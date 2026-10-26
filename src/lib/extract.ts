import type { ExtractedRecord, MedReason, MedRoute, MedUnit } from './types';

// Lexicon dictionaries
interface DrugLexiconEntry {
  canonical: string;
  aliases: string[];
}

const DRUG_LEXICON: DrugLexiconEntry[] = [
  { canonical: 'Midazolam', aliases: ['midazolam', 'versed'] },
  { canonical: 'Epinephrine', aliases: ['epinephrine', 'adrenaline', 'epi'] },
  { canonical: 'Morphine', aliases: ['morphine', 'morphine sulfate'] },
  { canonical: 'Fentanyl', aliases: ['fentanyl', 'sublimaze'] },
  { canonical: 'Naloxone', aliases: ['naloxone', 'narcan'] },
  { canonical: 'Aspirin', aliases: ['aspirin', 'asa', 'acetylsalicylic acid'] },
  { canonical: 'Atropine', aliases: ['atropine', 'atropine sulfate'] },
  { canonical: 'Ondansetron', aliases: ['ondansetron', 'zofran'] },
  { canonical: 'Salbutamol', aliases: ['salbutamol', 'albuterol', 'ventolin'] },
  { canonical: 'Diazepam', aliases: ['diazepam', 'valium'] },
  { canonical: 'Ketamine', aliases: ['ketamine', 'ketalar'] },
  { canonical: 'Dextrose (D50)', aliases: ['dextrose', 'd50', 'd 50', 'glucose'] },
  { canonical: 'Normal Saline', aliases: ['normal saline', 'saline', '0.9 nacl', 'nacl'] },
];

const ROUTE_RULES: { route: MedRoute; regex: RegExp }[] = [
  { route: 'IV push', regex: /\b(iv\s*push|intravenous\s*push|i\.v\.\s*push)\b/i },
  { route: 'IV', regex: /\b(iv|intravenous|i\.v\.)\b/i },
  { route: 'IM', regex: /\b(im|intramuscular|i\.m\.)\b/i },
  { route: 'IO', regex: /\b(io|intraosseous|i\.o\.)\b/i },
  { route: 'sublingual', regex: /\b(sublingual|sublingually|sub-lingual|s\.l\.|sl)\b/i },
  { route: 'intranasal', regex: /\b(intranasal|intranasally|intra-nasal|nasal|i\.n\.)\b/i },
  { route: 'nebulised', regex: /\b(nebulised|nebulized|nebuliser|nebulizer|neb|nebs)\b/i },
  { route: 'oral', regex: /\b(oral|orally|by\s*mouth|po|p\.o\.)\b/i },
];

const REASON_RULES: { reason: MedReason; regex: RegExp }[] = [
  { reason: 'seizure', regex: /\b(active\s*seizure|seizure|seizures|seizing|convulsion|convulsions|convulsing|status\s*epilepticus)\b/i },
  { reason: 'cardiac arrest', regex: /\b(cardiac\s*arrest|arrest|asystole|pulseless|code\s*blue|ventricular\s*fibrillation|v-fib)\b/i },
  { reason: 'anaphylaxis', regex: /\b(anaphylaxis|anaphylactic|severe\s*allergy|allergic\s*reaction)\b/i },
  { reason: 'pain', regex: /\b(pain|severe\s*pain|acute\s*pain|analgesia)\b/i },
  { reason: 'overdose', regex: /\b(overdose|od|narcotic\s*overdose|opioid\s*overdose|opioid\s*toxicity)\b/i },
  { reason: 'low sugar', regex: /\b(low\s*sugar|hypoglycemia|hypoglycemic|hypo|low\s*blood\s*sugar)\b/i },
  { reason: 'chest pain', regex: /\b(chest\s*pain|angina|myocardial\s*infarction|acs|heart\s*attack)\b/i },
  { reason: 'breathing difficulty', regex: /\b(breathing\s*difficulty|shortness\s*of\s*breath|dyspnea|sob|respiratory\s*distress|asthma\s*attack|wheezing)\b/i },
];

const SPOKEN_NUMBERS: Record<string, number> = {
  'zero': 0,
  'one': 1,
  'two': 2,
  'three': 3,
  'four': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8,
  'nine': 9,
  'ten': 10,
  'half': 0.5,
  'quarter': 0.25,
  'point five': 0.5,
  'zero point five': 0.5,
  'one point five': 1.5,
  'two point five': 2.5,
};

/**
 * Extracts structured medication fields from plain text note.
 * Pure typescript, local rule-based extractor.
 */
export function extractNote(text: string, referenceTime: Date = new Date()): ExtractedRecord {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();

  // 1. Extract Time first to prevent numbers in time (e.g. "at 1:44", "5 minutes ago")
  // from being confused with medication doses.
  let administeredAt = referenceTime.toISOString();
  const capturedAt = referenceTime.toISOString();
  let timeType: 'just_now' | 'relative' | 'explicit' | 'default_now' = 'default_now';
  let timeExtracted = false;

  // Mask string to remove time fragments from dose matching
  let textForDose = lower;

  // Check "just now" / "right now" / "now"
  if (/\b(just\s*now|right\s*now)\b/i.test(lower)) {
    administeredAt = referenceTime.toISOString();
    timeType = 'just_now';
    timeExtracted = true;
    textForDose = textForDose.replace(/\b(just\s*now|right\s*now)\b/gi, ' ');
  } 
  // Check "N minutes ago" e.g. "five minutes ago", "5 minutes ago", "10 min ago"
  else {
    const relativeMatch = lower.match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s*(?:minute|minutes|min|mins)\s*ago\b/i);
    if (relativeMatch) {
      let mins = 0;
      const numStr = relativeMatch[1].toLowerCase();
      if (SPOKEN_NUMBERS[numStr] !== undefined) {
        mins = SPOKEN_NUMBERS[numStr];
      } else {
        mins = parseInt(numStr, 10) || 0;
      }
      const adminDate = new Date(referenceTime.getTime() - mins * 60 * 1000);
      administeredAt = adminDate.toISOString();
      timeType = 'relative';
      timeExtracted = true;
      textForDose = textForDose.replace(relativeMatch[0], ' ');
    } else {
      // Check explicit clock time e.g. "at 1:44", "at 01:44", "at 13:45", "1:44"
      const explicitMatch = lower.match(/(?:at\s+)?\b([0-2]?\d):([0-5]\d)\b/i);
      if (explicitMatch) {
        const hours = parseInt(explicitMatch[1], 10);
        const minutes = parseInt(explicitMatch[2], 10);
        const adminDate = new Date(referenceTime);
        adminDate.setHours(hours, minutes, 0, 0);

        administeredAt = adminDate.toISOString();
        timeType = 'explicit';
        timeExtracted = true;
        textForDose = textForDose.replace(explicitMatch[0], ' ');
      }
    }
  }

  // 2. Extract Drug
  let drug: string | null = null;
  for (const entry of DRUG_LEXICON) {
    for (const alias of entry.aliases) {
      const regex = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (regex.test(lower)) {
        drug = entry.canonical;
        break;
      }
    }
    if (drug) break;
  }

  // 3. Extract Route
  let route: MedRoute | null = null;
  for (const rule of ROUTE_RULES) {
    if (rule.regex.test(lower)) {
      route = rule.route;
      break;
    }
  }

  // 4. Extract Reason
  let reason: MedReason | null = null;
  for (const rule of REASON_RULES) {
    if (rule.regex.test(lower)) {
      reason = rule.reason;
      break;
    }
  }

  // 5. Extract Dose and Unit
  let dose: number | null = null;
  let unit: MedUnit | null = null;

  // Unit regex with normalisation:
  // mg: milligrams, milligram, mgs, mg
  // mcg: micrograms, microgram, mcgs, mcg, ug
  // ml: milliliters, millilitres, milliliter, millilitre, mls, ml, cc, ccs
  // g: grams, gram, g
  const unitPatterns = [
    { canonical: 'mcg' as MedUnit, regex: /\b(micrograms?|mcgs?|ug)\b/i },
    { canonical: 'mg' as MedUnit, regex: /\b(milligrams?|mgs?|mg)\b/i },
    { canonical: 'ml' as MedUnit, regex: /\b(milliliters?|millilitres?|mls?|ml|ccs?|cc)\b/i },
    { canonical: 'g' as MedUnit, regex: /\b(grams?|g)\b/i },
  ];

  // Pattern A: Number followed by unit e.g. "two milligrams", "0.5 milligrams", "500 mcg", "10 ml", "point five mg"
  // First, normalize spoken multi-word phrases like "point five" or "zero point five"
  let doseSearchText = textForDose
    .replace(/\bzero\s*point\s*five\b/gi, '0.5')
    .replace(/\bpoint\s*five\b/gi, '0.5')
    .replace(/\bone\s*point\s*five\b/gi, '1.5')
    .replace(/\btwo\s*point\s*five\b/gi, '2.5')
    .replace(/\bhalf\b/gi, '0.5');

  // Match: (<number or word>) + optional spaces + (<unit words>)
  const doseWithUnitRegex = /\b(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten)\s*(milligrams?|mgs?|mg|micrograms?|mcgs?|ug|milliliters?|millilitres?|mls?|ml|ccs?|cc|grams?|g)\b/i;
  const matchA = doseSearchText.match(doseWithUnitRegex);

  if (matchA) {
    const rawNum = matchA[1].toLowerCase();
    if (SPOKEN_NUMBERS[rawNum] !== undefined) {
      dose = SPOKEN_NUMBERS[rawNum];
    } else {
      const parsed = parseFloat(rawNum);
      if (!isNaN(parsed)) {
        dose = parsed;
      }
    }

    const rawUnit = matchA[2].toLowerCase();
    for (const u of unitPatterns) {
      if (u.regex.test(rawUnit)) {
        unit = u.canonical;
        break;
      }
    }
  } else {
    // If unit is separated or only unit is present, or only number is present with "gave":
    // Check if any unit is mentioned
    for (const u of unitPatterns) {
      if (u.regex.test(doseSearchText)) {
        unit = u.canonical;
        break;
      }
    }

    // Check if numeric dose alone was mentioned (e.g. "gave 2 of midazolam")
    const gaveNumRegex = /\b(?:gave|administer(?:ed)?|push(?:ed)?)\s+(\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
    const matchGave = doseSearchText.match(gaveNumRegex);
    if (matchGave) {
      const rawNum = matchGave[1].toLowerCase();
      if (SPOKEN_NUMBERS[rawNum] !== undefined) {
        dose = SPOKEN_NUMBERS[rawNum];
      } else {
        const parsed = parseFloat(rawNum);
        if (!isNaN(parsed)) {
          dose = parsed;
        }
      }
    }
  }

  return {
    drug,
    dose,
    unit,
    route,
    reason,
    administeredAt,
    capturedAt,
    rawText: normalized,
    timeType,
    extractedFields: {
      drug: drug !== null,
      dose: dose !== null,
      unit: unit !== null,
      route: route !== null,
      reason: reason !== null,
      time: timeExtracted,
    },
  };
}
