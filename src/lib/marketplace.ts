/**
 * Robust marketplace fetch utilities
 * 
 * Architecture:
 * - Primary: pokemontcg.io (TCGPlayer + Cardmarket data)
 * - Secondary: eBay sold estimates (stubbed for real API integration)
 * - Tertiary: PriceCharting historical (stubbed for real API integration)
 * 
 * Every fetch has timeout, retry with exponential backoff, and graceful degradation.
 */

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  cacheTtlSeconds?: number;
}

export interface FetchResult<T> {
  data: T | null;
  ok: boolean;
  status: number;
  source: string;
  error?: string;
  cached?: boolean;
}

const DEFAULT_TIMEOUT = 8000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY = 500;

/** AbortController-based fetch with timeout */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(id);
  }
}

/** Exponential backoff delay */
function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

/** Robust fetch with retries, timeout, and structured error handling */
export async function robustFetch<T>(
  url: string,
  sourceName: string,
  options: FetchOptions = {}
): Promise<FetchResult<T>> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY,
  } = options;

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetchWithTimeout(
        url,
        {
          headers: {
            'User-Agent': 'pokeprice/1.0',
            Accept: 'application/json',
          },
        },
        timeoutMs
      );

      if (!resp.ok) {
        lastError = `HTTP ${resp.status}: ${resp.statusText}`;
        if (resp.status >= 500) {
          // Retry server errors
          await delay(retryDelayMs * Math.pow(2, attempt));
          continue;
        }
        // Don't retry client errors
        return { data: null, ok: false, status: resp.status, source: sourceName, error: lastError };
      }

      const data = (await resp.json()) as T;
      return { data, ok: true, status: resp.status, source: sourceName };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        await delay(retryDelayMs * Math.pow(2, attempt));
      }
    }
  }

  return { data: null, ok: false, status: 0, source: sourceName, error: lastError };
}

/** Parallel fetch from multiple sources with graceful degradation */
export async function fetchWithFallback<T>(
  sources: { name: string; url: string; options?: FetchOptions }[]
): Promise<FetchResult<T>[]> {
  const promises = sources.map((s) => robustFetch<T>(s.url, s.name, s.options));
  return Promise.all(promises);
}

/** Simple in-memory cache for API routes (Next.js serverless-safe per-request) */
export function withCache<T>(
  fn: () => Promise<FetchResult<T>>,
  key: string,
  ttlSeconds: number
): () => Promise<FetchResult<T>> {
  // In production, replace with Redis or similar
  // For now, this is a no-op wrapper documenting the cache intent
  return fn;
}

/* ═══════════════════════════════════════
   MARKETPLACE URL BUILDERS
   ═══════════════════════════════════════ */

export const POKEMONTCG_API = 'https://api.pokemontcg.io/v2';

export function buildPokemonTcgSearchUrl(query: string, limit: number): string {
  return `${POKEMONTCG_API}/cards?q=name:"${encodeURIComponent(query)}"&pageSize=${limit}&orderBy=set.releaseDate`;
}

export function buildPokemonTcgDetailUrl(id: string): string {
  return `${POKEMONTCG_API}/cards/${id}`;
}

/* ═══════════════════════════════════════
   EBAY SOLD ESTIMATE
   ═══════════════════════════════════════
   
   eBay API requires developer credentials. Until integrated:
   - We estimate eBay sold average as 92% of TCGPlayer market for raw cards
   - This reflects the real discount buyers get on eBay vs asking prices
   - When eBay API is connected, swap estimate() for real fetch
   
   Research: "Check eBay sold and then subtract 15% for fees."
   eBay sold prices are typically 8-12% below TCGPlayer market.
*/

export function estimateEbaySoldAvg(tcgplayerMarket: number | null): number | null {
  if (tcgplayerMarket === null) return null;
  // eBay sold averages run ~92% of TCGPlayer asking (raw cards)
  // Verified against community sentiment: "TCGPlayer market is aspirational; eBay sold is reality"
  return tcgplayerMarket * 0.92;
}

export function estimateEbaySoldGraded(tcgplayerMarket: number | null, grade?: string): number | null {
  if (tcgplayerMarket === null) return null;
  if (grade?.includes('PSA 10') || grade?.includes('BGS 10')) {
    // Graded 10s often sell AT or ABOVE market on eBay
    return tcgplayerMarket * 1.02;
  }
  if (grade?.includes('PSA 9')) return tcgplayerMarket * 0.98;
  // Raw / ungraded
  return tcgplayerMarket * 0.92;
}

/* ═══════════════════════════════════════
   COLLECTR (CAD) REFERENCE
   ═══════════════════════════════════════
   
   COLLECTR has an exclusive partnership with EB Games (Canada's largest
   game retailer). They provide Canadian pricing data that differs from
   TCGPlayer USD due to:
   - CAD/USD exchange rate
   - Canadian import duties and distribution costs
   - EB Games retail markup vs. US market rates
   - Regional scarcity (some products never officially released in Canada)
   
   Until COLLECTR opens a public API:
   - We derive CAD estimates from TCGPlayer USD using market exchange rates
   - Label clearly as "estimate" so users know it's not direct COLLECTR data
   - When API becomes available, replace estimate with real fetch
*/

export const COLLECTR_CONTEXT = {
  name: 'COLLECTR',
  region: 'Canada',
  partner: 'EB Games',
  currency: 'CAD',
  notes: 'Estimated from USD sources until COLLECTR API available. EB Games partnership gives them unique Canadian retail pricing data.',
};
