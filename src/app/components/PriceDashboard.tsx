"use client";

import { useMemo } from "react";
import { IconTrendUp, IconTrendDown, IconCheck, IconAlertTriangle, IconClock, IconExternalLink } from "./Icons";
import { buildUnifiedPrices, calculateConfidence, CONFIDENCE_META } from "@/lib/pricing";

interface CardPrice {
  low: number | null; mid: number | null; high: number | null;
  market: number | null; directLow: number | null;
}
interface Card {
  id: string; name: string;
  tcgplayer?: { updatedAt?: string; prices?: Record<string, CardPrice>; url?: string };
  cardmarket?: { prices?: Record<string, number>; updatedAt?: string; url?: string };
  _pokeprice?: {
    ebaySoldAvg?: number;
    unified?: ReturnType<typeof buildUnifiedPrices>;
  };
}

const EUR_TO_USD = 1.08; // Approximate rate — in production, fetch live
const OUTLIER_THRESHOLD = 10; // Multiplier above market to flag as outlier

function detectOutlier(value: number | null | undefined, reference: number | null | undefined): boolean {
  if (!value || !reference || reference <= 0) return false;
  return value > reference * OUTLIER_THRESHOLD;
}

function formatPrice(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  return `${currency}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function freshnessColor(dateStr?: string): string {
  if (!dateStr) return "text-text-tertiary";
  const d = new Date(dateStr);
  const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 1) return "text-emerald-400";
  if (days <= 7) return "text-yellow-400";
  return "text-rose-400";
}

function freshnessLabel(dateStr?: string): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 7) return `${Math.floor(days)}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function PriceDashboard({ card, activeVariant }: { card: Card; activeVariant: string }) {
  const tcg = card.tcgplayer?.prices?.[activeVariant];
  const cm = card.cardmarket?.prices;
  const tcgUrl = card.tcgplayer?.url;
  const cmUrl = card.cardmarket?.url;
  const ebaySoldAvg = card._pokeprice?.ebaySoldAvg;

  // Use server-computed unified prices if available, else compute client-side
  const unified = useMemo(() => {
    if (card._pokeprice?.unified) return card._pokeprice.unified;
    return buildUnifiedPrices(
      { market: tcg?.market ?? null, low: tcg?.low ?? null, high: tcg?.high ?? null, mid: tcg?.mid ?? null },
      { trendPrice: cm?.trendPrice ?? null, avg7: cm?.avg7 ?? null, avg30: cm?.avg30 ?? null },
      ebaySoldAvg ?? null
    );
  }, [card._pokeprice, tcg, cm, ebaySoldAvg]);

  const confidence = useMemo(() => calculateConfidence(unified), [unified]);
  const confidenceMeta = CONFIDENCE_META[confidence];

  const tcgHighOutlier = detectOutlier(tcg?.high, tcg?.market);
  const tcgLowOutlier = tcg && tcg.low !== null && tcg.market !== null && tcg.low > tcg.market * 2;

  const consensus = unified.consensus;
  const realizable = unified.realizable;

  return (
    <div className="space-y-5">
      {/* Confidence + Three-Vector Banner: Market / eBay Sold / Realizable */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${confidenceMeta.bg} ${confidenceMeta.border}`}>
        {confidence === "high" ? <IconCheck className={`w-5 h-5 ${confidenceMeta.color}`} /> : <IconAlertTriangle className={`w-5 h-5 ${confidenceMeta.color}`} />}
        <div className="flex-1">
          <div className={`text-sm font-semibold ${confidenceMeta.color}`}>{confidenceMeta.label}</div>
          <div className="text-xs text-text-secondary">{confidenceMeta.desc}</div>
        </div>
        {consensus && (
          <div className="text-right mr-4">
            <div className="text-[10px] text-text-secondary uppercase tracking-wider">Consensus</div>
            <div className="text-lg font-bold text-primary font-mono">${consensus.toFixed(2)}</div>
          </div>
        )}
        {unified.ebaySoldAvg && (
          <div className="text-right border-l border-border/50 pl-4 mr-4">
            <div className="text-[10px] text-text-secondary uppercase tracking-wider">eBay Sold Avg</div>
            <div className="text-lg font-bold text-amber-400 font-mono">${unified.ebaySoldAvg.toFixed(2)}</div>
            <div className="text-[9px] text-text-tertiary">estimated</div>
          </div>
        )}
        {realizable && (
          <div className="text-right border-l border-border/50 pl-4">
            <div className="text-[10px] text-text-secondary uppercase tracking-wider">Realizable</div>
            <div className="text-lg font-bold text-text-secondary font-mono">${realizable.toFixed(2)}</div>
            <div className="text-[9px] text-text-tertiary">after ~13% fees</div>
          </div>
        )}
      </div>

      {/* Source Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TCGPlayer */}
        <div className="glass rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <span className="text-[10px] font-bold">T</span>
                </div>
                <div>
                  <div className="text-sm font-bold">TCGPlayer</div>
                  <div className="text-[10px] text-text-secondary">USD Market</div>
                </div>
              </div>
              <a href={tcgUrl} target="_blank" rel="noopener noreferrer" className="text-text-tertiary hover:text-primary transition-colors">
                <IconExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="mb-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Market Price</div>
              <div className="text-3xl font-bold text-emerald-400 font-mono tabular-nums">{formatPrice(tcg?.market, "$")}</div>
            </div>

            <div className="space-y-2">
              <PriceRow label="Low" value={tcg?.low} currency="$" warn={tcgLowOutlier} />
              <PriceRow label="Mid" value={tcg?.mid} currency="$" />
              <PriceRow label="High" value={tcg?.high} currency="$" warn={tcgHighOutlier} />
              <PriceRow label="Direct" value={tcg?.directLow} currency="$" />
            </div>

            <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5 text-[11px] text-text-secondary">
              <IconClock className="w-3 h-3" />
              <span className={freshnessColor(card.tcgplayer?.updatedAt)}>
                {freshnessLabel(card.tcgplayer?.updatedAt)}
              </span>
            </div>
          </div>
        </div>

        {/* eBay Sold Average */}
        <div className="glass rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                  <span className="text-[10px] font-bold">E</span>
                </div>
                <div>
                  <div className="text-sm font-bold">eBay</div>
                  <div className="text-[10px] text-text-secondary">Sold Listings</div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Sold Average</div>
              <div className="text-3xl font-bold text-amber-400 font-mono tabular-nums">{formatPrice(unified.ebaySoldAvg, "$")}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-text-secondary">vs TCGPlayer</span>
                <span className="font-mono font-semibold tabular-nums">
                  {unified.tcgplayerMarket && unified.ebaySoldAvg
                    ? `${((unified.ebaySoldAvg / unified.tcgplayerMarket - 1) * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-text-secondary">vs Consensus</span>
                <span className="font-mono font-semibold tabular-nums">
                  {consensus && unified.ebaySoldAvg
                    ? `${((unified.ebaySoldAvg / consensus - 1) * 100).toFixed(1)}%`
                    : "—"}
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-text-secondary">
              Estimated from TCGPlayer market — real eBay API integration pending
            </div>
          </div>
        </div>

        {/* Cardmarket */}
        <div className="glass rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                  <span className="text-[10px] font-bold">C</span>
                </div>
                <div>
                  <div className="text-sm font-bold">Cardmarket</div>
                  <div className="text-[10px] text-text-secondary">EUR Market · ~${EUR_TO_USD} conversion</div>
                </div>
              </div>
              <a href={cmUrl} target="_blank" rel="noopener noreferrer" className="text-text-tertiary hover:text-primary transition-colors">
                <IconExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="mb-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Trend Price</div>
              <div className="text-3xl font-bold text-cyan-400 font-mono tabular-nums">{formatPrice(cm?.trendPrice, "€")}</div>
              {cm?.trendPrice && (
                <div className="text-xs text-text-secondary font-mono mt-0.5">≈ ${(cm.trendPrice * EUR_TO_USD).toFixed(2)} USD</div>
              )}
            </div>

            <div className="space-y-2">
              <PriceRow label="30-Day Avg" value={cm?.avg30} currency="€" usdEstimate />
              <PriceRow label="7-Day Avg" value={cm?.avg7} currency="€" usdEstimate />
              <PriceRow label="1-Day Avg" value={cm?.avg1} currency="€" usdEstimate />
              <PriceRow label="Low Price" value={cm?.lowPrice} currency="€" usdEstimate />
            </div>

            <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-1.5 text-[11px] text-text-secondary">
              <IconClock className="w-3 h-3" />
              <span className={freshnessColor(card.cardmarket?.updatedAt)}>
                {freshnessLabel(card.cardmarket?.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Comparison Bar */}
      {(tcg?.market || cm?.trendPrice || unified.ebaySoldAvg) && (
        <div className="glass rounded-xl p-4">
          <div className="text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-3">Price Comparison</div>
          <PriceComparisonBar tcgMarket={tcg?.market} cmTrend={cm?.trendPrice} ebaySold={unified.ebaySoldAvg} consensus={consensus} />
        </div>
      )}

      {/* Detailed Table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-raised border-b border-border">
              <th className="text-left py-3 px-4 text-[10px] font-bold text-text-secondary uppercase tracking-wider">Metric</th>
              <th className="text-left py-3 px-4 text-[10px] font-bold text-text-secondary uppercase tracking-wider">TCGPlayer (USD)</th>
              <th className="text-left py-3 px-4 text-[10px] font-bold text-text-secondary uppercase tracking-wider">eBay Sold (est.)</th>
              <th className="text-left py-3 px-4 text-[10px] font-bold text-text-secondary uppercase tracking-wider">Cardmarket (EUR)</th>
              <th className="text-left py-3 px-4 text-[10px] font-bold text-text-secondary uppercase tracking-wider">Cardmarket (USD est.)</th>
            </tr>
          </thead>
          <tbody>
            <TableRow label="Market / Trend / Sold" tcg={tcg?.market} ebay={unified.ebaySoldAvg} cm={cm?.trendPrice} />
            <TableRow label="Low" tcg={tcg?.low} cm={cm?.lowPrice} />
            <TableRow label="Mid / Avg30" tcg={tcg?.mid} cm={cm?.avg30} />
            <TableRow label="High / Avg1" tcg={tcg?.high} cm={cm?.avg1} />
            <TableRow label="Direct / Avg7" tcg={tcg?.directLow} cm={cm?.avg7} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriceRow({ label, value, currency, warn, usdEstimate }: {
  label: string; value: number | null | undefined; currency: string; warn?: boolean; usdEstimate?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        {warn && <span title="Possible outlier"><IconAlertTriangle className="w-3 h-3 text-rose-400" /></span>}
        <span className={`font-mono font-semibold tabular-nums ${warn ? "text-rose-400" : ""}`}>
          {formatPrice(value, currency)}
        </span>
        {usdEstimate && value && (
          <span className="text-[11px] text-text-tertiary font-mono">
            ≈ ${(value * EUR_TO_USD).toFixed(0)}
          </span>
        )}
      </div>
    </div>
  );
}

function TableRow({ label, tcg, ebay, cm }: { label: string; tcg?: number | null | undefined; ebay?: number | null | undefined; cm?: number | null | undefined }) {
  const cmUsd = cm ? cm * EUR_TO_USD : null;

  return (
    <tr className="border-b border-border/50 hover:bg-surface-raised/50 transition-colors">
      <td className="py-2.5 px-4 font-medium text-text-secondary">{label}</td>
      <td className="py-2.5 px-4 font-mono">{formatPrice(tcg, "$")}</td>
      <td className="py-2.5 px-4 font-mono">{formatPrice(ebay, "$")}</td>
      <td className="py-2.5 px-4 font-mono">{formatPrice(cm, "€")}</td>
      <td className="py-2.5 px-4 font-mono">{formatPrice(cmUsd, "$")}</td>
    </tr>
  );
}

function PriceComparisonBar({ tcgMarket, cmTrend, ebaySold, consensus }: {
  tcgMarket: number | null | undefined;
  cmTrend: number | null | undefined;
  ebaySold: number | null | undefined;
  consensus: number | null;
}) {
  const values: { label: string; val: number; color: string }[] = [];
  if (tcgMarket) values.push({ label: "TCGPlayer", val: tcgMarket, color: "#34d399" });
  if (ebaySold) values.push({ label: "eBay Sold", val: ebaySold, color: "#f59e0b" });
  if (cmTrend) values.push({ label: "Cardmarket", val: cmTrend * EUR_TO_USD, color: "#22d3ee" });
  if (consensus) values.push({ label: "Consensus", val: consensus, color: "#facc15" });

  if (values.length < 2) return null;

  const min = Math.min(...values.map(v => v.val));
  const max = Math.max(...values.map(v => v.val));
  const range = max - min || 1;

  return (
    <div className="space-y-3">
      {values.map((v) => {
        const pct = ((v.val - min) / range) * 100;
        return (
          <div key={v.label} className="flex items-center gap-3">
            <span className="text-xs text-text-secondary w-24 shrink-0 text-right">{v.label}</span>
            <div className="flex-1 h-2 bg-surface-raised rounded-full relative overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(4, pct)}%`, backgroundColor: v.color, opacity: 0.8 }}
              />
            </div>
            <span className="text-xs font-mono font-semibold tabular-nums w-20">${v.val.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}
