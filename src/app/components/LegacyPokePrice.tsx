"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Fuse from "fuse.js";
import {
  IconPokeball, IconSearch, IconLightning, IconFire, IconWater,
  IconLeaf, IconEye, IconChartLine, IconChartBar, IconTrendUp,
  IconTrendDown, IconBell, IconStar, IconHeart, IconClock,
  IconWallet, IconPackage, IconFilter, IconGrid, IconList,
  IconChevronRight, IconChevronLeft, IconChevronDown, IconX,
  IconCheck, IconInfo, IconExternalLink, IconArrowUpRight,
  IconMinus, IconPlus, IconSparkles, IconShield, IconMenu, IconAlertTriangle,
  IconBook, IconPen, IconClipboard, IconGlobe
} from "./Icons";
import Card3D from "./Card3D";
import Sparkline from "./Sparkline";
import PriceDashboard from "./PriceDashboard";
import { POKEMON_NAMES } from "@/lib/pokemon-names";
import { convertToCad, type Currency } from "@/lib/pricing";
import { parseSearchQuery, filterCollectionByQuery } from "@/lib/search-utils";

/* ═══════════════════════════════════════
   TYPES
   ═══════════════════════════════════════ */
interface CardPrice {
  low: number | null; mid: number | null; high: number | null;
  market: number | null; directLow: number | null;
}
interface Card {
  id: string; name: string; number?: string; rarity?: string;
  set?: { name: string; series?: string; releaseDate?: string };
  images?: { small: string; large: string };
  tcgplayer?: { updatedAt?: string; prices?: Record<string, CardPrice>; url?: string };
  cardmarket?: { prices?: Record<string, number>; updatedAt?: string; url?: string };
  _pokeprice?: {
    ebaySoldAvg?: number;
    unified?: import("@/lib/pricing").UnifiedPrices;
  };
}
interface SavedCard {
  id: string; name: string; setName: string; number?: string;
  imageSmall?: string; price: number | null; rarity?: string;
}
interface CollectionItem extends SavedCard {
  quantity: number;
  costBasis?: number;          // What the user paid per copy (research: "I bought 50 PSA 10s at $40 each, now they're $200. What's my return?")
  condition?: "NM" | "LP" | "MP" | "HP" | "Damaged"; // Condition tracking (research: "A NM Base Charizard and a PSA 2 should not share a price")
}

/* Icon component type — replaces 'any' */
type IconComponent = React.FC<{ className?: string }>;

/* Safe ID generation — crypto.randomUUID() unsupported in Safari < 14.1 */
function safeId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* Condition-adjusted price multipliers based on community standard deductions */
const CONDITION_MULTIPLIERS: Record<string, number> = {
  NM: 1.0,      // Near Mint — full price
  LP: 0.80,     // Light Play — 20% off (research: binder copies sell at discount)
  MP: 0.50,     // Moderate Play — 50% off
  HP: 0.30,     // Heavy Play — 70% off
  Damaged: 0.10 // Damaged — 90% off
};

type View = "home" | "search" | "detail" | "watchlist" | "collection" | "sealed" | "stories" | "grading";

/* Sealed product tracking — research gap: no competitor tracks sealed inventory */
interface SealedItem {
  id: string;
  name: string;
  set: string;
  format: "Booster Box" | "ETB" | "Blister" | "Tin" | "Collection Box" | "Other";
  qty: number;
  costBasis: number;
  estValue: number | null;
  storageLocation?: string;
  purchaseDate?: string;
  notes?: string;
}

/* Card Story Mode — attach memories, provenance, and meaning to individual cards.
   Research: Memorial/Story Collectors need narrative attached to cards, not just prices. */
interface CardStory {
  id: string;              // card.id (foreign key)
  title: string;
  body: string;
  date: string;            // ISO date of the memory/event
  createdAt: string;       // ISO date of story creation
  updatedAt: string;       // ISO date of last edit
}

/* Grading Submission Tracker — research: users check status 5+ times/day, turnaround times are unreliable,
   true cost basis includes grading fees + shipping + platform fees. Pro feature. */
interface GradingSubmission {
  id: string;
  cardName: string;
  cardId?: string;         // link to collection card if applicable
  imageSmall?: string;
  service: "PSA" | "BGS" | "CGC" | "SGC" | "TAG" | "ARS" | "ACE" | "Graad" | "Other";
  serviceLevel: string;    // e.g. "Value", "Express", "Regular"
  declaredValue: number;   // insured value
  gradingCost: number;     // per-card grading fee
  shippingCost: number;    // to/from grader
  otherCosts: number;      // middleman, supplies, etc.
  submissionDate: string;  // ISO date
  trackingNumber?: string;
  currentStage: string;
  stages: { name: string; date: string; notes?: string }[];
  estimatedCompletion?: string;
  actualCompletion?: string;
  status: "pending" | "in_transit" | "received" | "grading" | "completed" | "lost" | "cancelled";
  grade?: string;          // e.g. "PSA 10", "BGS 9.5"
  certNumber?: string;
  notes?: string;
}

/* Cross-Region Price estimates — research: JP cards often 10-15% cheaper in Japan,
   but shipping + duties complicate math. Displayed as context, not live data. */
interface RegionPrice {
  region: "US" | "JP" | "EU" | "UK" | "CA";
  currency: string;
  price: number | null;
  source: string;
  lastUpdated?: string;
}

/* ═══════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════ */
function getPrice(card: Card): number | null {
  const p = card.tcgplayer?.prices; if (!p) return null;
  for (const v of ["holofoil","reverseHolofoil","normal","1stEditionHolofoil"]) { if (p[v]?.market) return p[v].market!; }
  for (const v of Object.values(p)) { if (v?.market) return v.market; }
  return null;
}

/* Realizable price = what you'll actually get after typical resale fees
   Research evidence: "Never trust the app price. Check eBay sold and then subtract 15% for fees."
   We use 13% to be slightly conservative (eBay ~12.9% + payment processing ~0.3%) */
function getRealizablePrice(marketPrice: number | null): number | null {
  if (marketPrice === null) return null;
  return marketPrice * 0.87;
}

/* Condition-adjusted price for collection items */
function getConditionAdjustedPrice(marketPrice: number | null, condition?: string): number | null {
  if (marketPrice === null) return null;
  const mult = CONDITION_MULTIPLIERS[condition || "NM"] ?? 1.0;
  return marketPrice * mult;
}
function getVariants(card: Card): [string, CardPrice][] {
  const p = card.tcgplayer?.prices; if (!p) return [];
  return Object.entries(p).filter(([,v])=>v.market!=null) as [string,CardPrice][];
}
function formatVariant(n: string): string {
  const m: Record<string,string>={normal:"Normal",holofoil:"Holo",reverseHolofoil:"Reverse Holo","1stEditionHolofoil":"1st Ed Holo",unlimitedHolofoil:"Unlimited"};
  return m[n]||n.replace(/([A-Z])/g," $1").trim();
}
function toSavedCard(card: Card): SavedCard {
  return { id: card.id, name: card.name, setName: card.set?.name||"", number: card.number, imageSmall: card.images?.small, price: getPrice(card), rarity: card.rarity };
}

/* CSV export — always free. Research: users deeply value data portability and control. */
function exportCollectionToCsv(collection: CollectionItem[]): string {
  const headers = ["Name","Set","Number","Rarity","Quantity","Condition","Condition Multiplier","Market Price","Adjusted Price","Cost Basis","Invested","ROI %","eBay Sold Avg (est)"];
  const rows = collection.map(c => {
    const adj = getConditionAdjustedPrice(c.price, c.condition);
    const invested = (c.costBasis || 0) * c.quantity;
    const roi = c.costBasis && adj ? (((adj - c.costBasis) / c.costBasis) * 100).toFixed(1) : "";
    return [
      `"${c.name}"`, `"${c.setName}"`, c.number || "", c.rarity || "",
      c.quantity, c.condition || "NM", (CONDITION_MULTIPLIERS[c.condition || "NM"] * 100).toFixed(0) + "%",
      c.price?.toFixed(2) || "", adj?.toFixed(2) || "", c.costBasis?.toFixed(2) || "",
      invested.toFixed(2), roi
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* Sparkline generation — only uses real data points from APIs.
   Research finding: users deeply distrust apps that show fake/synthetic price charts.
   If we have fewer than 3 real data points, we show "Insufficient data" instead of fabricating trends. */
function generateSparkline(card: Card): { data: number[]; hasRealData: boolean } {
  const pts: number[] = [];
  const cm = card.cardmarket?.prices;
  if (cm?.avg30) pts.push(cm.avg30);
  if (cm?.avg7) pts.push(cm.avg7);
  if (cm?.avg1) pts.push(cm.avg1);
  if (cm?.trendPrice) pts.push(cm.trendPrice);
  const tcg = getPrice(card); if (tcg) pts.push(tcg);
  return { data: pts.slice(-10), hasRealData: pts.length >= 3 };
}
function getTrendPercent(card: Card): number | null {
  const cm = card.cardmarket?.prices;
  if (cm?.avg30 && cm?.avg7) return ((cm.avg7 - cm.avg30)/cm.avg30)*100;
  return null;
}
function getRarityStyle(rarity?: string): string {
  if (!rarity) return "text-slate-400 border-slate-500/20 bg-slate-500/10";
  if (rarity.includes("Secret")||rarity.includes("Rainbow")||rarity.includes("Gold")) return "text-amber-400 border-amber-500/20 bg-amber-500/10";
  if (rarity.includes("Holo")) return "text-cyan-400 border-cyan-500/20 bg-cyan-500/10";
  if (rarity.includes("Ultra")||rarity.includes("VMAX")||rarity.includes("VSTAR")||rarity.includes("EX")) return "text-purple-400 border-purple-500/20 bg-purple-500/10";
  if (rarity.includes("Rare")) return "text-yellow-400 border-yellow-500/20 bg-yellow-500/10";
  if (rarity.includes("Uncommon")) return "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
  return "text-slate-400 border-slate-500/20 bg-slate-500/10";
}
function isHolographic(card: Card): boolean {
  return !!card.rarity?.match(/Holo|Secret|Rainbow|Gold|VMAX|VSTAR|Alt Art/i);
}

/* ═══════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════ */
const TRENDING_QUERIES = ["charizard","pikachu","mewtwo","umbreon vmax","greninja ex","rayquaza vmax","lugia","mew"];
const RECENT_SETS = [
  { name:"Surging Sparks", date:"Nov 2024" },
  { name:"Stellar Crown", date:"Sep 2024" },
  { name:"Shrouded Fable", date:"Aug 2024" },
  { name:"Twilight Masquerade", date:"May 2024" },
  { name:"Temporal Forces", date:"Mar 2024" },
];

/* ═══════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════ */
function PriceChange({ value, className }: { value:number|null; className?:string }) {
  if (value===null) return <span className={className}>—</span>;
  const up = value>0;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium ${up?"text-emerald-400":"text-rose-400"} ${className||""}`}>
      {up?<IconTrendUp className="w-3 h-3"/>:<IconTrendDown className="w-3 h-3"/>}
      {up?"+":""}{value.toFixed(1)}%
    </span>
  );
}

function MarketDepth({ low, market, high }: { low:number|null|undefined; market:number|null|undefined; high:number|null|undefined }) {
  if (!low||!high||!market||high<=low) return <div className="h-1.5 bg-surface-raised rounded-full"/>;
  const pct = Math.max(2,Math.min(98,((market-low)/(high-low))*100));
  return (
    <div className="relative h-1.5 bg-surface-raised rounded-full overflow-hidden">
      <div className="absolute inset-y-0 left-0 bg-emerald-500/20 rounded-full" style={{width:`${pct}%`}} />
      <div className="absolute inset-y-0 right-0 bg-rose-500/20 rounded-full" style={{width:`${100-pct}%`}} />
      <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.4)]" style={{left:`${pct}%`}} />
    </div>
  );
}

function EmptyState({ icon:Icon, title, subtitle, action }: { icon:IconComponent; title:string; subtitle:string; action?:React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-surface-raised border border-border flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-text-tertiary" />
      </div>
      <h3 className="text-lg font-semibold text-text mb-1 font-display">{title}</h3>
      <p className="text-sm text-text-secondary max-w-sm mb-4">{subtitle}</p>
      {action}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 animate-shimmer overflow-hidden flex flex-col h-full">
      <div className="h-48 bg-white/[0.03] rounded-lg mb-3" />
      <div className="h-4 bg-white/[0.03] rounded w-3/4 mb-2" />
      <div className="h-3 bg-white/[0.03] rounded w-1/2 mb-4" />
      <div className="h-5 bg-white/[0.03] rounded w-1/3 mt-auto" />
    </div>
  );
}

/* ═══════════════════════════════════════
   VIEWS
   ═══════════════════════════════════════ */
function HomeView({ trending, trendingLoaded, onCardClick, onSetClick, watchlist, onToggleWatchlist }: {
  trending:Card[]; trendingLoaded:boolean; onCardClick:(id:string)=>void; onSetClick:(name:string)=>void;
  watchlist:SavedCard[]; onToggleWatchlist:(card:Card)=>void;
}) {
  const mood = useMemo(() => {
    if (trending.length===0) return "neutral";
    const up = trending.filter(c=>{const t=getTrendPercent(c); return t!==null&&t>0;}).length;
    const down = trending.filter(c=>{const t=getTrendPercent(c); return t!==null&&t<0;}).length;
    if (up>down*1.3) return "bullish"; if (down>up*1.3) return "bearish"; return "neutral";
  },[trending]);

  const topGainer = useMemo(() => {
    return trending.filter(c=>getTrendPercent(c)!==null).sort((a,b)=>(getTrendPercent(b)||0)-(getTrendPercent(a)||0))[0];
  },[trending]);

  return (
    <div className="animate-fade-in-up space-y-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8 md:p-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/5 rounded-full blur-3xl -ml-10 -mb-10" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <div className={`w-1.5 h-1.5 rounded-full ${mood==="bullish"?"bg-emerald-400 animate-pulse":mood==="bearish"?"bg-rose-400":"bg-yellow-400"}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono">
                {mood==="bullish"?"Bullish":mood==="bearish"?"Bearish":"Neutral"} Market
              </span>
            </div>
            {topGainer && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <IconTrendUp className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                  Top: {topGainer.name} +{(getTrendPercent(topGainer)||0).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-3 font-display">
            <span className="gradient-text">The Pokémon</span><br />
            <span className="text-text">Trading Terminal</span>
          </h1>
          <p className="text-text-secondary max-w-lg text-[15px] leading-relaxed mb-6">
            Real-time pricing from TCGPlayer & Cardmarket. 3D card inspection, market depth analysis, 
            sparkline trends, and portfolio tracking — built for serious collectors.
          </p>
          <div className="flex flex-wrap gap-3">
            {["Charizard","Pikachu","Mewtwo","Umbreon"].map(q=> (
              <button key={q} onClick={()=>{/* handled by parent */}} className="text-xs px-3 py-1.5 rounded-lg bg-surface-raised border border-border hover:border-primary/40 hover:text-primary transition-all">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trending */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <IconChartLine className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary font-display">Trending Now</h2>
          </div>
          <span className="text-xs text-text-tertiary font-mono">{trending.length} cards</span>
        </div>
        {!trendingLoaded ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_,i)=><SkeletonCard key={i}/>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {trending.map(card=> (
              <CardGridItem key={card.id} card={card} onClick={()=>onCardClick(card.id)} watchlist={watchlist} onToggleWatchlist={onToggleWatchlist} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Sets + How It Works */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <IconPackage className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary font-display">Recent Sets</h2>
          </div>
          <div className="bg-surface border border-border rounded-xl divide-y divide-border/50">
            {RECENT_SETS.map(set=> (
              <button key={set.name} onClick={()=>onSetClick(set.name)}
                className="w-full text-left px-4 py-3.5 hover:bg-surface-raised transition-colors flex justify-between items-center group first:rounded-t-xl last:rounded-b-xl">
                <div>
                  <div className="text-sm font-semibold group-hover:text-primary transition-colors">{set.name}</div>
                  <div className="text-xs text-text-secondary font-mono">{set.date}</div>
                </div>
                <IconChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-4">
            <IconSparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary font-display">How It Works</h2>
          </div>
          <div className="space-y-4">
            {[
              { icon: IconSearch, title: "Search any card", desc: "Type a Pokémon name to search across all sets and rarities.", color: "primary" },
              { icon: IconChartBar, title: "Analyze the market", desc: "See real-time prices, sparkline trends, and market depth gauges.", color: "secondary" },
              { icon: IconWallet, title: "Track your portfolio", desc: "Build your collection and watchlist. Monitor value over time.", color: "accent" },
            ].map((step,i)=> {
              const StepIcon = step.icon;
              const iconColor = step.color === "primary" ? "text-primary" : step.color === "secondary" ? "text-secondary" : "text-accent";
              const boxStyle = step.color === "primary" ? "bg-primary/10 border-primary/20" : step.color === "secondary" ? "bg-secondary/10 border-secondary/20" : "bg-accent/10 border-accent/20";
              return (
                <div key={i} className="flex gap-4 items-start">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${boxStyle}`}>
                    <StepIcon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-0.5">{step.title}</div>
                    <div className="text-xs text-text-secondary leading-relaxed">{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
            <div className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
              <IconLightning className="w-3.5 h-3.5" /> Coming Soon
            </div>
            <div className="text-xs text-emerald-300/70 leading-relaxed">
              Camera scanner — point your phone at any card to instantly see its value. 
              Price alerts and graded card integration are on the way.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardGridItem({ card, onClick, watchlist, onToggleWatchlist }: {
  card:Card; onClick:()=>void; watchlist:SavedCard[]; onToggleWatchlist:(c:Card)=>void;
}) {
  const price = getPrice(card);
  const { data: sparkData, hasRealData: sparkHasRealData } = generateSparkline(card);
  const trend = getTrendPercent(card);
  const isWatched = watchlist.some(w=>w.id===card.id);
  const holo = isHolographic(card);
  const rarityStyle = getRarityStyle(card.rarity);

  return (
    <div className="relative group">
      <Card3D className="h-full" holographic={holo}>
        <button onClick={onClick} className="w-full text-left flex flex-col h-full bg-surface border border-border rounded-xl p-4 hover:border-primary/30 transition-colors relative overflow-hidden">
          <div className="relative mb-3 flex-1 flex items-center justify-center min-h-[140px]">
            {card.images?.large ? (
              <img src={card.images.large} alt={card.name} className="w-full max-h-56 object-contain rounded-lg drop-shadow-2xl" loading="lazy" />
            ) : (
              <div className="w-full aspect-[2.5/3.5] bg-surface-raised rounded-lg flex items-center justify-center">
                <IconPokeball className="w-12 h-12 text-text-tertiary" />
              </div>
            )}
          </div>
          <div className="relative">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="text-sm font-semibold truncate leading-tight">{card.name}</div>
            </div>
            <div className="text-[11px] text-text-secondary font-mono mb-2">{card.set?.name} · #{card.number||"?"}</div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-lg font-bold text-primary font-mono tabular-nums">{price?`$${price.toFixed(2)}`:"—"}</div>
              <PriceChange value={trend} />
            </div>
            <Sparkline data={sparkData} hasRealData={sparkHasRealData} positive={(trend||0)>=0} className="h-6 mb-2" />
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${rarityStyle}`}>
                {card.rarity||"Common"}
              </span>
            </div>
          </div>
        </button>
      </Card3D>
      <button onClick={(e)=>{e.stopPropagation(); onToggleWatchlist(card);}}
        className="absolute top-3 right-3 z-30 w-8 h-8 rounded-lg bg-surface/80 backdrop-blur border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:border-primary/50 hover:text-primary">
        <IconStar className={`w-4 h-4 ${isWatched?"text-primary fill-primary":"text-text-secondary"}`} />
      </button>
    </div>
  );
}

function SearchView({ cards, loading, total, query, onCardClick, selectedIndex, watchlist, onToggleWatchlist, error, hasMore, onLoadMore }: {
  cards:Card[]; loading:boolean; total:number; query:string; onCardClick:(id:string)=>void;
  selectedIndex:number; watchlist:SavedCard[]; onToggleWatchlist:(c:Card)=>void;
  error?:string|null; hasMore?:boolean; onLoadMore?:()=>void;
}) {
  if (loading && cards.length===0) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight font-display">Searching "{query}"</h2>
            <div className="h-4 w-24 bg-white/[0.03] rounded mt-2 animate-shimmer" />
          </div>
          <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_,i)=><SkeletonCard key={i}/>)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={IconAlertTriangle}
        title="Search unavailable"
        subtitle={error}
      />
    );
  }

  if (cards.length===0) {
    return (
      <EmptyState
        icon={IconSearch}
        title="No cards found"
        subtitle={`We couldn't find any cards matching "${query}". Try a different search term or check your spelling.`}
      />
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-display">Results for "{query}"</h2>
          <p className="text-sm text-text-secondary font-mono">{cards.length} of {total} cards shown</p>
        </div>
        {loading && <div className="w-5 h-5 border-2 border-border border-t-primary rounded-full animate-spin" />}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card,i)=> (
          <div key={card.id} className={i===selectedIndex?"ring-2 ring-primary rounded-xl":undefined}>
            <CardGridItem card={card} onClick={()=>onCardClick(card.id)} watchlist={watchlist} onToggleWatchlist={onToggleWatchlist} />
          </div>
        ))}
      </div>
      {hasMore && onLoadMore && (
        <div className="mt-8 text-center">
          <button onClick={onLoadMore} disabled={loading}
            className="px-6 py-2.5 rounded-lg border border-border bg-surface-raised text-text-secondary hover:text-text text-sm font-semibold transition-all hover:border-text-secondary/50 disabled:opacity-50">
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

function DetailStorySection({ cardId, story, onSave, onRemove }: {
  cardId: string;
  story: CardStory | null;
  onSave: (cardId: string, title: string, body: string, date: string) => void;
  onRemove: (cardId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(story?.title || "");
  const [body, setBody] = useState(story?.body || "");
  const [date, setDate] = useState(story?.date || "");

  const handleSave = () => {
    if (!title.trim() && !body.trim()) return;
    onSave(cardId, title.trim(), body.trim(), date);
    setEditing(false);
  };

  if (!editing && !story) {
    return (
      <button onClick={() => setEditing(true)}
        className="mt-4 flex items-center gap-2 text-xs text-text-secondary hover:text-primary transition-colors group">
        <div className="w-7 h-7 rounded-lg bg-surface-raised border border-border flex items-center justify-center group-hover:border-primary/40 transition-colors">
          <IconPen className="w-3.5 h-3.5" />
        </div>
        <span className="font-medium">Add a story to this card</span>
      </button>
    );
  }

  if (!editing && story) {
    return (
      <div className="mt-4 glass rounded-xl p-4 border border-border">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <IconBook className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold text-primary">{story.title}</h4>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { setTitle(story.title); setBody(story.body); setDate(story.date); setEditing(true); }}
              className="w-6 h-6 rounded-md bg-surface-raised border border-border flex items-center justify-center text-text-tertiary hover:text-primary hover:border-primary/40 transition-all">
              <IconPen className="w-3 h-3" />
            </button>
            <button onClick={() => onRemove(cardId)}
              className="w-6 h-6 rounded-md bg-surface-raised border border-border flex items-center justify-center text-text-tertiary hover:text-rose-400 hover:border-rose-500/40 transition-all">
              <IconX className="w-3 h-3" />
            </button>
          </div>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap mb-2">{story.body}</p>
        <div className="flex items-center gap-3 text-[10px] text-text-tertiary font-mono">
          {story.date && <span>{new Date(story.date).toLocaleDateString()}</span>}
          <span>Edited {new Date(story.updatedAt).toLocaleDateString()}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 glass rounded-xl p-4 border border-border space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <IconPen className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-bold text-primary">{story ? "Edit Story" : "New Story"}</h4>
      </div>
      <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Story title..."
        className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono" />
      <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Why does this card matter to you?"
        rows={4}
        className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono resize-none" />
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        className="py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono" />
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="px-4 py-2 rounded-lg bg-primary text-bg text-sm font-bold hover:bg-primary/90 transition-colors">
          Save Story
        </button>
        <button onClick={() => { setEditing(false); setTitle(story?.title||""); setBody(story?.body||""); setDate(story?.date||""); }}
          className="px-4 py-2 rounded-lg border border-border bg-surface-raised text-text-secondary text-sm font-semibold hover:text-text transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function DetailView({ card, activeVariant, setActiveVariant, onBack, watchlist, onToggleWatchlist, collection, onAddToCollection, currency, stories, onAddStory, onRemoveStory }: {
  card:Card; activeVariant:string; setActiveVariant:(v:string)=>void; onBack:()=>void;
  watchlist:SavedCard[]; onToggleWatchlist:(c:Card)=>void;
  collection:CollectionItem[]; onAddToCollection:(c:Card)=>void;
  currency: Currency;
  stories: CardStory[];
  onAddStory: (cardId: string, title: string, body: string, date: string) => void;
  onRemoveStory: (cardId: string) => void;
}) {
  const prices = card.tcgplayer?.prices?.[activeVariant];
  const cm = card.cardmarket?.prices;
  const market = prices?.market; const low = prices?.low; const high = prices?.high;
  const variants = getVariants(card);
  const updated = card.tcgplayer?.updatedAt;
  const cmAvg30 = cm?.avg30; const cmAvg7 = cm?.avg7;
  const trend = cmAvg30 && cmAvg7 ? ((cmAvg7-cmAvg30)/cmAvg30)*100 : null;
  const isWatched = watchlist.some(w=>w.id===card.id);
  const inCollection = collection.find(c=>c.id===card.id);
  const { data: sparkData, hasRealData: sparkHasRealData } = generateSparkline(card);
  const holo = isHolographic(card);
  const ebaySold = card._pokeprice?.ebaySoldAvg ?? null;
  const realizable = card._pokeprice?.unified?.realizable ?? getRealizablePrice(market || null);

  // Currency-converted display values
  const dMarket = currency === 'CAD' ? convertToCad(market ?? null) : (market ?? null);
  const dEbay = currency === 'CAD' ? convertToCad(ebaySold ?? null) : (ebaySold ?? null);
  const dReal = currency === 'CAD' ? convertToCad(realizable ?? null) : (realizable ?? null);
  const sym = currency === 'CAD' ? 'C$' : '$';

  return (
    <div className="animate-fade-in-up max-w-5xl">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-text-secondary hover:text-primary transition-colors mb-6 group">
        <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center group-hover:border-primary/40 transition-colors">
          <IconChevronLeft className="w-4 h-4" />
        </div>
        <span className="font-medium">Back</span>
      </button>

      {/* Hero */}
      <div className="flex flex-col md:flex-row gap-8 mb-8 items-start">
        <div className="shrink-0 mx-auto md:mx-0">
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-secondary/10 to-accent/20 rounded-3xl blur-2xl opacity-40" />
            <Card3D className="relative" holographic={holo}>
              {card.images?.large ? (
                <img src={card.images.large} alt={card.name} className="w-[280px] md:w-[320px] rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10" />
              ) : (
                <div className="w-[280px] md:w-[320px] aspect-[2.5/3.5] bg-surface-raised rounded-2xl flex items-center justify-center ring-1 ring-white/10">
                  <IconPokeball className="w-20 h-20 text-text-tertiary" />
                </div>
              )}
            </Card3D>
          </div>
        </div>

        <div className="flex-1 w-full">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${getRarityStyle(card.rarity)}`}>
              {card.rarity||"Unknown"}
            </span>
            {card.set?.series && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                {card.set.series}
              </span>
            )}
            {updated && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                Updated {updated}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-1 font-display">{card.name}</h1>
          <p className="text-sm text-text-secondary font-mono mb-6">{card.set?.name||"Unknown Set"} · #{card.number||"?"}</p>

          {/* Three-vector pricing: Market / eBay Sold / Realizable */}
          <div className="flex items-end gap-5 mb-6 flex-wrap">
            <div>
              <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Market Price</div>
              <div className="text-4xl md:text-5xl font-bold text-primary font-mono tabular-nums tracking-tight">
                {dMarket?`${sym}${dMarket.toFixed(2)}`:"—"}
              </div>
            </div>
            {dEbay !== null && (
              <div className="pb-1">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">eBay Sold Avg</div>
                <div className="text-xl font-bold text-amber-400 font-mono tabular-nums">
                  {sym}{dEbay.toFixed(2)}
                </div>
                <div className="text-[10px] text-text-tertiary">estimated from sold listings</div>
              </div>
            )}
            {dReal !== null && (
              <div className="pb-1">
                <div className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-1">You'll Get ≈</div>
                <div className="text-xl font-bold text-text-secondary font-mono tabular-nums">
                  {sym}{dReal.toFixed(2)}
                </div>
                <div className="text-[10px] text-text-tertiary">after typical 13% resale fees</div>
              </div>
            )}
            <div className="pb-2">
              <PriceChange value={trend} className="text-sm" />
            </div>
          </div>

          <Sparkline data={sparkData} hasRealData={sparkHasRealData} positive={(trend||0)>=0} className="h-10 mb-6" />

          {/* Variant tabs */}
          {variants.length>1 && (
            <div className="flex gap-2 flex-wrap mb-6">
              {variants.map(([n])=> (
                <button key={n} onClick={()=>setActiveVariant(n)}
                  className={`text-xs font-semibold px-3.5 py-1.5 rounded-lg border transition-all ${activeVariant===n?"bg-primary text-bg border-primary shadow-lg shadow-primary/20":"bg-surface border-border text-text-secondary hover:text-text hover:border-text-secondary/50"}`}>
                  {formatVariant(n)}
                </button>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={()=>onToggleWatchlist(card)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all ${isWatched?"bg-primary/10 border-primary/30 text-primary":"bg-surface-raised border-border text-text-secondary hover:text-text hover:border-text-secondary/50"}`}>
              <IconStar className={`w-4 h-4 ${isWatched?"fill-primary":undefined}`} />
              {isWatched?"Watching":"Watchlist"}
            </button>
            <button onClick={()=>onAddToCollection(card)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-surface-raised text-text-secondary hover:text-text text-sm font-semibold transition-all hover:border-text-secondary/50">
              <IconPlus className="w-4 h-4" />
              {inCollection ? `In Collection (${inCollection.quantity})` : "Add to Collection"}
            </button>
          </div>

          {/* Card Story Mode */}
          <DetailStorySection cardId={card.id} story={stories.find(s=>s.id===card.id)||null} onSave={onAddStory} onRemove={onRemoveStory} />
        </div>
      </div>

      <PriceDashboard card={card} activeVariant={activeVariant} currency={currency} />

      {updated && <p className="text-right text-[11px] text-text-tertiary font-mono mt-4">Prices updated: {updated}</p>}
    </div>
  );
}

function WatchlistView({ watchlist, onCardClick, onRemove }: {
  watchlist:SavedCard[]; onCardClick:(id:string)=>void; onRemove:(id:string)=>void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return filterCollectionByQuery(watchlist, searchQuery);
  }, [watchlist, searchQuery]);

  if (watchlist.length===0) {
    return (
      <EmptyState
        icon={IconStar}
        title="Your watchlist is empty"
        subtitle="Star cards while browsing to track their prices and get alerts when they move."
      />
    );
  }

  const totalValue = filtered.reduce((sum,c)=>sum+(c.price||0),0);

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-display">Watchlist</h2>
          <p className="text-sm text-text-secondary font-mono">{filtered.length} of {watchlist.length} cards · ${totalValue.toFixed(2)} total</p>
        </div>
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search watchlist..."
            className="py-2 pl-8 pr-3 bg-bg border border-border rounded-lg text-xs outline-none focus:border-primary font-mono w-48" />
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={IconSearch} title="No matches" subtitle={`No cards match "${searchQuery}".`} />
      ) : (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(card=> (
          <div key={card.id} className="relative group">
            <button onClick={()=>onCardClick(card.id)} className="w-full text-left flex flex-col h-full bg-surface border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="relative mb-3 flex-1 flex items-center justify-center min-h-[140px]">
                {card.imageSmall ? (
                  <img src={card.imageSmall} alt={card.name} className="w-full max-h-48 object-contain rounded-lg" loading="lazy" />
                ) : (
                  <div className="w-full aspect-[2.5/3.5] bg-surface-raised rounded-lg flex items-center justify-center">
                    <IconPokeball className="w-12 h-12 text-text-tertiary" />
                  </div>
                )}
              </div>
              <div className="text-sm font-semibold truncate mb-0.5">{card.name}</div>
              <div className="text-[11px] text-text-secondary font-mono mb-2">{card.setName}</div>
              <div className="text-lg font-bold text-primary font-mono tabular-nums">{card.price?`$${card.price.toFixed(2)}`:"—"}</div>
            </button>
            <button onClick={()=>onRemove(card.id)}
              className="absolute top-3 right-3 z-30 w-8 h-8 rounded-lg bg-surface/80 backdrop-blur border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:border-rose-500/50 hover:text-rose-400">
              <IconX className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

function CollectionView({ collection, onCardClick, onRemove, onUpdateItem, stories }: {
  collection:CollectionItem[]; onCardClick:(id:string)=>void; onRemove:(id:string)=>void;
  onUpdateItem:(id:string, updates:Partial<CollectionItem>)=>void;
  stories: CardStory[];
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    return filterCollectionByQuery(collection, searchQuery);
  }, [collection, searchQuery]);

  if (collection.length===0) {
    return (
      <EmptyState
        icon={IconPackage}
        title="Your collection is empty"
        subtitle="Add cards to your collection to track total value, set completion, and portfolio growth."
      />
    );
  }

  /* Calculate portfolio metrics with condition adjustments and cost basis
     Research: "I bought 50 PSA 10s at $40 each, now they're $200. What's my return?" */
  const totalRawValue = filtered.reduce((sum,c)=>sum+(c.price||0)*c.quantity,0);
  const totalAdjValue = filtered.reduce((sum,c)=>{
    const adj = getConditionAdjustedPrice(c.price, c.condition);
    return sum + (adj || 0) * c.quantity;
  },0);
  const totalInvested = filtered.reduce((sum,c)=>sum+(c.costBasis||0)*c.quantity,0);
  const totalCards = filtered.reduce((sum,c)=>sum+c.quantity,0);
  const roi = totalInvested > 0 ? ((totalAdjValue - totalInvested) / totalInvested) * 100 : null;

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search collection..."
            className="py-2 pl-8 pr-3 bg-bg border border-border rounded-lg text-xs outline-none focus:border-primary font-mono w-48" />
        </div>
        <button onClick={()=>downloadCsv(`pokeprice-collection-${new Date().toISOString().slice(0,10)}.csv`, exportCollectionToCsv(collection))}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-surface-raised text-text-secondary hover:text-text text-xs font-semibold transition-all hover:border-text-secondary/50">
          <IconExternalLink className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
      <div className="glass rounded-2xl p-6 mb-6 flex flex-wrap gap-6">
        <div>
          <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Adjusted Value</div>
          <div className="text-3xl font-bold text-primary font-mono tabular-nums">${totalAdjValue.toFixed(2)}</div>
          <div className="text-[10px] text-text-tertiary mt-0.5">condition-adjusted</div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Invested</div>
          <div className="text-3xl font-bold text-text font-mono tabular-nums">${totalInvested.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">True ROI</div>
          <div className={`text-3xl font-bold font-mono tabular-nums ${roi===null?'text-text':roi>=0?'text-emerald-400':'text-rose-400'}`}>
            {roi!==null?`${roi>=0?'+':''}${roi.toFixed(1)}%`:"—"}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Cards Owned</div>
          <div className="text-3xl font-bold text-text font-mono tabular-nums">{totalCards}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Unique Cards</div>
          <div className="text-3xl font-bold text-text font-mono tabular-nums">{filtered.length}</div>
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={IconSearch} title="No matches" subtitle={`No cards match "${searchQuery}".`} />
      ) : (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(card=> {
          const adjPrice = getConditionAdjustedPrice(card.price, card.condition);
          const hasBasis = (card.costBasis ?? 0) > 0;
          const cardRoi = hasBasis && adjPrice ? ((adjPrice - card.costBasis!) / card.costBasis!) * 100 : null;
          const hasStory = stories.some(s=>s.id===card.id);
          return (
          <div key={card.id} className="relative group">
            <button onClick={()=>onCardClick(card.id)} className="w-full text-left flex flex-col h-full bg-surface border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="relative mb-3 flex-1 flex items-center justify-center min-h-[140px]">
                {hasStory && (
                  <div className="absolute top-1 left-1 z-20 w-6 h-6 rounded-md bg-primary/90 border border-primary/50 flex items-center justify-center text-bg shadow-sm">
                    <IconBook className="w-3 h-3" />
                  </div>
                )}
                {card.imageSmall ? (
                  <img src={card.imageSmall} alt={card.name} className="w-full max-h-48 object-contain rounded-lg" loading="lazy" />
                ) : (
                  <div className="w-full aspect-[2.5/3.5] bg-surface-raised rounded-lg flex items-center justify-center">
                    <IconPokeball className="w-12 h-12 text-text-tertiary" />
                  </div>
                )}
              </div>
              <div className="text-sm font-semibold truncate mb-0.5">{card.name}</div>
              <div className="text-[11px] text-text-secondary font-mono mb-2">{card.setName}</div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                  card.condition==='NM'?'text-emerald-400 border-emerald-500/20 bg-emerald-500/10':
                  card.condition==='LP'?'text-yellow-400 border-yellow-500/20 bg-yellow-500/10':
                  card.condition==='MP'?'text-orange-400 border-orange-500/20 bg-orange-500/10':
                  card.condition==='HP'?'text-rose-400 border-rose-500/20 bg-rose-500/10':
                  'text-slate-400 border-slate-500/20 bg-slate-500/10'
                }`}>
                  {card.condition || "NM"}
                </span>
                {card.condition && card.condition !== "NM" && (
                  <span className="text-[9px] text-text-tertiary">{(CONDITION_MULTIPLIERS[card.condition]*100).toFixed(0)}%</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold text-primary font-mono tabular-nums">{adjPrice?`$${adjPrice.toFixed(2)}`:"—"}</div>
                  {hasBasis && (
                    <div className={`text-[10px] font-mono ${cardRoi!==null?(cardRoi>=0?'text-emerald-400':'text-rose-400'):'text-text-tertiary'}`}>
                      {cardRoi!==null?`${cardRoi>=0?'+':''}${cardRoi.toFixed(0)}%`:"no basis"}
                    </div>
                  )}
                </div>
                <span className="text-xs font-mono text-text-secondary">×{card.quantity}</span>
              </div>
            </button>
            <div className="absolute bottom-3 left-3 right-10 z-20 opacity-0 group-hover:opacity-100 transition-all flex gap-1">
              <select
                value={card.condition || "NM"}
                onChange={(e)=>{e.stopPropagation(); onUpdateItem(card.id,{condition:e.target.value as CollectionItem['condition']});}}
                className="text-[9px] px-1 py-0.5 rounded bg-surface/90 border border-border font-mono cursor-pointer hover:border-primary/50"
                onClick={(e)=>e.stopPropagation()}
              >
                <option value="NM">NM</option>
                <option value="LP">LP</option>
                <option value="MP">MP</option>
                <option value="HP">HP</option>
                <option value="Damaged">DMG</option>
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="cost"
                value={card.costBasis ?? ""}
                onChange={(e)=>{e.stopPropagation(); onUpdateItem(card.id,{costBasis:parseFloat(e.target.value)||0});}}
                className="text-[9px] px-1 py-0.5 rounded bg-surface/90 border border-border font-mono w-14 cursor-text hover:border-primary/50"
                onClick={(e)=>e.stopPropagation()}
              />
            </div>
            <button onClick={()=>onRemove(card.id)}
              className="absolute top-3 right-3 z-30 w-8 h-8 rounded-lg bg-surface/80 backdrop-blur border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:border-rose-500/50 hover:text-rose-400">
              <IconX className="w-4 h-4" />
            </button>
          </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function SealedVaultView({ items, onAdd, onRemove, onUpdate }: {
  items: SealedItem[];
  onAdd: (item: Omit<SealedItem, "id">) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<SealedItem>) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState<Partial<SealedItem>>({ format: "Booster Box", qty: 1, costBasis: 0 });
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const fuse = new Fuse(items, {
      keys: ['name', 'set', 'format', 'storageLocation', 'notes'],
      threshold: 0.35,
      ignoreLocation: true,
    });
    return fuse.search(searchQuery.trim()).map(r => r.item);
  }, [items, searchQuery]);

  const totalCost = filtered.reduce((s, i) => s + i.costBasis * i.qty, 0);
  const totalEst = filtered.reduce((s, i) => s + (i.estValue || 0) * i.qty, 0);
  const totalQty = filtered.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="animate-fade-in-up">
      {/* Header + Add Button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-display">Sealed Vault</h2>
          <p className="text-sm text-text-secondary font-mono">{filtered.length} of {items.length} products · {totalQty} units</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search vault..."
              className="py-2 pl-8 pr-3 bg-bg border border-border rounded-lg text-xs outline-none focus:border-primary font-mono w-40" />
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface-raised text-text-secondary hover:text-text text-sm font-semibold transition-all hover:border-text-secondary/50">
            <IconPlus className="w-4 h-4" />
            {showAdd ? "Cancel" : "Add Product"}
          </button>
        </div>
      </div>

      {/* Portfolio Summary */}
      {items.length > 0 && (
        <div className="glass rounded-2xl p-6 mb-6 flex flex-wrap gap-6">
          <div>
            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Total Cost</div>
            <div className="text-3xl font-bold text-text font-mono tabular-nums">${totalCost.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Est. Value</div>
            <div className="text-3xl font-bold text-primary font-mono tabular-nums">${totalEst.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Unrealized</div>
            <div className={`text-3xl font-bold font-mono tabular-nums ${totalEst - totalCost >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalEst - totalCost >= 0 ? '+' : ''}${(totalEst - totalCost).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Products</div>
            <div className="text-3xl font-bold text-text font-mono tabular-nums">{items.length}</div>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="glass rounded-2xl p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Product Name</label>
              <input type="text" placeholder="e.g. Evolutions Booster Box"
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.name || ""} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Set</label>
              <input type="text" placeholder="e.g. XY Evolutions"
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.set || ""} onChange={e => setNewItem(p => ({ ...p, set: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Format</label>
              <select
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.format || "Booster Box"}
                onChange={e => setNewItem(p => ({ ...p, format: e.target.value as SealedItem["format"] }))}>
                {["Booster Box","ETB","Blister","Tin","Collection Box","Other"].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Qty</label>
              <input type="number" min={1}
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.qty || 1} onChange={e => setNewItem(p => ({ ...p, qty: parseInt(e.target.value) || 1 }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Cost Basis ($)</label>
              <input type="number" min={0} step={0.01}
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.costBasis || 0} onChange={e => setNewItem(p => ({ ...p, costBasis: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Est. Value ($)</label>
              <input type="number" min={0} step={0.01}
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.estValue || ""} onChange={e => setNewItem(p => ({ ...p, estValue: parseFloat(e.target.value) || null }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Storage Location</label>
              <input type="text" placeholder="e.g. Closet shelf A"
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.storageLocation || ""} onChange={e => setNewItem(p => ({ ...p, storageLocation: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Purchase Date</label>
              <input type="date"
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.purchaseDate || ""} onChange={e => setNewItem(p => ({ ...p, purchaseDate: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Notes</label>
              <input type="text" placeholder="e.g. Pre-order from GameStop, minor box damage"
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.notes || ""} onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <button onClick={() => {
            if (!newItem.name || !newItem.set) return;
            onAdd({
              name: newItem.name,
              set: newItem.set,
              format: newItem.format || "Booster Box",
              qty: newItem.qty || 1,
              costBasis: newItem.costBasis || 0,
              estValue: newItem.estValue ?? null,
              storageLocation: newItem.storageLocation,
              purchaseDate: newItem.purchaseDate,
              notes: newItem.notes,
            });
            setNewItem({ format: "Booster Box", qty: 1, costBasis: 0 });
            setShowAdd(false);
          }}
            className="px-4 py-2 rounded-lg bg-primary text-bg text-sm font-bold hover:bg-primary/90 transition-colors">
            Save Product
          </button>
        </div>
      )}

      {/* Items Grid */}
      {items.length === 0 ? (
        <EmptyState
          icon={IconPackage}
          title="Your vault is empty"
          subtitle="Track sealed products — booster boxes, ETBs, tins — with cost basis, estimated value, and storage location."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={IconSearch} title="No matches" subtitle={`No products match "${searchQuery}".`} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="glass rounded-2xl p-5 relative group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-bold">{item.name}</div>
                  <div className="text-[11px] text-text-secondary font-mono">{item.set}</div>
                </div>
                <button onClick={() => onRemove(item.id)}
                  className="w-7 h-7 rounded-lg bg-surface/80 backdrop-blur border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:border-rose-500/50 hover:text-rose-400">
                  <IconX className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Format</span>
                  <span className="font-mono">{item.format}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Quantity</span>
                  <span className="font-mono">{item.qty}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Cost Basis</span>
                  <span className="font-mono">${item.costBasis.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Total Cost</span>
                  <span className="font-mono">${(item.costBasis * item.qty).toFixed(2)}</span>
                </div>
                {item.estValue !== null && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Est. Value</span>
                      <span className="font-mono text-primary">${item.estValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Unrealized</span>
                      <span className={`font-mono ${item.estValue - item.costBasis >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.estValue - item.costBasis >= 0 ? '+' : ''}${((item.estValue - item.costBasis) * item.qty).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                {item.storageLocation && (
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Storage</span>
                    <span className="font-mono text-text-tertiary">{item.storageLocation}</span>
                  </div>
                )}
                {item.purchaseDate && (
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Purchased</span>
                    <span className="font-mono text-text-tertiary">{item.purchaseDate}</span>
                  </div>
                )}
              </div>

              {/* Inline edits */}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <input type="number" min={0} step={0.01} placeholder="Update est. value"
                  className="flex-1 text-[10px] px-2 py-1 rounded bg-surface/90 border border-border font-mono"
                  onChange={e => onUpdate(item.id, { estValue: parseFloat(e.target.value) || null })}
                />
                <input type="text" placeholder="Storage"
                  className="w-24 text-[10px] px-2 py-1 rounded bg-surface/90 border border-border font-mono"
                  onChange={e => onUpdate(item.id, { storageLocation: e.target.value })}
                />
              </div>

              {item.notes && (
                <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-text-tertiary italic">
                  {item.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StoriesView({ stories, collection, onCardClick, onRemove }: {
  stories: CardStory[];
  collection: CollectionItem[];
  onCardClick: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const enriched = useMemo(() => {
    return stories.map(story => {
      const item = collection.find(c => c.id === story.id);
      return { story, item };
    }).filter(({ story }) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return story.title.toLowerCase().includes(q) || story.body.toLowerCase().includes(q) || story.id.toLowerCase().includes(q);
    });
  }, [stories, collection, searchQuery]);

  if (stories.length === 0) {
    return (
      <EmptyState
        icon={IconBook}
        title="No stories yet"
        subtitle="Every card has a story. Add one from any card's detail page to preserve the memory behind your collection."
      />
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-display">Card Stories</h2>
          <p className="text-sm text-text-secondary font-mono">{enriched.length} of {stories.length} stories</p>
        </div>
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search stories..."
            className="py-2 pl-8 pr-3 bg-bg border border-border rounded-lg text-xs outline-none focus:border-primary font-mono w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {enriched.map(({ story, item }) => (
          <div key={story.id} className="glass rounded-2xl p-5 relative group">
            <div className="flex items-start gap-4 mb-3">
              {item?.imageSmall ? (
                <button onClick={() => onCardClick(story.id)} className="shrink-0 w-16 h-24 rounded-lg overflow-hidden bg-surface-raised border border-border hover:border-primary/40 transition-colors">
                  <img src={item.imageSmall} alt={item.name} className="w-full h-full object-contain" />
                </button>
              ) : (
                <div className="shrink-0 w-16 h-24 rounded-lg bg-surface-raised border border-border flex items-center justify-center">
                  <IconPokeball className="w-6 h-6 text-text-tertiary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold truncate">{item?.name || story.id}</div>
                    <div className="text-[11px] text-text-secondary font-mono">{item?.setName}</div>
                  </div>
                  <button onClick={() => onRemove(story.id)}
                    className="w-7 h-7 rounded-lg bg-surface/80 backdrop-blur border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:border-rose-500/50 hover:text-rose-400">
                    <IconX className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[10px] text-text-tertiary font-mono mt-0.5">
                  {story.date ? new Date(story.date).toLocaleDateString() : 'No date'}
                </div>
              </div>
            </div>
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-primary mb-1">{story.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">{story.body}</p>
            </div>
            <div className="text-[10px] text-text-tertiary font-mono">
              Last edited {new Date(story.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GradingTrackerView({ submissions, collection, onAdd, onRemove, onUpdate, onCardClick }: {
  submissions: GradingSubmission[];
  collection: CollectionItem[];
  onAdd: (item: Omit<GradingSubmission, "id">) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<GradingSubmission>) => void;
  onCardClick: (id: string) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newItem, setNewItem] = useState<Partial<GradingSubmission>>({
    service: "PSA",
    serviceLevel: "Value",
    status: "pending",
    stages: [],
    gradingCost: 0,
    shippingCost: 0,
    otherCosts: 0,
    declaredValue: 0,
  });

  const SERVICES = ["PSA", "BGS", "CGC", "SGC", "TAG", "ARS", "ACE", "Graad", "Other"] as const;
  const STATUSES = ["pending", "in_transit", "received", "grading", "completed", "lost", "cancelled"] as const;
  const STAGE_NAMES = ["Order Created", "Shipped to Grader", "Arrived", "Order Prep", "Research & ID", "Grading", "Assembly", "QA", "Graded", "Shipped Back", "Received Back"] as const;

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return submissions;
    const q = searchQuery.toLowerCase();
    return submissions.filter(s =>
      s.cardName.toLowerCase().includes(q) ||
      s.service.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q) ||
      s.grade?.toLowerCase().includes(q)
    );
  }, [submissions, searchQuery]);

  const totalInvested = submissions.reduce((sum, s) => sum + s.gradingCost + s.shippingCost + s.otherCosts, 0);
  const completed = submissions.filter(s => s.status === "completed");
  const avgTurnaround = completed.length > 0
    ? completed.reduce((sum, s) => {
        if (s.submissionDate && s.actualCompletion) {
          return sum + (new Date(s.actualCompletion).getTime() - new Date(s.submissionDate).getTime()) / (1000 * 60 * 60 * 24);
        }
        return sum;
      }, 0) / completed.length
    : null;

  if (submissions.length === 0 && !showAdd) {
    return (
      <EmptyState
        icon={IconClipboard}
        title="No grading submissions"
        subtitle="Track PSA, BGS, CGC, and other grading submissions. Know exactly where your cards are and what they truly cost."
        action={
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg bg-primary text-bg text-sm font-bold hover:bg-primary/90 transition-colors">
            Add Submission
          </button>
        }
      />
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-display">Grading Tracker</h2>
          <p className="text-sm text-text-secondary font-mono">{filtered.length} of {submissions.length} submissions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search submissions..."
              className="py-2 pl-8 pr-3 bg-bg border border-border rounded-lg text-xs outline-none focus:border-primary font-mono w-40" />
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface-raised text-text-secondary hover:text-text text-sm font-semibold transition-all hover:border-text-secondary/50">
            <IconPlus className="w-4 h-4" />
            {showAdd ? "Cancel" : "Add"}
          </button>
        </div>
      </div>

      {/* Portfolio Summary */}
      {submissions.length > 0 && (
        <div className="glass rounded-2xl p-6 mb-6 flex flex-wrap gap-6">
          <div>
            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Total Invested</div>
            <div className="text-3xl font-bold text-text font-mono tabular-nums">${totalInvested.toFixed(2)}</div>
            <div className="text-[10px] text-text-tertiary mt-0.5">grading + shipping + fees</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Active</div>
            <div className="text-3xl font-bold text-primary font-mono tabular-nums">{submissions.filter(s=>s.status!=='completed'&&s.status!=='cancelled').length}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Completed</div>
            <div className="text-3xl font-bold text-emerald-400 font-mono tabular-nums">{completed.length}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-1">Avg Turnaround</div>
            <div className="text-3xl font-bold text-text font-mono tabular-nums">{avgTurnaround!==null?`${Math.round(avgTurnaround)}d`:"—"}</div>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="glass rounded-2xl p-5 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Card Name</label>
              <input type="text" placeholder="e.g. Charizard Base Set 4/102"
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.cardName || ""} onChange={e => setNewItem(p => ({ ...p, cardName: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Service</label>
              <select
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.service || "PSA"}
                onChange={e => setNewItem(p => ({ ...p, service: e.target.value as GradingSubmission["service"] }))}>
                {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Service Level</label>
              <input type="text" placeholder="e.g. Value, Express"
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.serviceLevel || ""} onChange={e => setNewItem(p => ({ ...p, serviceLevel: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Declared Value ($)</label>
              <input type="number" min={0} step={0.01}
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.declaredValue || 0} onChange={e => setNewItem(p => ({ ...p, declaredValue: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Grading Cost ($)</label>
              <input type="number" min={0} step={0.01}
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.gradingCost || 0} onChange={e => setNewItem(p => ({ ...p, gradingCost: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Shipping Cost ($)</label>
              <input type="number" min={0} step={0.01}
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.shippingCost || 0} onChange={e => setNewItem(p => ({ ...p, shippingCost: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Other Costs ($)</label>
              <input type="number" min={0} step={0.01}
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.otherCosts || 0} onChange={e => setNewItem(p => ({ ...p, otherCosts: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Submission Date</label>
              <input type="date"
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.submissionDate || ""} onChange={e => setNewItem(p => ({ ...p, submissionDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Tracking #</label>
              <input type="text" placeholder="optional"
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.trackingNumber || ""} onChange={e => setNewItem(p => ({ ...p, trackingNumber: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 block">Notes</label>
              <input type="text" placeholder="e.g. Middleman via GameStop, bulk submission"
                className="w-full py-2 px-3 bg-bg border border-border rounded-lg text-sm outline-none focus:border-primary font-mono"
                value={newItem.notes || ""} onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <button onClick={() => {
            if (!newItem.cardName) return;
            onAdd({
              cardName: newItem.cardName,
              service: newItem.service || "PSA",
              serviceLevel: newItem.serviceLevel || "Value",
              declaredValue: newItem.declaredValue || 0,
              gradingCost: newItem.gradingCost || 0,
              shippingCost: newItem.shippingCost || 0,
              otherCosts: newItem.otherCosts || 0,
              submissionDate: newItem.submissionDate || new Date().toISOString().slice(0, 10),
              trackingNumber: newItem.trackingNumber,
              status: "pending",
              currentStage: "Order Created",
              stages: [{ name: "Order Created", date: new Date().toISOString().slice(0, 10) }],
              notes: newItem.notes,
            });
            setNewItem({ service: "PSA", serviceLevel: "Value", status: "pending", stages: [], gradingCost: 0, shippingCost: 0, otherCosts: 0, declaredValue: 0 });
            setShowAdd(false);
          }}
            className="px-4 py-2 rounded-lg bg-primary text-bg text-sm font-bold hover:bg-primary/90 transition-colors">
            Save Submission
          </button>
        </div>
      )}

      {/* Submissions Grid */}
      {submissions.length === 0 ? null : filtered.length === 0 ? (
        <EmptyState icon={IconSearch} title="No matches" subtitle={`No submissions match "${searchQuery}".`} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map(sub => {
            const totalCost = sub.gradingCost + sub.shippingCost + sub.otherCosts;
            const daysIn = sub.submissionDate ? Math.floor((Date.now() - new Date(sub.submissionDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
            const linkedCard = sub.cardId ? collection.find(c => c.id === sub.cardId) : null;
            const statusColors: Record<string, string> = {
              pending: "text-yellow-400 border-yellow-500/20 bg-yellow-500/10",
              in_transit: "text-amber-400 border-amber-500/20 bg-amber-500/10",
              received: "text-blue-400 border-blue-500/20 bg-blue-500/10",
              grading: "text-purple-400 border-purple-500/20 bg-purple-500/10",
              completed: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
              lost: "text-rose-400 border-rose-500/20 bg-rose-500/10",
              cancelled: "text-slate-400 border-slate-500/20 bg-slate-500/10",
            };
            return (
              <div key={sub.id} className="glass rounded-2xl p-5 relative group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    {linkedCard?.imageSmall ? (
                      <button onClick={() => sub.cardId && onCardClick(sub.cardId)}
                        className="shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-surface-raised border border-border hover:border-primary/40 transition-colors">
                        <img src={linkedCard.imageSmall} alt={sub.cardName} className="w-full h-full object-contain" />
                      </button>
                    ) : (
                      <div className="shrink-0 w-12 h-16 rounded-lg bg-surface-raised border border-border flex items-center justify-center">
                        <IconClipboard className="w-5 h-5 text-text-tertiary" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-bold">{sub.cardName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${statusColors[sub.status] || statusColors.pending}`}>
                          {sub.status.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-text-secondary font-mono">{sub.service} · {sub.serviceLevel}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => onRemove(sub.id)}
                    className="w-7 h-7 rounded-lg bg-surface/80 backdrop-blur border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:border-rose-500/50 hover:text-rose-400">
                    <IconX className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Total Cost</div>
                    <div className="text-sm font-bold font-mono">${totalCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Declared Value</div>
                    <div className="text-sm font-bold font-mono">${sub.declaredValue.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Days In</div>
                    <div className="text-sm font-bold font-mono">{daysIn}d</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-tertiary uppercase tracking-wider">Current Stage</div>
                    <div className="text-sm font-bold font-mono text-primary">{sub.currentStage}</div>
                  </div>
                </div>

                {/* Stage Timeline */}
                {sub.stages.length > 0 && (
                  <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
                    {sub.stages.map((stage, i) => (
                      <div key={i} className="flex items-center gap-1 shrink-0">
                        <div className="px-2 py-1 rounded-md bg-surface-raised border border-border text-[10px] font-mono text-text-secondary">
                          {stage.name}
                        </div>
                        {i < sub.stages.length - 1 && (
                          <IconChevronRight className="w-3 h-3 text-text-tertiary shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Grade Result */}
                {sub.grade && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Grade</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">{sub.grade}</span>
                    {sub.certNumber && <span className="text-[10px] text-text-tertiary font-mono">#{sub.certNumber}</span>}
                  </div>
                )}

                {/* Inline updates */}
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all flex-wrap">
                  <select
                    value={sub.status}
                    onChange={e => onUpdate(sub.id, { status: e.target.value as GradingSubmission['status'] })}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-surface/90 border border-border font-mono cursor-pointer hover:border-primary/50"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  <select
                    value={sub.currentStage}
                    onChange={e => {
                      const stageName = e.target.value;
                      const newStages = [...sub.stages, { name: stageName, date: new Date().toISOString().slice(0, 10) }];
                      onUpdate(sub.id, { currentStage: stageName, stages: newStages });
                    }}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-surface/90 border border-border font-mono cursor-pointer hover:border-primary/50"
                  >
                    {STAGE_NAMES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input type="text" placeholder="Grade (e.g. PSA 10)"
                    className="text-[9px] px-1.5 py-0.5 rounded bg-surface/90 border border-border font-mono w-20"
                    value={sub.grade || ""}
                    onChange={e => onUpdate(sub.id, { grade: e.target.value || undefined })}
                  />
                  <input type="text" placeholder="Cert #"
                    className="text-[9px] px-1.5 py-0.5 rounded bg-surface/90 border border-border font-mono w-20"
                    value={sub.certNumber || ""}
                    onChange={e => onUpdate(sub.id, { certNumber: e.target.value || undefined })}
                  />
                </div>

                {sub.notes && (
                  <div className="mt-2 text-[11px] text-text-tertiary italic">{sub.notes}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN
   ═══════════════════════════════════════ */
export default function LegacyPokePrice({ initialView = "home" }: { initialView?: View }) {
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Card|null>(null);
  const [activeVariant, setActiveVariant] = useState("");
  const [trending, setTrending] = useState<Card[]>([]);
  const [trendingLoaded, setTrendingLoaded] = useState(false);
  const [view, setView] = useState<View>(initialView);
  const [returnTo, setReturnTo] = useState<View>(initialView);
  const [watchlist, setWatchlist] = useState<SavedCard[]>([]);
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [sealedVault, setSealedVault] = useState<SealedItem[]>([]);
  const [stories, setStories] = useState<CardStory[]>([]);
  const [gradingSubmissions, setGradingSubmissions] = useState<GradingSubmission[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<SavedCard[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [searchError, setSearchError] = useState<string|null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController|null>(null);

  /* Memoized sidebar metrics — prevents recalculation on every keystroke */
  const watchlistTotalValue = useMemo(() =>
    watchlist.reduce((s,c)=>s+(c.price||0),0),
  [watchlist]);

  const collectionMetrics = useMemo(() => {
    const unique = collection.length;
    const totalCards = collection.reduce((s,c)=>s+c.quantity,0);
    const adjValue = collection.reduce((s,c)=>s+((getConditionAdjustedPrice(c.price,c.condition))||0)*c.quantity,0);
    const invested = collection.reduce((s,c)=>s+(c.costBasis||0)*c.quantity,0);
    return { unique, totalCards, adjValue, invested };
  }, [collection]);

  const sealedMetrics = useMemo(() => {
    const products = sealedVault.length;
    const units = sealedVault.reduce((s,i)=>s+i.qty,0);
    const totalCost = sealedVault.reduce((s,i)=>s+i.costBasis*i.qty,0);
    const estValue = sealedVault.reduce((s,i)=>s+(i.estValue||0)*i.qty,0);
    return { products, units, totalCost, estValue };
  }, [sealedVault]);

  /* Load localStorage with migration from v1 -> v2 for collection
     v1 items lacked costBasis and condition fields; we default them gracefully */
  useEffect(()=>{
    try {
      const w = localStorage.getItem("pokeprice_watchlist_v1");
      const c = localStorage.getItem("pokeprice_collection_v2") || localStorage.getItem("pokeprice_collection_v1");
      const s = localStorage.getItem("pokeprice_sealed_v1");
      const r = localStorage.getItem("pokeprice_recent_v1");
      const cur = localStorage.getItem("pokeprice_currency_v1");
      if (w) setWatchlist(JSON.parse(w));
      if (c) {
        const parsed = JSON.parse(c) as CollectionItem[];
        setCollection(parsed.map(item=>({
          ...item,
          condition: item.condition || "NM",
          costBasis: item.costBasis ?? 0
        })));
      }
      if (s) setSealedVault(JSON.parse(s));
      const st = localStorage.getItem("pokeprice_stories_v1");
      if (st) setStories(JSON.parse(st));
      const g = localStorage.getItem("pokeprice_grading_v1");
      if (g) setGradingSubmissions(JSON.parse(g));
      if (r) setRecentlyViewed(JSON.parse(r));
      if (cur === 'USD' || cur === 'CAD') setCurrency(cur);
    } catch {}
  },[]);

  /* Deep linking: read ?q= and ?card= from URL on mount */
  useEffect(()=>{
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    const cardParam = params.get('card');
    if (cardParam) {
      loadDetail(cardParam);
    } else if (qParam) {
      setQuery(qParam);
      search(qParam, 1);
    }
  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  },[]);

  /* Save localStorage */
  useEffect(()=>{ localStorage.setItem("pokeprice_watchlist_v1", JSON.stringify(watchlist)); },[watchlist]);
  useEffect(()=>{ localStorage.setItem("pokeprice_collection_v2", JSON.stringify(collection)); },[collection]);
  useEffect(()=>{ localStorage.setItem("pokeprice_sealed_v1", JSON.stringify(sealedVault)); },[sealedVault]);
  useEffect(()=>{ localStorage.setItem("pokeprice_stories_v1", JSON.stringify(stories)); },[stories]);
  useEffect(()=>{ localStorage.setItem("pokeprice_grading_v1", JSON.stringify(gradingSubmissions)); },[gradingSubmissions]);
  useEffect(()=>{ localStorage.setItem("pokeprice_recent_v1", JSON.stringify(recentlyViewed)); },[recentlyViewed]);
  useEffect(()=>{ localStorage.setItem("pokeprice_currency_v1", currency); },[currency]);

  /* Search autocomplete using Pokemon name dictionary */
  useEffect(()=>{
    const q = query.trim();
    if (q.length < 2 || q.startsWith('#') || /^\d/.test(q)) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const fuse = new Fuse(POKEMON_NAMES, { threshold: 0.3, distance: 50, ignoreLocation: true });
    const results = fuse.search(q).slice(0, 6).map(r => r.item);
    setSearchSuggestions(results);
    setShowSuggestions(results.length > 0);
  },[query]);

  /* Load trending */
  useEffect(()=>{
    let cancelled = false;
    (async()=>{
      const results:Card[]=[];
      for (const q of TRENDING_QUERIES) {
        if (cancelled) break;
        try {
          const resp = await fetch(`/api/cards?q=${q}&limit=2`);
          const data = await resp.json();
          const best = (data.data||[]).sort((a:Card,b:Card)=>(getPrice(b)||0)-(getPrice(a)||0))[0];
          if (best && !results.find(r=>r.id===best.id)) results.push(best);
        } catch {}
      }
      if (!cancelled) { setTrending(results); setTrendingLoaded(true); }
    })();
    return ()=>{ cancelled=true; };
  },[]);

  /* Keyboard shortcuts */
  useEffect(()=>{
    const handleKey = (e:KeyboardEvent)=>{
      if ((e.metaKey||e.ctrlKey) && e.key==="k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      /* Autocomplete keyboard navigation */
      if (showSuggestions && searchSuggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSuggestionIndex(i => (i + 1) % searchSuggestions.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSuggestionIndex(i => (i - 1 + searchSuggestions.length) % searchSuggestions.length);
          return;
        }
        if (e.key === 'Enter' && suggestionIndex >= 0) {
          e.preventDefault();
          setQuery(searchSuggestions[suggestionIndex]);
          setShowSuggestions(false);
          setSuggestionIndex(-1);
          return;
        }
        if (e.key === 'Escape') {
          setShowSuggestions(false);
          setSuggestionIndex(-1);
          return;
        }
      }
      if (view==="search") {
        if (e.key==="ArrowDown") { e.preventDefault(); setSelectedIndex(i=>Math.min(i+1,cards.length-1)); }
        else if (e.key==="ArrowUp") { e.preventDefault(); setSelectedIndex(i=>Math.max(i-1,0)); }
        else if (e.key==="Enter" && selectedIndex>=0 && cards[selectedIndex]) {
          loadDetail(cards[selectedIndex].id);
        }
      }
      if (e.key==="Escape") {
        if (showSuggestions) { setShowSuggestions(false); setSuggestionIndex(-1); }
        else if (selected) goBack();
        else if (query) { setQuery(""); setView("home"); }
      }
    };
    window.addEventListener("keydown",handleKey);
    return ()=>window.removeEventListener("keydown",handleKey);
  },[view,cards,selectedIndex,query,selected,showSuggestions,searchSuggestions,suggestionIndex]);

  /* Debounced search with shared pattern detection, pagination, and error handling */
  const search = useCallback(async(q:string, pageNum:number=1)=>{
    if (q.length<2) {
      setCards([]);
      setTotal(0);
      setSearchError(null);
      if (view !== "search") setView("home");
      return;
    }
    setLoading(true); setView("search"); setSelectedIndex(-1); setShowSuggestions(false); setSearchError(null);

    const parsed = parseSearchQuery(q);
    const limit = 24;

    try {
      const resp = await fetch(`/api/cards?q=${encodeURIComponent(parsed.apiQuery)}&limit=${limit}`);
      if (!resp.ok) {
        const errData = await resp.json().catch(()=>({}));
        throw new Error(errData.error || `Server error ${resp.status}`);
      }
      const data = await resp.json();
      const results = data.data||[];
      const totalCount = data.totalCount||0;
      if (pageNum === 1) {
        setCards(results);
      } else {
        setCards(prev=>[...prev, ...results]);
      }
      setTotal(totalCount);
      setHasMore(results.length === limit && cards.length + results.length < totalCount);
      /* Deep link: update URL with ?q= */
      const url = new URL(window.location.href);
      url.searchParams.set('q', q);
      url.searchParams.delete('card');
      window.history.replaceState({}, '', url);
    } catch (err) {
      setCards([]);
      setTotal(0);
      setSearchError(err instanceof Error ? err.message : 'Search failed. The pricing API may be temporarily unavailable.');
    }
    setLoading(false);
  },[]);

  useEffect(()=>{
    clearTimeout(debounce.current);
    debounce.current = setTimeout(()=>{setPage(1); search(query,1);},300);
    return ()=>clearTimeout(debounce.current);
  },[query,search]);

  const loadDetail = async(id:string)=>{
    /* Abort any in-flight detail fetch to prevent race conditions */
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setReturnTo(view);
    setLoading(true);
    try {
      const resp = await fetch(`/api/cards/${id}`, { signal: controller.signal });
      const card = ((await resp.json()).data) as Card;
      setSelected(card);
      setActiveVariant(getVariants(card)[0]?.[0]||"");
      setView("detail");
      setRecentlyViewed(prev=>{
        const next = [toSavedCard(card), ...prev.filter(p=>p.id!==card.id)].slice(0,10);
        return next;
      });
      /* Deep link: update URL with ?card= */
      const url = new URL(window.location.href);
      url.searchParams.set('card', id);
      url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setSearchError('Failed to load card details. The API may be temporarily unavailable.');
      }
    }
    setLoading(false);
  };

  const goBack = ()=>{
    setSelected(null);
    setActiveVariant("");
    setView(returnTo);
    /* Clear deep link params from URL */
    const url = new URL(window.location.href);
    url.searchParams.delete('card');
    window.history.replaceState({}, '', url);
  };

  const toggleWatchlist = (card:Card)=>{
    const saved = toSavedCard(card);
    setWatchlist(prev=>{
      const exists = prev.some(p=>p.id===saved.id);
      if (exists) return prev.filter(p=>p.id!==saved.id);
      return [saved, ...prev];
    });
  };

  const addToCollection = (card:Card)=>{
    const saved = toSavedCard(card);
    setCollection(prev=>{
      const exists = prev.find(p=>p.id===saved.id);
      if (exists) {
        return prev.map(p=>p.id===saved.id?{...p,quantity:p.quantity+1}:p);
      }
      return [{...saved,quantity:1}, ...prev];
    });
  };

  const removeFromWatchlist = (id:string)=> setWatchlist(prev=>prev.filter(p=>p.id!==id));
  const removeFromCollection = (id:string)=> setCollection(prev=>prev.filter(p=>p.id!==id));

  const updateCollectionItem = (id:string, updates:Partial<CollectionItem>)=>{
    setCollection(prev=>prev.map(p=>p.id===id?{...p,...updates}:p));
  };

  const addSealedItem = (item: Omit<SealedItem, "id">)=>{
    setSealedVault(prev=>[...prev, { ...item, id: safeId() }]);
  };
  const removeSealedItem = (id:string)=> setSealedVault(prev=>prev.filter(p=>p.id!==id));
  const updateSealedItem = (id:string, updates:Partial<SealedItem>)=>{
    setSealedVault(prev=>prev.map(p=>p.id===id?{...p,...updates}:p));
  };

  const addStory = (cardId: string, title: string, body: string, date: string) => {
    const now = new Date().toISOString();
    setStories(prev => {
      const existing = prev.find(s => s.id === cardId);
      if (existing) {
        return prev.map(s => s.id === cardId ? { ...s, title, body, date, updatedAt: now } : s);
      }
      return [...prev, { id: cardId, title, body, date, createdAt: now, updatedAt: now }];
    });
  };
  const removeStory = (cardId: string) => setStories(prev => prev.filter(s => s.id !== cardId));

  const addGradingSubmission = (item: Omit<GradingSubmission, "id">)=>{
    setGradingSubmissions(prev=>[...prev, { ...item, id: safeId() }]);
  };
  const removeGradingSubmission = (id:string)=> setGradingSubmissions(prev=>prev.filter(p=>p.id!==id));
  const updateGradingSubmission = (id:string, updates:Partial<GradingSubmission>)=>{
    setGradingSubmissions(prev=>prev.map(p=>p.id===id?{...p,...updates}:p));
  };

  /* Sidebar nav items */
  const navItems: { id: View; label: string; icon: IconComponent; badge?: number }[] = [
    { id: "home", label: "Discover", icon: IconLightning },
    { id: "watchlist", label: "Watchlist", icon: IconStar, badge: watchlist.length },
    { id: "collection", label: "Collection", icon: IconPackage, badge: collection.length },
    { id: "stories", label: "Stories", icon: IconBook, badge: stories.length },
    { id: "grading", label: "Grading Tracker", icon: IconClipboard, badge: gradingSubmissions.length },
    { id: "sealed", label: "Sealed Vault", icon: IconShield, badge: sealedVault.length },
  ];

  return (
    <div className="flex min-h-screen bg-bg text-text">
      {/* Sidebar */}
      <aside className="w-[280px] bg-surface border-r border-border flex flex-col shrink-0 max-md:hidden">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-bg shadow-lg shadow-primary/20"
            onClick={()=>{ setView("home"); setSelected(null); setQuery(""); }}>
            <IconPokeball className="w-5 h-5" />
          </div>
          <div className="cursor-pointer" onClick={()=>{ setView("home"); setSelected(null); setQuery(""); }}>
            <h1 className="text-base font-extrabold tracking-tight font-display leading-none">PokePrice</h1>
            <p className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">Trading Terminal</p>
          </div>
        </div>

        {/* Search with Autocomplete */}
        <div className="p-4">
          <div className="relative group">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary group-focus-within:text-primary transition-colors z-10" />
            <input ref={searchRef} type="text" value={query} onChange={e=>{setQuery(e.target.value); setShowSuggestions(true);}}
              onFocus={()=>query.trim().length>=2 && setShowSuggestions(searchSuggestions.length>0)}
              onBlur={()=>setTimeout(()=>setShowSuggestions(false),150)}
              placeholder="Search cards..."
              className="w-full py-2.5 pl-9 pr-16 bg-bg border border-border rounded-lg text-sm outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-text-tertiary/60 font-mono text-xs" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-tertiary font-mono border border-border rounded px-1.5 py-0.5">
              ⌘K
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                {searchSuggestions.map((suggestion, i) => (
                  <button
                    key={suggestion}
                    onMouseDown={()=>{setQuery(suggestion); setShowSuggestions(false); setSuggestionIndex(-1); searchRef.current?.focus();}}
                    className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${i===suggestionIndex?'bg-primary/10 text-primary':'text-text-secondary hover:bg-primary/10 hover:text-primary'} ${i===0?'border-t-0':'border-t border-border/50'}`}>
                    {suggestion}
                  </button>
                ))}
                <div className="px-3 py-1.5 text-[10px] text-text-tertiary border-t border-border/50 bg-surface-raised">
                  Try: <span className="font-mono text-text-secondary">#105</span>, <span className="font-mono text-text-secondary">4/102</span>, or <span className="font-mono text-text-secondary">Charizard ex 105</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="px-3 mb-4">
          {navItems.map(item=>{
            const Icon = item.icon;
            const active = view===item.id || (view==="detail" && returnTo===item.id) || (view==="search" && item.id==="home" && query.length>=2);
            return (
              <button key={item.id} onClick={()=>{ setView(item.id); setSelected(null); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-all mb-0.5 ${active?"bg-primary/10 text-primary border border-primary/20":"text-text-secondary hover:text-text hover:bg-surface-raised border border-transparent"}`}>
                <Icon className={`w-4 h-4 ${active?"text-primary":"text-text-tertiary"}`} />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className={`ml-auto text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full ${active?"bg-primary text-bg":"bg-surface-raised text-text-secondary"}`}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Context Panel */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {view==="home" && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2 font-display">Recent Sets</h3>
                <div className="space-y-0.5">
                  {RECENT_SETS.slice(0,5).map(set=> (
                    <button key={set.name} onClick={()=>setQuery(set.name)}
                      className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-surface-raised transition-colors flex justify-between items-center group">
                      <span className="text-xs group-hover:text-primary transition-colors">{set.name}</span>
                      <span className="text-[10px] text-text-tertiary font-mono">{set.date}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2 font-display">Hot Searches</h3>
                <div className="flex flex-wrap gap-1.5">
                  {TRENDING_QUERIES.map(q=> (
                    <button key={q} onClick={()=>setQuery(q)}
                      className="text-[10px] px-2 py-1 rounded-md bg-surface-raised border border-border hover:border-primary/40 hover:text-primary transition-all font-mono">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view==="search" && (
            <div className="animate-fade-in">
              <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2 font-display">Search</h3>
              <p className="text-xs text-text-secondary mb-2">{total} results</p>
              <p className="text-[11px] text-text-tertiary">Use arrow keys to navigate. Press Enter to select.</p>
            </div>
          )}

          {view==="detail" && selected && (
            <div className="animate-fade-in space-y-4">
              <div className="bg-surface-raised border border-border rounded-xl p-3">
                {selected.images?.small && <img src={selected.images.small} alt={selected.name} className="w-full rounded-lg mb-2" />}
                <div className="text-sm font-semibold truncate">{selected.name}</div>
                <div className="text-[11px] text-text-secondary font-mono">{selected.set?.name}</div>
              </div>
              <div className="text-[11px] text-text-tertiary leading-relaxed">
                Pricing data sourced from TCGPlayer & Cardmarket via pokemontcg.io
              </div>
            </div>
          )}

          {view==="watchlist" && (
            <div className="animate-fade-in">
              <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2 font-display">Summary</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Cards</span><span className="font-mono">{watchlist.length}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Total Value</span><span className="font-mono text-primary">${watchlistTotalValue.toFixed(2)}</span></div>
              </div>
            </div>
          )}

          {view==="collection" && (
            <div className="animate-fade-in">
              <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2 font-display">Summary</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Unique</span><span className="font-mono">{collectionMetrics.unique}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Total Cards</span><span className="font-mono">{collectionMetrics.totalCards}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Adj. Value</span><span className="font-mono text-primary">${collectionMetrics.adjValue.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Invested</span><span className="font-mono text-text">${collectionMetrics.invested.toFixed(2)}</span></div>
              </div>
            </div>
          )}

          {view==="sealed" && (
            <div className="animate-fade-in">
              <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2 font-display">Summary</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Products</span><span className="font-mono">{sealedMetrics.products}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Units</span><span className="font-mono">{sealedMetrics.units}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Total Cost</span><span className="font-mono text-text">${sealedMetrics.totalCost.toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Est. Value</span><span className="font-mono text-primary">${sealedMetrics.estValue.toFixed(2)}</span></div>
              </div>
            </div>
          )}

          {view==="stories" && (
            <div className="animate-fade-in">
              <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2 font-display">Summary</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Stories</span><span className="font-mono">{stories.length}</span></div>
              </div>
              <p className="text-[11px] text-text-tertiary mt-3 leading-relaxed">
                Attach memories, provenance, and meaning to the cards that matter most.
              </p>
            </div>
          )}

          {view==="grading" && (
            <div className="animate-fade-in">
              <h3 className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-2 font-display">Summary</h3>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Submissions</span><span className="font-mono">{gradingSubmissions.length}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-secondary">In Grading</span><span className="font-mono">{gradingSubmissions.filter(s=>s.status==='grading'||s.status==='received').length}</span></div>
                <div className="flex justify-between text-xs"><span className="text-text-secondary">Completed</span><span className="font-mono">{gradingSubmissions.filter(s=>s.status==='completed').length}</span></div>
              </div>
              <p className="text-[11px] text-text-tertiary mt-3 leading-relaxed">
                Track PSA, BGS, CGC, and other grading submissions from start to finish.
              </p>
            </div>
          )}
        </div>

        {/* Currency Toggle */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">Currency</span>
            <div className="flex bg-surface-raised rounded-lg border border-border overflow-hidden">
              <button onClick={()=>setCurrency('USD')}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold transition-all ${currency==='USD'?'bg-primary text-bg':'text-text-secondary hover:text-text'}`}>
                USD
              </button>
              <button onClick={()=>setCurrency('CAD')}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold transition-all ${currency==='CAD'?'bg-primary text-bg':'text-text-secondary hover:text-text'}`}>
                CAD
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border text-[10px] text-text-tertiary font-mono">
          <p>Data via pokemontcg.io</p>
          <p className="mt-0.5">COLLECTR CAD via EB Games (est.)</p>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={()=>setMobileMenuOpen(!mobileMenuOpen)} className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-text-secondary">
          <IconMenu className="w-4 h-4" />
        </button>
        <div className="flex-1 relative">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary z-10" />
          <input ref={mobileSearchRef} type="text" value={query} onChange={e=>{setQuery(e.target.value); setShowSuggestions(true);}}
            onFocus={()=>query.trim().length>=2 && setShowSuggestions(searchSuggestions.length>0)}
            onBlur={()=>setTimeout(()=>setShowSuggestions(false),150)}
            placeholder="Search cards..."
            className="w-full py-2 pl-8 pr-3 bg-bg border border-border rounded-lg text-xs outline-none focus:border-primary font-mono" />
          {/* Mobile Autocomplete Dropdown */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
              {searchSuggestions.map((suggestion, i) => (
                <button key={suggestion} onMouseDown={()=>{setQuery(suggestion); setShowSuggestions(false); mobileSearchRef.current?.focus();}}
                  className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-primary/10 hover:text-primary transition-colors ${i===0?'border-t-0':'border-t border-border/50'}`}>
                  <span className="text-text-secondary">{suggestion}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-bg shrink-0"
          onClick={()=>{ setView("home"); setSelected(null); setQuery(""); }}>
          <IconPokeball className="w-4 h-4" />
        </div>
      </div>

      {/* Mobile Navigation Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-bg/95 backdrop-blur-sm" onClick={()=>setMobileMenuOpen(false)}>
          <div className="p-6 space-y-2" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary font-display">Menu</h2>
              <button onClick={()=>setMobileMenuOpen(false)} className="w-8 h-8 rounded-lg bg-surface-raised border border-border flex items-center justify-center text-text-secondary">
                <IconX className="w-4 h-4" />
              </button>
            </div>
            {navItems.map(item=>{
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={()=>{ setView(item.id); setSelected(null); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-all ${view===item.id?"bg-primary/10 text-primary border border-primary/20":"text-text-secondary hover:text-text hover:bg-surface-raised border border-transparent"}`}>
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className={`ml-auto text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full ${view===item.id?"bg-primary text-bg":"bg-surface-raised text-text-secondary"}`}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {/* Currency toggle on mobile */}
            <div className="pt-4 border-t border-border mt-4">
              <div className="flex items-center justify-between px-4">
                <span className="text-[10px] text-text-tertiary font-mono uppercase tracking-wider">Currency</span>
                <div className="flex bg-surface-raised rounded-lg border border-border overflow-hidden">
                  <button onClick={()=>setCurrency('USD')}
                    className={`px-2.5 py-1 text-[10px] font-mono font-bold transition-all ${currency==='USD'?'bg-primary text-bg':'text-text-secondary hover:text-text'}`}>
                    USD
                  </button>
                  <button onClick={()=>setCurrency('CAD')}
                    className={`px-2.5 py-1 text-[10px] font-mono font-bold transition-all ${currency==='CAD'?'bg-primary text-bg':'text-text-secondary hover:text-text'}`}>
                    CAD
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 overflow-y-auto relative">
        <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto">
          {view==="home" && <HomeView trending={trending} trendingLoaded={trendingLoaded} onCardClick={loadDetail} onSetClick={setQuery} watchlist={watchlist} onToggleWatchlist={toggleWatchlist} />}
          {view==="search" && <SearchView cards={cards} loading={loading} total={total} query={query} onCardClick={loadDetail} selectedIndex={selectedIndex} watchlist={watchlist} onToggleWatchlist={toggleWatchlist} error={searchError} hasMore={hasMore} onLoadMore={()=>{setPage(p=>p+1); search(query, page+1);}} />}
          {view==="detail" && selected && <DetailView card={selected} activeVariant={activeVariant} setActiveVariant={setActiveVariant} onBack={goBack} watchlist={watchlist} onToggleWatchlist={toggleWatchlist} collection={collection} onAddToCollection={addToCollection} currency={currency} stories={stories} onAddStory={addStory} onRemoveStory={removeStory} />}
          {view==="watchlist" && <WatchlistView watchlist={watchlist} onCardClick={loadDetail} onRemove={removeFromWatchlist} />}
          {view==="collection" && <CollectionView collection={collection} onCardClick={loadDetail} onRemove={removeFromCollection} onUpdateItem={updateCollectionItem} stories={stories} />}
          {view==="sealed" && <SealedVaultView items={sealedVault} onAdd={addSealedItem} onRemove={removeSealedItem} onUpdate={updateSealedItem} />}
          {view==="stories" && <StoriesView stories={stories} collection={collection} onCardClick={loadDetail} onRemove={removeStory} />}
          {view==="grading" && <GradingTrackerView submissions={gradingSubmissions} collection={collection} onAdd={addGradingSubmission} onRemove={removeGradingSubmission} onUpdate={updateGradingSubmission} onCardClick={loadDetail} />}
        </div>
      </main>
    </div>
  );
}
