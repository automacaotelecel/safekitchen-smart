"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLabelPdf = generateLabelPdf;
exports.generateBatchLabelsPdf = generateBatchLabelsPdf;
const pdfkit_1 = __importDefault(require("pdfkit"));
function brDate(value) {
    if (!value)
        return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return '—';
    return date.toLocaleDateString('pt-BR');
}
function brDateTime(value) {
    if (!value)
        return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return '—';
    return date.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
}
function labelTypeName(type) {
    const map = {
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
function conservationName(mode) {
    const map = {
        AMBIENTE: 'Temperatura ambiente',
        REFRIGERADO: 'Refrigerado',
        CONGELADO: 'Congelado',
    };
    return map[mode || ''] || mode || '—';
}
function normalizeExtraData(extraData) {
    if (!extraData)
        return {};
    if (typeof extraData === 'object') {
        return extraData;
    }
    try {
        const parsed = JSON.parse(extraData);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
        return {};
    }
    catch {
        return {};
    }
}
function asText(value) {
    if (value === null || value === undefined)
        return '';
    if (Array.isArray(value)) {
        return value.filter(Boolean).join(', ');
    }
    return String(value);
}
function collectExtraRows(label) {
    const extra = normalizeExtraData(label.extraData);
    const rows = [];
    const push = (title, key) => {
        const value = extra[key];
        if (value !== null && value !== undefined && asText(value).trim()) {
            rows.push([title, asText(value)]);
        }
    };
    push('Restaurante', 'restaurantName');
    push('Data da coleta', 'collectionDate');
    push('Hora da coleta', 'collectionTime');
    push('Finalidade', 'chemicalPurpose');
    push('Diluição (ml)', 'dilutionMl');
    push('Diluição (litros)', 'dilutionLiters');
    push('Data preparo', 'preparationDate');
    push('Hora preparo', 'preparationTime');
    push('Validade química', 'chemicalValidity');
    push('Não conformidade', 'nonConformityReasons');
    push('Outro motivo', 'otherNonConformity');
    push('Data identificação', 'identificationDate');
    push('Ação tomada', 'actionTaken');
    push('Método', 'thawingMethod');
    push('Data início', 'startDate');
    push('Hora início', 'startTime');
    push('Tipo de carne', 'meatType');
    push('MAPA/SIF', 'mapaSif');
    push('Data recebimento', 'receiptDate');
    push('Armazenamento', 'storageType');
    push('Data reembalagem', 'repackagingDate');
    push('Validade original', 'originalValidity');
    push('Nova validade', 'newValidity');
    return rows;
}
function drawLabel(doc, label, x, y) {
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
    function row(title, value) {
        if (rowY > y + height - 24)
            return;
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
    row('Aberto/manip.', brDateTime(label.openedAt));
    row('Validade', brDateTime(label.expiresAt));
    row('Responsável', label.responsibleName || '—');
    row('Lote', label.batch || '—');
    if (label.quantity)
        row('Quantidade', label.quantity);
    if (label.brand)
        row('Marca', label.brand);
    if (label.supplier)
        row('Fornecedor', label.supplier);
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
function createPdfBuffer(draw) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({
            size: 'A4',
            margin: 28,
            bufferPages: true,
        });
        const chunks = [];
        doc.on('data', (chunk) => {
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
async function generateLabelPdf(label) {
    return createPdfBuffer((doc) => {
        doc
            .font('Helvetica-Bold')
            .fontSize(16)
            .fillColor('#0f172a')
            .text('SafeKitchen Smart', {
            align: 'center',
        });
        doc
            .moveDown(0.3)
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#64748b')
            .text('Etiqueta de controle de qualidade', {
            align: 'center',
        });
        drawLabel(doc, label, 170, 110);
        doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#64748b')
            .text(`Gerado em ${brDateTime(new Date())}`, 28, 760, {
            width: 540,
            align: 'center',
        });
    });
}
async function generateBatchLabelsPdf(labels) {
    return createPdfBuffer((doc) => {
        doc
            .font('Helvetica-Bold')
            .fontSize(14)
            .fillColor('#0f172a')
            .text('SafeKitchen Smart - Impressão em lote', {
            align: 'center',
        });
        doc
            .moveDown(0.2)
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#64748b')
            .text(`Gerado em ${brDateTime(new Date())}`, {
            align: 'center',
        });
        const startX = 32;
        const startY = 70;
        const gapX = 24;
        const gapY = 18;
        const labelW = 255;
        const labelH = 165;
        let x = startX;
        let y = startY;
        let col = 0;
        labels.forEach((label, index) => {
            if (index > 0 && index % 8 === 0) {
                doc.addPage();
                x = startX;
                y = startY;
                col = 0;
            }
            drawLabel(doc, label, x, y);
            col += 1;
            if (col === 2) {
                col = 0;
                x = startX;
                y += labelH + gapY;
            }
            else {
                x = startX + labelW + gapX;
            }
        });
    });
}
