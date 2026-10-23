import type { ProviderKind, Units } from '../db/types';

export interface AnalysisImage {
  /** data: URL of an already downscaled JPEG. */
  dataUrl: string;
  mime: 'image/jpeg';
}

export interface AnalysisInput {
  text?: string;
  image?: AnalysisImage;
  units: Units;
}

/** Shape the model is asked to return for each food item. */
export interface AnalyzedItem {
  name: string;
  portion: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number;
}

export interface AnalysisResult {
  items: AnalyzedItem[];
  notes?: string;
  /** The raw model text, kept for debugging and "report a bad result". */
  raw: string;
}

export type AIErrorCode =
  | 'no_api_key'
  | 'unauthorized'
  | 'rate_limited'
  | 'network_or_cors'
  | 'no_vision'
  | 'bad_json'
  | 'http'
  | 'aborted'
  | 'timeout'
  | 'empty';

export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public status?: number,
    public raw?: string,
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface ConnectionTest {
  ok: boolean;
  model?: string;
  message: string;
}

/** One timed probe from the diagnostics panel. */
export interface ProbeResult {
  label: string;
  ok: boolean;
  ms: number;
  detail: string;
}

export interface FoodAnalysisProvider {
  readonly kind: ProviderKind;
  readonly supportsVision: boolean;
  analyze(input: AnalysisInput, opts?: { signal?: AbortSignal }): Promise<AnalysisResult>;
  testConnection(opts?: { signal?: AbortSignal }): Promise<ConnectionTest>;
}
