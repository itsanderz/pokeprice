"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface CardPrice {
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  directLow: number | null;
}

interface Card {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  set?: { name: string; series?: string };
  images?: { small: string; large: string };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, CardPrice>;
  };
  cardmarket?: {
    url?: string;
    prices?: Record<string, number>;
  };
}

function getMarketPrice(card: Card): number | null {
  const prices = card.tcgplayer?.prices;
  if (!prices) return null;
  for (const variant of ["holofoil", "reverseHolofoil", "normal", "1stEditionHolofoil"]) {
    if (prices[variant]?.market) return prices[variant].market!;
  }
  for (const p of Object.values(prices)) {
    if (p?.market) return p.market;
  }
  return null;
}

function formatVariant(name: string): string {
  const map: Record<string, string> = {
    normal: "Normal",
    holofoil: "Holo",
    reverseHolofoil: "Rev Holo",
    "1stEditionHolofoil": "1st Ed Holo",
    unlimitedHolofoil: "Unlimited",
    "1stEdition": "1st Edition",
    unlimited: "Unlimited",
  };
  return map[name] || name.replace(/([A-Z])/g, " $1").trim();
}

function getVariants(card: Card): [string, CardPrice][] {
  const prices = card.tcgplayer?.prices;
  if (!prices) return [];
  return Object.entries(prices).filter(([, p]) => p.market != null) as [
    string,
    CardPrice
  ][];
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);
  const [activeVariant, setActiveVariant] = useState<string>("");
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setCards([]);
      setTotal(0);
      setSelected(null);
      return;
    }
    setLoading(true);
    setSelected(null);
    try {
      const resp = await fetch(`/api/cards?q=${encodeURIComponent(q)}&limit=12`);
      const data = await resp.json();
      setCards(data.data || []);
      setTotal(data.totalCount || 0);
    } catch {
      setCards([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(query), 250);
    return () => clearTimeout(debounce.current);
  }, [query, search]);

  const selectCard = async (id: string) => {
    try {
      const resp = await fetch(`/api/cards/${id}`);
      const data = await resp.json();
      const card = data.data as Card;
      setSelected(card);
      const variants = getVariants(card);
      if (variants.length > 0) setActiveVariant(variants[0][0]);
    } catch {
      /* ignore */
    }
  };

  const selectedPrices = selected?.tcgplayer?.prices?.[activeVariant];
  const cmPrices = selected?.cardmarket?.prices;

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#fafafa] font-sans">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between pb-5 mb-5 border-b border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-lg">
              ⚡
            </div>
            <h1 className="text-lg font-bold tracking-tight">
              Poke<span className="text-violet-400">Price</span>
            </h1>
          </div>
          <span className="text-[11px] px-2 py-1 rounded-full bg-violet-500/15 text-violet-400 font-semibold tracking-wide">
            BETA
          </span>
        </header>

        {/* Search */}
        <div className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any Pokémon card…"
            className="w-full bg-[#1a1a1e] border border-[#27272a] rounded-xl px-4 py-3.5 text-base text-[#fafafa] outline-none transition-all focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/15 placeholder:text-[#71717a]"
            autoFocus
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-[#27272a] border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Results */}
        {!query && (
          <div className="text-center py-20 text-[#71717a]">
            <div className="text-5xl mb-3 opacity-50">🔍</div>
            <h3 className="text-base text-[#a1a1aa] mb-1">Search a Pokémon card</h3>
            <p className="text-[13px] max-w-xs mx-auto">
              Type a card name above to see real-time prices from TCGPlayer &amp; Cardmarket
            </p>
          </div>
        )}

        {query && !loading && cards.length === 0 && (
          <div className="text-center py-20 text-[#71717a]">
            <div className="text-5xl mb-3 opacity-50">😕</div>
            <h3 className="text-base text-[#a1a1aa] mb-1">No cards found</h3>
            <p className="text-[13px] max-w-xs mx-auto">
              Try a different search like &ldquo;Charizard&rdquo; or &ldquo;Pikachu&rdquo;
            </p>
          </div>
        )}

        {cards.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[13px] text-[#a1a1aa] font-medium">
                {total} cards found
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {cards.map((card) => {
                const marketPrice = getMarketPrice(card);
                return (
                  <button
                    key={card.id}
                    onClick={() => selectCard(card.id)}
                    className={`flex items-center gap-3.5 p-3 bg-[#1a1a1e] border rounded-xl cursor-pointer transition-all text-left hover:bg-[#222226] hover:border-[#3b3b40] hover:translate-x-0.5 ${
                      selected?.id === card.id
                        ? "border-violet-500 bg-violet-500/5"
                        : "border-[#27272a]"
                    }`}
                  >
                    {card.images?.small ? (
                      <img
                        src={card.images.small}
                        alt={card.name}
                        className="w-12 h-[66px] rounded object-contain bg-white/[0.03] shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-[66px] rounded bg-white/[0.03] shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold tracking-tight">{card.name}</div>
                      <div className="text-xs text-[#a1a1aa] mt-0.5">
                        {card.set?.name || "Unknown Set"}
                      </div>
                      <div className="text-[11px] text-[#71717a] font-mono">
                        #{card.number || "?"} · {card.rarity || "?"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold font-mono">
                        {marketPrice ? `$${marketPrice.toFixed(2)}` : "—"}
                      </div>
                      <div className="text-[10px] text-[#71717a] uppercase tracking-wider">
                        Market
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Detail panel */}
        {selected && (
          <div className="mt-2 bg-[#1a1a1e] border border-[#27272a] rounded-xl p-6 animate-[slideDown_0.2s_ease]">
            {/* Card header */}
            <div className="flex gap-5 mb-6 items-start max-sm:flex-col max-sm:items-center max-sm:text-center">
              {selected.images?.large && (
                <img
                  src={selected.images.large}
                  alt={selected.name}
                  className="w-[140px] rounded-lg shadow-xl max-sm:w-[180px]"
                />
              )}
              <div>
                <h2 className="text-[22px] font-bold tracking-tight">{selected.name}</h2>
                <p className="text-sm text-[#a1a1aa] mt-0.5">
                  {selected.set?.name || "Unknown Set"} · #{selected.number || "?"}
                </p>
                <span className="inline-block text-xs mt-1.5 px-2.5 py-0.5 bg-violet-500/15 text-violet-400 rounded-full font-semibold">
                  {selected.rarity || "Unknown"}
                </span>
              </div>
            </div>

            {/* Variant tabs */}
            {getVariants(selected).length > 1 && (
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {getVariants(selected).map(([name]) => (
                  <button
                    key={name}
                    onClick={() => setActiveVariant(name)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                      activeVariant === name
                        ? "bg-violet-500 text-white"
                        : "bg-[#141416] border border-[#27272a] text-[#a1a1aa] hover:bg-[#222226] hover:text-[#fafafa]"
                    }`}
                  >
                    {formatVariant(name)}
                  </button>
                ))}
              </div>
            )}

            {/* Pricing grid */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3 max-sm:grid-cols-1">
              {/* TCGPlayer */}
              <div className="bg-[#141416] border border-[#27272a] rounded-lg p-4">
                <h3 className="text-[11px] uppercase tracking-[0.8px] text-[#71717a] font-semibold mb-2">
                  📊 TCGPlayer
                </h3>
                <div className="text-2xl font-bold font-mono tracking-tight text-green-500">
                  {selectedPrices?.market
                    ? `$${selectedPrices.market.toFixed(2)}`
                    : "—"}
                </div>
                {selectedPrices && (
                  <div className="mt-2.5 flex flex-col gap-1">
                    <Row label="Market" value={selectedPrices.market} prefix="$" />
                    <Row label="Low" value={selectedPrices.low} prefix="$" />
                    <Row label="Mid" value={selectedPrices.mid} prefix="$" />
                    <Row label="High" value={selectedPrices.high} prefix="$" />
                    <Row label="Direct Low" value={selectedPrices.directLow} prefix="$" />
                  </div>
                )}
              </div>

              {/* Cardmarket */}
              <div className="bg-[#141416] border border-[#27272a] rounded-lg p-4">
                <h3 className="text-[11px] uppercase tracking-[0.8px] text-[#71717a] font-semibold mb-2">
                  🇪🇺 Cardmarket
                </h3>
                <div className="text-2xl font-bold font-mono tracking-tight text-blue-400">
                  {cmPrices?.trendPrice
                    ? `€${cmPrices.trendPrice.toFixed(2)}`
                    : "—"}
                </div>
                {cmPrices?.trendPrice && (
                  <div className="mt-2.5 flex flex-col gap-1">
                    <Row label="Trend" value={cmPrices.trendPrice} prefix="€" />
                    <Row label="1-Day Avg" value={cmPrices.avg1} prefix="€" />
                    <Row label="7-Day Avg" value={cmPrices.avg7} prefix="€" />
                    <Row label="30-Day Avg" value={cmPrices.avg30} prefix="€" />
                    <Row label="Low" value={cmPrices.lowPrice} prefix="€" />
                  </div>
                )}
              </div>

              {/* Fair Price */}
              <div className="bg-[#141416] border border-[#27272a] rounded-lg p-4">
                <h3 className="text-[11px] uppercase tracking-[0.8px] text-[#71717a] font-semibold mb-2">
                  💰 Fair Price
                </h3>
                <div className="text-2xl font-bold font-mono tracking-tight text-violet-400">
                  {selectedPrices?.market
                    ? `$${selectedPrices.market.toFixed(2)}`
                    : "—"}
                </div>
                <p className="text-[11px] text-[#71717a] mt-2">
                  Weighted blend of all sources
                </p>
              </div>
            </div>

            {selected.tcgplayer?.updatedAt && (
              <p className="text-[11px] text-[#71717a] mt-4 text-right">
                Prices updated: {selected.tcgplayer.updatedAt}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  prefix,
}: {
  label: string;
  value: number | null;
  prefix: string;
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[#71717a]">{label}</span>
      <span className="text-[#a1a1aa] font-mono text-[11px]">
        {value != null ? `${prefix}${value.toFixed(2)}` : "—"}
      </span>
    </div>
  );
}
