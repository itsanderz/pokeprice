/**
 * Pricing engine — unified calculations across all marketplaces
 * 
 * Sources:
 * - TCGPlayer (primary USD market)
 * - Cardmarket (primary EUR market)
 * - eBay Sold Average (estimated until real API connected)
 * 
 * All calculations are deterministic and clearly labeled.
 */

export interface UnifiedPrices {
  tcgplayerMarket: number | null;
  tcgplayerLow: number | null;
  tcgplayerHigh: number | null;
  tcgplayerMid: number | null;
  cardmarketTrend: number | null;
  cardmarketAvg7: number | null;
  cardmarketAvg30: number | null;
  ebaySoldAvg: number | null;     // Estimated until eBay API connected
  consensus: number | null;        // Mean of available sources
  realizable: number | null;       // consensus * 0.87 (after ~13% fees)
}

const EUR_TO_USD = 1.08;

export function buildUnifiedPrices(
  tcgplayerPrices?: {
    market?: number | null;
    low?: number | null;
    high?: number | null;
    mid?: number | null;
  },
  cardmarketPrices?: {
    trendPrice?: number | null;
    avg7?: number | null;
    avg30?: number | null;
  },
  ebaySoldAvg?: number | null
): UnifiedPrices {
  const tcgMarket = tcgplayerPrices?.market ?? null;
  const tcgLow = tcgplayerPrices?.low ?? null;
  const tcgHigh = tcgplayerPrices?.high ?? null;
  const tcgMid = tcgplayerPrices?.mid ?? null;

  const cmTrend = cardmarketPrices?.trendPrice ?? null;
  const cmAvg7 = cardmarketPrices?.avg7 ?? null;
  const cmAvg30 = cardmarketPrices?.avg30 ?? null;

  const ebay = ebaySoldAvg ?? null;

  // Consensus = average of all available USD-equivalent sources
  const sources: number[] = [];
  if (tcgMarket !== null) sources.push(tcgMarket);
  if (cmTrend !== null) sources.push(cmTrend * EUR_TO_USD);
  if (cmAvg7 !== null) sources.push(cmAvg7 * EUR_TO_USD);
  if (ebay !== null) sources.push(ebay);

  const consensus = sources.length > 0
    ? sources.reduce((a, b) => a + b, 0) / sources.length
    : null;

  const realizable = consensus !== null ? consensus * 0.87 : null;

  return {
    tcgplayerMarket: tcgMarket,
    tcgplayerLow: tcgLow,
    tcgplayerHigh: tcgHigh,
    tcgplayerMid: tcgMid,
    cardmarketTrend: cmTrend,
    cardmarketAvg7: cmAvg7,
    cardmarketAvg30: cmAvg30,
    ebaySoldAvg: ebay,
    consensus,
    realizable,
  };
}

/** Confidence level based on source agreement */
export function calculateConfidence(prices: UnifiedPrices): 'high' | 'medium' | 'low' {
  const { tcgplayerMarket, cardmarketTrend, ebaySoldAvg } = prices;
  const sources: number[] = [];
  if (tcgplayerMarket !== null) sources.push(tcgplayerMarket);
  if (cardmarketTrend !== null) sources.push(cardmarketTrend * EUR_TO_USD);
  if (ebaySoldAvg !== null) sources.push(ebaySoldAvg);

  if (sources.length < 2) return 'low';

  const max = Math.max(...sources);
  const min = Math.min(...sources);
  const avg = sources.reduce((a, b) => a + b, 0) / sources.length;
  const diff = (max - min) / avg;

  if (diff < 0.2) return 'high';
  if (diff < 0.5) return 'medium';
  return 'low';
}

export const CONFIDENCE_META = {
  high: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    label: 'High Confidence',
    desc: 'Sources agree closely',
  },
  medium: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    label: 'Moderate Confidence',
    desc: 'Some variance between sources',
  },
  low: {
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    label: 'Low Confidence',
    desc: 'Large discrepancy — verify before buying',
  },
};
