import type { ChainVerificationResult, ConfirmedRecord } from './types';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes SHA-256 hash using Web Crypto API (crypto.subtle).
 * Fully offline, standard compliant, fast.
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deterministically serialize record data for hashing.
 */
export function getRecordPayload(record: {
  id: string;
  drug: string;
  dose: number;
  unit: string;
  route: string;
  reason: string;
  administeredAt: string;
  capturedAt: string;
  rawText: string;
  previousHash: string;
}): string {
  return JSON.stringify({
    id: record.id,
    drug: record.drug,
    dose: record.dose,
    unit: record.unit,
    route: record.route,
    reason: record.reason,
    administeredAt: record.administeredAt,
    capturedAt: record.capturedAt,
    rawText: record.rawText,
    previousHash: record.previousHash,
  });
}

/**
 * Calculates cryptographic SHA-256 hash of a record linking previous hash.
 */
export async function calculateRecordHash(record: {
  id: string;
  drug: string;
  dose: number;
  unit: string;
  route: string;
  reason: string;
  administeredAt: string;
  capturedAt: string;
  rawText: string;
  previousHash: string;
}): Promise<string> {
  const payload = getRecordPayload(record);
  return await sha256(payload);
}

/**
 * Verifies the integrity of the tamper-evident hash chain.
 * Recomputes all hashes from genesis to latest record.
 */
export async function verifyChain(records: ConfirmedRecord[]): Promise<ChainVerificationResult> {
  if (records.length === 0) {
    return {
      isValid: true,
      count: 0,
      message: 'Run-sheet is empty. No records to verify.',
    };
  }

  // Ensure records are ordered chronologically by timestamp
  const chronological = [...records].sort((a, b) => a.timestamp - b.timestamp);

  for (let i = 0; i < chronological.length; i++) {
    const current = chronological[i];
    const expectedPrev = i === 0 ? GENESIS_HASH : chronological[i - 1].hash;

    // Check back-link
    if (current.previousHash !== expectedPrev) {
      return {
        isValid: false,
        count: chronological.length,
        brokenIndex: i,
        message: `Tamper detected at record #${i + 1} (${current.drug}): previous hash mismatch.`,
      };
    }

    // Recompute current hash
    const recomputedHash = await calculateRecordHash(current);
    if (recomputedHash !== current.hash) {
      return {
        isValid: false,
        count: chronological.length,
        brokenIndex: i,
        message: `Tamper detected at record #${i + 1} (${current.drug}): content hash mismatch.`,
      };
    }
  }

  return {
    isValid: true,
    count: chronological.length,
    message: `Chain verification passed: all ${chronological.length} record(s) cryptographically intact and unbroken.`,
  };
}
