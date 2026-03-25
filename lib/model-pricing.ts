// Dynamic model pricing fetched from LiteLLM's published cost data.
// Cached in memory with a 24-hour TTL; falls back to hardcoded rates on failure.

const LITELLM_COST_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface PricingEntry {
  input: number; // USD per 1M tokens
  output: number;
}

// Fallback prices (last known good values) used when the fetch fails
const FALLBACK_PRICING: Record<string, PricingEntry> = {
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "codex-mini-latest": { input: 0.75, output: 3.0 },
};

const DEFAULT_FALLBACK: PricingEntry = { input: 0.4, output: 1.6 }; // gpt-4.1-mini

let cachedPricing: Record<string, PricingEntry> | null = null;
let cacheTimestamp = 0;

interface LiteLLMModelEntry {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
}

async function fetchPricing(): Promise<Record<string, PricingEntry>> {
  const res = await fetch(LITELLM_COST_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data: Record<string, LiteLLMModelEntry> = await res.json();
  const pricing: Record<string, PricingEntry> = {};

  for (const [model, info] of Object.entries(data)) {
    if (info.input_cost_per_token != null && info.output_cost_per_token != null) {
      pricing[model] = {
        input: info.input_cost_per_token * 1_000_000,
        output: info.output_cost_per_token * 1_000_000,
      };
    }
  }

  return pricing;
}

async function getPricingMap(): Promise<Record<string, PricingEntry>> {
  const now = Date.now();
  if (cachedPricing && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPricing;
  }

  try {
    cachedPricing = await fetchPricing();
    cacheTimestamp = now;
    return cachedPricing;
  } catch (err) {
    console.warn("Failed to fetch model pricing, using fallback:", err);
    // If we had a stale cache, keep using it
    if (cachedPricing) return cachedPricing;
    return FALLBACK_PRICING;
  }
}

export async function getModelPricing(model: string): Promise<PricingEntry> {
  const pricing = await getPricingMap();

  // Direct match
  if (pricing[model]) return pricing[model];

  // Try with openai/ prefix (LiteLLM convention)
  if (pricing[`openai/${model}`]) return pricing[`openai/${model}`];

  // Fallback to hardcoded if available
  if (FALLBACK_PRICING[model]) return FALLBACK_PRICING[model];

  return DEFAULT_FALLBACK;
}
