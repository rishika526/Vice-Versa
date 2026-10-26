import { describe, it, expect } from 'vitest';
import { calculateRecordHash, GENESIS_HASH, verifyChain } from '../chain';
import { checkSafety } from '../safety';
import type { ConfirmedRecord } from '../types';

describe('Cryptographic Hash Chain', () => {
  it('Creates valid genesis block and links consecutive records', async () => {
    const rec1Data = {
      id: 'rec-1',
      drug: 'Midazolam',
      dose: 2,
      unit: 'mg',
      route: 'IV push',
      reason: 'seizure',
      administeredAt: '2026-10-26T10:00:00.000Z',
      capturedAt: '2026-10-26T10:00:05.000Z',
      rawText: 'Gave two milligrams midazolam IV push just now for active seizure',
      previousHash: GENESIS_HASH,
    };
    const hash1 = await calculateRecordHash(rec1Data);
    expect(hash1).toHaveLength(64);

    const rec1: ConfirmedRecord = {
      ...rec1Data,
      hash: hash1,
      unit: 'mg',
      route: 'IV push',
      reason: 'seizure',
      timestamp: 1000,
      safetyWarnings: [],
      safetyAcknowledged: false,
    };

    const rec2Data = {
      id: 'rec-2',
      drug: 'Fentanyl',
      dose: 50,
      unit: 'mcg',
      route: 'IV',
      reason: 'pain',
      administeredAt: '2026-10-26T10:05:00.000Z',
      capturedAt: '2026-10-26T10:05:04.000Z',
      rawText: 'Gave fifty mcg fentanyl IV for pain',
      previousHash: hash1,
    };
    const hash2 = await calculateRecordHash(rec2Data);
    const rec2: ConfirmedRecord = {
      ...rec2Data,
      hash: hash2,
      unit: 'mcg',
      route: 'IV',
      reason: 'pain',
      timestamp: 2000,
      safetyWarnings: [],
      safetyAcknowledged: false,
    };

    // Verify unbroken chain
    const result = await verifyChain([rec1, rec2]);
    expect(result.isValid).toBe(true);
    expect(result.count).toBe(2);

    // Tamper with rec1 dose
    const tamperedRec1: ConfirmedRecord = {
      ...rec1,
      dose: 20, // tampered!
    };
    const tamperedResult = await verifyChain([tamperedRec1, rec2]);
    expect(tamperedResult.isValid).toBe(false);
  });
});

describe('Safety Checking System', () => {
  it('Flags dose exceeding maximum prehospital threshold', () => {
    const existing: ConfirmedRecord[] = [];
    const safety = checkSafety('Midazolam', 20, 'mg', existing);
    expect(safety.isWarning).toBe(true);
    expect(safety.warnings[0]).toContain('High Dose Warning');
  });

  it('Passes normal dose under threshold', () => {
    const existing: ConfirmedRecord[] = [];
    const safety = checkSafety('Midazolam', 5, 'mg', existing);
    expect(safety.isWarning).toBe(false);
    expect(safety.warnings).toHaveLength(0);
  });

  it('Flags duplicate administration within 2 minutes', () => {
    const now = new Date('2026-10-26T12:00:00.000Z');
    const existing: ConfirmedRecord[] = [
      {
        id: 'dup-1',
        drug: 'Epinephrine',
        dose: 1,
        unit: 'mg',
        route: 'IV push',
        reason: 'cardiac arrest',
        administeredAt: new Date(now.getTime() - 45 * 1000).toISOString(), // 45 seconds ago
        capturedAt: now.toISOString(),
        rawText: 'Gave 1 mg epi IV push',
        previousHash: GENESIS_HASH,
        hash: 'abc',
        timestamp: now.getTime() - 45000,
        safetyWarnings: [],
        safetyAcknowledged: false,
      },
    ];

    const safety = checkSafety('Epinephrine', 1, 'mg', existing, now);
    expect(safety.isWarning).toBe(true);
    expect(safety.warnings[0]).toContain('Possible Duplicate Warning');
  });
});
