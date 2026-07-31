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
  sampleShift?: string;
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
  receivingTemperatureC?: number | string;
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
  detectedBatch?: string;
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

export type RegulatorySource = {
  id: string;
  title: string;
  authority: string;
  jurisdiction: 'BR' | 'SP';
  status: 'ACTIVE' | 'FUTURE';
  effectiveFrom: string;
  effectiveUntil?: string;
  url: string;
};

export type RegulatoryAnswer = {
  answer: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sources: RegulatorySource[];
  disclaimer: string;
};

export type AuditChecklistResult = 'CONFORM' | 'NON_CONFORM' | 'NOT_APPLICABLE';

export type AuditChecklistItem = {
  id: string;
  section: string;
  reference: string;
  requirement: string;
  evidenceHint: string;
};

export type AuditTemplate = {
  id: string;
  name: string;
  version: string;
  jurisdiction: 'BR' | 'SP';
  disclaimer: string;
  sources: RegulatorySource[];
  items: AuditChecklistItem[];
};

export type AuditRecord = ComplianceRecord & {
  data?: {
    templateId?: string;
    templateVersion?: string;
    jurisdiction?: 'BR' | 'SP';
    score?: number;
    conform?: number;
    nonConform?: number;
    notApplicable?: number;
    total?: number;
  };
};

export type ApiResponse<T> = {
  ok: boolean;
  data: T;
  message?: string;
  details?: unknown;
};

export type TemperatureCategory =
  | 'EQUIPMENT'
  | 'PREPARATION'
  | 'DELIVERY'
  | 'FRYING_OIL'
  | 'READY_FOOD'
  | 'REFRIGERATED_FOOD'
  | 'DISTRIBUTION'
  | 'RECEIVING';

export type TemperaturePoint = {
  id: string;
  name: string;
  category: TemperatureCategory;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  active: boolean;
};

export type TemperatureReading = {
  id: string;
  pointId?: string | null;
  category: TemperatureCategory;
  subject: string;
  temperatureC: number;
  secondaryTemperatureC?: number | null;
  tertiaryTemperatureC?: number | null;
  occurredAt: string;
  source: 'MANUAL' | 'DEVICE' | string;
  status: 'NORMAL' | 'ALERT' | string;
  responsibleName: string;
  notes?: string | null;
  point?: TemperaturePoint | null;
};

export type StoredDocument = {
  id: string;
  name: string;
  category: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  reminderDays: number;
  notes?: string | null;
  status: string;
  createdAt: string;
};

export type ComplianceType =
  | 'MAINTENANCE'
  | 'RESERVOIR_CLEANING'
  | 'NON_ROUTINE_CLEANING'
  | 'TRAINING'
  | 'RECEIVING'
  | 'AUDIT';

export type ComplianceRecord = {
  id: string;
  type: ComplianceType;
  subject: string;
  occurredAt: string;
  nextDueAt?: string | null;
  responsibleName: string;
  notes?: string | null;
  data?: Record<string, unknown> | null;
  status: string;
  createdAt: string;
};

export type PlanCode = 'START' | 'PRO';

export type CommercialPlan = {
  code: PlanCode;
  name: string;
  audience: string;
  description: string;
  setupAmountCents: number;
  amountCents: number;
  currency: 'BRL';
  interval: 'MONTH';
  highlighted: boolean;
  maxUsers: number;
  maxLabelsPerMonth: number | null;
  maxAiAnalysesPerMonth: number;
  maxDevices: number;
  implementationItems: string[];
  features: string[];
};

export type SubscriptionInfo = {
  id: string;
  planCode: PlanCode;
  status: 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | string;
  payerEmail?: string | null;
  checkoutUrl?: string | null;
  amountCents: number;
  currency: string;
  currentPeriodEnd?: string | null;
  canceledAt?: string | null;
};

export type ImplementationOrderInfo = {
  id: string;
  planCode: PlanCode;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'ERROR' | string;
  checkoutUrl?: string | null;
  amountCents: number;
  currency: string;
  providerPaymentId?: string | null;
  paidAt?: string | null;
  implementationStatus?: 'AWAITING_PAYMENT' | 'AWAITING_SCHEDULING' | 'SCHEDULED' | 'COMPLETED' | string;
  scheduledAt?: string | null;
  scheduledFor?: string | null;
  meetingUrl?: string | null;
  scheduleNotes?: string | null;
  scheduleEmailedAt?: string | null;
  scheduleEmailError?: string | null;
  completedAt?: string | null;
};

export type CommercialContractInfo = {
  id: string;
  contractNumber: string;
  version: string;
  status: string;
  customerEmail: string;
  acceptedAt: string;
  activatedAt?: string | null;
  emailedAt?: string | null;
  emailError?: string | null;
  welcomeEmailedAt?: string | null;
  welcomeEmailError?: string | null;
};

export type AppNotification = {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  link?: string | null;
  readAt?: string | null;
  emailSentAt?: string | null;
  createdAt: string;
};

export type NotificationPreference = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  labelsEnabled: boolean;
  documentsEnabled: boolean;
  complianceEnabled: boolean;
  temperatureEnabled: boolean;
  deviceOfflineEnabled: boolean;
};
