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
    expect(r.items[0].confidence).toBe(0.2); // "2" on a 1-10 scale
  });

  it('reads numbers embedded in prose and object-valued fields', () => {
    const r = parseAnalysis(
      JSON.stringify({
        items: [
          {
            name: 'Rice',
            portion: { amount: 150, unit: 'g' },
            calories: 'approx. 250 kcal (100 g)',
            protein_g: 'est. 12',
            carbs_g: { value: '45,5', unit: 'g' },
            fat_g: '1 cup (3 g)',
            confidence: 85,
          },
        ],
      }),
    );
    expect(r.items[0]).toMatchObject({
      portion: '150 g',
      calories: 250,
      protein_g: 12,
      carbs_g: 45.5,
      fat_g: 1,
      confidence: 0.85,
    });
  });

  it('keeps leading decimals, signs and thousands separators', () => {
    const r = parseAnalysis(
      JSON.stringify({
        items: [
          {
            name: 'A',
            calories: '1,200 kcal',
            protein_g: '.5 g',
            carbs_g: '-.5 g',
            fat_g: '2,5 g',
          },
        ],
      }),
    );
    expect(r.items[0]).toMatchObject({ calories: 1200, protein_g: 0.5, carbs_g: 0, fat_g: 2.5 });
  });

  it('finds items nested one level down or keyed by name', () => {
    const nested = parseAnalysis('{"meal":{"items":[{"name":"Egg","calories":70}]}}');
    expect(nested.items.map((i) => i.name)).toEqual(['Egg']);
    const keyed = parseAnalysis('{"items":{"Apple":{"calories":95},"Banana":{"calories":105}}}');
    expect(keyed.items.map((i) => [i.name, i.calories])).toEqual([
      ['Apple', 95],
      ['Banana', 105],
    ]);
  });

  it('survives braces in prose, two objects, and trailing commas', () => {
    expect(
      parseAnalysis('Note: {items} means: {"items":[{"name":"A","calories":1}]}').items,
    ).toHaveLength(1);
    expect(parseAnalysis('{"items":[{"name":"A","calories":1}]} {"notes":"x"}').items).toHaveLength(
      1,
    );
    expect(parseAnalysis('{"items":[{"name":"A","calories":1,},],}').items).toHaveLength(1);
  });

  it('returns empty items with notes when nothing is edible', () => {
    const r = parseAnalysis('{"items":[],"notes":"That is a photo of a cat."}');
    expect(r.items).toEqual([]);
    expect(r.notes).toMatch(/cat/);
  });
});
