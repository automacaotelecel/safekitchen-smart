import {
  ImageEncoder,
  LabelType as NiimbotLabelType,
  NiimbotBluetoothClient,
  PacketGenerator,
  PrinterModel,
  type PrinterModelMeta,
} from '@mmote/niimbluelib';

import type { Label, LabelExtraData, LabelType } from '../types';

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
  model: string;
  pages: number;
};

const B21_MODELS = new Set<PrinterModel>([
  PrinterModel.B21,
  PrinterModel.B21_PRO,
  PrinterModel.B21_C2B,
  PrinterModel.B21_L2B,
  PrinterModel.B21S,
  PrinterModel.B21S_C2B,
]);

const MAX_DIRECT_PAGES = 100;
let bluetoothClient: NiimbotBluetoothClient | null = null;
let directPrintInProgress = false;

function client() {
  bluetoothClient ??= new NiimbotBluetoothClient();
  return bluetoothClient;
}

export function getDirectPrintSupport() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, reason: 'Bluetooth indisponível neste ambiente.' };
  }

  if (String(import.meta.env.VITE_NIIMBOT_DIRECT_PRINT || 'true') === 'false') {
    return {
      supported: false,
      reason: 'A impressão Bluetooth direta foi desativada nesta instalação.',
    };
  }

  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: 'A impressão Bluetooth exige acesso por HTTPS.',
    };
  }

  if (!navigator.bluetooth) {
    return {
      supported: false,
      reason:
        'Este navegador não oferece impressão Bluetooth direta. Use Chrome ou Edge compatível, ou utilize o PDF térmico.',
    };
  }

  return { supported: true, reason: '' };
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
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(value: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function formatTemperature(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toLocaleString('pt-BR')} °C` : String(value);
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  if (context.measureText(text).width <= maxWidth) return text;

  let result = text;
  while (result.length > 1 && context.measureText(`${result}…`).width > maxWidth) {
    result = result.slice(0, -1);
  }

  return `${result}…`;
}

function renderLabelCanvas(label: Label, metadata: PrinterModelMeta) {
  const width = metadata.printheadPixels;
  const height = Math.round((metadata.dpi * 30) / 25.4);
  const scale = width / 384;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('O navegador não conseguiu preparar a etiqueta.');

  const px = (value: number) => Math.max(1, Math.round(value * scale));
  const extra = parseExtraData(label);

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#000000';
  context.fillRect(0, 0, width, px(34));

  context.textBaseline = 'middle';
  context.textAlign = 'left';
  context.fillStyle = '#ffffff';
  context.font = `700 ${px(13)}px Arial, sans-serif`;
  context.fillText(
    fitText(context, typeName(label.type), width - px(24)),
    px(12),
    px(17)
  );

  context.fillStyle = '#000000';
  context.textAlign = 'center';
  context.font = `900 ${px(25)}px Arial, sans-serif`;
  context.fillText(
    fitText(context, label.productName || 'Produto', width - px(24)),
    width / 2,
    px(57)
  );

  context.strokeStyle = '#000000';
  context.lineWidth = px(1);
  context.beginPath();
  context.moveTo(px(10), px(76));
  context.lineTo(width - px(10), px(76));
  context.stroke();

  const receivingTemperature = formatTemperature(extra.receivingTemperatureC);
  const rows: Array<[string, string]> =
    label.type === 'ARMAZENAMENTO_CARNES'
      ? [
          ['Recebimento', formatDate(extra.receiptDate)],
          ['Temperatura', receivingTemperature || 'Não registrada'],
          ['Validade', formatDateTime(label.expiresAt)],
          ['Responsável', label.responsibleName || '—'],
        ]
      : [
          [label.type === 'AMOSTRAS' ? 'Coleta' : 'Data base', formatDateTime(label.openedAt)],
          [label.type === 'AMOSTRAS' ? 'Descarte' : 'Validade', formatDateTime(label.expiresAt)],
          ['Responsável', label.responsibleName || '—'],
          ['Conservação', conservationName(label.conservationMode)],
        ];

  const columnWidth = (width - px(30)) / 2;
  rows.forEach(([title, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = px(10) + column * (columnWidth + px(10));
    const y = px(88 + row * 55);

    context.textAlign = 'left';
    context.fillStyle = '#000000';
    context.font = `700 ${px(11)}px Arial, sans-serif`;
    context.fillText(fitText(context, title, columnWidth), x, y);
    context.font = `500 ${px(14)}px Arial, sans-serif`;
    context.fillText(fitText(context, value, columnWidth), x, y + px(18));
  });

  const detailParts = [
    label.batch ? `Lote ${label.batch}` : '',
    label.quantity || '',
    label.brand || '',
  ].filter(Boolean);

  context.beginPath();
  context.moveTo(px(10), height - px(31));
  context.lineTo(width - px(10), height - px(31));
  context.stroke();

  context.textAlign = 'left';
  context.font = `600 ${px(9)}px Arial, sans-serif`;
  context.fillText(
    fitText(context, detailParts.join(' • ') || 'SafeKitchen Smart', width - px(100)),
    px(10),
    height - px(17)
  );
  context.textAlign = 'right';
  context.font = `500 ${px(8)}px Arial, sans-serif`;
  context.fillText(label.id.slice(-10), width - px(10), height - px(17));

  return canvas;
}

function directPrintError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotFoundError') {
      return new Error('Seleção da impressora cancelada. Nenhuma etiqueta foi enviada.');
    }

    if (error.name === 'SecurityError') {
      return new Error('O navegador bloqueou o Bluetooth. Abra o sistema por HTTPS e tente novamente.');
    }

    if (error.name === 'NetworkError') {
      return new Error(
        'Não foi possível conectar à B21. Ligue a impressora, aproxime-a e feche o aplicativo NIIMBOT antes de tentar novamente.'
      );
    }
  }

  const message = error instanceof Error ? error.message : String(error || '');
  if (/gatt|channel|characteristic|disconnect/i.test(message)) {
    return new Error(
      'A conexão Bluetooth com a B21 foi interrompida. Feche o aplicativo NIIMBOT, reinicie a impressora e tente novamente.'
    );
  }

  if (/paper|lack|label/i.test(message)) {
    return new Error('A B21 informou um problema com a etiqueta ou falta de papel.');
  }

  return new Error(message || 'Não foi possível imprimir diretamente na B21.');
}

export async function printDirectToNiimbot(
  labels: Label[],
  onProgress?: (progress: DirectPrintProgress) => void
): Promise<DirectPrintResult> {
  const support = getDirectPrintSupport();
  if (!support.supported) throw new Error(support.reason);
  if (!labels.length) throw new Error('Nenhuma etiqueta foi selecionada.');
  if (labels.length > MAX_DIRECT_PAGES) {
    throw new Error(`Imprima no máximo ${MAX_DIRECT_PAGES} etiquetas por lote Bluetooth.`);
  }
  if (directPrintInProgress) {
    throw new Error('Já existe uma impressão em andamento. Aguarde a B21 concluir.');
  }

  const printer = client();
  let printTask: ReturnType<typeof printer.abstraction.newPrintTask> | null = null;
  let b21PrintStarted = false;
  let finished = false;
  directPrintInProgress = true;

  try {
    onProgress?.({
      stage: 'connecting',
      message: 'Selecione a NIIMBOT B21 na janela do Bluetooth…',
    });

    const connection = printer.isConnected()
      ? { deviceName: 'NIIMBOT B21' }
      : await printer.connect();

    let metadata = printer.getModelMetadata();
    if (!metadata) {
      await printer.fetchPrinterInfo();
      metadata = printer.getModelMetadata();
    }

    if (!metadata || !B21_MODELS.has(metadata.model)) {
      const detected = metadata?.model || 'desconhecido';
      throw new Error(`Impressora ${detected} detectada. Este perfil foi validado para a família B21.`);
    }

    const detectedTaskName = printer.getPrintTaskType();
    if (!detectedTaskName) {
      throw new Error(`O protocolo da ${metadata.model} não foi reconhecido.`);
    }

    // Alguns firmwares B21 mantêm a última quantidade usada pela impressora.
    // O perfil B21_V1 da biblioteca não transmite a quantidade, o que pode
    // fazer uma solicitação de 1 etiqueta repetir a quantidade anterior.
    // Mantemos exatamente a codificação de imagem da B21_V1 e acrescentamos
    // somente PrintQuantity(1) depois do tamanho de cada página.
    const useSingleCopyB21Profile = detectedTaskName === 'B21_V1';

    onProgress?.({
      stage: 'preparing',
      message: `Preparando ${labels.length} etiqueta(s) para ${metadata.model}…`,
      total: labels.length,
    });

    if (useSingleCopyB21Profile) {
      await printer.abstraction.sendAll([
        PacketGenerator.setDensity(metadata.densityDefault),
        PacketGenerator.setLabelType(NiimbotLabelType.WithGaps),
        PacketGenerator.printStart1b(),
      ]);
      b21PrintStarted = true;
    } else {
      printTask = printer.abstraction.newPrintTask(detectedTaskName, {
        totalPages: labels.length,
        density: metadata.densityDefault,
        labelType: NiimbotLabelType.WithGaps,
        statusTimeoutMs: Math.max(15_000, labels.length * 5_000),
        pageTimeoutMs: 15_000,
      });

      await printTask.printInit();
    }

    for (let index = 0; index < labels.length; index += 1) {
      onProgress?.({
        stage: 'printing',
        message: `Enviando etiqueta ${index + 1} de ${labels.length}…`,
        current: index + 1,
        total: labels.length,
      });

      const canvas = renderLabelCanvas(labels[index], metadata);
      const image = ImageEncoder.encodeCanvas(canvas, metadata.printDirection);

      if (useSingleCopyB21Profile) {
        await printer.abstraction.sendAll(
          [
            PacketGenerator.pageStart(),
            PacketGenerator.setPageSize4b(image.rows, image.cols),
            PacketGenerator.setPrintQuantity(1),
            ...PacketGenerator.writeImageData(image, {
              countsMode: 'total',
              enableCheckLine: true,
              printheadPixels: metadata.printheadPixels,
            }),
            PacketGenerator.pageEnd(),
          ],
          15_000
        );
      } else if (printTask) {
        await printTask.printPage(image, 1);
        await printTask.waitForPageFinished();
      }
    }

    onProgress?.({
      stage: 'finishing',
      message: 'Aguardando a B21 concluir a impressão…',
      current: labels.length,
      total: labels.length,
    });

    if (useSingleCopyB21Profile) {
      // A B21 confirma a conclusão aceitando PrintEnd. Esse é o mesmo método
      // de finalização do perfil B21_V1 original.
      await printer.abstraction.waitUntilPrintFinishedByPrintEndPoll(labels.length, 300);
    } else if (printTask) {
      await printTask.waitForFinished();
      await printTask.printEnd();
    }

    finished = true;

    const result = {
      deviceName: connection.deviceName || metadata.model,
      model: metadata.model,
      pages: labels.length,
    };

    onProgress?.({
      stage: 'done',
      message: `${labels.length} etiqueta(s) enviada(s) para ${result.deviceName}.`,
      current: labels.length,
      total: labels.length,
    });

    return result;
  } catch (error) {
    if (b21PrintStarted && !finished) {
      await printer.abstraction.printEnd().catch(() => undefined);
    } else if (printTask && !finished) {
      await printTask.printEnd().catch(() => undefined);
    }
    throw directPrintError(error);
  } finally {
    await printer.disconnect().catch(() => undefined);
    directPrintInProgress = false;
  }
}

export async function disconnectNiimbot() {
  if (!bluetoothClient) return;
  await bluetoothClient.disconnect();
}
