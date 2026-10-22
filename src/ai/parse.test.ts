import { describe, expect, it } from 'vitest';
import { extractJson, parseAnalysis } from './parse';
import { AIError } from './types';

const good =
  '{"items":[{"name":"Egg","portion":"1 large","calories":78,"protein_g":6,"carbs_g":0.6,"fat_g":5,"confidence":0.9}]}';

describe('extractJson', () => {
  it('parses clean JSON', () => {
    expect(extractJson(good)).toHaveProperty('items');
  });

  it('strips code fences', () => {
    expect(extractJson('Sure!\n```json\n' + good + '\n```\nHope that helps.')).toHaveProperty(
      'items',
    );
  });

  it('finds the object inside prose', () => {
    expect(extractJson('Here is the estimate: ' + good + ' Enjoy.')).toHaveProperty('items');
  });

  it('throws bad_json for garbage', () => {
    expect(() => extractJson('I cannot help with that.')).toThrowError(AIError);
    try {
      extractJson('nope');
    } catch (e) {
      expect((e as AIError).code).toBe('bad_json');
    }
  });
});

describe('parseAnalysis', () => {
  it('normalizes aliases, strings and percent confidence', () => {
    const r = parseAnalysis(
      '{"foods":[{"food":"Rice","serving":"1 cup","kcal":"206 kcal","protein":"4.3g","carbohydrates":45,"fats":0.4,"confidence":85}],"note":"ok"}',
    );
    expect(r.items).toEqual([
      {
        name: 'Rice',
        portion: '1 cup',
        calories: 206,
        protein_g: 4.3,
        carbs_g: 45,
        fat_g: 0.4,
        confidence: 0.85,
      },
    ]);
    expect(r.notes).toBe('ok');
  });

  it('accepts a bare array or a single item object', () => {
    expect(parseAnalysis('[{"name":"Apple","calories":95}]').items[0].name).toBe('Apple');
    expect(parseAnalysis('{"name":"Apple","calories":95}').items[0].calories).toBe(95);
  });

  it('drops nameless items and clamps negatives', () => {
    const r = parseAnalysis(
      '{"items":[{"calories":10},{"name":"X","calories":-5,"confidence":2}]}',
    );
    expect(r.items).toHaveLength(1);
    expect(r.items[0].calories).toBe(0);
    expect(r.items[0].confidence).toBe(1);
  });

  it('returns empty items with notes when nothing is edible', () => {
    const r = parseAnalysis('{"items":[],"notes":"That is a photo of a cat."}');
    expect(r.items).toEqual([]);
    expect(r.notes).toMatch(/cat/);
  });
});
