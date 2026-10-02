// Precios en USD por millón de tokens. Llegan del servidor (/api/status, variables del .env).
// Jev sólo cobra la entrada; la salida es gratuita.

export interface Prices {
  llmIn: number; // entrada sin caché
  llmCached: number; // entrada que acierta la caché de prompt
  llmOut: number;
  jevIn: number;
}

export const PRICES: Prices = { llmIn: 0.15, llmCached: 0.003, llmOut: 0.6, jevIn: 0.042 };

export function setPrices(p: Partial<Prices>) {
  Object.assign(PRICES, p);
}

export function llmCost(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_cache_hit_tokens?: number; // DeepSeek
  prompt_tokens_details?: { cached_tokens?: number }; // OpenAI
}): number {
  const hit = usage.prompt_cache_hit_tokens ?? usage.prompt_tokens_details?.cached_tokens ?? 0;
  const miss = Math.max(0, (usage.prompt_tokens ?? 0) - hit);
  return (hit * PRICES.llmCached + miss * PRICES.llmIn + (usage.completion_tokens ?? 0) * PRICES.llmOut) / 1e6;
}

export function jevCost(inputTokens: number): number {
  return (inputTokens * PRICES.jevIn) / 1e6;
}

/** Estimación aproximada de tokens a partir del texto (≈ 4 caracteres por token). */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);
