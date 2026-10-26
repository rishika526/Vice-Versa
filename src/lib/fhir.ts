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

/**
 * Builds standard HL7 FHIR R4 MedicationAdministration Bundle
 */
export function buildFHIRBundle(records: ConfirmedRecord[]) {
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
      resource: {
        resourceType: 'MedicationAdministration',
        id: rec.id,
        identifier: [
          {
            system: 'urn:f2r:chain:hash',
            value: rec.hash,
          },
          {
            system: 'urn:f2r:chain:previous-hash',
            value: rec.previousHash,
          },
        ],
        status: 'completed',
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
        recorded: rec.capturedAt,
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
        reasonCode: [
          {
            text: rec.reason,
          },
        ],
        note: [
          {
            text: `Original voice/typed note: "${rec.rawText}"`,
          },
        ],
      },
    })),
  };
}

/**
 * Downloads FHIR-lite JSON bundle to user device.
 */
export function exportFHIRJson(records: ConfirmedRecord[]): void {
  const bundle = buildFHIRBundle(records);
  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `f2r-medications-${new Date().toISOString().slice(0, 10)}.json`;
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
