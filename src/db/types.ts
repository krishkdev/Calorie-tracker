export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalType = 'lose' | 'maintain' | 'gain';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Units = 'metric' | 'imperial';
export type ThemeSetting = 'system' | 'light' | 'dark';

export interface Macros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Profile {
  id: 'me';
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: GoalType;
  /** 0 for maintain. Typical: 0.25, 0.5, 0.75, 1. */
  rateKgPerWeek: number;
  targets: Macros;
  /** True once the user hand-edits targets; profile edits then ask before recomputing. */
  targetsOverridden: boolean;
  onboardedAt: number;
}

export type ItemSource = 'ai' | 'barcode' | 'manual' | 'favorite';

export interface FoodItem {
  id: string;
  name: string;
  /** Human portion description, e.g. "1 large egg", "150 g". */
  portion: string;
  /** Multiplier applied to the base macros below. Default 1. */
  quantity: number;
  /** Base nutrition for quantity = 1. */
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** 0..1 from the AI, when known. */
  confidence?: number;
  source: ItemSource;
  barcode?: string;
}

export interface FoodEntry {
  id: string;
  /** Local calendar day 'YYYY-MM-DD'. */
  dayKey: string;
  loggedAt: number;
  meal: MealType;
  items: FoodItem[];
  /** Original text prompt or free note. */
  note?: string;
  /** Small JPEG thumbnail (<= 256px). Never the full photo. */
  photoThumb?: Blob;
  /** Denormalised sum of items, kept in sync on every write. */
  totals: Macros;
  createdAt: number;
  updatedAt: number;
}

export interface WeightEntry {
  id: string;
  dayKey: string;
  loggedAt: number;
  weightKg: number;
  note?: string;
}

export interface Favorite {
  id: string;
  name: string;
  items: FoodItem[];
  useCount: number;
  lastUsedAt: number;
  createdAt: number;
}

export type ProviderKind = 'openai-compatible' | 'anthropic';
export type PresetId =
  'deepseek' | 'openrouter' | 'gemini' | 'openai' | 'ollama' | 'lmstudio' | 'custom';

export interface ProviderConfig {
  kind: ProviderKind;
  preset: PresetId;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Whether the configured model accepts image input. Drives photo logging availability. */
  supportsVision: boolean;
  /** Send response_format: json_object. Some local servers reject it. */
  jsonMode: boolean;
  /** Optional pass-through proxy for providers that block browser origins. */
  proxyUrl?: string;
}

export interface Settings {
  id: 'app';
  provider: ProviderConfig;
  units: Units;
  theme: ThemeSetting;
  mealCutoffs: { breakfast: number; lunch: number; dinner: number };
}

export interface CachedProduct {
  barcode: string;
  fetchedAt: number;
  product: ProductInfo | null;
}

export interface ProductInfo {
  barcode: string;
  name: string;
  brand?: string;
  per100g: Macros;
  perServing?: Macros;
  servingSize?: string;
  servingGrams?: number;
  imageUrl?: string;
}
