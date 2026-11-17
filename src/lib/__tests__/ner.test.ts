import { describe, it, expect } from 'vitest';
import { extractMedicationNER, tokenizeAndTag, getNERStatus } from '../ner';

describe('In-Browser Edge AI NER Pipeline', () => {
  const refTime = new Date('2026-11-16T12:00:00.000Z');

  it('Extracts Drug, Dose, and Route from clinical note', async () => {
    const text = 'Gave two milligrams midazolam IV push just now for active seizure';
    const result = await extractMedicationNER(text, refTime);

    expect(result.drug).toBe('Midazolam');
    expect(result.dose).toBe(2);
    expect(result.unit).toBe('mg');
    expect(result.route).toBe('IV push');
    expect(result.reason).toBe('seizure');
    expect(result.timeType).toBe('just_now');
    expect(result.confidence.drug).toBeGreaterThan(0.9);
    expect(result.confidence.dose).toBeGreaterThan(0.9);
    expect(result.confidence.route).toBeGreaterThan(0.9);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.tokens.length).toBeGreaterThan(0);
  });

  it('Identifies missing route and sets field status accurately', async () => {
    const text = 'Gave 0.5 milligrams epinephrine for anaphylaxis';
    const result = await extractMedicationNER(text, refTime);

    expect(result.drug).toBe('Epinephrine');
    expect(result.dose).toBe(0.5);
    expect(result.unit).toBe('mg');
    expect(result.route).toBeNull(); // Missing route!
    expect(result.reason).toBe('anaphylaxis');
    expect(result.extractedFields.route).toBe(false);
    expect(result.extractedFields.drug).toBe(true);
    expect(result.extractedFields.dose).toBe(true);
  });

  it('Identifies missing dose while preserving route and explicit time', async () => {
    const text = 'Gave morphine IM at 1:44 for pain';
    const result = await extractMedicationNER(text, refTime);

    expect(result.drug).toBe('Morphine');
    expect(result.dose).toBeNull(); // Missing dose!
    expect(result.unit).toBeNull();
    expect(result.route).toBe('IM');
    expect(result.reason).toBe('pain');
    expect(result.timeType).toBe('explicit');
    expect(result.extractedFields.dose).toBe(false);
  });

  it('Correctly tags tokens with distinct DRUG, DOSE, and ROUTE entity labels', () => {
    const text = 'Gave two milligrams midazolam IV push just now for active seizure';
    const tokens = tokenizeAndTag(
      text,
      'Midazolam',
      2,
      'mg',
      'IV push',
      'seizure',
      'just_now'
    );

    const tags = tokens.map((t) => t.tag);
    expect(tags).toContain('DRUG');
    expect(tags).toContain('DOSE');
    expect(tags).toContain('ROUTE');

    const drugToken = tokens.find((t) => t.tag === 'DRUG');
    expect(drugToken?.text.toLowerCase()).toContain('midazolam');

    const routeToken = tokens.find((t) => t.tag === 'ROUTE');
    expect(routeToken?.text.toLowerCase()).toContain('iv push');
  });

  it('Reports NER status and model metadata', () => {
    const status = getNERStatus();
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('modelName');
    expect(status).toHaveProperty('progress');
  });
});

