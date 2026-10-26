import type { ConfirmedRecord, MedUnit, SafetyCheckResult } from './types';

interface MaxDoseRule {
  maxAmount: number;
  unit: MedUnit;
  explanation: string;
}

const MAX_DOSE_LIMITS: Record<string, MaxDoseRule> = {
  'Midazolam': { maxAmount: 10, unit: 'mg', explanation: 'Standard adult max single dose is 10 mg (status epilepticus).' },
  'Epinephrine': { maxAmount: 1, unit: 'mg', explanation: 'Standard adult max single dose is 1 mg (cardiac arrest) or 0.5 mg (anaphylaxis).' },
  'Morphine': { maxAmount: 15, unit: 'mg', explanation: 'Standard adult single dose analgesia rarely exceeds 10–15 mg without physician order.' },
  'Fentanyl': { maxAmount: 200, unit: 'mcg', explanation: 'Standard single adult dose is 25–100 mcg. >200 mcg requires medical control.' },
  'Naloxone': { maxAmount: 4, unit: 'mg', explanation: 'Typical initial dose is 0.4–2 mg. Dosages >4 mg should be titrated with caution.' },
  'Aspirin': { maxAmount: 325, unit: 'mg', explanation: 'Standard cardiac protocol is 162–324 mg chewed.' },
  'Atropine': { maxAmount: 3, unit: 'mg', explanation: 'Cumulative vagolytic limit is 3 mg. Single dose >3 mg is toxic.' },
  'Ondansetron': { maxAmount: 8, unit: 'mg', explanation: 'Standard single adult IV or ODT dose is 4–8 mg.' },
  'Salbutamol': { maxAmount: 5, unit: 'mg', explanation: 'Standard single nebulised dose is 2.5–5 mg.' },
  'Diazepam': { maxAmount: 10, unit: 'mg', explanation: 'Standard single IV bolus is 5–10 mg.' },
  'Ketamine': { maxAmount: 200, unit: 'mg', explanation: 'Standard procedural/sedation single bolus is 1–2 mg/kg (capped at 200 mg).' },
  'Dextrose (D50)': { maxAmount: 50, unit: 'ml', explanation: 'Standard single ampule is 50 ml of 50% dextrose (25 g).' },
  'Normal Saline': { maxAmount: 2000, unit: 'ml', explanation: 'Rapid bolus should be reassessed after each 500–1000 ml infusion.' },
};

function convertDose(amount: number, fromUnit: MedUnit, toUnit: MedUnit): number | null {
  if (fromUnit === toUnit) return amount;

  // mg <-> mcg
  if (fromUnit === 'mg' && toUnit === 'mcg') return amount * 1000;
  if (fromUnit === 'mcg' && toUnit === 'mg') return amount / 1000;

  // g <-> mg
  if (fromUnit === 'g' && toUnit === 'mg') return amount * 1000;
  if (fromUnit === 'mg' && toUnit === 'g') return amount / 1000;

  // Incompatible unit conversion (e.g. ml to mg)
  return null;
}

/**
 * Runs safety checks on proposed medication administration.
 * 1. Checks max dose lookup table.
 * 2. Checks duplicate administration within last 2 minutes.
 */
export function checkSafety(
  drug: string,
  dose: number,
  unit: MedUnit,
  existingRecords: ConfirmedRecord[],
  currentTime: Date = new Date()
): SafetyCheckResult {
  const warnings: string[] = [];

  // 1. Max Sane Dose Check
  const rule = MAX_DOSE_LIMITS[drug];
  if (rule) {
    const converted = convertDose(dose, unit, rule.unit);
    if (converted !== null && converted > rule.maxAmount) {
      warnings.push(
        `High Dose Warning: ${dose} ${unit} exceeds standard prehospital single dose limit of ${rule.maxAmount} ${rule.unit}. ${rule.explanation}`
      );
    }
  }

  // 2. Duplicate Check within 2 minutes (120,000 ms)
  const TWO_MINUTES_MS = 2 * 60 * 1000;
  const currentMs = currentTime.getTime();

  for (const record of existingRecords) {
    if (record.drug.toLowerCase() === drug.toLowerCase()) {
      const recordTime = new Date(record.administeredAt).getTime();
      const diffMs = Math.abs(currentMs - recordTime);

      if (diffMs <= TWO_MINUTES_MS) {
        const secondsAgo = Math.max(1, Math.round(diffMs / 1000));
        warnings.push(
          `Possible Duplicate Warning: ${record.drug} ${record.dose} ${record.unit} via ${record.route} was already logged ~${secondsAgo}s ago.`
        );
        break;
      }
    }
  }

  return {
    warnings,
    isWarning: warnings.length > 0,
  };
}
