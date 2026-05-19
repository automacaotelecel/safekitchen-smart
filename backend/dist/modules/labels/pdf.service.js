"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLabelPdf = buildLabelPdf;
exports.buildLabelsSheetPdf = buildLabelsSheetPdf;
const pdfkit_1 = __importDefault(require("pdfkit"));
const date_fns_1 = require("date-fns");
function extra(label) {
    if (!label.extraData)
        return {};
    try {
        const parsed = JSON.parse(label.extraData);
        return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch {
        return {};
    }
}
function brDate(date) {
    if (!date)
        return '__/__/____';
    const finalDate = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(finalDate.getTime()))
        return '__/__/____';
    return (0, date_fns_1.format)(finalDate, 'dd/MM/yyyy');
}
function brTime(date) {
    if (!date)
        return '__:__';
    const finalDate = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(finalDate.getTime()))
        return '__:__';
    return (0, date_fns_1.format)(finalDate, 'HH:mm');
}
function textOrLine(value, fallback = '________________') {
    return value && value.trim() ? value.trim() : fallback;
}
function firstLine(value, fallback = '________________', max = 38) {
    const finalValue = value && value.trim() ? value.trim() : fallback;
    return finalValue.length > max ? `${finalValue.slice(0, max - 3)}...` : finalValue;
}
function modeCheck(mode, expected) {
    return String(mode).toUpperCase() === String(expected).toUpperCase() ? 'X' : ' ';
}
function checkList(values, expected) {
    return Array.isArray(values) && values.includes(expected) ? 'X' : ' ';
}
function labelHeader(type) {
    const map = {
        PRODUTO_ABERTO: 'ETIQUETA DE PRODUTO ABERTO',
        PRODUCAO: 'ETIQUETA DE PRODUÇÃO',
        REEMBALAGEM: 'ETIQUETA DE REEMBALAGEM',
        ARMAZENAMENTO_CARNES: 'ETIQUETA DE ARMAZENAMENTO DE CARNES',
        AMOSTRAS: 'ETIQUETA DE AMOSTRAS',
        NAO_CONFORME: 'PRODUTO SEGREGADO — NÃO CONFORME',
        DESCONGELAMENTO_DESSALGUE: 'ETIQUETA DE DESCONGELAMENTO/DESSALGUE',
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
function isNonConform(label) {
    return label.type === 'NAO_CONFORME';
}
function isSample(label) {
    return label.type === 'AMOSTRAS';
}
function drawDocumentHeader(doc, type) {
    doc.save();
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#008f86').text('SafeKitchen Smart', 32, 28);
    doc.font('Helvetica').fontSize(6).fillColor('#666').text('Tecnologia • Controle • Segurança', 32, 42);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#111').text(labelHeader(type), 245, 28, {
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
function line(doc, label, value, x, y, options) {
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
    doc
        .moveTo(x + labelWidth, y + fontSize + 2)
        .lineTo(x + labelWidth + valueWidth, y + fontSize + 2)
        .strokeColor('#888')
        .lineWidth(0.4)
        .stroke();
}
function checkbox(doc, checked, text, x, y, width = 70) {
    doc.font('Helvetica').fontSize(5.8).fillColor('#111').text(`(${checked}) ${text}`, x, y, {
        width,
        lineBreak: false,
    });
}
function title(doc, text, x, y, w) {
    doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#111').text(text, x, y, {
        width: w,
        lineBreak: false,
    });
}
function drawNonConformLabel(doc, label, x, y, w, h) {
    const data = extra(label);
    doc.save();
    doc.roundedRect(x, y, w, h, 7).strokeColor('#9b1c1c').lineWidth(1).stroke();
    drawBrandMark(doc, x, y, w);
    title(doc, 'PRODUTO SEGREGADO — NÃO CONFORME', x + 6, y + 7, w - 35);
    line(doc, 'Produto:', firstLine(label.productName, '________________', 31), x + 6, y + 22, { labelWidth: 29, valueWidth: w - 44 });
    line(doc, 'Lote:', textOrLine(label.batch), x + 6, y + 35, { labelWidth: 21, valueWidth: 58 });
    doc.font('Helvetica-Bold').fontSize(6.2).fillColor('#333').text('Não conformidade:', x + 6, y + 49);
    checkbox(doc, checkList(data.nonConformities, 'Vencido'), 'Vencido', x + 6, y + 62);
    checkbox(doc, checkList(data.nonConformities, 'Temperatura inadequada'), 'Temp. inadequada', x + 68, y + 62, 90);
    checkbox(doc, checkList(data.nonConformities, 'Embalagem violada'), 'Emb. violada', x + 6, y + 74);
    checkbox(doc, checkList(data.nonConformities, 'Contaminação'), 'Contaminação', x + 68, y + 74, 80);
    checkbox(doc, checkList(data.nonConformities, 'Sem identificação'), 'Sem identificação', x + 6, y + 86);
    line(doc, 'Outro:', String(data.nonConformityOther || ''), x + 98, y + 86, { labelWidth: 22, valueWidth: w - 128, fontSize: 5.8 });
    line(doc, 'Data ident.:', brDate(data.identifiedAt || label.openedAt), x + 6, y + 100, { labelWidth: 42, valueWidth: 60 });
    doc.font('Helvetica-Bold').fontSize(6.2).fillColor('#333').text('Ação tomada:', x + 6, y + 114);
    checkbox(doc, checkList(data.actionsTaken, 'Descarte'), 'Descarte', x + 6, y + 127);
    checkbox(doc, checkList(data.actionsTaken, 'Devolução fornecedor'), 'Devolução fornecedor', x + 68, y + 127, 94);
    checkbox(doc, checkList(data.actionsTaken, 'Avaliação responsável técnico'), 'Avaliação RT', x + 6, y + 139, 80);
    line(doc, 'Responsável:', textOrLine(label.responsibleName), x + 6, y + h - 15, { labelWidth: 43, valueWidth: w - 57 });
    doc.restore();
}
function drawSampleLabel(doc, label, x, y, w, h) {
    const data = extra(label);
    doc.save();
    doc.roundedRect(x, y, w, h, 7).strokeColor('#1d3340').lineWidth(0.8).stroke();
    drawBrandMark(doc, x, y, w);
    title(doc, 'AMOSTRAS', x + 6, y + 7, w - 35);
    line(doc, 'Produto:', firstLine(label.productName, '________________', 32), x + 6, y + 23, { labelWidth: 30, valueWidth: w - 45 });
    line(doc, 'Data coleta:', brDate(label.openedAt), x + 6, y + 38, { labelWidth: 44, valueWidth: 58 });
    line(doc, 'Hora coleta:', brTime(label.openedAt), x + 112, y + 38, { labelWidth: 44, valueWidth: w - 162 });
    line(doc, 'Responsável:', textOrLine(label.responsibleName), x + 6, y + 53, { labelWidth: 45, valueWidth: w - 59 });
    line(doc, 'Restaurante:', textOrLine(data.restaurantName || 'Restaurante'), x + 6, y + 68, { labelWidth: 45, valueWidth: w - 59 });
    line(doc, 'Data descarte:', brDate(data.discardAt || label.expiresAt), x + 6, y + 83, { labelWidth: 50, valueWidth: 64 });
    doc.font('Helvetica-Bold').fontSize(6.1).fillColor('#333').text('Conservação:', x + 6, y + 99);
    checkbox(doc, modeCheck(label.conservationMode, 'REFRIGERADO'), 'Refrigerado', x + 55, y + 99, 70);
    checkbox(doc, modeCheck(label.conservationMode, 'CONGELADO'), 'Congelado', x + 125, y + 99, 70);
    doc.restore();
}
function drawProductLikeLabel(doc, label, x, y, w, h) {
    const data = extra(label);
    doc.save();
    doc.roundedRect(x, y, w, h, 7).strokeColor('#1d3340').lineWidth(0.8).stroke();
    drawBrandMark(doc, x, y, w);
    let mainTitle = 'Produto e Marca/ Produção:';
    if (label.type === 'PRODUTO_ABERTO')
        mainTitle = 'Produto industrializado aberto:';
    if (label.type === 'PRODUCAO')
        mainTitle = 'Produto manipulado/preparado:';
    if (label.type === 'REEMBALAGEM')
        mainTitle = 'Produto reembalado:';
    if (label.type === 'ARMAZENAMENTO_CARNES')
        mainTitle = 'Produto/carne:';
    if (isThawing(label))
        mainTitle = 'Produto em descongelamento/dessalgue:';
    const titleValue = [label.productName, label.brand].filter(Boolean).join(' - ');
    doc.font('Helvetica-Bold').fontSize(6.6).fillColor('#333').text(mainTitle, x + 6, y + 7, { width: w - 35 });
    doc.font('Helvetica-Bold').fontSize(7.1).fillColor('#111').text(firstLine(titleValue), x + 6, y + 18, { width: w - 16, lineBreak: false });
    doc.moveTo(x + 6, y + 29).lineTo(x + w - 8, y + 29).strokeColor('#888').lineWidth(0.4).stroke();
    if (isThawing(label)) {
        line(doc, 'Data início:', brDate(label.openedAt), x + 6, y + 35, { labelWidth: 41, valueWidth: 52 });
        line(doc, 'Hora início:', brTime(label.openedAt), x + 105, y + 35, { labelWidth: 42, valueWidth: w - 154 });
        line(doc, 'Validade:', brDate(label.expiresAt ?? null), x + 6, y + 50, { labelWidth: 34, valueWidth: 70 });
        doc.font('Helvetica-Bold').fontSize(6.1).fillColor('#333').text('Método:', x + 6, y + 65);
        checkbox(doc, data.thawingMethod === 'Refrigerado (0°C a 5°C)' ? 'X' : ' ', 'Refrigerado (0°C a 5°C)', x + 40, y + 65, 90);
        checkbox(doc, data.thawingMethod === 'Micro-ondas' ? 'X' : ' ', 'Micro-ondas', x + 6, y + 78, 70);
        checkbox(doc, data.thawingMethod === 'Água corrente controlada' ? 'X' : ' ', 'Água corrente controlada', x + 78, y + 78, 105);
        line(doc, 'Responsável:', textOrLine(label.responsibleName), x + 6, y + h - 14, { labelWidth: 43, valueWidth: w - 56 });
        doc.restore();
        return;
    }
    if (label.type === 'ARMAZENAMENTO_CARNES') {
        line(doc, 'Tipo:', String(data.meatType || ''), x + 6, y + 34, { labelWidth: 21, valueWidth: 62 });
        line(doc, 'Fornecedor:', textOrLine(label.supplier), x + 6, y + 48, { labelWidth: 42, valueWidth: w - 56 });
        line(doc, 'Lote:', textOrLine(label.batch), x + 6, y + 62, { labelWidth: 21, valueWidth: 55 });
        line(doc, 'MAPA/SIF:', String(data.mapaSif || ''), x + 84, y + 62, { labelWidth: 39, valueWidth: w - 131 });
        line(doc, 'Recebimento:', brDate(data.receivedAt || label.openedAt), x + 6, y + 76, { labelWidth: 48, valueWidth: 64 });
        line(doc, 'Validade:', brDate(label.expiresAt ?? null), x + 6, y + 90, { labelWidth: 34, valueWidth: 64 });
        doc.font('Helvetica-Bold').fontSize(6.1).fillColor('#333').text('Armazenamento:', x + 6, y + 104);
        checkbox(doc, data.storageType === 'Resfriado' ? 'X' : ' ', 'Resfriado', x + 69, y + 104, 56);
        checkbox(doc, data.storageType === 'Congelado' ? 'X' : ' ', 'Congelado', x + 124, y + 104, 70);
        line(doc, 'Responsável:', textOrLine(label.responsibleName), x + 6, y + h - 14, { labelWidth: 43, valueWidth: w - 56 });
        doc.restore();
        return;
    }
    if (label.type === 'REEMBALAGEM') {
        line(doc, 'Lote:', textOrLine(label.batch), x + 6, y + 34, { labelWidth: 21, valueWidth: 60 });
        line(doc, 'Data reemb.:', brDate(data.repackagedAt || label.openedAt), x + 6, y + 49, { labelWidth: 45, valueWidth: 62 });
        line(doc, 'Val. original:', brDate(data.originalValidityAt), x + 6, y + 64, { labelWidth: 48, valueWidth: 64 });
        line(doc, 'Nova validade:', brDate(data.newValidityAt || label.expiresAt), x + 6, y + 79, { labelWidth: 50, valueWidth: 64 });
        line(doc, 'Responsável:', textOrLine(label.responsibleName), x + 6, y + h - 14, { labelWidth: 43, valueWidth: w - 56 });
        doc.restore();
        return;
    }
    line(doc, 'Fornecedor:', textOrLine(label.supplier), x + 6, y + 34, { labelWidth: 39, valueWidth: w - 53 });
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text('Lote:', x + 6, y + 47);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text(textOrLine(label.batch), x + 25, y + 47, { width: 49, lineBreak: false });
    doc.moveTo(x + 25, y + 55).lineTo(x + 72, y + 55).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text('Val. Prod.:', x + 78, y + 47);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text('___/___/____', x + 115, y + 47, { width: 62, lineBreak: false });
    doc.moveTo(x + 115, y + 55).lineTo(x + w - 8, y + 55).strokeColor('#888').lineWidth(0.4).stroke();
    const dateLabel = label.type === 'PRODUCAO' ? 'Produzido em:' : 'Manipulado/ aberto:';
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text(dateLabel, x + 6, y + 60);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text(`${brDate(label.openedAt)}   H: ${brTime(label.openedAt)}`, x + 72, y + 60, {
        width: w - 78,
        lineBreak: false,
    });
    doc.moveTo(x + 72, y + 68).lineTo(x + w - 8, y + 68).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#333').text('Válido até:', x + 6, y + 73);
    doc.font('Helvetica').fontSize(6.3).fillColor('#111').text(`${brDate(label.expiresAt ?? null)} ${label.quantity ? ` • Qtd.: ${label.quantity}` : ''}`, x + 57, y + 73, {
        width: w - 64,
        lineBreak: false,
    });
    doc.moveTo(x + 57, y + 81).lineTo(x + w - 8, y + 81).strokeColor('#888').lineWidth(0.4).stroke();
    doc.font('Helvetica-Bold').fontSize(6.1).fillColor('#333').text('Modo de Conservação:', x + 64, y + 85, { width: 84, align: 'center' });
    doc.font('Helvetica').fontSize(6).fillColor('#111').text(`( ${modeCheck(label.conservationMode, 'AMBIENTE')} ) Temp. Amb.   ( ${modeCheck(label.conservationMode, 'REFRIGERADO')} ) Refri.   ( ${modeCheck(label.conservationMode, 'CONGELADO')} ) Congelado`, x + 8, y + 98, { width: w - 16, lineBreak: false });
    line(doc, 'Responsável:', textOrLine(label.responsibleName), x + 6, y + h - 14, { labelWidth: 43, valueWidth: w - 56 });
    doc.restore();
}
function drawChemicalLabel(doc, label, x, y, w, h) {
    const data = extra(label);
    doc.save();
    doc.roundedRect(x, y, w, h, 7).strokeColor('#1d3340').lineWidth(0.8).stroke();
    drawBrandMark(doc, x, y, w);
    const productValue = [label.productName, label.brand].filter(Boolean).join(' - ');
    title(doc, 'PRODUTO QUÍMICO', x + 7, y + 7, w - 35);
    line(doc, 'Produto:', firstLine(productValue, '________________', 33), x + 7, y + 22, { labelWidth: 30, valueWidth: w - 47 });
    doc.font('Helvetica-Bold').fontSize(6.4).fillColor('#333').text('Finalidade:', x + 7, y + 38);
    checkbox(doc, checkList(data.chemicalPurposes, 'Higienização'), 'Higienização', x + 50, y + 38, 70);
    checkbox(doc, checkList(data.chemicalPurposes, 'Desinfecção'), 'Desinfecção', x + 120, y + 38, 70);
    checkbox(doc, checkList(data.chemicalPurposes, 'Limpeza pesada'), 'Limpeza pesada', x + 190, y + 38, 80);
    line(doc, 'Diluição:', `${data.dilutionMl || '____'} mL para ${data.dilutionWaterL || '____'} L de água`, x + 7, y + 54, { labelWidth: 34, valueWidth: w - 50 });
    line(doc, 'Data preparo:', brDate(data.chemicalPreparedAt || label.openedAt), x + 7, y + 70, { labelWidth: 50, valueWidth: 70 });
    line(doc, 'Hora:', brTime(data.chemicalPreparedAt || label.openedAt), x + 135, y + 70, { labelWidth: 22, valueWidth: 45 });
    line(doc, 'Validade:', brDate(data.chemicalValidityAt || label.expiresAt), x + 7, y + 86, { labelWidth: 34, valueWidth: 70 });
    line(doc, 'Responsável:', textOrLine(label.responsibleName), x + 7, y + h - 13, {
        labelWidth: 44,
        valueWidth: w - 60,
        fontSize: 6.3,
    });
    doc.restore();
}
function drawEmptySlot(doc, x, y, w, h, type = 'PRODUTO_ABERTO') {
    const emptyLabel = {
        id: '',
        type,
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
        extraData: '',
        createdAt: new Date(),
    };
    drawLabel(doc, emptyLabel, x, y, w, h);
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
function templateType(label) {
    if (label.type === 'PRODUTO_QUIMICO')
        return 'PRODUTO_QUIMICO';
    if (label.type === 'DESCONGELAMENTO_DESSALGUE')
        return 'DESCONGELAMENTO_DESSALGUE';
    if (label.type === 'NAO_CONFORME')
        return 'NAO_CONFORME';
    if (label.type === 'AMOSTRAS')
        return 'AMOSTRAS';
    return 'PRODUTO_ABERTO';
}
function drawLabel(doc, label, x, y, w, h) {
    if (isChemical(label))
        return drawChemicalLabel(doc, label, x, y, w, h);
    if (isNonConform(label))
        return drawNonConformLabel(doc, label, x, y, w, h);
    if (isSample(label))
        return drawSampleLabel(doc, label, x, y, w, h);
    return drawProductLikeLabel(doc, label, x, y, w, h);
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
            drawLabel(doc, label, x, y, grid.slotW, grid.slotH);
            continue;
        }
        if (fillEmptySlots) {
            drawEmptySlot(doc, x, y, grid.slotW, grid.slotH, type);
        }
    }
}
function groupByTemplate(labels) {
    const groups = {};
    labels.forEach((label) => {
        const template = templateType(label);
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
