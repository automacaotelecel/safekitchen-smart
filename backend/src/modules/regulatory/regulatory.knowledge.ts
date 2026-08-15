export type RegulatoryJurisdiction = 'BR' | 'SP';

export type RegulatorySource = {
  id: string;
  title: string;
  authority: string;
  jurisdiction: RegulatoryJurisdiction;
  status: 'ACTIVE' | 'FUTURE';
  effectiveFrom: string;
  effectiveUntil?: string;
  url: string;
};

export type AuditChecklistItem = {
  id: string;
  section: string;
  reference: string;
  requirement: string;
  evidenceHint: string;
};

export const regulatorySources: RegulatorySource[] = [
  {
    id: 'RDC_216_2004',
    title: 'RDC Anvisa nº 216/2004',
    authority: 'Agência Nacional de Vigilância Sanitária',
    jurisdiction: 'BR',
    status: 'ACTIVE',
    effectiveFrom: '2004-09-15',
    url: 'https://www.gov.br/anvisa/pt-br/arquivos-noticias-anvisa/811json-file-1',
  },
  {
    id: 'CVS_5_2013',
    title: 'Portaria CVS nº 5/2013',
    authority: 'Centro de Vigilância Sanitária do Estado de São Paulo',
    jurisdiction: 'SP',
    status: 'ACTIVE',
    effectiveFrom: '2013-04-19',
    effectiveUntil: '2026-10-03',
    url: 'https://cvs.saude.sp.gov.br/up/PORTARIA%20CVS-5_090413.pdf',
  },
  {
    id: 'CVS_3_2026',
    title: 'Portaria CVS nº 3/2026',
    authority: 'Centro de Vigilância Sanitária do Estado de São Paulo',
    jurisdiction: 'SP',
    status: 'FUTURE',
    effectiveFrom: '2026-10-04',
    url: 'https://www.doe.sp.gov.br/executivo/secretaria-da-saude/portaria-cvs-n-3-de-3-de-julho-de-2026-20260703113712132141965199',
  },
];

export const regulatoryKnowledge = [
  {
    id: 'RDC216_SCOPE',
    sourceId: 'RDC_216_2004',
    keywords: ['rdc 216', 'abrangência', 'serviço de alimentação', 'restaurante'],
    text:
      'A RDC Anvisa nº 216/2004 estabelece Boas Práticas para serviços de alimentação e organiza os requisitos em instalações, higienização, água, resíduos, manipuladores, matérias-primas, preparo, armazenamento, transporte, exposição, documentação e responsabilidade.',
  },
  {
    id: 'RDC216_HOT_COLD',
    sourceId: 'RDC_216_2004',
    keywords: ['temperatura', 'quente', 'frio', 'distribuição', 'exposição'],
    text:
      'Na conservação e exposição, a RDC 216 exige controle de tempo e temperatura. Alimentos preparados mantidos quentes devem permanecer em condição de segurança; para conservação refrigerada, o prazo deve considerar a temperatura e a natureza do alimento. A equipe deve registrar medições e agir quando o limite adotado não for atendido.',
  },
  {
    id: 'RDC216_COOLING',
    sourceId: 'RDC_216_2004',
    keywords: ['resfriamento', 'refrigerado', 'congelamento', 'preparo'],
    text:
      'O resfriamento de alimento preparado deve reduzir rapidamente a temperatura para limitar a multiplicação microbiana. Depois, o alimento deve ser conservado refrigerado ou congelado em condição controlada, identificado e protegido contra contaminação.',
  },
  {
    id: 'RDC216_RECEIVING',
    sourceId: 'RDC_216_2004',
    keywords: ['recebimento', 'fornecedor', 'embalagem', 'validade', 'matéria-prima'],
    text:
      'No recebimento, matérias-primas, ingredientes e embalagens devem ser inspecionados. A verificação deve considerar integridade, identificação, prazo de validade, condições de conservação e, quando aplicável, temperatura.',
  },
  {
    id: 'RDC216_DOCUMENTS',
    sourceId: 'RDC_216_2004',
    keywords: ['documentação', 'registro', 'manual', 'pop', 'procedimento'],
    text:
      'O serviço de alimentação deve manter Manual de Boas Práticas e Procedimentos Operacionais Padronizados aplicáveis, além dos registros necessários para demonstrar execução, monitoramento e ações corretivas.',
  },
  {
    id: 'SP_TRANSITION_2026',
    sourceId: 'CVS_3_2026',
    keywords: ['cvs 3', 'cvs 5', 'são paulo', 'sp', 'vigência', 'transição'],
    text:
      'Em São Paulo, a Portaria CVS nº 3/2026 foi publicada em julho de 2026 e prevê início de vigência 90 dias após a publicação. Até a entrada em vigor, a operação deve observar a norma estadual vigente e preparar a atualização dos procedimentos para a nova regra. Requisitos municipais também podem ser aplicáveis.',
  },
];

export const rdc216AuditChecklist: AuditChecklistItem[] = [
  {
    id: 'BLD_01',
    section: 'Edificação e instalações',
    reference: 'RDC 216/2004, item 4.1',
    requirement: 'Fluxo de trabalho reduz risco de contaminação cruzada e facilita limpeza.',
    evidenceHint: 'Planta, fluxo observado, separação de áreas e barreiras.',
  },
  {
    id: 'BLD_02',
    section: 'Edificação e instalações',
    reference: 'RDC 216/2004, item 4.1',
    requirement: 'Pisos, paredes, tetos, portas e superfícies estão íntegros e higienizáveis.',
    evidenceHint: 'Inspeção visual e plano de manutenção.',
  },
  {
    id: 'BLD_03',
    section: 'Edificação e instalações',
    reference: 'RDC 216/2004, item 4.1',
    requirement: 'Equipamentos, móveis e utensílios são adequados, conservados e permitem higienização.',
    evidenceHint: 'Inventário, manutenção e inspeção visual.',
  },
  {
    id: 'HYG_01',
    section: 'Higienização',
    reference: 'RDC 216/2004, item 4.2',
    requirement: 'Existem rotinas definidas de limpeza e desinfecção das instalações e equipamentos.',
    evidenceHint: 'POP, cronograma, produtos e registros de execução.',
  },
  {
    id: 'HYG_02',
    section: 'Higienização',
    reference: 'RDC 216/2004, item 4.2',
    requirement: 'Produtos saneantes são regularizados, identificados e armazenados separadamente.',
    evidenceHint: 'Rótulos, fichas técnicas e local de armazenamento.',
  },
  {
    id: 'PEST_01',
    section: 'Controle de vetores e pragas',
    reference: 'RDC 216/2004, item 4.3',
    requirement: 'A operação mantém ações contínuas para impedir atração, abrigo e acesso de pragas.',
    evidenceHint: 'Barreiras, mapa de iscas, registros e certificado da empresa.',
  },
  {
    id: 'WAT_01',
    section: 'Abastecimento de água',
    reference: 'RDC 216/2004, item 4.4',
    requirement: 'A água utilizada é potável e o reservatório permanece protegido e higienizado.',
    evidenceHint: 'Laudos, comprovantes e registro de higienização.',
  },
  {
    id: 'WST_01',
    section: 'Resíduos',
    reference: 'RDC 216/2004, item 4.5',
    requirement: 'Resíduos são acondicionados e removidos sem contaminar alimentos ou áreas limpas.',
    evidenceHint: 'Recipientes, rota de retirada e frequência.',
  },
  {
    id: 'HND_01',
    section: 'Manipuladores',
    reference: 'RDC 216/2004, item 4.6',
    requirement: 'Manipuladores cumprem higiene pessoal, uniforme e lavagem correta das mãos.',
    evidenceHint: 'Observação, lavatórios abastecidos e orientação visual.',
  },
  {
    id: 'HND_02',
    section: 'Manipuladores',
    reference: 'RDC 216/2004, item 4.6',
    requirement: 'A condição de saúde dos manipuladores é acompanhada e situações de risco são afastadas da manipulação.',
    evidenceHint: 'Procedimento, registros e comunicação interna.',
  },
  {
    id: 'HND_03',
    section: 'Manipuladores',
    reference: 'RDC 216/2004, itens 4.6 e 4.12',
    requirement: 'Há capacitação periódica e responsável definido pelas Boas Práticas.',
    evidenceHint: 'Lista de presença, conteúdo, carga horária e responsável.',
  },
  {
    id: 'RCV_01',
    section: 'Recebimento e armazenamento',
    reference: 'RDC 216/2004, item 4.7',
    requirement: 'Fornecedores e produtos são avaliados no recebimento quanto a integridade, validade e conservação.',
    evidenceHint: 'Controle de recebimento e critérios de rejeição.',
  },
  {
    id: 'RCV_02',
    section: 'Recebimento e armazenamento',
    reference: 'RDC 216/2004, item 4.7',
    requirement: 'Matérias-primas são armazenadas protegidas, identificadas e respeitando condições de conservação.',
    evidenceHint: 'Etiquetas, organização, temperatura e segregação.',
  },
  {
    id: 'PRE_01',
    section: 'Preparação dos alimentos',
    reference: 'RDC 216/2004, item 4.8',
    requirement: 'Medidas evitam contato entre alimentos crus, preparados e prontos para consumo.',
    evidenceHint: 'Fluxo, utensílios, bancadas e prática observada.',
  },
  {
    id: 'PRE_02',
    section: 'Preparação dos alimentos',
    reference: 'RDC 216/2004, item 4.8',
    requirement: 'Cocção e tratamento térmico são controlados e verificados quando aplicável.',
    evidenceHint: 'Planilha de temperatura e termômetro calibrado.',
  },
  {
    id: 'PRE_03',
    section: 'Preparação dos alimentos',
    reference: 'RDC 216/2004, item 4.8',
    requirement: 'Descongelamento é feito sob condição controlada e sem permanência indevida em temperatura ambiente.',
    evidenceHint: 'Procedimento, identificação e registros.',
  },
  {
    id: 'PRE_04',
    section: 'Preparação dos alimentos',
    reference: 'RDC 216/2004, item 4.8',
    requirement: 'Resfriamento, refrigeração e congelamento são monitorados e registrados.',
    evidenceHint: 'Tempos, temperaturas, recipientes e ações corretivas.',
  },
  {
    id: 'PRE_05',
    section: 'Preparação dos alimentos',
    reference: 'RDC 216/2004, item 4.8',
    requirement: 'Óleos e gorduras de fritura são monitorados e substituídos quando inadequados.',
    evidenceHint: 'Temperatura, características sensoriais e registro de troca.',
  },
  {
    id: 'STO_01',
    section: 'Armazenamento e transporte',
    reference: 'RDC 216/2004, item 4.9',
    requirement: 'Alimentos preparados são identificados, protegidos e mantidos em tempo e temperatura seguros.',
    evidenceHint: 'Etiquetas, histórico de temperatura e organização.',
  },
  {
    id: 'DSP_01',
    section: 'Exposição e distribuição',
    reference: 'RDC 216/2004, item 4.10',
    requirement: 'Equipamentos de exposição e distribuição mantêm o alimento protegido e sob controle de temperatura.',
    evidenceHint: 'Medições, barreiras de proteção e utensílios.',
  },
  {
    id: 'DOC_01',
    section: 'Documentação e registros',
    reference: 'RDC 216/2004, item 4.11',
    requirement: 'Manual de Boas Práticas está atualizado e corresponde à operação real.',
    evidenceHint: 'Documento vigente, aprovação e revisão.',
  },
  {
    id: 'DOC_02',
    section: 'Documentação e registros',
    reference: 'RDC 216/2004, item 4.11',
    requirement: 'POPs obrigatórios estão disponíveis, implantados e acompanhados por registros.',
    evidenceHint: 'POPs, formulários, evidências e ações corretivas.',
  },
  {
    id: 'DOC_03',
    section: 'Documentação e registros',
    reference: 'RDC 216/2004, item 4.11',
    requirement: 'Registros possuem data, responsável, rastreabilidade e período de guarda definido.',
    evidenceHint: 'Planilhas, sistema, assinaturas e histórico.',
  },
  {
    id: 'MGT_01',
    section: 'Responsabilidade',
    reference: 'RDC 216/2004, item 4.12',
    requirement: 'Existe responsável capacitado para acompanhar manipulação e Boas Práticas.',
    evidenceHint: 'Designação, formação/capacitação e rotina de supervisão.',
  },
];

export const saoPauloAuditChecklist: AuditChecklistItem[] = [
  {
    id: 'SP_TRN_01',
    section: 'Legislação complementar - São Paulo',
    reference: 'Portarias CVS nº 5/2013 e nº 3/2026 (período de transição)',
    requirement:
      'O estabelecimento identificou quais procedimentos e documentos precisam ser atualizados para a entrada em vigor do novo regulamento estadual.',
    evidenceHint:
      'Plano de adequação, responsável, prazos internos e registro de revisão dos procedimentos.',
  },
  {
    id: 'SP_DOC_01',
    section: 'Legislação complementar - São Paulo',
    reference: 'Portaria CVS nº 5/2013 - documentação e registros',
    requirement:
      'Os documentos de Boas Práticas refletem a operação, permanecem acessíveis e possuem registros que demonstram sua execução.',
    evidenceHint: 'Manual, POPs, formulários preenchidos, responsáveis e datas de revisão.',
  },
  {
    id: 'SP_RCV_01',
    section: 'Legislação complementar - São Paulo',
    reference: 'Portaria CVS nº 5/2013 - recebimento e armazenamento',
    requirement:
      'O recebimento de perecíveis adota critérios documentados de integridade, validade, conservação, temperatura quando aplicável e rejeição.',
    evidenceHint: 'Controle de recebimento, registros de temperatura e critérios de devolução.',
  },
  {
    id: 'SP_TMP_01',
    section: 'Legislação complementar - São Paulo',
    reference: 'Portaria CVS nº 5/2013 - controle de tempo e temperatura',
    requirement:
      'Os limites de tempo e temperatura adotados pela operação estão definidos, monitorados e validados pelo responsável técnico.',
    evidenceHint: 'Planilhas, limites aprovados, calibração e ações corretivas registradas.',
  },
];

export function checklistForJurisdiction(jurisdiction: RegulatoryJurisdiction) {
  return jurisdiction === 'SP'
    ? [...rdc216AuditChecklist, ...saoPauloAuditChecklist]
    : rdc216AuditChecklist;
}

export function sourcesForJurisdiction(jurisdiction: RegulatoryJurisdiction) {
  return regulatorySources.filter(
    (source) => source.jurisdiction === 'BR' || source.jurisdiction === jurisdiction
  );
}
