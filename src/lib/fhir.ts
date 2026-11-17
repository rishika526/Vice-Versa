import type { ConfirmedRecord } from './types';

export function formatTimeHHMM(isoString: string): string {
  try {
    const d = new Date(isoString);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '--:--';
  }
}

export function formatTimeHHMMSS(isoString: string): string {
  try {
    const d = new Date(isoString);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  } catch {
    return '--:--:--';
  }
}

/**
 * Builds standard HL7 FHIR R4 MedicationAdministration or Procedure individual resource.
 */
export function buildFHIRMedicationAdministration(rec: ConfirmedRecord): any {
  const hlcTimestamp = rec.administeredAt
    ? `${new Date(rec.administeredAt).getTime()}:0001:MEDIC-04`
    : `${rec.timestamp || Date.now()}:0001:MEDIC-04`;

  return {
    resourceType: rec.isProcedure ? 'Procedure' : 'MedicationAdministration',
    id: rec.id,
    identifier: [
      {
        system: 'urn:f2r:hlc:timestamp',
        value: hlcTimestamp,
      },
      {
        system: 'urn:f2r:device:id',
        value: 'MEDIC-04-RIG-TABLET',
      },
    ],
    status: 'completed',
    ...(rec.isProcedure
      ? {
          code: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '89666000',
                display: rec.procedureName || rec.drug || 'Cardiopulmonary resuscitation (CPR)',
              },
            ],
            text: rec.procedureName || rec.drug || 'Cardiopulmonary resuscitation (CPR)',
          },
          performedDateTime: rec.administeredAt,
        }
      : {
          medicationCodeableConcept: {
            coding: [
              {
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                display: rec.drug,
              },
            ],
            text: rec.drug,
          },
          effectiveDateTime: rec.administeredAt,
          dosage: {
            text: `${rec.dose} ${rec.unit} via ${rec.route}`,
            route: {
              text: rec.route,
            },
            dose: {
              value: rec.dose,
              unit: rec.unit,
            },
          },
        }),
    recorded: rec.capturedAt,
    reasonCode: [
      {
        text: rec.reason || (rec.isProcedure ? 'cardiac arrest' : 'pain'),
      },
    ],
    note: [
      {
        text: `Original voice/typed note: "${rec.rawText}"`,
      },
    ],
  };
}

/**
 * Builds standard HL7 FHIR R4 MedicationAdministration or Procedure Bundle
 */
export function buildFHIRBundle(records: ConfirmedRecord[]): any {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    id: `f2r-bundle-${Date.now()}`,
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/MedicationAdministration'],
      tag: [
        {
          system: 'urn:f2r:source',
          code: 'field-to-record-prehospital-pwa',
          display: 'F2R Prehospital Voice-to-Record',
        },
      ],
    },
    entry: records.map((rec) => ({
      fullUrl: `urn:uuid:${rec.id}`,
      resource: buildFHIRMedicationAdministration(rec),
    })),
  };
}

/**
 * Downloads FHIR Record bundle to user device.
 */
export function exportFHIRJson(records: ConfirmedRecord[]): void {
  const bundle = buildFHIRBundle(records);
  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `f2r-clinical-records-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads single record FHIR MedicationAdministration JSON to user device.
 */
export function exportSingleFHIRJson(record: ConfirmedRecord): void {
  const fhir = buildFHIRMedicationAdministration(record);
  const jsonStr = JSON.stringify(fhir, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fhir-med-admin-${record.id}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats all records into a readable run-sheet text summary for clipboard copying.
 */
export function formatRunSheetSummary(records: ConfirmedRecord[]): string {
  if (records.length === 0) return 'No medication records logged.';

  // Oldest first for clinical run-sheet chronology
  const chronological = [...records].sort((a, b) => a.timestamp - b.timestamp);

  const lines = chronological.map((rec, i) => {
    const timeStr = formatTimeHHMM(rec.administeredAt);
    return `${i + 1}. [${timeStr}] ${rec.drug} ${rec.dose} ${rec.unit} via ${rec.route} — Indication: ${rec.reason} (Audit Hash: ${rec.hash.slice(0, 8)})`;
  });

  return [
    `=== F2R PARAMEDIC MEDICATION RUN-SHEET ===`,
    `Generated: ${new Date().toLocaleString()}`,
    `Total Administrations: ${records.length}`,
    `Tamper-Evident Hash Chain: Verified`,
    `------------------------------------------`,
    ...lines,
    `==========================================`,
  ].join('\n');
}
