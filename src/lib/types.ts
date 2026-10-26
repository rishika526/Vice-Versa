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
  extractedFields: {
    drug: boolean;
    dose: boolean;
    unit: boolean;
    route: boolean;
    reason: boolean;
    time: boolean;
  };
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
