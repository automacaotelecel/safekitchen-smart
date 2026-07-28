import { strToU8, zipSync } from 'fflate';

export const operationalExportKinds = [
  'EQUIPMENT',
  'PREPARATION',
  'DELIVERY',
  'FRYING_OIL',
  'READY_FOOD',
  'REFRIGERATED_FOOD',
  'DISTRIBUTION',
  'RECEIVING',
  'MAINTENANCE',
  'RESERVOIR_CLEANING',
  'NON_ROUTINE_CLEANING',
  'TRAINING',
] as const;

export type OperationalExportKind = (typeof operationalExportKinds)[number];

type TemperatureRow = {
  category: string;
  subject: string;
  temperatureC: number;
  secondaryTemperatureC: number | null;
  tertiaryTemperatureC: number | null;
  occurredAt: Date;
  responsibleName: string;
  notes: string | null;
  metadata: unknown;
};

type ComplianceRow = {
  type: string;
  subject: string;
  occurredAt: Date;
  nextDueAt: Date | null;
  responsibleName: string;
  notes: string | null;
  data: unknown;
};

const kindTitles: Record<OperationalExportKind, string> = {
  EQUIPMENT: 'Planilha de Controle de Temperatura dos Equipamentos',
  PREPARATION: 'Planilha de Controle de Temperatura Durante o Preparo',
  DELIVERY: 'Planilha de Controle de Temperatura Durante a Entrega',
  FRYING_OIL: 'Planilha de Controle de Temperatura do Óleo de Fritura',
  READY_FOOD: 'Planilha de Controle de Temperatura do Alimento Pronto',
  REFRIGERATED_FOOD: 'Planilha de Controle de Temperatura do Alimento Refrigerado',
  DISTRIBUTION: 'Planilha de Controle de Temperatura na Distribuição',
  RECEIVING: 'Planilha de Controle de Recebimento',
  MAINTENANCE: 'Planilha de Controle de Manutenção de Equipamentos',
  RESERVOIR_CLEANING: 'Planilha de Controle de Higienização do Reservatório',
  NON_ROUTINE_CLEANING: 'Planilha de Controle de Higienização Não Rotineira',
  TRAINING: 'Ata de Treinamento',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function dateValue(value: unknown) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : date;
}

function temperature(value: number | null | undefined) {
  return typeof value === 'number' ? `${value.toFixed(1)} °C` : '';
}

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function metadataValue(row: TemperatureRow, key: string) {
  return stringValue(asRecord(row.metadata)[key]);
}

function temperatureColumns(kind: OperationalExportKind) {
  if (kind === 'EQUIPMENT') {
    return ['Data/Horário', 'Equipamento 01', 'Equipamento 02', 'Equipamento 03', 'Equipamento 04', 'Responsável'];
  }
  if (kind === 'READY_FOOD') {
    return ['Data', 'Alimento e T°C', 'Destino do produto', 'T°C Final para Distribuição', 'Responsável'];
  }
  if (kind === 'REFRIGERATED_FOOD') {
    return ['Data', 'Alimento', 'T°C após o preparo', 'T°C 2h após preparo', 'Observação', 'Responsável'];
  }
  if (kind === 'DISTRIBUTION' || kind === 'DELIVERY') {
    return ['Data', 'Alimento', 'Horário e T°C iniciais', 'TºC após 2h', 'TºC após 4h', 'Responsável'];
  }
  return ['Data', 'Alimento', 'Temperatura', 'Observação', 'Responsável'];
}

function complianceColumns(kind: OperationalExportKind) {
  if (kind === 'RECEIVING') {
    return ['Produto/Fornecedor', 'Data', 'Embalagem', 'Conservação', 'TºC', 'Entregador', 'Data de Validade', 'Responsável'];
  }
  if (kind === 'MAINTENANCE') {
    return ['Equipamento', 'Data realizada', 'Manutenção realizada', 'Próxima manutenção', 'Responsável', 'Observações'];
  }
  if (kind === 'RESERVOIR_CLEANING') {
    return ['Data', 'Data da próxima higienização', 'Responsável'];
  }
  if (kind === 'NON_ROUTINE_CLEANING') {
    return ['Equipamento', 'Data da higienização', 'Próxima higienização', 'Produto utilizado', 'Responsável', 'Assinatura'];
  }
  return ['Treinamento', 'Responsável', 'Conteúdos', 'Data', 'Carga horária', 'Participantes', 'Turnos', 'Assinaturas'];
}

function equipmentRows(rows: TemperatureRow[]) {
  const groups = new Map<string, TemperatureRow[]>();

  for (const row of rows) {
    const key = `${dayKey(row.occurredAt)}|${row.responsibleName}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  return Array.from(groups.values()).flatMap((group) => {
    const chunks: TemperatureRow[][] = [];
    for (let index = 0; index < group.length; index += 4) {
      chunks.push(group.slice(index, index + 4));
    }

    return chunks.map((chunk) => [
      chunk[0].occurredAt,
      ...Array.from({ length: 4 }, (_, index) => {
        const reading = chunk[index];
        return reading
          ? `${reading.subject}: ${temperature(reading.temperatureC)}`
          : '';
      }),
      chunk[0].responsibleName,
    ]);
  });
}

function temperatureRows(kind: OperationalExportKind, rows: TemperatureRow[]) {
  if (kind === 'EQUIPMENT') return equipmentRows(rows);

  return rows.map((row) => {
    if (kind === 'READY_FOOD') {
      return [
        row.occurredAt,
        `${row.subject} — ${temperature(row.temperatureC)}`,
        metadataValue(row, 'destination'),
        temperature(row.secondaryTemperatureC),
        row.responsibleName,
      ];
    }
    if (kind === 'REFRIGERATED_FOOD') {
      return [
        row.occurredAt,
        row.subject,
        temperature(row.temperatureC),
        temperature(row.secondaryTemperatureC),
        row.notes || '',
        row.responsibleName,
      ];
    }
    if (kind === 'DISTRIBUTION' || kind === 'DELIVERY') {
      return [
        row.occurredAt,
        row.subject,
        `${row.occurredAt.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        })} — ${temperature(row.temperatureC)}`,
        temperature(row.secondaryTemperatureC),
        temperature(row.tertiaryTemperatureC),
        row.responsibleName,
      ];
    }

    return [
      row.occurredAt,
      row.subject,
      temperature(row.temperatureC),
      row.notes || '',
      row.responsibleName,
    ];
  });
}

function complianceRows(kind: OperationalExportKind, rows: ComplianceRow[]) {
  return rows.map((row) => {
    const data = asRecord(row.data);

    if (kind === 'RECEIVING') {
      const product = stringValue(data.productName) || row.subject;
      const supplier = stringValue(data.supplier);
      return [
        supplier ? `${product} / ${supplier}` : product,
        row.occurredAt,
        stringValue(data.packaging),
        stringValue(data.conservation),
        data.temperatureC === null || data.temperatureC === undefined
          ? ''
          : temperature(Number(data.temperatureC)),
        stringValue(data.deliverer),
        dateValue(data.expirationDate),
        row.responsibleName,
      ];
    }
    if (kind === 'MAINTENANCE') {
      return [
        row.subject,
        row.occurredAt,
        stringValue(data.maintenancePerformed) || row.notes || '',
        row.nextDueAt || '',
        row.responsibleName,
        stringValue(data.observations),
      ];
    }
    if (kind === 'RESERVOIR_CLEANING') {
      return [row.occurredAt, row.nextDueAt || '', row.responsibleName];
    }
    if (kind === 'NON_ROUTINE_CLEANING') {
      return [
        row.subject,
        row.occurredAt,
        row.nextDueAt || '',
        stringValue(data.productUsed),
        row.responsibleName,
        stringValue(data.signature),
      ];
    }

    return [
      row.subject,
      row.responsibleName,
      stringValue(data.contents) || row.notes || '',
      row.occurredAt,
      stringValue(data.workload),
      stringValue(data.participants),
      stringValue(data.shifts),
      stringValue(data.signatures),
    ];
  });
}

function xml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnLetter(index: number) {
  let value = index + 1;
  let output = '';
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output;
}

function cellValue(value: unknown) {
  if (value instanceof Date) {
    return value.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }
  return String(value ?? '');
}

function inlineCell(row: number, column: number, value: unknown, style: number) {
  const ref = `${columnLetter(column)}${row}`;
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(
    cellValue(value)
  )}</t></is></c>`;
}

function worksheetXml(input: {
  title: string;
  restaurantName: string;
  from: Date;
  to: Date;
  columns: string[];
  rows: unknown[][];
}) {
  const lastColumn = columnLetter(input.columns.length - 1);
  const dataRows = input.rows.length
    ? input.rows
    : [
        [
          'Nenhum registro encontrado no período.',
          ...Array.from({ length: input.columns.length - 1 }, () => ''),
        ],
      ];
  const sheetRows = [
    `<row r="1" ht="28" customHeight="1">${inlineCell(
      1,
      0,
      input.title,
      1
    )}</row>`,
    `<row r="2" ht="22" customHeight="1">${inlineCell(
      2,
      0,
      `${input.restaurantName} • ${input.from.toLocaleDateString(
        'pt-BR'
      )} a ${input.to.toLocaleDateString('pt-BR')}`,
      2
    )}</row>`,
    '<row r="3"></row>',
    `<row r="4" ht="34" customHeight="1">${input.columns
      .map((value, column) => inlineCell(4, column, value, 3))
      .join('')}</row>`,
    ...dataRows.map(
      (values, index) =>
        `<row r="${index + 5}">${values
          .map((value, column) => inlineCell(index + 5, column, value, 4))
          .join('')}</row>`
    ),
  ].join('');
  const widths = input.columns
    .map((header, index) => {
      const width = Math.min(Math.max(header.length + 3, 16), 34);
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');
  const lastRow = dataRows.length + 4;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${widths}</cols>
  <sheetData>${sheetRows}</sheetData>
  <autoFilter ref="A4:${lastColumn}${lastRow}"/>
  <mergeCells count="2">
    <mergeCell ref="A1:${lastColumn}1"/>
    <mergeCell ref="A2:${lastColumn}2"/>
  </mergeCells>
  <pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Calibri"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0A7C86"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF073B4C"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD6E1E5"/></left>
      <right style="thin"><color rgb="FFD6E1E5"/></right>
      <top style="thin"><color rgb="FFD6E1E5"/></top>
      <bottom style="thin"><color rgb="FFD6E1E5"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

export async function generateOperationalWorkbook(input: {
  kind: OperationalExportKind;
  restaurantName: string;
  from: Date;
  to: Date;
  temperatures: TemperatureRow[];
  controls: ComplianceRow[];
}) {
  const temperatureKind = [
    'EQUIPMENT',
    'PREPARATION',
    'DELIVERY',
    'FRYING_OIL',
    'READY_FOOD',
    'REFRIGERATED_FOOD',
    'DISTRIBUTION',
  ].includes(input.kind);
  const columns = temperatureKind
    ? temperatureColumns(input.kind)
    : complianceColumns(input.kind);

  const rows =
    input.kind === 'RECEIVING'
      ? [
          ...complianceRows(input.kind, input.controls),
          ...input.temperatures.map((row) => [
            row.subject,
            row.occurredAt,
            metadataValue(row, 'packaging'),
            metadataValue(row, 'conservation'),
            temperature(row.temperatureC),
            metadataValue(row, 'deliverer'),
            dateValue(asRecord(row.metadata).expirationDate),
            row.responsibleName,
          ]),
        ]
      : temperatureKind
        ? temperatureRows(input.kind, input.temperatures)
        : complianceRows(input.kind, input.controls);

  const now = new Date().toISOString();
  const files = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`),
    'docProps/core.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>SafeKitchen Smart</dc:creator>
  <cp:lastModifiedBy>SafeKitchen Smart</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`),
    'docProps/app.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>SafeKitchen Smart</Application>
</Properties>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView/></bookViews>
  <sheets><sheet name="Controle" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(stylesXml()),
    'xl/worksheets/sheet1.xml': strToU8(
      worksheetXml({
        title: kindTitles[input.kind],
        restaurantName: input.restaurantName,
        from: input.from,
        to: input.to,
        columns,
        rows,
      })
    ),
  };

  return Buffer.from(zipSync(files, { level: 6 }));
}
