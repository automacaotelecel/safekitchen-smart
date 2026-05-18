import type { LabelType } from '../types';

export const labelTypes: { value: LabelType; label: string; description: string }[] = [
  { value: 'PRODUTO_ABERTO', label: 'Produto aberto', description: 'Produto industrializado aberto ou retirado da embalagem original.' },
  { value: 'PRODUCAO', label: 'Produção', description: 'Alimentos manipulados, sobremesas, saladas e molhos.' },
  { value: 'DESCONGELAMENTO_DESSALGUE', label: 'Descongelamento/dessalgue', description: 'Controle de início, fim e validade após descongelamento.' },
  { value: 'ARMAZENAMENTO_CARNES', label: 'Armazenamento de carnes', description: 'Rastreabilidade, lote, corte e conservação.' },
  { value: 'REEMBALAGEM', label: 'Reembalagem', description: 'Produto transferido para nova embalagem.' },
  { value: 'AMOSTRAS', label: 'Amostras', description: 'Identificação de amostras de produção.' },
  { value: 'NAO_CONFORME', label: 'Não conforme', description: 'Produto segregado ou bloqueado.' },
  { value: 'PRODUTO_QUIMICO', label: 'Produto químico', description: 'Diluição, horário, lote e responsável.' }
];

export function labelTypeName(type: LabelType) {
  return labelTypes.find((item) => item.value === type)?.label || type;
}
