import { describe, it, expect } from 'vitest';
import { extractNote } from '../extract';

describe('Local Rule-Based Extractor (Field-to-Record)', () => {
  const refTime = new Date('2026-10-26T12:00:00.000Z');

  it('Example 1 (Complete): "Gave two milligrams midazolam IV push just now for active seizure"', () => {
    const text = 'Gave two milligrams midazolam IV push just now for active seizure';
    const result = extractNote(text, refTime);

    expect(result.drug).toBe('Midazolam');
    expect(result.dose).toBe(2);
    expect(result.unit).toBe('mg');
    expect(result.route).toBe('IV push');
    expect(result.reason).toBe('seizure');
    expect(result.timeType).toBe('just_now');
    expect(result.administeredAt).toBe(refTime.toISOString());
    expect(result.extractedFields.drug).toBe(true);
    expect(result.extractedFields.dose).toBe(true);
    expect(result.extractedFields.unit).toBe(true);
    expect(result.extractedFields.route).toBe(true);
    expect(result.extractedFields.reason).toBe(true);
  });

  it('Example 2 (Route missing): "Gave 0.5 milligrams epinephrine for anaphylaxis"', () => {
    const text = 'Gave 0.5 milligrams epinephrine for anaphylaxis';
    const result = extractNote(text, refTime);

    expect(result.drug).toBe('Epinephrine');
    expect(result.dose).toBe(0.5);
    expect(result.unit).toBe('mg');
    expect(result.route).toBeNull(); // Missing!
    expect(result.reason).toBe('anaphylaxis');
    expect(result.extractedFields.route).toBe(false);
  });

  it('Example 3 (Dose and unit missing): "Gave midazolam IV for seizure five minutes ago"', () => {
    const text = 'Gave midazolam IV for seizure five minutes ago';
    const result = extractNote(text, refTime);

    expect(result.drug).toBe('Midazolam');
    expect(result.dose).toBeNull(); // Missing!
    expect(result.unit).toBeNull(); // Missing!
    expect(result.route).toBe('IV');
    expect(result.reason).toBe('seizure');
    expect(result.timeType).toBe('relative');
    
    // Five minutes ago from 12:00 is 11:55
    const expectedTime = new Date('2026-10-26T11:55:00.000Z').toISOString();
    expect(result.administeredAt).toBe(expectedTime);
    expect(result.extractedFields.dose).toBe(false);
    expect(result.extractedFields.unit).toBe(false);
  });

  it('Example 4 (Dose missing, explicit time): "Gave morphine IM at 1:44 for pain"', () => {
    const text = 'Gave morphine IM at 1:44 for pain';
    const result = extractNote(text, refTime);

    expect(result.drug).toBe('Morphine');
    expect(result.dose).toBeNull(); // Missing! Must not pick up 1 from 1:44
    expect(result.unit).toBeNull();
    expect(result.route).toBe('IM');
    expect(result.reason).toBe('pain');
    expect(result.timeType).toBe('explicit');
    expect(result.extractedFields.dose).toBe(false);
  });

  it('Handles aliases and variations (e.g. Narcan for overdose, 500 mcg)', () => {
    const text = 'Administered 500 mcg Narcan intranasal for suspected opioid overdose';
    const result = extractNote(text, refTime);

    expect(result.drug).toBe('Naloxone');
    expect(result.dose).toBe(500);
    expect(result.unit).toBe('mcg');
    expect(result.route).toBe('intranasal');
    expect(result.reason).toBe('overdose');
  });
});
