import { describe, it, expect } from 'vitest';
import { extractNote } from '../extract';
import { checkSafety } from '../safety';
import { calculateRecordHash, GENESIS_HASH, verifyChain } from '../chain';
import { buildFHIRBundle, formatRunSheetSummary } from '../fhir';
import type { ConfirmedRecord, MedRoute } from '../types';

describe('End-to-End Clinical Flow: Missing-Data, Chain & Export', () => {
  it('Simulates complete user journey for missing-data resolution, sealing, and audit', async () => {
    // STEP 1: Paramedic speaks or types note with missing route
    const rawNote1 = 'Gave 0.5 milligrams epinephrine for anaphylaxis';
    const parsed1 = extractNote(rawNote1);

    expect(parsed1.drug).toBe('Epinephrine');
    expect(parsed1.dose).toBe(0.5);
    expect(parsed1.unit).toBe('mg');
    expect(parsed1.route).toBeNull(); // Route is not stated!
    expect(parsed1.reason).toBe('anaphylaxis');
    expect(parsed1.extractedFields.route).toBe(false);

    // STEP 2: Paramedic is prompted with one-tap chips and selects "IM"
    const confirmedRoute: MedRoute = 'IM';

    // STEP 3: Safety check
    const safety1 = checkSafety(parsed1.drug!, parsed1.dose!, parsed1.unit!, []);
    expect(safety1.isWarning).toBe(false);

    // STEP 4: Seal record with SHA-256 genesis chaining
    const rec1Data = {
      id: 'rec-test-1',
      drug: parsed1.drug!,
      dose: parsed1.dose!,
      unit: parsed1.unit!,
      route: confirmedRoute,
      reason: parsed1.reason!,
      administeredAt: parsed1.administeredAt,
      capturedAt: parsed1.capturedAt,
      rawText: rawNote1,
      previousHash: GENESIS_HASH,
    };
    const hash1 = await calculateRecordHash(rec1Data);
    const rec1: ConfirmedRecord = {
      ...rec1Data,
      hash: hash1,
      timestamp: 1000,
      safetyWarnings: [],
      safetyAcknowledged: false,
    };

    // STEP 5: Second note processed (Complete note)
    const rawNote2 = 'Gave two milligrams midazolam IV push just now for active seizure';
    const parsed2 = extractNote(rawNote2);

    expect(parsed2.drug).toBe('Midazolam');
    expect(parsed2.dose).toBe(2);
    expect(parsed2.unit).toBe('mg');
    expect(parsed2.route).toBe('IV push');
    expect(parsed2.reason).toBe('seizure');

    const rec2Data = {
      id: 'rec-test-2',
      drug: parsed2.drug!,
      dose: parsed2.dose!,
      unit: parsed2.unit!,
      route: parsed2.route!,
      reason: parsed2.reason!,
      administeredAt: parsed2.administeredAt,
      capturedAt: parsed2.capturedAt,
      rawText: rawNote2,
      previousHash: hash1, // Chained to record 1!
    };
    const hash2 = await calculateRecordHash(rec2Data);
    const rec2: ConfirmedRecord = {
      ...rec2Data,
      hash: hash2,
      timestamp: 2000,
      safetyWarnings: [],
      safetyAcknowledged: false,
    };

    // STEP 6: Run-sheet Chain Verification
    const auditResult = await verifyChain([rec1, rec2]);
    expect(auditResult.isValid).toBe(true);
    expect(auditResult.count).toBe(2);
    expect(auditResult.message).toContain('all 2 record(s) cryptographically intact');

    // STEP 7: Export FHIR-lite JSON
    const fhirBundle = buildFHIRBundle([rec1, rec2]);
    expect(fhirBundle.resourceType).toBe('Bundle');
    expect(fhirBundle.entry).toHaveLength(2);
    expect(fhirBundle.entry[0].resource.medicationCodeableConcept.text).toBe('Epinephrine');
    expect(fhirBundle.entry[0].resource.dosage.route.text).toBe('IM');
    expect(fhirBundle.entry[0].resource.identifier[0].value).toBe(hash1);
    expect(fhirBundle.entry[1].resource.medicationCodeableConcept.text).toBe('Midazolam');

    // STEP 8: Copy Run-sheet summary text
    const summaryText = formatRunSheetSummary([rec1, rec2]);
    expect(summaryText).toContain('PARAMEDIC MEDICATION RUN-SHEET');
    expect(summaryText).toContain('Epinephrine 0.5 mg via IM');
    expect(summaryText).toContain('Midazolam 2 mg via IV push');
  });
});
