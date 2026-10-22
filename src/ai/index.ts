import type { ProviderConfig } from '../db/types';
import { OpenAICompatibleProvider } from './openaiCompat';
import type { FoodAnalysisProvider } from './types';

/**
 * Factory for the configured provider. To add a provider that does not speak
 * the OpenAI format, implement FoodAnalysisProvider in a new file and add a
 * case here keyed on ProviderConfig.kind.
 */
export function createProvider(config: ProviderConfig): FoodAnalysisProvider {
  switch (config.kind) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config);
    case 'anthropic':
      throw new Error('The Anthropic adapter is not implemented yet. Contributions welcome.');
    default: {
      const kind: never = config.kind;
      throw new Error(`Unknown provider kind: ${String(kind)}`);
    }
  }
}

export { AIError } from './types';
export type { AnalysisResult, AnalyzedItem, FoodAnalysisProvider } from './types';
