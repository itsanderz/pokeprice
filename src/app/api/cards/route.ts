import { NextRequest, NextResponse } from 'next/server';
import {
  robustFetch,
  buildPokemonTcgSearchUrl,
  estimateEbaySoldAvg,
} from '@/lib/marketplace';
import { buildUnifiedPrices } from '@/lib/pricing';
import { rankByRelevance } from '@/lib/search';

interface PokemonTcgResponse {
  data: Array<{
    id: string;
    name: string;
    number?: string;
    rarity?: string;
    set?: { name: string; series?: string; releaseDate?: string };
    images?: { small: string; large: string };
    tcgplayer?: { updatedAt?: string; prices?: Record<string, { low?: number; mid?: number; high?: number; market?: number; directLow?: number }> };
    cardmarket?: { prices?: Record<string, number>; updatedAt?: string; url?: string };
  }>;
  totalCount?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = searchParams.get('limit') || '12';

  if (!q) {
    return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });
  }

  const parsedLimit = Math.min(parseInt(limit, 10), 40);

  /* Fetch a broader set from upstream so fuzzy ranking has more candidates.
     Pokémontcg.io name queries are prefix-ish; we pull 2x the requested limit
     and let Fuse.js find the true best matches across all fields. */
  const upstreamLimit = Math.min(parsedLimit * 4, 100);
  const url = buildPokemonTcgSearchUrl(q, upstreamLimit);

  const result = await robustFetch<PokemonTcgResponse>(url, 'pokemontcg.io', {
    timeoutMs: 10000,
    retries: 2,
    retryDelayMs: 500,
  });

  if (!result.ok || !result.data) {
    return NextResponse.json(
      { error: result.error || 'Failed to fetch card data', source: result.source },
      { status: 502 }
    );
  }

  // Enrich each card with eBay sold estimate and unified pricing
  const enriched = result.data.data.map((card) => {
    const tcgMarket =
      card.tcgplayer?.prices?.holofoil?.market ??
      card.tcgplayer?.prices?.reverseHolofoil?.market ??
      card.tcgplayer?.prices?.normal?.market ??
      null;

    const ebaySoldAvg = estimateEbaySoldAvg(tcgMarket);
    const unified = buildUnifiedPrices(
      {
        market: tcgMarket,
        low: card.tcgplayer?.prices?.holofoil?.low ?? null,
        high: card.tcgplayer?.prices?.holofoil?.high ?? null,
        mid: card.tcgplayer?.prices?.holofoil?.mid ?? null,
      },
      {
        trendPrice: card.cardmarket?.prices?.trendPrice ?? null,
        avg7: card.cardmarket?.prices?.avg7 ?? null,
        avg30: card.cardmarket?.prices?.avg30 ?? null,
      },
      ebaySoldAvg
    );

    return {
      ...card,
      _pokeprice: {
        ebaySoldAvg,
        unified,
      },
    };
  });

  // Apply fuzzy relevance ranking so "charzard" matches "Charizard"
  const ranked = rankByRelevance(enriched, q, parsedLimit);

  return NextResponse.json({ data: ranked, totalCount: ranked.length });
}
