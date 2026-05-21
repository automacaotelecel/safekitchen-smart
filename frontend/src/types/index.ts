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

export type LabelStatus =
  | 'ATIVA'
  | 'VALIDA'
  | 'VENCIDA'
  | 'PROXIMA'
  | 'CANCELADA'
  | string;

export type ValidityUnit = 'days' | 'hours';

export type ValidityRule = {
  id: string;
  productId?: string | null;
  category: string;
  description: string;
  conservationMode: ConservationMode;
  validityValue: number;
  validityUnit: ValidityUnit;
  source: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Product = {
  id: string;
  restaurantId?: string | null;
  name: string;
  category: string;
  imageUrl?: string | null;
  defaultMode: ConservationMode;
  keywords: string;
  isGlobal: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  validityRules: ValidityRule[];
  _count?: {
    labels?: number;
  };
};

export type ProductDetails = Product & {
  labels?: Label[];
};

export type Employee = {
  id: string;
  restaurantId?: string;
  name: string;
  role?: string | null;
  shift?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LabelExtraData = {
  restaurantName?: string;
  collectionDate?: string;
  collectionTime?: string;
  discardAt?: string;

  chemicalPurpose?: string;
  dilutionMl?: string;
  dilutionLiters?: string;
  preparationDate?: string;
  preparationTime?: string;
  chemicalValidity?: string;

  nonConformityReasons?: string[];
  otherNonConformity?: string;
  identificationDate?: string;
  actionTaken?: string[];

  thawingMethod?: string;
  startDate?: string;
  startTime?: string;

  meatType?: string;
  mapaSif?: string;
  receiptDate?: string;
  storageType?: string;

  repackagingDate?: string;
  originalValidity?: string;
  newValidity?: string;

  [key: string]: unknown;
};

export type Label = {
  id: string;
  restaurantId?: string;
  type: LabelType;
  productId?: string | null;
  employeeId?: string | null;
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
  status: LabelStatus;
  extraData?: LabelExtraData | string | null;
  createdAt: string;
  updatedAt?: string;
};

export type Restaurant = {
  id: string;
  name: string;
  document?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type User = {
  id: string;
  restaurantId?: string;
  name: string;
  email: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type DashboardSummary = {
  totalProducts?: number;
  totalLabels?: number;
  expiredLabels?: number;
  expiringSoonLabels?: number;
  activeEmployees?: number;
  recentLabels?: Label[];
};

export type VisionSuggestion = {
  productName: string;
  brand: string;
  category: string;
  conservationMode: ConservationMode;
  labelType: LabelType;
  keywords: string;
  confidence: number;
  notes: string;
};

export type VisionIdentifyResponse = {
  suggestion: VisionSuggestion;
  matchedProduct: Product | null;
  warning: string;
};

export type ApiResponse<T> = {
  ok: boolean;
  data: T;
  message?: string;
  details?: unknown;
};