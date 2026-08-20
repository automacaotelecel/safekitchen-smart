import PDFDocument from 'pdfkit';

type LabelLike = {
  id: string;
  type?: string | null;
  productName?: string | null;
  brand?: string | null;
  supplier?: string | null;
  batch?: string | null;
  conservationMode?: string | null;
  openedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  quantity?: string | null;
  responsibleName?: string | null;
  observations?: string | null;
  extraData?: string | Record<string, unknown> | null;
  status?: string | null;
  createdAt?: Date | string | null;
};

function brDate(value?: Date | string | null) {
  if (!value) return '—';

  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function brDateTime(value?: Date | string | null) {
  if (!value) return '—';

  const date = value instanceof Date ? value : new Date(value);

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

function labelDateTitle(type?: string | null) {
  const map: Record<string, string> = {
    PRODUTO_ABERTO: 'Data de abertura',
    PRODUCAO: 'Data de produção',
    DESCONGELAMENTO_DESSALGUE: 'Data de início',
    ARMAZENAMENTO_CARNES: 'Data de recebimento',
    REEMBALAGEM: 'Data de reembalagem',
    AMOSTRAS: 'Data da coleta',
    NAO_CONFORME: 'Data de identificação',
    PRODUTO_QUIMICO: 'Data de preparo',
  };

  return map[type || ''] || 'Data';
}

function labelTypeName(type?: string | null) {
  const map: Record<string, string> = {
    PRODUTO_ABERTO: 'Produto aberto',
    PRODUCAO: 'Produção',
    DESCONGELAMENTO_DESSALGUE: 'Descongelamento/dessalgue',
    ARMAZENAMENTO_CARNES: 'Armazenamento de carnes',
    REEMBALAGEM: 'Reembalagem',
    AMOSTRAS: 'Amostras',
    NAO_CONFORME: 'Produto não conforme',
    PRODUTO_QUIMICO: 'Produto químico',
  };

  return map[type || ''] || type || 'Etiqueta';
}

function conservationName(mode?: string | null) {
  const map: Record<string, string> = {
    AMBIENTE: 'Temperatura ambiente',
    REFRIGERADO: 'Refrigerado',
    CONGELADO: 'Congelado',
  };

  return map[mode || ''] || mode || '—';
}

function normalizeExtraData(extraData?: string | Record<string, unknown> | null) {
  if (!extraData) return {};

  if (typeof extraData === 'object') {
    return extraData;
  }

  try {
    const parsed = JSON.parse(extraData);

    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }

    return {};
  } catch {
    return {};
  }
}

function asText(value: unknown) {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  return String(value);
}

function collectExtraRows(label: LabelLike) {
  const extra = normalizeExtraData(label.extraData);
  const rows: Array<[string, string]> = [];

  const push = (
    title: string,
    key: string,
    formatter: (value: unknown) => string = asText
  ) => {
    const value = extra[key];

    if (value !== null && value !== undefined && asText(value).trim()) {
      rows.push([title, formatter(value)]);
    }
  };

  const dateValue = (value: unknown) => brDate(asText(value));

  push('Restaurante', 'restaurantName');
  push('Data da coleta', 'collectionDate', dateValue);
  push('Hora da coleta', 'collectionTime');

  push('Finalidade', 'chemicalPurpose');
  push('Diluição (ml)', 'dilutionMl');
  push('Diluição (litros)', 'dilutionLiters');
  push('Data preparo', 'preparationDate', dateValue);
  push('Hora preparo', 'preparationTime');
  push('Validade química', 'chemicalValidity', dateValue);

  push('Não conformidade', 'nonConformityReasons');
  push('Outro motivo', 'otherNonConformity');
  push('Data identificação', 'identificationDate', dateValue);
  push('Ação tomada', 'actionTaken');

  push('Método', 'thawingMethod');
  push('Data início', 'startDate', dateValue);
  push('Hora início', 'startTime');

  if (label.type === 'ARMAZENAMENTO_CARNES') {
    push('Tipo de carne', 'meatType');
    push('MAPA/SIF', 'mapaSif');
    push(
      'Temperatura receb.',
      'receivingTemperatureC',
      (value) => `${asText(value)} °C`
    );
    push('Armazenamento', 'storageType');
  }

  push('Data reembalagem', 'repackagingDate', dateValue);
  push('Validade original', 'originalValidity', dateValue);
  push('Nova validade', 'newValidity', dateValue);

  return rows;
}

function drawLabel(doc: PDFKit.PDFDocument, label: LabelLike, x: number, y: number) {
  const width = 255;
  const height = 165;

  const status = label.status || 'ATIVA';
  const canceled = status === 'CANCELADA';

  doc
    .roundedRect(x, y, width, height, 10)
    .lineWidth(1.2)
    .strokeColor(canceled ? '#9ca3af' : '#10b981')
    .fillColor('#ffffff')
    .fillAndStroke('#ffffff', canceled ? '#9ca3af' : '#10b981');

  doc
    .roundedRect(x, y, width, 30, 10)
    .fillColor(canceled ? '#6b7280' : '#0f766e')
    .fill();

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(labelTypeName(label.type).toUpperCase(), x + 10, y + 8, {
      width: width - 20,
      align: 'center',
    });

  doc
    .fillColor('#111827')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(label.productName || 'PRODUTO', x + 10, y + 40, {
      width: width - 20,
      align: 'center',
      ellipsis: true,
    });

  let rowY = y + 63;

  function row(title: string, value?: string | null) {
    if (rowY > y + height - 24) return;

    doc
      .font('Helvetica-Bold')
      .fontSize(6.8)
      .fillColor('#374151')
      .text(`${title}:`, x + 10, rowY, {
        width: 70,
        continued: false,
      });

    doc
      .font('Helvetica')
      .fontSize(6.8)
      .fillColor('#111827')
      .text(value || '—', x + 78, rowY, {
        width: width - 88,
        ellipsis: true,
      });

    rowY += 10.5;
  }

  row('Conservação', conservationName(label.conservationMode));

  if (label.type === 'AMOSTRAS') {
    row('Data da coleta', brDateTime(label.openedAt));
    row('Descarte', brDateTime(label.expiresAt));
  } else if (label.type === 'REEMBALAGEM') {
    row('Data de reembalagem', brDateTime(label.openedAt));
    row('Nova validade', brDateTime(label.expiresAt));
  } else if (label.type === 'DESCONGELAMENTO_DESSALGUE') {
    row('Data de início', brDateTime(label.openedAt));
    row('Validade', brDateTime(label.expiresAt));
  } else if (label.type === 'ARMAZENAMENTO_CARNES') {
    const extra = normalizeExtraData(label.extraData);
    row('Data de recebimento', brDate(asText(extra.receiptDate)));
    row('Validade', brDateTime(label.expiresAt));
  } else {
    row(labelDateTitle(label.type), brDateTime(label.openedAt));
    row('Validade', brDateTime(label.expiresAt));
  }

  row('Responsável', label.responsibleName || '—');
  row('Lote', label.batch || '—');

  if (label.quantity) row('Quantidade', label.quantity);
  if (label.brand) row('Marca', label.brand);
  if (label.supplier) row('Fornecedor', label.supplier);

  const extraRows = collectExtraRows(label);
  extraRows.slice(0, 3).forEach(([title, value]) => row(title, value));

  if (label.observations && rowY <= y + height - 24) {
    doc
      .font('Helvetica-Bold')
      .fontSize(6.8)
      .fillColor('#374151')
      .text('Obs.:', x + 10, rowY);

    doc
      .font('Helvetica')
      .fontSize(6.5)
      .fillColor('#111827')
      .text(label.observations, x + 38, rowY, {
        width: width - 48,
        height: 22,
        ellipsis: true,
      });
  }

  if (canceled) {
    doc
      .save()
      .rotate(-18, {
        origin: [x + width / 2, y + height / 2],
      })
      .font('Helvetica-Bold')
      .fontSize(28)
      .fillColor('#ef4444')
      .opacity(0.18)
      .text('CANCELADA', x + 30, y + 78, {
        width: width - 60,
        align: 'center',
      })
      .opacity(1)
      .restore();
  }

  doc
    .font('Helvetica')
    .fontSize(5.8)
    .fillColor('#6b7280')
    .text(`ID: ${label.id}`, x + 10, y + height - 13, {
      width: width - 20,
      align: 'center',
    });
}

function createPdfBuffer(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 28,
      bufferPages: true,
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', reject);

    draw(doc);

    doc.end();
  });
}

const MILLIMETER_IN_POINTS = 72 / 25.4;
const TOMATE_LABEL_WIDTH = 102 * MILLIMETER_IN_POINTS;
const TOMATE_LABEL_HEIGHT = 152 * MILLIMETER_IN_POINTS;

function drawThermalLabel(doc: PDFKit.PDFDocument, label: LabelLike) {
  const margin = 12;
  const contentWidth = TOMATE_LABEL_WIDTH - margin * 2;
  const canceled = label.status === 'CANCELADA';
  const extra = normalizeExtraData(label.extraData);
  const receivingTemperature = asText(extra.receivingTemperatureC).trim();
  const primaryDate =
    label.type === 'ARMAZENAMENTO_CARNES' && asText(extra.receiptDate).trim()
      ? brDate(asText(extra.receiptDate))
      : brDateTime(label.openedAt);

  doc
    .rect(0, 0, TOMATE_LABEL_WIDTH, TOMATE_LABEL_HEIGHT)
    .fillColor('#ffffff')
    .fill();

  doc
    .roundedRect(margin, margin, contentWidth, TOMATE_LABEL_HEIGHT - margin * 2, 5)
    .lineWidth(1.2)
    .strokeColor('#111111')
    .stroke();

  doc
    .rect(margin, margin, contentWidth, 38)
    .fillColor('#111111')
    .fill();

  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor('#ffffff')
    .text(labelTypeName(label.type).toUpperCase(), margin + 8, margin + 13, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#000000')
    .text(label.productName || 'PRODUTO', margin + 8, margin + 52, {
      width: contentWidth - 16,
      height: 48,
      align: 'center',
      ellipsis: true,
    });

  doc
    .moveTo(margin + 8, margin + 106)
    .lineTo(TOMATE_LABEL_WIDTH - margin - 8, margin + 106)
    .lineWidth(1)
    .strokeColor('#111111')
    .stroke();

  const rows: Array<[string, string]> = [
    [labelDateTitle(label.type), primaryDate],
    [label.type === 'AMOSTRAS' ? 'Descarte' : 'Validade', brDateTime(label.expiresAt)],
    ['Responsável', label.responsibleName || '—'],
    ['Conservação', conservationName(label.conservationMode)],
  ];

  const push = (title: string, value?: string | null) => {
    if (value && value.trim()) rows.push([title, value.trim()]);
  };

  if (label.type === 'ARMAZENAMENTO_CARNES' && receivingTemperature) {
    push('Temperatura', `${receivingTemperature} °C`);
  }

  push('Lote', label.batch);
  push('Quantidade', label.quantity);
  push('Marca', label.brand);
  push('Fornecedor', label.supplier);
  collectExtraRows(label).forEach(([title, value]) => push(title, value));
  push('Observações', label.observations);

  const visibleRows = rows.slice(0, 11);
  const rowsTop = margin + 118;
  const footerTop = TOMATE_LABEL_HEIGHT - margin - 30;
  const rowHeight = Math.min(24, (footerTop - rowsTop) / Math.max(visibleRows.length, 1));
  const titleWidth = 91;

  visibleRows.forEach(([title, value], index) => {
    const y = rowsTop + index * rowHeight;

    if (index > 0) {
      doc
        .moveTo(margin + 8, y)
        .lineTo(TOMATE_LABEL_WIDTH - margin - 8, y)
        .lineWidth(0.35)
        .strokeColor('#b8b8b8')
        .stroke();
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#111111')
      .text(`${title}:`, margin + 8, y + 7, {
        width: titleWidth,
        lineBreak: false,
        ellipsis: true,
      });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#111111')
      .text(value || '—', margin + 8 + titleWidth, y + 7, {
        width: contentWidth - titleWidth - 24,
        align: 'right',
        lineBreak: false,
        ellipsis: true,
      });
  });

  doc
    .moveTo(margin + 8, footerTop)
    .lineTo(TOMATE_LABEL_WIDTH - margin - 8, footerTop)
    .lineWidth(0.6)
    .dash(2, { space: 2 })
    .strokeColor('#555555')
    .stroke()
    .undash();

  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor('#444444')
    .text(`SafeKitchen Smart - ${label.id}`, margin + 8, footerTop + 10, {
      width: contentWidth - 16,
      align: 'center',
      lineBreak: false,
      ellipsis: true,
    });

  if (canceled) {
    doc
      .save()
      .rotate(-20, { origin: [TOMATE_LABEL_WIDTH / 2, TOMATE_LABEL_HEIGHT / 2] })
      .font('Helvetica-Bold')
      .fontSize(42)
      .fillColor('#000000')
      .opacity(0.18)
      .text('CANCELADA', 24, TOMATE_LABEL_HEIGHT / 2 - 24, {
        width: TOMATE_LABEL_WIDTH - 48,
        align: 'center',
      })
      .opacity(1)
      .restore();
  }
}

function createThermalPdfBuffer(labels: LabelLike[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [TOMATE_LABEL_WIDTH, TOMATE_LABEL_HEIGHT],
      margin: 0,
      bufferPages: true,
      autoFirstPage: false,
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const label of labels) {
      doc.addPage({
        size: [TOMATE_LABEL_WIDTH, TOMATE_LABEL_HEIGHT],
        margin: 0,
      });
      drawThermalLabel(doc, label);
    }

    doc.end();
  });
}

export async function generateLabelPdf(label: LabelLike): Promise<Buffer> {
  return createThermalPdfBuffer([label]);
}

export async function generateBatchLabelsPdf(labels: LabelLike[]): Promise<Buffer> {
  return createThermalPdfBuffer(labels);
}
