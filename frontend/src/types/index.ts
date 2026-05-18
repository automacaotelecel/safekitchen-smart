export type ConservationMode = 'AMBIENTE' | 'REFRIGERADO' | 'CONGELADO';

export type LabelType =
  | 'PRODUTO_ABERTO'
  | 'PRODUCAO'
  | 'DESCONGELAMENTO_DESSALGUE'
  | 'ARMAZENAMENTO_CARNES'
  | 'REEMBALAGEM'
  | 'AMOSTRAS'
  | 'NAO_CONFORME'
  | 'PRODUTO_QUIMICO';

export type Product = {
  id: string;
  name: string;
  category: string;
  imageUrl?: string | null;
  defaultMode: ConservationMode;
  keywords: string;
  isGlobal: boolean;
  createdAt?: string;
  updatedAt?: string;
  validityRules: ValidityRule[];
};

export type ProductDetails = Product & {
  labels: Label[];
};

export type ValidityRule = {
  id: string;
  category: string;
  description: string;
  conservationMode: ConservationMode;
  validityValue: number;
  validityUnit: 'days' | 'hours';
  source: string;
};

export type Employee = {
  id: string;
  name: string;
  active: boolean;
};

export type Label = {
  id: string;
  type: LabelType;
  productId?: string | null;
  productName: string;
  brand?: string | null;
  supplier?: string | null;
  batch?: string | null;
  conservationMode: ConservationMode;
  openedAt: string;
  expiresAt?: string | null;
  quantity?: string | null;
  responsibleName: string;
  observations?: string | null;
  status: string;
  createdAt: string;
};

export type ApiResponse<T> = {
  ok: boolean;
  data: T;
  message?: string;
  details?: unknown;
};
