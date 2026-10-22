import { describe, expect, it } from 'vitest';
import { cmToFtIn, displayWeight, ftInToCm, kgToLb, lbToKg, parseWeightInput } from './units';

describe('units', () => {
  it('converts weight both ways', () => {
    expect(kgToLb(80)).toBeCloseTo(176.37, 2);
    expect(lbToKg(kgToLb(80))).toBeCloseTo(80, 6);
    expect(displayWeight(80, 'imperial')).toBe(176.4);
    expect(parseWeightInput(176.4, 'imperial')).toBeCloseTo(80, 1);
  });

  it('converts height both ways', () => {
    expect(cmToFtIn(180)).toEqual({ ft: 5, in: 11 });
    expect(ftInToCm(5, 11)).toBeCloseTo(180.34, 2);
  });
});
