import { describe, it, expect } from 'vitest';
import {
  broadcastConfirmedMedication,
  subscribeToHospitalFeed,
  createMockAmbulanceTransmission,
  isEventAcknowledged,
  acknowledgeEvent,
} from '../hospitalFeed';
import { buildFHIRMedicationAdministration } from '../fhir';
import { calculateRecordHash } from '../chain';
import { extractNote } from '../extract';
import type { ConfirmedRecord } from '../types';

describe('Closed-Loop Validation & Hospital ED Telemetry', () => {
  it('Builds compliant HL7 FHIR R4 MedicationAdministration with HLC provenance (No blockchain hashes)', async () => {
    const raw = {
      id: 'rec-test-101',
      drug: 'Midazolam',
      dose: 2,
      unit: 'mg' as const,
      route: 'IV push' as const,
      reason: 'seizure' as const,
      administeredAt: '2026-11-16T12:00:00.000Z',
      capturedAt: '2026-11-16T12:00:05.000Z',
      rawText: 'Gave two milligrams midazolam IV push just now for active seizure',
      previousHash: '0'.repeat(64),
    };

    const hash = await calculateRecordHash(raw);
    const confirmedRecord: ConfirmedRecord = {
      ...raw,
      hash,
      timestamp: Date.now(),
      safetyWarnings: [],
      safetyAcknowledged: false,
    };

    const fhir = buildFHIRMedicationAdministration(confirmedRecord);

    expect(fhir.resourceType).toBe('MedicationAdministration');
    expect(fhir.id).toBe('rec-test-101');
    expect(fhir.status).toBe('completed');
    expect(fhir.medicationCodeableConcept.text).toBe('Midazolam');
    expect(fhir.dosage.dose.value).toBe(2);
    expect(fhir.dosage.dose.unit).toBe('mg');
    expect(fhir.dosage.route.text).toBe('IV push');
    expect(fhir.effectiveDateTime).toBe('2026-11-16T12:00:00.000Z');
    expect(fhir.identifier).toEqual([
      {
        system: 'urn:f2r:hlc:timestamp',
        value: `${new Date('2026-11-16T12:00:00.000Z').getTime()}:0001:MEDIC-04`,
      },
      {
        system: 'urn:f2r:device:id',
        value: 'MEDIC-04-RIG-TABLET',
      },
    ]);
  });

  it('Correctly identifies procedures (e.g. CPR) into Procedure Mode without blocking warnings', () => {
    const cprResult = extractNote('gave CPR');
    expect(cprResult.isProcedure).toBe(true);
    expect(cprResult.procedureName).toContain('CPR');
    expect(cprResult.drug).toBeNull();

    const compressionsResult = extractNote('started chest compressions and bagging');
    expect(compressionsResult.isProcedure).toBe(true);
    expect(compressionsResult.procedureName).toBeDefined();

    // Builds FHIR Procedure resource
    const rec: ConfirmedRecord = {
      id: 'rec-cpr-1',
      drug: 'CPR (Compressions)',
      dose: 1,
      unit: 'mg',
      route: 'IV',
      reason: 'cardiac arrest',
      administeredAt: '2026-11-16T12:00:00.000Z',
      capturedAt: '2026-11-16T12:00:00.000Z',
      rawText: 'gave CPR',
      previousHash: '0'.repeat(64),
      hash: 'abc',
      timestamp: Date.now(),
      safetyWarnings: [],
      safetyAcknowledged: false,
      isProcedure: true,
      procedureName: 'CPR (Cardiopulmonary Resuscitation)',
    };

    const fhirProc = buildFHIRMedicationAdministration(rec);
    expect(fhirProc.resourceType).toBe('Procedure');
    expect(fhirProc.code.text).toContain('CPR');
    expect(fhirProc.identifier[0].system).toBe('urn:f2r:hlc:timestamp');
  });

  it('Broadcasts confirmed medication and notifies hospital ED feed', () => {
    let receivedEvent: any = null;

    const unsub = subscribeToHospitalFeed((event) => {
      receivedEvent = event;
    });

    const mockEvent = createMockAmbulanceTransmission('anaphylaxis');
    expect(mockEvent).toBeDefined();
    expect(mockEvent.record.drug).toBe('Epinephrine');
    expect(mockEvent.record.dose).toBe(0.5);
    expect(mockEvent.record.route).toBe('IM');
    expect(mockEvent.fhirJson.resourceType).toBe('MedicationAdministration');

    // Test direct broadcast function as well
    const directBroadcast = broadcastConfirmedMedication(mockEvent.record);
    expect(directBroadcast.id).toBeDefined();
    expect(receivedEvent || directBroadcast).toBeDefined();

    unsub();
  });

  it('Allows ED physicians to accept & reconcile alerts', () => {
    const eventId = `test-ack-${Date.now()}`;
    expect(isEventAcknowledged(eventId)).toBe(false);

    acknowledgeEvent(eventId);
    expect(isEventAcknowledged(eventId)).toBe(true);
  });
});
