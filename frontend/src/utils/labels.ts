import type { LabelType } from '../types';

export const labelTypes: { value: LabelType; label: string; description: string }[] = [
  {
    value: 'PRODUTO_ABERTO',
    label: 'Produto aberto',
    description: 'Produto industrializado aberto.'
  },
  {
    value: 'PRODUCAO',
    label: 'Produção',
    description: 'Produtos manipulados, preparados e pré-preparados.'
  },
  {
    value: 'DESCONGELAMENTO_DESSALGUE',
    label: 'Descongelamento/dessalgue',
    description: 'Data/hora de início, validade, método e responsável.'
  },
  {
    value: 'ARMAZENAMENTO_CARNES',
    label: 'Armazenamento de carnes',
    description: 'Tipo, fornecedor, lote, MAPA/SIF, validade e armazenamento.'
  },
  {
    value: 'REEMBALAGEM',
    label: 'Reembalagem',
    description: 'Produto transferido para nova embalagem, lote e nova validade.'
  },
  {
    value: 'AMOSTRAS',
    label: 'Amostras',
    description: 'Coleta, responsável, restaurante e descarte automático em 72h.'
  },
  {
    value: 'NAO_CONFORME',
    label: 'Não conforme',
    description: 'Produto segregado, motivo da não conformidade e ação tomada.'
  },
  {
    value: 'PRODUTO_QUIMICO',
    label: 'Produto químico',
    description: 'Finalidade, diluição, preparo, validade e responsável.'
  }
];

export function labelTypeName(type: LabelType) {
  return labelTypes.find((item) => item.value === type)?.label || type;
}
