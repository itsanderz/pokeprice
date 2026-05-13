import { NextRequest, NextResponse } from 'next/server';
import {
  robustFetch,
  buildPokemonTcgDetailUrl,
  estimateEbaySoldAvg,
} from '@/lib/marketplace';
import { buildUnifiedPrices } from '@/lib/pricing';

interface PokemonTcgCardResponse {
  data: {
    id: string;
    name: string;
    number?: string;
    rarity?: string;
    set?: { name: string; series?: string; releaseDate?: string };
    images?: { small: string; large: string };
    tcgplayer?: { updatedAt?: string; prices?: Record<string, { low?: number; mid?: number; high?: number; market?: number; directLow?: number }>; url?: string };
    cardmarket?: { prices?: Record<string, number>; updatedAt?: string; url?: string };
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const url = buildPokemonTcgDetailUrl(id);

  const result = await robustFetch<PokemonTcgCardResponse>(url, 'pokemontcg.io', {
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

  const card = result.data.data;

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

  const enriched = {
    ...card,
    _pokeprice: {
      ebaySoldAvg,
      unified,
    },
  };

  return NextResponse.json({ data: enriched });
}
