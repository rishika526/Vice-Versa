export type MedUnit = 'mg' | 'mcg' | 'ml' | 'g';

export type MedRoute = 
  | 'IV' 
  | 'IV push' 
  | 'IM' 
  | 'IO' 
  | 'oral' 
  | 'sublingual' 
  | 'intranasal' 
  | 'nebulised';

export type MedReason = 
  | 'seizure' 
  | 'cardiac arrest' 
  | 'anaphylaxis' 
  | 'pain' 
  | 'overdose' 
  | 'low sugar' 
  | 'chest pain' 
  | 'breathing difficulty';

export interface ExtractedRecord {
  drug: string | null;
  dose: number | null;
  unit: MedUnit | null;
  route: MedRoute | null;
  reason: MedReason | null;
  administeredAt: string; // ISO 8601
  capturedAt: string;     // ISO 8601
  rawText: string;
  timeType: 'just_now' | 'relative' | 'explicit' | 'default_now';
  isProcedure?: boolean;
  procedureName?: string | null;
  extractedFields: {
    drug: boolean;
    dose: boolean;
    unit: boolean;
    route: boolean;
    reason: boolean;
    time: boolean;
  };
}

export type EntityTag = 'DRUG' | 'DOSE' | 'ROUTE' | 'REASON' | 'TIME' | 'PROCEDURE' | 'O';

export interface NERToken {
  text: string;
  tag: EntityTag;
  confidence: number;
}

export interface ExtractedNERResult extends ExtractedRecord {
  engine: 'transformers-quantized' | 'clinical-rule-hybrid';
  modelName: string;
  latencyMs: number;
  confidence: {
    drug: number;
    dose: number;
    route: number;
    reason: number;
    overall: number;
  };
  tokens: NERToken[];
  isProcedure: boolean;
  procedureName: string | null;
}

export interface ConfirmedRecord {
  id: string;
  drug: string;
  dose: number;
  unit: MedUnit;
  route: MedRoute;
  reason: MedReason;
  administeredAt: string; // ISO string
  capturedAt: string;     // ISO string
  rawText: string;
  previousHash: string;
  hash: string;
  timestamp: number;
  safetyWarnings: string[];
  safetyAcknowledged: boolean;
  fhirResource?: any;
  isProcedure?: boolean;
  procedureName?: string | null;
  isReconciled?: boolean;
  reconciledAt?: string;
}

export interface ChainVerificationResult {
  isValid: boolean;
  count: number;
  brokenIndex?: number;
  message: string;
}

export interface SafetyCheckResult {
  warnings: string[];
  isWarning: boolean;
}

export type ViewMode = 'paramedic' | 'hospital';

export interface AmbulanceTelemetryEvent {
  id: string;
  timestamp: number;
  record: ConfirmedRecord;
  fhirJson: any;
  receivedAt: string;
}
