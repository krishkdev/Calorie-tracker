import type { Macros } from '../db/types';
import type { MealCutoffs } from '../lib/dates';
import { fiberOf } from './totals';

/**
 * Pure functions behind the "Today's insights" card, the time-of-day nudges
 * and the Progress summary. Everything here is derived from numbers already
 * on the device; nothing is persisted.
 */

export type NutrientKey = 'proteinG' | 'carbsG' | 'fatG' | 'fiberG';

export const NUTRIENT_LABELS: Record<NutrientKey, string> = {
  proteinG: 'protein',
  carbsG: 'carbs',
  fatG: 'fat',
  fiberG: 'fibre',
};

export interface NutrientStatus {
  key: NutrientKey;
  label: string;
  eaten: number;
  target: number;
  /** Grams still to eat; 0 once the target is met. */
  left: number;
  /** Grams past the target; 0 while under it. */
  over: number;
  /** eaten / target, uncapped. 0 when there is no target. */
  ratio: number;
}

function get(m: Macros, key: NutrientKey): number {
  return key === 'fiberG' ? fiberOf(m) : m[key];
}

export function nutrientStatus(consumed: Macros, target: Macros): NutrientStatus[] {
  return (Object.keys(NUTRIENT_LABELS) as NutrientKey[]).map((key) => {
    const eaten = Math.round(get(consumed, key));
    const goal = Math.round(get(target, key));
    return {
      key,
      label: NUTRIENT_LABELS[key],
      eaten,
      target: goal,
      left: Math.max(0, goal - eaten),
      over: Math.max(0, eaten - goal),
      ratio: goal > 0 ? eaten / goal : 0,
    };
  });
}

export interface EnergySplit {
  protein: number;
  carbs: number;
  fat: number;
}

/** Share of energy from each macro, in whole percents that add up to 100. */
export function energySplit(m: Macros): EnergySplit | null {
  const p = m.proteinG * 4;
  const c = m.carbsG * 4;
  const f = m.fatG * 9;
  const total = p + c + f;
  if (total <= 0) return null;
  const protein = Math.round((p / total) * 100);
  const fat = Math.round((f / total) * 100);
  return { protein, fat, carbs: 100 - protein - fat };
}

export type InsightTone = 'good' | 'warn' | 'info';

export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
}

export interface DayInsightInput {
  consumed: Macros;
  target: Macros;
  /** How many entries the day has. No entries means nothing to say. */
  entryCount: number;
  /** True when the day being viewed is today, so the day is still in progress. */
  isToday: boolean;
}

/** Calories within this fraction of the target count as "on target". */
const KCAL_TOLERANCE = 0.05;
/** A macro this far off its target (as a share of the target) is worth a sentence. */
const MACRO_TOLERANCE = 0.1;

export function dayInsights({ consumed, target, entryCount, isToday }: DayInsightInput): Insight[] {
  const out: Insight[] = [];
  if (entryCount === 0 || target.kcal <= 0) return out;
  const status = nutrientStatus(consumed, target);
  const by = Object.fromEntries(status.map((s) => [s.key, s])) as Record<
    NutrientKey,
    NutrientStatus
  >;
  const kcalDiff = Math.round(consumed.kcal - target.kcal);
  const kcalOnTarget = Math.abs(kcalDiff) <= target.kcal * KCAL_TOLERANCE;
  const dayDone = !isToday;

  if (kcalOnTarget && (dayDone || consumed.kcal >= target.kcal * (1 - KCAL_TOLERANCE))) {
    out.push({
      id: 'kcal-on-target',
      tone: 'good',
      text: `Calories landed on target: ${fmt(consumed.kcal)} of ${fmt(target.kcal)} kcal.`,
    });
  } else if (kcalDiff > 0) {
    out.push({
      id: 'kcal-over',
      tone: 'warn',
      text: `${fmt(kcalDiff)} kcal over target${isToday ? ' so far' : ''}.`,
    });
  } else if (dayDone) {
    out.push({
      id: 'kcal-under',
      tone: 'info',
      text: `${fmt(-kcalDiff)} kcal under target. Fine now and then; a pattern of it is worth a look.`,
    });
  }

  const protein = by.proteinG;
  const carbs = by.carbsG;
  const fat = by.fatG;
  const fiber = by.fiberG;
  const proteinShort = protein.target > 0 && protein.left >= protein.target * MACRO_TOLERANCE;
  const carbsOver = carbs.target > 0 && carbs.over >= carbs.target * MACRO_TOLERANCE;
  const fatOver = fat.target > 0 && fat.over >= fat.target * MACRO_TOLERANCE;

  if (kcalOnTarget && proteinShort && (carbsOver || fatOver)) {
    const filler = [carbsOver ? `${carbs.over} g carbs` : '', fatOver ? `${fat.over} g fat` : '']
      .filter(Boolean)
      .join(' and ');
    out.push({
      id: 'balance-off',
      tone: 'warn',
      text: `Calories were fine but the mix was off: ${filler} stood in for ${protein.left} g of protein.`,
    });
  } else if (protein.target > 0 && protein.left === 0) {
    out.push({ id: 'protein-hit', tone: 'good', text: 'Protein target hit.' });
  } else if (proteinShort && dayDone) {
    out.push({
      id: 'protein-short',
      tone: 'warn',
      text: `Protein came in ${protein.left} g short of ${protein.target} g.`,
    });
  }

  if (fiber.target > 0) {
    if (fiber.left === 0) {
      out.push({ id: 'fiber-hit', tone: 'good', text: `Fibre target hit (${fiber.eaten} g).` });
    } else if (fiber.eaten === 0) {
      out.push({
        id: 'fiber-none',
        tone: 'info',
        text: `No fibre recorded${isToday ? ' yet' : ''}. Entries saved before fibre tracking count as 0 g.`,
      });
    } else if (dayDone) {
      out.push({
        id: 'fiber-short',
        tone: 'warn',
        text: `Fibre came in ${fiber.left} g short of ${fiber.target} g.`,
      });
    }
  }

  const split = energySplit(consumed);
  const targetSplit = energySplit(target);
  if (split && targetSplit) {
    out.push({
      id: 'split',
      tone: 'info',
      text: `Energy split P ${split.protein}% · C ${split.carbs}% · F ${split.fat}% (target ${targetSplit.protein} · ${targetSplit.carbs} · ${targetSplit.fat}).`,
    });
  }
  return out;
}

// ---------- Nudges ----------

export type DayPhase = 'morning' | 'midday' | 'afternoon' | 'evening';

export function dayPhase(hour: number, cutoffs: MealCutoffs): DayPhase {
  if (hour >= cutoffs.dinner) return 'evening';
  if (hour >= cutoffs.lunch) return 'afternoon';
  if (hour >= cutoffs.breakfast) return 'midday';
  return 'morning';
}

interface FoodHint {
  name: string;
  grams: number;
}

/** Everyday foods and roughly how much of the nutrient one portion carries. Smallest first. */
const PROTEIN_FOODS: FoodHint[] = [
  { name: 'a boiled egg', grams: 6 },
  { name: 'a glass of milk', grams: 8 },
  { name: 'a pot of Greek yogurt', grams: 17 },
  { name: 'a cup of cottage cheese', grams: 24 },
  { name: 'a scoop of protein powder', grams: 25 },
  { name: 'a chicken breast', grams: 31 },
  { name: 'a tin of tuna', grams: 32 },
];

const FIBER_FOODS: FoodHint[] = [
  { name: 'a carrot', grams: 2 },
  { name: 'an apple', grams: 4 },
  { name: 'a bowl of oats', grams: 5 },
  { name: 'a pear', grams: 6 },
  { name: 'a cup of raspberries', grams: 8 },
  { name: 'an avocado', grams: 10 },
  { name: 'a cup of lentils or beans', grams: 15 },
];

/** "a pot of Greek yogurt (~17 g)" or "2 × a chicken breast" when nothing single covers it. */
export function foodSuggestion(kind: 'protein' | 'fiber', grams: number): string {
  const list = kind === 'protein' ? PROTEIN_FOODS : FIBER_FOODS;
  const single = list.find((f) => f.grams >= grams);
  if (single) return `${single.name} (~${single.grams} g)`;
  const biggest = list[list.length - 1];
  const n = Math.ceil(grams / biggest.grams);
  return `${n} × ${biggest.name} (~${biggest.grams * n} g)`;
}

/** Gaps up to this many grams get a snack suggestion. */
const SNACK_GAP_G = 40;

function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface NudgeInput {
  consumed: Macros;
  target: Macros;
  hour: number;
  cutoffs: MealCutoffs;
}

/**
 * One short line telling the user what is still to eat today, worded for the
 * time of day. Null when there is nothing useful to say (morning, no targets,
 * or everything is already covered).
 */
export function dayNudge({ consumed, target, hour, cutoffs }: NudgeInput): Insight | null {
  if (target.kcal <= 0) return null;
  const phase = dayPhase(hour, cutoffs);
  if (phase === 'morning') return null;
  const status = nutrientStatus(consumed, target);
  const protein = status.find((s) => s.key === 'proteinG')!;
  const fiber = status.find((s) => s.key === 'fiberG')!;
  const kcalLeft = Math.round(target.kcal - consumed.kcal);

  if (protein.left === 0 && fiber.left === 0) {
    return kcalLeft < -target.kcal * KCAL_TOLERANCE
      ? {
          id: 'nudge-over',
          tone: 'warn',
          text: `Targets met, but you are ${fmt(-kcalLeft)} kcal over.`,
        }
      : { id: 'nudge-done', tone: 'good', text: 'Protein and fibre both covered for today.' };
  }

  const needs = [
    protein.left > 0 ? `${protein.left} g protein` : '',
    fiber.left > 0 ? `${fiber.left} g fibre` : '',
  ]
    .filter(Boolean)
    .join(' and ');
  const mealsLeft =
    phase === 'midday'
      ? 'Lunch and dinner can cover it.'
      : phase === 'afternoon'
        ? 'Dinner can cover it.'
        : '';

  // A food-sized hint only for snack-sized gaps; a 100 g protein gap is a meal, not a snack.
  let hint = '';
  if (phase === 'evening' || phase === 'afternoon') {
    if (protein.left > 0 && protein.left <= SNACK_GAP_G) {
      hint = `${cap(foodSuggestion('protein', protein.left))} gets you there on protein.`;
    } else if (protein.left === 0 && fiber.left <= SNACK_GAP_G) {
      hint = `${cap(foodSuggestion('fiber', fiber.left))} covers the fibre.`;
    }
  }
  const budget =
    kcalLeft > 0
      ? `${fmt(kcalLeft)} kcal left.`
      : kcalLeft < 0
        ? `Already ${fmt(-kcalLeft)} kcal over, so keep it lean.`
        : '';

  return {
    id: 'nudge',
    tone: phase === 'evening' ? 'warn' : 'info',
    text: [`Still ${needs} to go today.`, mealsLeft, hint, budget].filter(Boolean).join(' '),
  };
}

// ---------- Period summary (Progress tab) ----------

export interface DayNutrition {
  dayKey: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  logged: boolean;
}

export interface PeriodSummary {
  loggedDays: number;
  totalDays: number;
  /** Averages over logged days only. */
  avg: { kcal: number; protein: number; carbs: number; fat: number; fiber: number };
  /** Days meeting each goal, out of loggedDays. Calories count when within ±10%. */
  hit: { kcal: number; protein: number; fiber: number };
  /** Logged days with any fibre at all, to show when old entries drag the average down. */
  fiberTrackedDays: number;
}

const KCAL_HIT_TOLERANCE = 0.1;

export function periodSummary(days: DayNutrition[], target: Macros): PeriodSummary {
  const logged = days.filter((d) => d.logged);
  const n = logged.length;
  const mean = (pick: (d: DayNutrition) => number) =>
    n ? Math.round(logged.reduce((s, d) => s + pick(d), 0) / n) : 0;
  const fiberTarget = fiberOf(target);
  return {
    loggedDays: n,
    totalDays: days.length,
    avg: {
      kcal: mean((d) => d.kcal),
      protein: mean((d) => d.protein),
      carbs: mean((d) => d.carbs),
      fat: mean((d) => d.fat),
      fiber: mean((d) => d.fiber),
    },
    hit: {
      kcal: logged.filter(
        (d) =>
          target.kcal > 0 && Math.abs(d.kcal - target.kcal) <= target.kcal * KCAL_HIT_TOLERANCE,
      ).length,
      protein: logged.filter((d) => target.proteinG > 0 && d.protein >= target.proteinG).length,
      fiber: logged.filter((d) => fiberTarget > 0 && d.fiber >= fiberTarget).length,
    },
    fiberTrackedDays: logged.filter((d) => d.fiber > 0).length,
  };
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}
