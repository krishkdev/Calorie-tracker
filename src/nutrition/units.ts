import type { Units } from '../db/types';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), in: totalIn % 12 };
}

export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * CM_PER_IN;
}

/** Weight in the user's display unit, rounded to 1 decimal. */
export function displayWeight(kg: number, units: Units): number {
  const v = units === 'imperial' ? kgToLb(kg) : kg;
  return Math.round(v * 10) / 10;
}

export function weightUnitLabel(units: Units): string {
  return units === 'imperial' ? 'lb' : 'kg';
}

export function formatWeight(kg: number, units: Units): string {
  return `${displayWeight(kg, units)} ${weightUnitLabel(units)}`;
}

/** Parse a weight typed in the user's display unit back to kg. */
export function parseWeightInput(value: number, units: Units): number {
  return units === 'imperial' ? lbToKg(value) : value;
}

export function formatHeight(cm: number, units: Units): string {
  if (units === 'imperial') {
    const { ft, in: inches } = cmToFtIn(cm);
    return `${ft}'${inches}"`;
  }
  return `${Math.round(cm)} cm`;
}
