import type { Label, LabelExtraData, LabelType } from '../types';
import { labelBaseDateName } from './labels';

export type DirectPrintStage =
  | 'connecting'
  | 'preparing'
  | 'printing'
  | 'finishing'
  | 'done';

export type DirectPrintProgress = {
  stage: DirectPrintStage;
  message: string;
  current?: number;
  total?: number;
};

export type DirectPrintResult = {
  deviceName: string;
  model: 'MDK-022';
  pages: number;
  transport: 'Bluetooth BLE' | 'Bluetooth/USB serial';
};

type DirectTransport = 'ble' | 'serial';

type SerialPortInfo = {
  usbVendorId?: number;
  usbProductId?: number;
  bluetoothServiceClassId?: number | string;
};

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'odd';
    bufferSize?: number;
    flowControl?: 'none' | 'hardware';
  }): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
};

type SerialApi = {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(options?: {
    allowedBluetoothServiceClassIds?: Array<number | string>;
  }): Promise<SerialPortLike>;
};

const MODEL = 'MDK-022' as const;
const LABEL_WIDTH_MM = 102;
const LABEL_HEIGHT_MM = 152;
const configuredGap = Number(import.meta.env.VITE_TOMATE_LABEL_GAP_MM ?? 3);
const LABEL_GAP_MM =
  Number.isFinite(configuredGap) && configuredGap >= 0.5 && configuredGap <= 10
    ? configuredGap
    : 3;
const DOTS_PER_MM = 8;
const LABEL_WIDTH_DOTS = LABEL_WIDTH_MM * DOTS_PER_MM;
const LABEL_HEIGHT_DOTS = LABEL_HEIGHT_MM * DOTS_PER_MM;
const MAX_DIRECT_PAGES = 30;
const FEASYCOM_SERVICE_UUID = 0xfff0;
const BUILD_ID = 'MDK022-2026-08-20-01';

// A foto de autodiagnóstico informa BLE e SPP. FFF0/FFF2 é o perfil transparente
// padrão documentado pela Feasycom; os UUIDs adicionais cobrem outros módulos
// seriais comuns sem relaxar o filtro para dispositivos Bluetooth não relacionados.
const BLE_SERVICE_UUIDS: BluetoothServiceUUID[] = [
  FEASYCOM_SERVICE_UUID,
  0xffe0,
  0xff00,
  0x18f0,
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

let activeJob = false;
let jobSequence = 0;
let serialPort: SerialPortLike | null = null;
let bleDevice: BluetoothDevice | null = null;
let bleCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let bleChunkSize: number | null = null;

export const TOMATE_PRINT_BUILD = BUILD_ID;

function serialApi() {
  return (navigator as Navigator & { serial?: SerialApi }).serial;
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function directPrintEnabled() {
  const configured =
    import.meta.env.VITE_TOMATE_DIRECT_PRINT ??
    import.meta.env.VITE_NIIMBOT_DIRECT_PRINT ??
    'true';

  return String(configured).toLowerCase() !== 'false';
}

export function getDirectPrintSupport() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      supported: false,
      reason: 'Impressão direta indisponível neste ambiente.',
      preferredTransport: undefined as DirectTransport | undefined,
    };
  }

  if (!directPrintEnabled()) {
    return {
      supported: false,
      reason: 'A impressão direta foi desativada nesta instalação.',
      preferredTransport: undefined as DirectTransport | undefined,
    };
  }

  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: 'A impressão direta exige HTTPS ou localhost.',
      preferredTransport: undefined as DirectTransport | undefined,
    };
  }

  const hasBle = Boolean(navigator.bluetooth);
  const hasSerial = Boolean(serialApi());

  if (!hasBle && !hasSerial) {
    return {
      supported: false,
      reason:
        'Este navegador não oferece Bluetooth BLE nem porta serial. Use Chrome/Edge compatível ou o PDF térmico.',
      preferredTransport: undefined as DirectTransport | undefined,
    };
  }

  return {
    supported: true,
    reason: '',
    preferredTransport: hasSerial && !isMobileDevice() ? ('serial' as const) : ('ble' as const),
  };
}

function parseExtraData(label: Label): LabelExtraData {
  if (!label.extraData) return {};
  if (typeof label.extraData === 'object') return label.extraData;

  try {
    const parsed = JSON.parse(label.extraData);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function typeName(type: LabelType) {
  const names: Record<LabelType, string> = {
    PRODUTO_ABERTO: 'PRODUTO ABERTO',
    PRODUCAO: 'PRODUÇÃO',
    DESCONGELAMENTO_DESSALGUE: 'DESCONGELAMENTO / DESSALGUE',
    ARMAZENAMENTO_CARNES: 'ARMAZENAMENTO DE CARNES',
    REEMBALAGEM: 'REEMBALAGEM',
    AMOSTRAS: 'AMOSTRA',
    NAO_CONFORME: 'NÃO CONFORME',
    PRODUTO_QUIMICO: 'PRODUTO QUÍMICO',
  };

  return names[type] || 'ETIQUETA';
}

function conservationName(value?: string | null) {
  const names: Record<string, string> = {
    AMBIENTE: 'Ambiente',
    REFRIGERADO: 'Refrigerado',
    CONGELADO: 'Congelado',
  };

  return names[value || ''] || value || '—';
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const raw = String(value);
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTemperature(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toLocaleString('pt-BR')} °C` : String(value);
}

function asText(value: unknown) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value);
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;

  let result = text;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }

  return `${result}…`;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || context.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;

    if (lines.length === maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);

  const consumed = lines.join(' ').length;
  if (consumed < text.trim().length && lines.length) {
    lines[lines.length - 1] = fitText(context, `${lines[lines.length - 1]}…`, maxWidth);
  }

  return lines.length ? lines : ['PRODUTO'];
}

function collectRows(label: Label): Array<[string, string]> {
  const extra = parseExtraData(label);
  const rows: Array<[string, string]> = [
    [labelBaseDateName(label.type), formatDateTime(label.openedAt)],
    [label.type === 'AMOSTRAS' ? 'Descarte' : 'Validade', formatDateTime(label.expiresAt)],
    ['Responsável', label.responsibleName || '—'],
    ['Conservação', conservationName(label.conservationMode)],
  ];

  const push = (title: string, value: unknown) => {
    const text = asText(value).trim();
    if (text) rows.push([title, text]);
  };

  if (label.type === 'ARMAZENAMENTO_CARNES') {
    push('Tipo de carne', extra.meatType);
    push('MAPA/SIF', extra.mapaSif);
    push('Recebimento', formatDate(extra.receiptDate));
    push('Temperatura', formatTemperature(extra.receivingTemperatureC));
    push('Armazenamento', extra.storageType);
  }

  if (label.type === 'AMOSTRAS') {
    push('Restaurante', extra.restaurantName);
    push('Turno', extra.sampleShift);
    push(
      'Coleta',
      `${formatDate(extra.collectionDate)} ${asText(extra.collectionTime)}`.trim()
    );
  }

  if (label.type === 'PRODUTO_QUIMICO') {
    push('Finalidade', extra.chemicalPurpose);
    push('Diluição', [extra.dilutionMl, extra.dilutionLiters].filter(Boolean).join(' / '));
    push('Validade química', formatDate(extra.chemicalValidity));
  }

  if (label.type === 'NAO_CONFORME') {
    push('Não conformidade', extra.nonConformityReasons);
    push('Ação tomada', extra.actionTaken);
  }

  if (label.type === 'DESCONGELAMENTO_DESSALGUE') {
    push('Método', extra.thawingMethod);
  }

  push('Marca', label.brand);
  push('Fornecedor', label.supplier);
  push('Lote', label.batch);
  push('Quantidade', label.quantity);
  push('Observações', label.observations);

  return rows.slice(0, 11);
}

function renderLabelCanvas(label: Label) {
  const canvas = document.createElement('canvas');
  canvas.width = LABEL_WIDTH_DOTS;
  canvas.height = LABEL_HEIGHT_DOTS;

  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) throw new Error('O navegador não conseguiu preparar a etiqueta.');

  const margin = 28;
  const contentWidth = canvas.width - margin * 2;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#000000';
  context.lineWidth = 3;
  context.strokeRect(margin, margin, contentWidth, canvas.height - margin * 2);

  context.fillStyle = '#000000';
  context.fillRect(margin, margin, contentWidth, 82);
  context.fillStyle = '#ffffff';
  context.textBaseline = 'middle';
  context.textAlign = 'center';
  context.font = '700 25px Arial, sans-serif';
  context.fillText(fitText(context, typeName(label.type), contentWidth - 32), canvas.width / 2, 69);

  context.fillStyle = '#000000';
  context.font = '900 46px Arial, sans-serif';
  const titleLines = wrapText(context, label.productName || 'Produto', contentWidth - 56, 2);
  titleLines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, 142 + index * 52);
  });

  const dividerY = titleLines.length > 1 ? 216 : 190;
  context.beginPath();
  context.moveTo(margin + 20, dividerY);
  context.lineTo(canvas.width - margin - 20, dividerY);
  context.lineWidth = 3;
  context.stroke();

  const rows = collectRows(label);
  const rowsTop = dividerY + 18;
  const footerTop = canvas.height - 96;
  const rowHeight = Math.floor((footerTop - rowsTop) / Math.max(rows.length, 1));
  const titleWidth = 230;

  rows.forEach(([title, value], index) => {
    const top = rowsTop + index * rowHeight;
    const baseline = top + rowHeight / 2;

    if (index > 0) {
      context.beginPath();
      context.moveTo(margin + 18, top);
      context.lineTo(canvas.width - margin - 18, top);
      context.lineWidth = 1;
      context.strokeStyle = '#b0b0b0';
      context.stroke();
    }

    context.fillStyle = '#000000';
    context.textAlign = 'left';
    context.font = '700 23px Arial, sans-serif';
    context.fillText(fitText(context, title, titleWidth), margin + 24, baseline);
    context.textAlign = 'right';
    context.font = '600 25px Arial, sans-serif';
    context.fillText(
      fitText(context, value || '—', contentWidth - titleWidth - 68),
      canvas.width - margin - 24,
      baseline
    );
  });

  context.beginPath();
  context.moveTo(margin + 18, footerTop);
  context.lineTo(canvas.width - margin - 18, footerTop);
  context.lineWidth = 2;
  context.setLineDash([8, 6]);
  context.strokeStyle = '#000000';
  context.stroke();
  context.setLineDash([]);

  context.textAlign = 'left';
  context.font = '700 20px Arial, sans-serif';
  context.fillText('SafeKitchen Smart', margin + 24, canvas.height - 58);
  context.textAlign = 'right';
  context.font = '500 17px Arial, sans-serif';
  context.fillText(label.id, canvas.width - margin - 24, canvas.height - 58);

  if (label.status === 'CANCELADA') {
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(-Math.PI / 6);
    context.globalAlpha = 0.24;
    context.textAlign = 'center';
    context.font = '900 100px Arial, sans-serif';
    context.fillText('CANCELADA', 0, 0);
    context.restore();
  }

  return canvas;
}

function canvasToBitmap(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) throw new Error('Não foi possível ler a prévia da etiqueta.');

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const bytesPerRow = Math.ceil(canvas.width / 8);
  const bitmap = new Uint8Array(bytesPerRow * canvas.height);
  let darkPixels = 0;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const pixelIndex = (y * canvas.width + x) * 4;
      const luminance =
        data[pixelIndex] * 0.2126 +
        data[pixelIndex + 1] * 0.7152 +
        data[pixelIndex + 2] * 0.0722;

      if (luminance < 168) {
        bitmap[y * bytesPerRow + Math.floor(x / 8)] |= 0x80 >> (x % 8);
        darkPixels += 1;
      }
    }
  }

  if (darkPixels < 1_000) {
    throw new Error('A etiqueta ficou sem conteúdo e não foi enviada à impressora.');
  }

  return { bitmap, bytesPerRow, darkPixels };
}

function encodeAscii(value: string) {
  return new TextEncoder().encode(value);
}

function concatBytes(...parts: Uint8Array[]) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;

  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });

  return result;
}

function createTsplJob(canvas: HTMLCanvasElement) {
  const { bitmap, bytesPerRow, darkPixels } = canvasToBitmap(canvas);
  const setupCommands =
    [
      `SIZE ${LABEL_WIDTH_MM} mm,${LABEL_HEIGHT_MM} mm`,
      `GAP ${LABEL_GAP_MM} mm,0 mm`,
      'SPEED 5',
      'DENSITY 8',
      'DIRECTION 1,0',
      'REFERENCE 0,0',
      'CLS',
    ].join('\r\n') + '\r\n';
  const header = encodeAscii(
    `${setupCommands}BITMAP 0,0,${bytesPerRow},${LABEL_HEIGHT_DOTS},0,`
  );
  const footer = encodeAscii('\r\nPRINT 1,1\r\n');

  return {
    payload: concatBytes(header, bitmap, footer),
    darkPixels,
  };
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

async function findBleWriteCharacteristic(server: BluetoothRemoteGATTServer) {
  for (const serviceUuid of BLE_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const characteristics = await service.getCharacteristics();
      const writable =
        characteristics.find((item) => item.properties.writeWithoutResponse) ||
        characteristics.find((item) => item.properties.write);

      if (writable) return writable;
    } catch {
      // O módulo pode expor apenas um dos serviços opcionais autorizados.
    }
  }

  throw new Error(
    'A MDK-022 foi encontrada, mas o canal BLE de impressão FFF0/FFF2 não foi exposto. Use o Chrome/Edge no computador pelo Bluetooth SPP/USB ou o PDF térmico.'
  );
}

async function connectBle() {
  if (
    bleDevice?.gatt?.connected &&
    bleCharacteristic?.service.device.gatt?.connected
  ) {
    return bleCharacteristic;
  }

  bleDevice = await navigator.bluetooth.requestDevice({
    filters: [{ name: MODEL }, { namePrefix: 'MDK-022' }, { namePrefix: 'MDK' }],
    optionalServices: BLE_SERVICE_UUIDS,
  });

  const gatt = bleDevice.gatt;
  if (!gatt) {
    throw new Error('A impressora selecionada não disponibilizou conexão BLE.');
  }

  const selectedDevice = bleDevice;
  selectedDevice.addEventListener('gattserverdisconnected', () => {
    if (bleDevice === selectedDevice) {
      bleCharacteristic = null;
      bleChunkSize = null;
    }
  });

  const server = await gatt.connect();
  bleCharacteristic = await findBleWriteCharacteristic(server);
  bleChunkSize = null;
  return bleCharacteristic;
}

async function writeBleChunk(
  characteristic: BluetoothRemoteGATTCharacteristic,
  chunk: Uint8Array
) {
  const value = new ArrayBuffer(chunk.byteLength);
  new Uint8Array(value).set(chunk);

  if (characteristic.properties.writeWithoutResponse) {
    await characteristic.writeValueWithoutResponse(value);
    return;
  }

  await characteristic.writeValueWithResponse(value);
}

async function detectBleChunkSize(characteristic: BluetoothRemoteGATTCharacteristic) {
  if (bleChunkSize) return bleChunkSize;

  for (const size of [180, 120, 64, 20]) {
    try {
      const harmlessProbe = new Uint8Array(size);
      harmlessProbe.fill(0x0a);
      await writeBleChunk(characteristic, harmlessProbe);
      bleChunkSize = size;
      return size;
    } catch (error) {
      if (size === 20) throw error;
    }
  }

  return 20;
}

async function writeBle(payload: Uint8Array) {
  const characteristic = await connectBle();
  const chunkSize = await detectBleChunkSize(characteristic);

  for (let offset = 0, chunkIndex = 0; offset < payload.length; offset += chunkSize) {
    const chunk = payload.slice(offset, Math.min(offset + chunkSize, payload.length));
    await writeBleChunk(characteristic, chunk);
    chunkIndex += 1;

    if (characteristic.properties.writeWithoutResponse && chunkIndex % 12 === 0) {
      await sleep(4);
    }
  }
}

async function connectSerial() {
  const api = serialApi();
  if (!api) throw new Error('A porta serial não está disponível neste navegador.');

  if (serialPort?.writable) return serialPort;

  // Sem filtro, o Chrome mostra tanto USB quanto o perfil Bluetooth SPP já
  // emparelhado, que é exatamente o conjunto de interfaces da MDK-022.
  serialPort = await api.requestPort();

  await serialPort.open({
    baudRate: 115_200,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
    bufferSize: 1_048_576,
    flowControl: 'none',
  });

  return serialPort;
}

async function writeSerial(payload: Uint8Array) {
  const port = await connectSerial();
  if (!port.writable) throw new Error('A porta da impressora não está disponível para escrita.');

  const writer = port.writable.getWriter();

  try {
    const chunkSize = 16_384;
    for (let offset = 0; offset < payload.length; offset += chunkSize) {
      await writer.write(payload.slice(offset, Math.min(offset + chunkSize, payload.length)));
    }
  } finally {
    writer.releaseLock();
  }
}

function resolveTransport(): DirectTransport {
  const support = getDirectPrintSupport();
  if (!support.supported || !support.preferredTransport) {
    throw new Error(support.reason);
  }

  return support.preferredTransport;
}

function directPrintError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotFoundError') {
      return new Error('Seleção da impressora cancelada. Nenhuma etiqueta foi enviada.');
    }

    if (error.name === 'SecurityError') {
      return new Error('O navegador bloqueou o acesso à impressora. Abra o sistema por HTTPS.');
    }

    if (error.name === 'NetworkError') {
      return new Error(
        'Não foi possível conectar à Tomate MDK-022. Feche o Print-Label/BarTender, confirme que a impressora está ligada e tente novamente.'
      );
    }

    if (error.name === 'InvalidStateError') {
      return new Error(
        'A porta da MDK-022 já está em uso. Feche outros aplicativos de impressão e tente novamente.'
      );
    }
  }

  const message = error instanceof Error ? error.message : String(error || '');
  if (/gatt|channel|characteristic|disconnect|serial|port|network/i.test(message)) {
    return new Error(
      message ||
        'A conexão com a Tomate MDK-022 foi interrompida. Reinicie a impressora e tente novamente.'
    );
  }

  if (/paper|lack|label/i.test(message)) {
    return new Error('A MDK-022 informou falta de papel ou problema na mídia GAP.');
  }

  return new Error(message || 'Não foi possível imprimir diretamente na Tomate MDK-022.');
}

async function resetConnections() {
  if (bleDevice?.gatt?.connected) bleDevice.gatt.disconnect();
  bleCharacteristic = null;
  bleChunkSize = null;

  if (serialPort) {
    await serialPort.close().catch(() => undefined);
    serialPort = null;
  }
}

export async function printDirectToTomate(
  labels: Label[],
  onProgress?: (progress: DirectPrintProgress) => void
): Promise<DirectPrintResult> {
  const support = getDirectPrintSupport();
  if (!support.supported) throw new Error(support.reason);
  if (!labels.length) throw new Error('Nenhuma etiqueta foi selecionada.');
  if (labels.length > MAX_DIRECT_PAGES) {
    throw new Error(`Imprima no máximo ${MAX_DIRECT_PAGES} etiquetas por lote direto.`);
  }
  if (activeJob) throw new Error('Já existe um trabalho de impressão em andamento.');

  activeJob = true;
  const jobId = `${Date.now().toString(36)}-${++jobSequence}`;
  const frozenLabels = [...labels];
  const transport = resolveTransport();

  try {
    console.info(`[PRINT ${jobId}] clique recebido; etiquetas=${frozenLabels.length}`);
    onProgress?.({
      stage: 'connecting',
      message:
        transport === 'serial'
          ? 'Selecione a porta da Tomate MDK-022 (Bluetooth ou USB)…'
          : 'Selecione a Tomate MDK-022 na janela do Bluetooth…',
      total: frozenLabels.length,
    });

    if (transport === 'serial') await connectSerial();
    else await connectBle();

    onProgress?.({
      stage: 'preparing',
      message: `Preparando ${frozenLabels.length} etiqueta(s) TSPL em 102 × 152 mm…`,
      total: frozenLabels.length,
    });

    for (let index = 0; index < frozenLabels.length; index += 1) {
      const canvas = renderLabelCanvas(frozenLabels[index]);
      const { payload, darkPixels } = createTsplJob(canvas);

      console.info(
        `[PRINT ${jobId}] página=${index + 1}/${frozenLabels.length}; canvas=${canvas.width}x${canvas.height}; gap=${LABEL_GAP_MM}mm; pixelsEscuros=${darkPixels}; bytes=${payload.length}; PRINT=1,1`
      );
      onProgress?.({
        stage: 'printing',
        message: `Enviando etiqueta ${index + 1} de ${frozenLabels.length} para a MDK-022…`,
        current: index + 1,
        total: frozenLabels.length,
      });

      if (transport === 'serial') await writeSerial(payload);
      else await writeBle(payload);

      // 152 mm a 130 mm/s leva aproximadamente 1,2 s. A pausa impede que um
      // novo CLS/BITMAP alcance o buffer antes da etiqueta atual terminar.
      await sleep(1_350);
    }

    onProgress?.({
      stage: 'finishing',
      message: 'Aguardando a MDK-022 concluir o último avanço…',
      current: frozenLabels.length,
      total: frozenLabels.length,
    });
    await sleep(500);

    const result: DirectPrintResult = {
      deviceName: bleDevice?.name || MODEL,
      model: MODEL,
      pages: frozenLabels.length,
      transport: transport === 'serial' ? 'Bluetooth/USB serial' : 'Bluetooth BLE',
    };

    console.info(`[PRINT ${jobId}] trabalho concluído; páginas=${result.pages}`);
    onProgress?.({
      stage: 'done',
      message: `${result.pages} etiqueta(s) enviada(s) para ${result.deviceName}.`,
      current: result.pages,
      total: result.pages,
    });

    return result;
  } catch (error) {
    console.error(`[PRINT ${jobId}] falha`, error);
    await resetConnections();
    throw directPrintError(error);
  } finally {
    activeJob = false;
  }
}

export async function disconnectTomate() {
  if (activeJob) throw new Error('Aguarde a impressão terminar antes de desconectar.');
  await resetConnections();
}
