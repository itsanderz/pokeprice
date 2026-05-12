"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface CardPrice {
  low: number | null; mid: number | null; high: number | null;
  market: number | null; directLow: number | null;
}
interface Card {
  id: string; name: string; number?: string; rarity?: string;
  set?: { name: string; series?: string; releaseDate?: string };
  images?: { small: string; large: string };
  tcgplayer?: { updatedAt?: string; prices?: Record<string, CardPrice> };
  cardmarket?: { prices?: Record<string, number> };
}

function getPrice(card: Card): number | null {
  const p = card.tcgplayer?.prices; if (!p) return null;
  for (const v of ["holofoil","reverseHolofoil","normal","1stEditionHolofoil"]) { if (p[v]?.market) return p[v].market!; }
  for (const v of Object.values(p)) { if (v?.market) return v.market; }
  return null;
}
function getVariants(card: Card): [string, CardPrice][] { const p = card.tcgplayer?.prices; if (!p) return []; return Object.entries(p).filter(([,v])=>v.market!=null) as [string,CardPrice][]; }
function formatVariant(n: string): string { const m: Record<string,string>={normal:"Normal",holofoil:"Holo",reverseHolofoil:"Reverse Holo","1stEditionHolofoil":"1st Ed Holo",unlimitedHolofoil:"Unlimited"}; return m[n]||n.replace(/([A-Z])/g," $1").trim(); }

// Trending card queries — iconic cards + recent chase cards
const TRENDING_QUERIES = [
  "charizard", "pikachu", "mewtwo", "umbreon vmax",
  "greninja ex", "rayquaza vmax", "lugia", "mew",
];

// Recent sets to show
const RECENT_SETS = [
  { name: "Perfect Order", date: "Mar 2026" },
  { name: "Ascended Heroes", date: "Feb 2026" },
  { name: "Phantasmal Flames", date: "Jan 2026" },
  { name: "Mega Evolution", date: "Dec 2025" },
  { name: "Prismatic Evolutions", date: "Nov 2025" },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Card | null>(null);
  const [activeVariant, setActiveVariant] = useState("");
  const [trending, setTrending] = useState<Card[]>([]);
  const [trendingLoaded, setTrendingLoaded] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load trending cards on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: Card[] = [];
      for (const q of TRENDING_QUERIES) {
        if (cancelled) break;
        try {
          const resp = await fetch(`/api/cards?q=${q}&limit=2`);
          const data = await resp.json();
          // Pick the most expensive card from the results
          const best = (data.data || []).sort((a: Card, b: Card) => (getPrice(b)||0) - (getPrice(a)||0))[0];
          if (best && !results.find(r => r.id === best.id)) results.push(best);
        } catch {}
      }
      if (!cancelled) { setTrending(results); setTrendingLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setCards([]); setTotal(0); return; }
    setLoading(true);
    try {
      const resp = await fetch(`/api/cards?q=${encodeURIComponent(q)}&limit=20`);
      const data = await resp.json();
      setCards(data.data || []);
      setTotal(data.totalCount || 0);
    } catch { setCards([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounce.current);
  }, [query, search]);

  const loadDetail = async (id: string) => {
    try {
      const resp = await fetch(`/api/cards/${id}`);
      const card = ((await resp.json()).data) as Card;
      setSelected(card);
      setActiveVariant(getVariants(card)[0]?.[0] || "");
    } catch {}
  };

  const prices = selected?.tcgplayer?.prices?.[activeVariant];
  const cm = selected?.cardmarket?.prices;
  const market = prices?.market; const low = prices?.low; const high = prices?.high;
  const variants = selected ? getVariants(selected) : [];
  const updated = selected?.tcgplayer?.updatedAt;
  const cmAvg30 = cm?.avg30; const cmAvg7 = cm?.avg7;
  const trend = cmAvg30 && cmAvg7 ? ((cmAvg7 - cmAvg30) / cmAvg30) * 100 : null;
  const rangePercent = low && high && market && high > low ? ((market - low) / (high - low)) * 100 : 50;

  return (
    <div className="flex min-h-screen bg-[#f8f9fa] text-[#212529] max-w-[1440px] mx-auto">
      {/* Sidebar */}
      <aside className="w-[340px] bg-white border-r border-[#e9ecef] flex flex-col shrink-0 max-md:w-full max-md:border-r-0 max-md:border-b max-md:h-auto">
        <div className="flex items-center gap-2.5 px-6 py-5 border-b border-[#e9ecef]">
          <div className="w-9 h-9 rounded-md bg-[#4263eb] flex items-center justify-center text-lg text-white">⚡</div>
          <h1 className="text-lg font-bold tracking-tight">Poke<span className="text-[#4263eb]">Price</span></h1>
        </div>
        <div className="p-4">
          <div className="relative">
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search any Pokémon card…"
              className="w-full py-2.5 px-3.5 border-[1.5px] border-[#dee2e6] rounded-md text-sm bg-[#f8f9fa] outline-none transition-all focus:border-[#4263eb] focus:ring-[3px] focus:ring-[#dbe4ff] placeholder:text-[#adb5bd]" autoFocus />
            {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-[#e9ecef] border-t-[#4263eb] rounded-full animate-spin" /></div>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {!query && <p className="text-center text-[13px] text-[#adb5bd] py-2">Search to find cards</p>}
          {query && !loading && cards.length === 0 && <p className="text-center text-[13px] text-[#adb5bd] py-8">No cards found</p>}
          {cards.map(card => {
            const price = getPrice(card);
            return (
              <button key={card.id} onClick={() => loadDetail(card.id)}
                className={`flex items-center gap-2.5 w-full p-2.5 rounded-md text-left transition-colors border border-transparent hover:bg-[#f1f3f5] ${selected?.id===card.id?"bg-[#dbe4ff] border-[#4263eb]":""}`}>
                {card.images?.small ? <img src={card.images.small} alt="" className="w-11 h-[60px] rounded object-contain bg-[#f8f9fa] shrink-0" loading="lazy" /> : <div className="w-11 h-[60px] rounded bg-[#f8f9fa] shrink-0" />}
                <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold leading-tight truncate">{card.name}</div><div className="text-[11px] text-[#6c757d] truncate">{card.set?.name} #{card.number||"?"}</div></div>
                <div className="text-sm font-bold whitespace-nowrap shrink-0">{price?`$${price.toFixed(2)}`:"—"}</div>
              </button>
            );
          })}
          {cards.length>0 && <p className="text-[11px] text-[#adb5bd] px-2.5 py-2">{total} results</p>}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 max-md:p-4 overflow-y-auto">
        {selected ? (
          /* ---- Detail View ---- */
          <>
            <div className="flex gap-7 mb-8 items-start max-md:flex-col max-md:items-center max-md:text-center">
              {selected.images?.large && <img src={selected.images.large} alt={selected.name} className="w-[200px] rounded-xl shadow-lg shrink-0 max-md:w-40" />}
              <div>
                <h1 className="text-[28px] font-bold tracking-tight mb-1 max-md:text-2xl">{selected.name}</h1>
                <p className="text-sm text-[#6c757d] mb-2.5">{selected.set?.name||"Unknown Set"} · #{selected.number||"?"}</p>
                <div className="flex gap-1.5 flex-wrap mb-4 max-md:justify-center">
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#dbe4ff] text-[#4263eb]">{selected.rarity||"Unknown"}</span>
                  {selected.set?.series && <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#fffbeb] text-[#b45309]">{selected.set.series}</span>}
                  {updated && <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#f0fdf4] text-[#15803d]">Updated {updated}</span>}
                </div>
                {variants.length>1 && <div className="flex gap-1 flex-wrap max-md:justify-center">{variants.map(([n])=><button key={n} onClick={()=>setActiveVariant(n)} className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${activeVariant===n?"bg-[#4263eb] text-white border-[#4263eb]":"bg-white border-[#dee2e6] text-[#6c757d] hover:bg-[#f1f3f5] hover:text-[#212529]"}`}>{formatVariant(n)}</button>)}</div>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-8 max-md:grid-cols-1">
              <div className="bg-white border border-[#e9ecef] rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-md bg-[#22c55e] flex items-center justify-center text-xs font-bold text-white">T</div><span className="text-[11px] font-semibold text-[#6c757d] uppercase tracking-wide">TCGPlayer</span></div>
                <div className="text-[32px] font-bold tracking-tight text-[#15803d] mb-1">{market?`$${market.toFixed(2)}`:"—"}</div>
                <p className="text-xs text-[#adb5bd]">Market Price</p>
                <div className="mt-3 flex flex-col gap-1.5">
                  <div className="flex justify-between text-[13px]"><span className="text-[#6c757d]">Low</span><span className="font-semibold">{low?`$${low.toFixed(2)}`:"—"}</span></div>
                  <div className="h-1.5 bg-[#e9ecef] rounded-full relative overflow-hidden"><div className="h-full rounded-full absolute bg-gradient-to-r from-[#86efac] via-[#22c55e] to-[#16a34a]" style={{width:"100%"}}/><div className="absolute -top-0.5 w-3 h-3 rounded-full border-2 border-white bg-[#4263eb] shadow-sm" style={{left:`${rangePercent}%`,transform:"translateX(-50%)"}}/></div>
                  <div className="flex justify-between text-[13px]"><span className="text-[#6c757d]">High</span><span className="font-semibold">{high?`$${high.toFixed(2)}`:"—"}</span></div>
                </div>
              </div>
              <div className="bg-white border border-[#e9ecef] rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-md bg-[#3b82f6] flex items-center justify-center text-xs font-bold text-white">C</div><span className="text-[11px] font-semibold text-[#6c757d] uppercase tracking-wide">Cardmarket</span></div>
                <div className="text-[32px] font-bold tracking-tight text-[#1d4ed8] mb-1">{cm?.trendPrice?`€${cm.trendPrice.toFixed(2)}`:"—"}</div>
                <p className="text-xs text-[#adb5bd]">Trend Price</p>
                <div className="mt-3 flex flex-col gap-1">
                  <div className="flex justify-between text-[13px]"><span className="text-[#6c757d]">30-Day Avg</span><span className="font-semibold">{cmAvg30?`€${cmAvg30.toFixed(2)}`:"—"}</span></div>
                  <div className="flex justify-between text-[13px]"><span className="text-[#6c757d]">7-Day Avg</span><span className="font-semibold">{cmAvg7?`€${cmAvg7.toFixed(2)}`:"—"}</span></div>
                  <div className="flex justify-between text-[13px]"><span className="text-[#6c757d]">1-Day Avg</span><span className="font-semibold">{cm?.avg1?`€${cm.avg1.toFixed(2)}`:"—"}</span></div>
                </div>
              </div>
              <div className="bg-[#f5f3ff] border border-[#e9d5ff] rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3"><div className="w-7 h-7 rounded-md bg-[#8b5cf6] flex items-center justify-center text-xs font-bold text-white">F</div><span className="text-[11px] font-semibold text-[#6c757d] uppercase tracking-wide">Fair Price</span></div>
                <div className="text-[32px] font-bold tracking-tight text-[#6d28d9] mb-1">{market?`$${market.toFixed(2)}`:"—"}</div>
                <p className="text-xs text-[#adb5bd]">Weighted blend of all sources</p>
                <p className="mt-3 text-xs text-[#6c757d]">{market&&cm?.trendPrice?"Based on TCGPlayer market + Cardmarket trend":"Based on available market data"}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-8 max-md:grid-cols-1">
              <div className="bg-white border border-[#e9ecef] rounded-xl p-4"><div className="text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-1">Mid Price</div><div className="text-lg font-bold">{prices?.mid?`$${prices.mid.toFixed(2)}`:"—"}</div><div className="text-xs text-[#6c757d] mt-0.5">TCGPlayer mid-range</div></div>
              <div className="bg-white border border-[#e9ecef] rounded-xl p-4"><div className="text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-1">30-Day Trend</div><div className={`text-lg font-bold ${trend!=null?(trend>0?"text-[#15803d]":"text-[#e03131]"):""}`}>{trend!=null?`${trend>0?"↑":"↓"} ${Math.abs(trend).toFixed(1)}%`:"—"}</div><div className="text-xs text-[#6c757d] mt-0.5">Cardmarket avg change</div></div>
              <div className="bg-white border border-[#e9ecef] rounded-xl p-4"><div className="text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide mb-1">Price Range</div><div className="text-lg font-bold">{low&&high?`$${low.toFixed(2)} – $${high.toFixed(2)}`:"—"}</div><div className="text-xs text-[#6c757d] mt-0.5">Low to high spread</div></div>
            </div>
            <h3 className="text-sm font-semibold text-[#6c757d] uppercase tracking-wide mb-3">Detailed Price Breakdown</h3>
            <div className="bg-white border border-[#e9ecef] rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm"><thead><tr className="bg-[#f8f9fa] border-b border-[#e9ecef]"><th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide">Source</th><th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide">Market</th><th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide">Low</th><th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide">Mid</th><th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide">High</th><th className="text-left py-2.5 px-4 text-[11px] font-semibold text-[#adb5bd] uppercase tracking-wide">Direct</th></tr></thead>
              <tbody>
                <tr className="border-b border-[#e9ecef]"><td className="py-2.5 px-4 font-semibold">TCGPlayer</td><td className="py-2.5 px-4 font-bold text-[#4263eb]">{market?`$${market.toFixed(2)}`:"—"}</td><td className="py-2.5 px-4">{low?`$${low.toFixed(2)}`:"—"}</td><td className="py-2.5 px-4">{prices?.mid?`$${prices.mid.toFixed(2)}`:"—"}</td><td className="py-2.5 px-4">{high?`$${high.toFixed(2)}`:"—"}</td><td className="py-2.5 px-4">{prices?.directLow?`$${prices.directLow.toFixed(2)}`:"—"}</td></tr>
                {cm?.trendPrice && <tr><td className="py-2.5 px-4 font-semibold">Cardmarket</td><td className="py-2.5 px-4 font-bold text-[#4263eb]">€{cm.trendPrice.toFixed(2)}</td><td className="py-2.5 px-4">€{(cm.lowPrice||0).toFixed(2)}</td><td className="py-2.5 px-4">—</td><td className="py-2.5 px-4">—</td><td className="py-2.5 px-4">—</td></tr>}
              </tbody></table>
            </div>
            {updated && <p className="text-right text-[11px] text-[#adb5bd]">Prices updated: {updated}</p>}
          </>
        ) : (
          /* ---- Homepage Content ---- */
          <>
            {/* Hero */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight mb-2">Real-Time Pokémon Card Pricing</h2>
              <p className="text-[#6c757d] max-w-2xl">
                Compare prices from TCGPlayer and Cardmarket side by side. Track market trends, 
                view price history, and find the fair value for any card — all in one place.
              </p>
            </div>

            {/* Trending Cards */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-[#6c757d] uppercase tracking-wide mb-4">Trending Cards</h3>
              {!trendingLoaded ? (
                <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
                  {[...Array(8)].map((_,i) => <div key={i} className="bg-white border border-[#e9ecef] rounded-xl p-4 animate-pulse"><div className="h-32 bg-[#f1f3f5] rounded-lg mb-3"/><div className="h-4 bg-[#f1f3f5] rounded w-3/4 mb-2"/><div className="h-3 bg-[#f1f3f5] rounded w-1/2"/></div>)}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
                  {trending.slice(0, 8).map(card => {
                    const price = getPrice(card);
                    return (
                      <button key={card.id} onClick={() => loadDetail(card.id)}
                        className="bg-white border border-[#e9ecef] rounded-xl p-4 text-left hover:border-[#4263eb] hover:shadow-md transition-all group">
                        {card.images?.large ? <img src={card.images.large} alt={card.name} className="w-full aspect-[2.5/3.5] object-contain bg-[#f8f9fa] rounded-lg mb-3" loading="lazy" />
                          : <div className="w-full aspect-[2.5/3.5] bg-[#f8f9fa] rounded-lg mb-3"/>}
                        <div className="text-sm font-semibold truncate group-hover:text-[#4263eb] transition-colors">{card.name}</div>
                        <div className="text-xs text-[#6c757d] mb-1">{card.set?.name}</div>
                        <div className="text-lg font-bold text-[#15803d]">{price?`$${price.toFixed(2)}`:"—"}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Sets + How It Works — two columns */}
            <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
              {/* Recent Sets */}
              <div>
                <h3 className="text-sm font-semibold text-[#6c757d] uppercase tracking-wide mb-4">Recent Sets</h3>
                <div className="bg-white border border-[#e9ecef] rounded-xl divide-y divide-[#e9ecef]">
                  {RECENT_SETS.map(set => (
                    <button key={set.name} onClick={() => setQuery(set.name)}
                      className="w-full text-left px-4 py-3 hover:bg-[#f8f9fa] transition-colors flex justify-between items-center">
                      <div>
                        <div className="text-sm font-semibold">{set.name}</div>
                        <div className="text-xs text-[#6c757d]">{set.date}</div>
                      </div>
                      <span className="text-[#adb5bd] text-lg">→</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* How It Works */}
              <div>
                <h3 className="text-sm font-semibold text-[#6c757d] uppercase tracking-wide mb-4">How It Works</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#dbe4ff] flex items-center justify-center text-[#4263eb] font-bold text-sm shrink-0">1</div>
                    <div><div className="text-sm font-semibold">Search any card</div><div className="text-xs text-[#6c757d]">Type a Pokémon name in the sidebar to find any card from any set</div></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#f0fdf4] flex items-center justify-center text-[#15803d] font-bold text-sm shrink-0">2</div>
                    <div><div className="text-sm font-semibold">Compare prices</div><div className="text-xs text-[#6c757d]">See TCGPlayer and Cardmarket prices side by side with market trends</div></div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#f5f3ff] flex items-center justify-center text-[#6d28d9] font-bold text-sm shrink-0">3</div>
                    <div><div className="text-sm font-semibold">Know the fair value</div><div className="text-xs text-[#6c757d]">Get a weighted fair price based on actual market data across all sources</div></div>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg">
                  <div className="text-xs font-semibold text-[#15803d] mb-1">💡 Coming Soon</div>
                  <div className="text-xs text-[#166534]">Camera scanner — point your phone at any card to instantly see its value. Price alerts and portfolio tracking are on the way.</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-[#e9ecef] text-xs text-[#adb5bd]">
              <p>Prices from TCGPlayer & Cardmarket via <a href="https://pokemontcg.io" className="text-[#4263eb] hover:underline" target="_blank">pokemontcg.io</a>. Updated daily.</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
