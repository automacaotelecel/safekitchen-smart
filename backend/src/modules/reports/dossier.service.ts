import PDFDocument from 'pdfkit';

type DossierInput = {
  restaurant: { name: string; document: string | null; timezone: string };
  generatedBy: string;
  from: Date;
  to: Date;
  labels: Array<{
    type: string;
    productName: string;
    status: string;
    responsibleName: string;
    openedAt: Date;
    expiresAt: Date | null;
  }>;
  documents: Array<{
    name: string;
    category: string;
    issuedAt: Date | null;
    expiresAt: Date | null;
    status: string;
  }>;
  temperatures: Array<{
    subject: string;
    temperatureC: number;
    status: string;
    source: string;
    responsibleName: string;
    occurredAt: Date;
  }>;
  controls: Array<{
    type: string;
    subject: string;
    responsibleName: string;
    occurredAt: Date;
    nextDueAt: Date | null;
  }>;
  sanitaryAudits: Array<{
    subject: string;
    responsibleName: string;
    occurredAt: Date;
    data: unknown;
  }>;
};

function date(value: Date | null, timezone: string, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    dateStyle: 'short',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(value);
}

function typeName(value: string) {
  const names: Record<string, string> = {
    PRODUTO_ABERTO: 'Produto aberto',
    PRODUCAO: 'Produção',
    DESCONGELAMENTO_DESSALGUE: 'Descongelamento/dessalgue',
    ARMAZENAMENTO_CARNES: 'Armazenamento de carnes',
    REEMBALAGEM: 'Reembalagem',
    AMOSTRAS: 'Amostras',
    NAO_CONFORME: 'Não conforme',
    PRODUTO_QUIMICO: 'Produto químico',
    MAINTENANCE: 'Manutenção',
    RESERVOIR_CLEANING: 'Limpeza de reservatório',
    NON_ROUTINE_CLEANING: 'Limpeza não rotineira',
    TRAINING: 'Treinamento',
    RECEIVING: 'Recebimento de perecíveis',
    AUDIT: 'Auditoria sanitária',
  };
  return names[value] || value;
}

function auditResult(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Sem resultado';
  const value = data as Record<string, unknown>;
  const score = Number(value.score);
  const conform = Number(value.conform);
  const nonConform = Number(value.nonConform);

  if (!Number.isFinite(score)) return 'Sem resultado';

  return `${Math.round(score)}% • C:${Number.isFinite(conform) ? conform : 0} • NC:${Number.isFinite(nonConform) ? nonConform : 0}`;
}

export function generateComplianceDossier(input: DossierInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, info: {
      Title: `Dossiê de conformidade - ${input.restaurant.name}`,
      Author: 'SafeKitchen Smart',
    } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = doc.page.width - 84;
    const timezone = input.restaurant.timezone || 'America/Sao_Paulo';
    const ensure = (height: number) => {
      if (doc.y + height > doc.page.height - 56) doc.addPage();
    };
    const section = (title: string) => {
      ensure(45);
      doc.moveDown(0.6).fillColor('#075b58').font('Helvetica-Bold').fontSize(15).text(title, 42);
      doc.moveTo(42, doc.y + 5).lineTo(42 + width, doc.y + 5).strokeColor('#b8ddda').stroke();
      doc.moveDown(0.8);
    };
    const line = (left: string, right?: string, warning = false) => {
      ensure(32);
      const y = doc.y;
      doc.roundedRect(42, y, width, 26, 6).fill(warning ? '#fff1f0' : '#f3f8f7');
      doc.fillColor(warning ? '#9f2923' : '#183b40').font('Helvetica').fontSize(9)
        .text(left, 50, y + 8, { width: right ? width - 175 : width - 16, ellipsis: true });
      if (right) {
        doc.font('Helvetica-Bold').text(right, 42 + width - 165, y + 8, { width: 155, align: 'right', ellipsis: true });
      }
      doc.y = y + 31;
    };

    doc.rect(0, 0, doc.page.width, 118).fill('#073b45');
    doc.fillColor('#2ee3c2').font('Helvetica-Bold').fontSize(11).text('SAFEKITCHEN SMART', 42, 30);
    doc.fillColor('#ffffff').fontSize(26).text('Dossiê de conformidade', 42, 51);
    doc.font('Helvetica').fontSize(11).text(input.restaurant.name, 42, 84);
    doc.y = 138;
    doc.fillColor('#183b40').fontSize(10)
      .text(`Período: ${date(input.from, timezone)} a ${date(input.to, timezone)}`)
      .text(`Gerado por: ${input.generatedBy}`)
      .text(`Documento da empresa: ${input.restaurant.document || 'não informado'}`);

    const now = new Date();
    const expiringLimit = new Date(now.getTime() + 7 * 86_400_000);
    const activeLabels = input.labels.filter((item) => item.status !== 'CANCELADA');
    const expiredLabels = activeLabels.filter((item) => item.expiresAt && item.expiresAt < now).length;
    const expiringLabels = activeLabels.filter(
      (item) => item.expiresAt && item.expiresAt >= now && item.expiresAt <= expiringLimit
    ).length;
    const validLabels = activeLabels.filter(
      (item) => item.expiresAt && item.expiresAt > expiringLimit
    ).length;
    const labelsWithoutExpiration = activeLabels.filter((item) => !item.expiresAt).length;
    const canceledLabels = input.labels.filter((item) => item.status === 'CANCELADA').length;
    const temperatureAlerts = input.temperatures.filter((item) => item.status === 'ALERT').length;
    const expiredDocuments = input.documents.filter((item) => item.expiresAt && item.expiresAt < now).length;
    const overdueControls = input.controls.filter((item) => item.nextDueAt && item.nextDueAt < now).length;

    section('Resumo executivo');
    line('Etiquetas emitidas no período', String(input.labels.length));
    line('Etiquetas atualmente vencidas', String(expiredLabels), expiredLabels > 0);
    line('Etiquetas a vencer em até 7 dias', String(expiringLabels), expiringLabels > 0);
    line('Leituras de temperatura / alertas', `${input.temperatures.length} / ${temperatureAlerts}`, temperatureAlerts > 0);
    line('Documentos ativos / vencidos', `${input.documents.length} / ${expiredDocuments}`, expiredDocuments > 0);
    line('Controles registrados / atrasados', `${input.controls.length} / ${overdueControls}`, overdueControls > 0);

    section('Situação das etiquetas');
    line('Vencidas', String(expiredLabels), expiredLabels > 0);
    line('A vencer em até 7 dias', String(expiringLabels), expiringLabels > 0);
    line('Válidas por mais de 7 dias', String(validLabels));
    line('Sem prazo de validade', String(labelsWithoutExpiration));
    line('Canceladas no período', String(canceledLabels));

    section('Temperaturas');
    if (!input.temperatures.length) line('Nenhuma leitura no período.');
    for (const item of input.temperatures.slice(0, 250)) {
      line(
        `${item.subject} • ${item.responsibleName} • ${item.source}`,
        `${item.temperatureC.toFixed(1)} °C • ${date(item.occurredAt, timezone, true)}`,
        item.status === 'ALERT'
      );
    }

    section('Documentos e licenças');
    if (!input.documents.length) line('Nenhum documento ativo cadastrado.');
    for (const item of input.documents) {
      const expired = Boolean(item.expiresAt && item.expiresAt < now);
      const expiring = Boolean(
        item.expiresAt && item.expiresAt >= now && item.expiresAt <= new Date(now.getTime() + 30 * 86_400_000)
      );
      const state = expired
        ? 'VENCIDO'
        : expiring
          ? 'A VENCER'
          : item.expiresAt
            ? 'VIGENTE'
            : 'SEM VENCIMENTO';
      line(
        `${item.name} • ${item.category} • emissão ${date(item.issuedAt, timezone)}`,
        `Venc. ${date(item.expiresAt, timezone)} • ${state}`,
        expired
      );
    }

    section('Controles sanitários');
    if (!input.controls.length) line('Nenhum controle no período.');
    for (const item of input.controls) {
      const overdue = Boolean(item.nextDueAt && item.nextDueAt < now);
      line(
        `${typeName(item.type)} • ${item.subject} • ${item.responsibleName}`,
        `Próximo ${date(item.nextDueAt, timezone)}`,
        overdue
      );
    }

    section('Auditorias sanitárias');
    if (!input.sanitaryAudits.length) line('Nenhuma auditoria sanitária no período.');
    for (const item of input.sanitaryAudits) {
      line(
        `${item.subject} • ${item.responsibleName}`,
        `${date(item.occurredAt, timezone)} • ${auditResult(item.data)}`
      );
    }

    ensure(80);
    doc.moveDown().fillColor('#50666a').font('Helvetica').fontSize(8);
    doc.text(
      'Documento gerado eletronicamente a partir dos registros do SafeKitchen Smart. Os registros devem ser conferidos pelo responsável técnico da operação.',
      42,
      doc.y,
      { width, align: 'justify' }
    );

    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      const footer = `SafeKitchen Smart • página ${index + 1} de ${range.count}`;
      doc.fillColor('#7a8d90').font('Helvetica').fontSize(8);
      const footerX = 42 + (width - doc.widthOfString(footer)) / 2;
      doc.text(footer, footerX, doc.page.height - 34, { lineBreak: false });
    }

    doc.end();
  });
}
