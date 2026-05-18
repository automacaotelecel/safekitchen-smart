"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLabelPdf = buildLabelPdf;
exports.buildLabelsSheetPdf = buildLabelsSheetPdf;
const pdfkit_1 = __importDefault(require("pdfkit"));
const date_fns_1 = require("date-fns");
function brDate(date) {
    if (!date)
        return '__/__/____';
    return (0, date_fns_1.format)(date, 'dd/MM/yyyy');
}
function brTime(date) {
    if (!date)
        return '__:__';
    return (0, date_fns_1.format)(date, 'HH:mm');
}
function textOrLine(value) {
    return value && value.trim() ? value.trim() : '________________';
}
function firstLine(value, fallback = '________________') {
    const finalValue = value && value.trim() ? value.trim() : fallback;
    return finalValue.length > 38 ? `${finalValue.slice(0, 35)}...` : finalValue;
}
function modeCheck(mode, expected) {
    return String(mode).toUpperCase() === String(expected).toUpperCase() ? 'X' : ' ';
}
function labelHeader(type) {
    const map = {
        PRODUTO_ABERTO: 'FOR PROD 12 - 02   ETIQUETA DE IDENTIFICAÇÃO DE PRODUTO',
        PRODUCAO: 'FOR PROD 12 - 02   ETIQUETA DE IDENTIFICAÇÃO DE PRODUTO',
        REEMBALAGEM: 'FOR PROD 12 - 02   ETIQUETA DE IDENTIFICAÇÃO DE PRODUTO',
        ARMAZENAMENTO_CARNES: 'FOR PROD 12 - 02   ETIQUETA DE IDENTIFICAÇÃO DE PRODUTO',
        AMOSTRAS: 'FOR PROD 12 - 02   ETIQUETA DE IDENTIFICAÇÃO DE PRODUTO',
        NAO_CONFORME: 'ETIQUETA DE PRODUTO NÃO CONFORME',
        DESCONGELAMENTO_DESSALGUE: 'FOR PROD 16 - 01   ETIQUETA DE IDENTIFICAÇÃO EM DESCONGELAMENTO E DESSALGUE',
        PRODUTO_QUIMICO: 'FOR PROD 36 - 01   ETIQUETA DE PRODUTO QUÍMICO',
    };
    return map[type] || 'ETIQUETA';
}
function isChemical(label) {
    return label.type === 'PRODUTO_QUIMICO';
}
function isThawing(label) {
    return label.type === 'DESCONGELAMENTO_DESSALGUE';
}
function drawDocumentHeader(doc, type) {
    doc.save();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#008f86').text('SafeKitchen Smart', 32, 28);
    doc.font('Helvetica').fontSize(6).fillColor('#666').text('Tecnologia • Controle • Segurança', 32, 42);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111').text(labelHeader(type), 245, 28, {
        width: 550,
        align: 'right',
    });
    doc.restore();
}
function drawBrandMark(doc, x, y, w) {
    doc.save();
    doc.roundedRect(x + w - 24, y + 6, 14, 14, 4).strokeColor('#008f86').lineWidth(0.7).stroke();
    doc.font('Helvetica-Bold').fontSize(5).fillColor('#008f86').text('SKS', x + w - 22, y + 10, {
        width: 10,
        align: 'center',
    });
    doc.restore();
}
function drawFieldLine(doc, label, value, x, y, options) {
    const labelWidth = options?.labelWidth || 58;
    const valueWidth = options?.valueWidth || 110;
    const fontSize = options?.fontSize || 6.4;
    doc.font('Helvetica-Bold').fontSize(fontSize).fillColor('#333').text(label, x, y, {
        width: labelWidth,
        continued: false,
    });
    doc.font('Helvetica').fontSize(fontSize).fillColor('#111').text(value, x + labelWidth, y, {
        width: valueWidth,
        lineBreak: false,
    });
    doc.moveTo(x + labelWidth, y + fontSize + 2).lineTo(x + labelWidth + valueWidth, y + fontSize + 2).strokeColor('#888').lineWidth(0.4).stroke();
}
function drawProductLikeLabel(doc, label, x, y, w, h) {
    doc.save();
    doc.roundedRect(x, y, w, h, 7).strokeColor('#1d3340').lineWidth(0.8).stroke();
    drawBrandMark(doc, x, y, w);
    const title = isThawing(label) ? 'Produto em descongelamento/dessalgue:' : 'Produto e Marca/ Produção:';
    const titleValue = [label.productName, label.brand].filter(Boolean).join(' - ');
    doc.font('Helvetica-Bold').fontSize(6.6).fillColor('#333').text(title, x + 6, y + 7, { width: w - 35 });
    doc.font('Helvetica-Bold').fontSize(7.1).fillColor('#111').text(firstLine(titleValue), x + 6, y + 18, { width: w - 16, lineBreak: false });
    doc.moveTo(x + 6, y + 29).lineTo(x + w - 8, y + 29).strokeColor('#888').lineWidth(0.4).stroke();
    drawFieldLine(doc, 'Fornecedor:', textOrLine(label.supplier), x + 6, y + 34, { labelWidth: 39, valueWidth: w - 53 });
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text('Lote:', x + 6, y + 47);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text(textOrLine(label.batch), x + 25, y + 47, { width: 49, lineBreak: false });
    doc.moveTo(x + 25, y + 55).lineTo(x + 72, y + 55).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text('Val. Prod.:', x + 78, y + 47);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text('___/___/____', x + 115, y + 47, { width: 62, lineBreak: false });
    doc.moveTo(x + 115, y + 55).lineTo(x + w - 8, y + 55).strokeColor('#888').lineWidth(0.4).stroke();
    const dateLabel = isThawing(label) ? 'Início desc./dessalgue:' : 'Manipulado/ aberto:';
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text(dateLabel, x + 6, y + 60);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text(`${brDate(label.openedAt)}   H: ${brTime(label.openedAt)}`, x + 72, y + 60, {
        width: w - 78,
        lineBreak: false,
    });
    doc.moveTo(x + 72, y + 68).lineTo(x + w - 8, y + 68).strokeColor('#888').lineWidth(0.4).stroke();
    const validLabel = isThawing(label) ? 'Uso até:' : 'Valido até dia:';
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text(validLabel, x + 6, y + 73);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text(`${brDate(label.expiresAt ?? null)} ${label.quantity ? ` • Qtd.: ${label.quantity}` : ''}`, x + 57, y + 73, {
        width: w - 64,
        lineBreak: false,
    });
    doc.moveTo(x + 57, y + 81).lineTo(x + w - 8, y + 81).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.1).fillColor('#333').text('Modo de Conservação:', x + 64, y + 85, { width: 84, align: 'center' });
    doc.font('Helvetica').fontSize(6).fillColor('#111').text(`( ${modeCheck(label.conservationMode, 'AMBIENTE')} ) Temp. Amb.   ( ${modeCheck(label.conservationMode, 'REFRIGERADO')} ) Refri.   ( ${modeCheck(label.conservationMode, 'CONGELADO')} ) Congelado`, x + 8, y + 98, { width: w - 16, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(6.1).fillColor('#333').text('Responsável:', x + 6, y + h - 14);
    doc.font('Helvetica').fontSize(6.1).fillColor('#111').text(textOrLine(label.responsibleName), x + 45, y + h - 14, {
        width: w - 52,
        lineBreak: false,
    });
    doc.moveTo(x + 45, y + h - 6).lineTo(x + w - 8, y + h - 6).strokeColor('#888').lineWidth(0.4).stroke();
    if (label.type === 'NAO_CONFORME') {
        doc.rotate(-18, { origin: [x + w / 2, y + h / 2] });
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#c62828').opacity(0.16).text('NÃO CONFORME', x + 18, y + 42, {
            width: w - 36,
            align: 'center',
        });
        doc.opacity(1);
    }
    doc.restore();
}
function drawChemicalLabel(doc, label, x, y, w, h) {
    doc.save();
    doc.roundedRect(x, y, w, h, 7).strokeColor('#1d3340').lineWidth(0.8).stroke();
    drawBrandMark(doc, x, y, w);
    const productValue = [label.productName, label.brand].filter(Boolean).join(' - ');
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#333').text('Produto e Marca:', x + 7, y + 7, { width: w - 35 });
    doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#111').text(firstLine(productValue), x + 7, y + 19, { width: w - 17, lineBreak: false });
    doc.moveTo(x + 7, y + 31).lineTo(x + w - 8, y + 31).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#333').text('Lote:', x + 7, y + 38);
    doc.font('Helvetica').fontSize(6.5).fillColor('#111').text(textOrLine(label.batch), x + 28, y + 38, { width: 65, lineBreak: false });
    doc.moveTo(x + 28, y + 46).lineTo(x + 92, y + 46).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#333').text('Val. Prod.:', x + 104, y + 38);
    doc.font('Helvetica').fontSize(6.5).fillColor('#111').text('___/___/____', x + 145, y + 38, { width: 75, lineBreak: false });
    doc.moveTo(x + 145, y + 46).lineTo(x + w - 8, y + 46).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text('Manipulado/ Limpo e Substituído:', x + 7, y + 52);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text(`${brDate(label.openedAt)}`, x + 127, y + 52, { width: 78, lineBreak: false });
    doc.moveTo(x + 127, y + 60).lineTo(x + w - 8, y + 60).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text('Diluição:', x + 7, y + 66);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text(textOrLine(label.observations), x + 41, y + 66, { width: 97, lineBreak: false });
    doc.moveTo(x + 41, y + 74).lineTo(x + 136, y + 74).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text('Horário:', x + 146, y + 66);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text(brTime(label.openedAt), x + 177, y + 66, { width: 45, lineBreak: false });
    doc.moveTo(x + 177, y + 74).lineTo(x + w - 8, y + 74).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text('Responsável:', x + 7, y + h - 13);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text(textOrLine(label.responsibleName), x + 51, y + h - 13, {
        width: w - 60,
        lineBreak: false,
    });
    doc.moveTo(x + 51, y + h - 5).lineTo(x + w - 8, y + h - 5).strokeColor('#888').lineWidth(0.4).stroke();
    doc.restore();
}
function drawEmptySlot(doc, x, y, w, h, chemical = false) {
    const emptyLabel = {
        id: '',
        type: chemical ? 'PRODUTO_QUIMICO' : 'PRODUTO_ABERTO',
        productName: '',
        brand: '',
        supplier: '',
        batch: '',
        conservationMode: '',
        openedAt: null,
        expiresAt: null,
        quantity: '',
        responsibleName: '',
        observations: '',
        createdAt: new Date(),
    };
    if (chemical)
        drawChemicalLabel(doc, emptyLabel, x, y, w, h);
    else
        drawProductLikeLabel(doc, emptyLabel, x, y, w, h);
}
function gridFor(type) {
    const pageWidth = 842;
    const marginX = 26;
    const startY = 92;
    const bottom = 26;
    if (type === 'PRODUTO_QUIMICO') {
        const cols = 3;
        const rows = 4;
        const gapX = 7;
        const gapY = 8;
        const slotW = (pageWidth - marginX * 2 - gapX * (cols - 1)) / cols;
        const slotH = (595 - startY - bottom - gapY * (rows - 1)) / rows;
        return { cols, rows, gapX, gapY, startX: marginX, startY, slotW, slotH };
    }
    const cols = 4;
    const rows = 3;
    const gapX = 7;
    const gapY = 10;
    const slotW = (pageWidth - marginX * 2 - gapX * (cols - 1)) / cols;
    const slotH = (595 - startY - bottom - gapY * (rows - 1)) / rows;
    return { cols, rows, gapX, gapY, startX: marginX, startY, slotW, slotH };
}
function drawSheet(doc, type, labels, fillEmptySlots) {
    drawDocumentHeader(doc, type);
    const grid = gridFor(type);
    const totalSlots = grid.cols * grid.rows;
    for (let index = 0; index < totalSlots; index += 1) {
        const col = index % grid.cols;
        const row = Math.floor(index / grid.cols);
        const x = grid.startX + col * (grid.slotW + grid.gapX);
        const y = grid.startY + row * (grid.slotH + grid.gapY);
        const label = labels[index];
        if (label) {
            if (isChemical(label))
                drawChemicalLabel(doc, label, x, y, grid.slotW, grid.slotH);
            else
                drawProductLikeLabel(doc, label, x, y, grid.slotW, grid.slotH);
            continue;
        }
        if (fillEmptySlots) {
            drawEmptySlot(doc, x, y, grid.slotW, grid.slotH, type === 'PRODUTO_QUIMICO');
        }
    }
}
function groupByTemplate(labels) {
    const groups = {};
    labels.forEach((label) => {
        const template = isChemical(label) ? 'PRODUTO_QUIMICO' : isThawing(label) ? 'DESCONGELAMENTO_DESSALGUE' : 'PRODUTO_ABERTO';
        groups[template] ||= [];
        groups[template].push(label);
    });
    return groups;
}
async function buildLabelPdf(label, copies = 1) {
    const repeated = Array.from({ length: Math.max(1, Math.min(copies, 60)) }, () => label);
    return buildLabelsSheetPdf(repeated, { fillEmptySlots: false });
}
async function buildLabelsSheetPdf(labels, options = {}) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({ size: 'A4', layout: 'landscape', margin: 0, bufferPages: true });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        const groups = groupByTemplate(labels);
        const templateTypes = Object.keys(groups);
        if (templateTypes.length === 0) {
            drawDocumentHeader(doc, 'PRODUTO_ABERTO');
            doc.font('Helvetica-Bold').fontSize(14).fillColor('#333').text('Nenhuma etiqueta selecionada.', 40, 110);
            doc.end();
            return;
        }
        let firstPage = true;
        for (const type of templateTypes) {
            const grid = gridFor(type);
            const pageSize = grid.cols * grid.rows;
            const group = groups[type];
            for (let start = 0; start < group.length; start += pageSize) {
                if (!firstPage)
                    doc.addPage({ size: 'A4', layout: 'landscape', margin: 0 });
                firstPage = false;
                drawSheet(doc, type, group.slice(start, start + pageSize), Boolean(options.fillEmptySlots));
            }
        }
        doc.end();
    });
}
