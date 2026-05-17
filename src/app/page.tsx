"use client";

import { useMemo, useState } from "react";
import {
  IconBell,
  IconBook,
  IconChartBar,
  IconChartLine,
  IconChevronDown,
  IconChevronRight,
  IconClipboard,
  IconGlobe,
  IconInfo,
  IconPackage,
  IconPen,
  IconPokeball,
  IconSearch,
  IconShield,
  IconStar,
  IconTrendDown,
  IconTrendUp,
  IconWallet,
} from "./components/Icons";

type Currency = "CAD" | "USD";
type TimeRange = "7D" | "1M" | "3M" | "6M" | "1Y" | "ALL";

type SparkPoint = {
  label: string;
  value: number;
};

type HoldingsRow = {
  id: string;
  name: string;
  set: string;
  number: string;
  image: string;
  condition: "NM" | "LP";
  qty: number;
  costBasis: number;
  marketValue: number;
};

const NAV_ITEMS = [
  { label: "Dashboard", icon: IconChartBar, active: true },
  { label: "Search Cards", icon: IconSearch },
  { label: "Collection", icon: IconClipboard },
  { label: "Watchlist", icon: IconStar },
  { label: "Sealed Vault", icon: IconPackage },
  { label: "Grading Tracker", icon: IconShield },
  { label: "Card Stories", icon: IconBook },
  { label: "Alerts", icon: IconBell },
] as const;

const ANALYTICS_ITEMS = ["Price Comparer", "Market Trends"];
const ACCOUNT_ITEMS = ["Reports", "Export (CSV)", "Settings"];

const PORTFOLIO_SERIES: Record<TimeRange, SparkPoint[]> = {
  "7D": [
    { label: "May 10", value: 24110 },
    { label: "May 11", value: 23980 },
    { label: "May 12", value: 24320 },
    { label: "May 13", value: 24690 },
    { label: "May 14", value: 24520 },
    { label: "May 15", value: 24780 },
    { label: "May 16", value: 24812 },
  ],
  "1M": [
    { label: "Apr 16", value: 18940 },
    { label: "Apr 18", value: 17820 },
    { label: "Apr 20", value: 18630 },
    { label: "Apr 22", value: 20840 },
    { label: "Apr 24", value: 20650 },
    { label: "Apr 26", value: 21790 },
    { label: "Apr 28", value: 22600 },
    { label: "Apr 30", value: 22920 },
    { label: "May 2", value: 24710 },
    { label: "May 4", value: 23940 },
    { label: "May 6", value: 25110 },
    { label: "May 8", value: 24880 },
    { label: "May 10", value: 25850 },
    { label: "May 12", value: 26780 },
    { label: "May 14", value: 26120 },
    { label: "May 16", value: 28140 },
  ],
  "3M": [
    { label: "Feb", value: 14200 },
    { label: "Late Feb", value: 15110 },
    { label: "Mar", value: 16890 },
    { label: "Mid Mar", value: 17620 },
    { label: "Late Mar", value: 19440 },
    { label: "Apr", value: 20810 },
    { label: "Mid Apr", value: 22500 },
    { label: "Late Apr", value: 23190 },
    { label: "May", value: 24812 },
  ],
  "6M": [
    { label: "Nov", value: 11900 },
    { label: "Dec", value: 12840 },
    { label: "Jan", value: 15110 },
    { label: "Feb", value: 16780 },
    { label: "Mar", value: 19400 },
    { label: "Apr", value: 21980 },
    { label: "May", value: 24812 },
  ],
  "1Y": [
    { label: "Jun", value: 9600 },
    { label: "Aug", value: 10440 },
    { label: "Oct", value: 11880 },
    { label: "Dec", value: 13600 },
    { label: "Feb", value: 17240 },
    { label: "Apr", value: 21980 },
    { label: "May", value: 24812 },
  ],
  ALL: [
    { label: "Start", value: 7200 },
    { label: "Era 2", value: 9300 },
    { label: "Era 3", value: 11900 },
    { label: "Era 4", value: 15020 },
    { label: "Era 5", value: 19010 },
    { label: "Era 6", value: 22410 },
    { label: "Now", value: 24812 },
  ],
};

const HOLDINGS: HoldingsRow[] = [
  {
    id: "charizard-ex-151",
    name: "Charizard ex",
    set: "151",
    number: "#199",
    image: "https://images.pokemontcg.io/sv3pt5/199.png",
    condition: "NM",
    qty: 2,
    costBasis: 85,
    marketValue: 156.23,
  },
  {
    id: "umbreon-vmax-evs-215",
    name: "Umbreon VMAX",
    set: "Evolving Skies",
    number: "#215",
    image: "https://images.pokemontcg.io/swsh7/215.png",
    condition: "NM",
    qty: 1,
    costBasis: 128,
    marketValue: 178.9,
  },
  {
    id: "pikachu-svp-190",
    name: "Pikachu",
    set: "SV Promo",
    number: "SVP 190",
    image: "https://images.pokemontcg.io/svpromo/190.png",
    condition: "NM",
    qty: 3,
    costBasis: 28,
    marketValue: 42,
  },
  {
    id: "gengar-fossil-5",
    name: "Gengar",
    set: "Fossil",
    number: "#5",
    image: "https://images.pokemontcg.io/base4/5.png",
    condition: "LP",
    qty: 1,
    costBasis: 65,
    marketValue: 93.5,
  },
];

const WATCHLIST = [
  {
    name: "Charizard ex (151)",
    subtitle: "Ultra Rare • #199",
    priceCad: 312.45,
    change: -8.6,
    image: "https://images.pokemontcg.io/sv3pt5/199.png",
  },
  {
    name: "Umbreon VMAX",
    subtitle: "Evolving Skies • #215",
    priceCad: 178.9,
    change: 12.3,
    image: "https://images.pokemontcg.io/swsh7/215.png",
  },
  {
    name: "Pikachu (SVP 190)",
    subtitle: "SV Promo • SVP 190",
    priceCad: 42,
    change: 15,
    image: "https://images.pokemontcg.io/svpromo/190.png",
  },
  {
    name: "Gengar (Fossil)",
    subtitle: "Holo Rare • #5",
    priceCad: 93.5,
    change: -4.2,
    image: "https://images.pokemontcg.io/base4/5.png",
  },
];

const ALERTS = [
  {
    title: "Card Price Drop",
    subtitle: "Charizard ex (151)",
    value: "CA$ 312.45",
    delta: -8.6,
  },
  {
    title: "Price Increase",
    subtitle: "Umbreon VMAX (Evolving Skies)",
    value: "CA$ 178.90",
    delta: 12.3,
  },
  {
    title: "Watchlist Deal",
    subtitle: "Pikachu (SVP 190)",
    value: "CA$ 42.00",
    deltaLabel: "-15% below avg",
  },
];

const RECENT_ACTIVITY = [
  { title: "Added to Collection", subtitle: "Charizard ex (151) #199", time: "2m ago", tone: "green" },
  { title: "Price Updated", subtitle: "Umbreon VMAX (Evolving Skies)", time: "4m ago", tone: "violet" },
  { title: "New Card Story", subtitle: "Base Set Charizard", time: "1h ago", tone: "amber" },
  { title: "Grading Submission", subtitle: "PSA submission created", time: "2h ago", tone: "blue" },
] as const;

const SOURCE_GUIDE = [
  { name: "TCGPlayer", desc: "Live market data", badge: "Verified", tone: "green" },
  { name: "Cardmarket", desc: "Live market data", badge: "Verified", tone: "green" },
  { name: "eBay Sold", desc: "Estimated from recent sales", badge: "Estimate", tone: "amber" },
  { name: "COLLECTR", desc: "Estimated from USD pricing", badge: "Estimate", tone: "amber" },
  { name: "Consensus Price", desc: "Weighted formula", badge: "Calculated", tone: "blue" },
  { name: "Realizable Price", desc: "What you can likely sell for", badge: "Calculated", tone: "blue" },
] as const;

const BOTTOM_FEATURES = [
  { title: "Sealed Vault", desc: "Track your sealed products and storage.", cta: "View Vault", icon: "📦" },
  { title: "Grading Tracker", desc: "Monitor submissions and grades.", cta: "View Tracker", icon: "🃏" },
  { title: "Card Stories", desc: "Document the stories behind your cards.", cta: "View Stories", icon: "📖" },
  { title: "Price Alerts", desc: "Set alerts on cards you care about.", cta: "View Alerts", icon: "🔔" },
  { title: "Market Trends", desc: "Explore market movements.", cta: "View Trends", icon: "📈" },
] as const;

function formatMoney(value: number, currency: Currency, digits = 2) {
  const prefix = currency === "CAD" ? "CA$" : "$";
  return `${prefix} ${value.toLocaleString("en-CA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function MiniSparkline({ values }: { values: number[] }) {
  const points = useMemo(() => {
    const width = 140;
    const height = 40;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = Math.max(max - min, 1);
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - 6) - 3;
        return `${x},${y}`;
      })
      .join(" ");
  }, [values]);

  return (
    <svg viewBox="0 0 140 40" className="h-10 w-full overflow-visible">
      <defs>
        <linearGradient id="miniSpark" x1="0" x2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#c084fc" stopOpacity="1" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="url(#miniSpark)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function PortfolioChart({ points }: { points: SparkPoint[] }) {
  const width = 920;
  const height = 280;
  const padding = 28;
  const values = points.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  const plotted = points.map((point, index) => {
    const x = padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
    return { ...point, x, y };
  });

  const line = plotted.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`;
  const focusPoint = plotted[Math.floor(plotted.length * 0.6)];

  return (
    <div className="relative h-[300px] rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,22,41,0.94),rgba(7,13,24,0.94))] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <defs>
          <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="chartLine" x1="0" x2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3, 4].map((index) => {
          const y = padding + (index / 4) * (height - padding * 2);
          return (
            <line
              key={index}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          );
        })}

        <polygon points={area} fill="url(#chartFill)" />
        <polyline
          points={line}
          fill="none"
          stroke="url(#chartLine)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {plotted.map((point) => (
          <circle key={point.label} cx={point.x} cy={point.y} r="4" fill="#a855f7" stroke="#d8b4fe" strokeWidth="1.5" />
        ))}
      </svg>

      <div className="pointer-events-none absolute left-10 top-8 flex h-[232px] flex-col justify-between text-[13px] text-slate-400">
        {["CA$30K", "CA$25K", "CA$20K", "CA$15K", "CA$10K"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-7 left-16 right-16 flex justify-between text-[13px] text-slate-400">
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor(points.length * 0.25)]?.label}</span>
        <span>{points[Math.floor(points.length * 0.5)]?.label}</span>
        <span>{points[Math.floor(points.length * 0.75)]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>

      {focusPoint ? (
        <div
          className="pointer-events-none absolute rounded-2xl border border-white/10 bg-[#0a1220]/95 px-4 py-3 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
          style={{ left: `${(focusPoint.x / width) * 100 - 2}%`, top: `${(focusPoint.y / height) * 100 + 5}%` }}
        >
          <div className="mb-2 text-slate-300">May 9, 2026</div>
          <div className="flex items-center gap-2 font-medium text-white">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-400" />
            CA$ 22,451.35
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ConfidenceDonut() {
  return (
    <div className="flex items-center gap-4">
      <div className="relative grid h-24 w-24 place-items-center rounded-full bg-[conic-gradient(#4ade80_0_295deg,#facc15_295deg_345deg,#fb7185_345deg_360deg)]">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-[#0f1727] text-center shadow-inner shadow-black/30">
          <div>
            <div className="text-xl font-semibold text-white">82%</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">High</div>
          </div>
        </div>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        <Legend tone="green" label="82% High" />
        <Legend tone="amber" label="14% Medium" />
        <Legend tone="rose" label="4% Low" />
      </div>
    </div>
  );
}

function Legend({ tone, label }: { tone: "green" | "amber" | "rose" | "blue"; label: string }) {
  const toneClass = {
    green: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    blue: "bg-sky-400",
  }[tone];
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${toneClass}`} />
      <span>{label}</span>
    </div>
  );
}

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(11,18,32,0.94),rgba(7,13,24,0.98))] shadow-[0_12px_40px_rgba(0,0,0,0.24)] ${className}`}>
      {children}
    </section>
  );
}

export default function Home() {
  const [currency, setCurrency] = useState<Currency>("CAD");
  const [range, setRange] = useState<TimeRange>("1M");

  const holdings = useMemo(() => {
    return HOLDINGS.map((row) => {
      const totalInvested = row.costBasis * row.qty;
      const totalValue = row.marketValue * row.qty;
      const roi = ((totalValue - totalInvested) / totalInvested) * 100;
      return { ...row, totalInvested, totalValue, roi };
    });
  }, []);

  const kpis = {
    portfolioValue: 24812.67,
    realizableValue: 18457.32,
    totalInvested: 14213.11,
    roi: 74.66,
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.08),transparent_28%),linear-gradient(180deg,#040813_0%,#07101d_100%)] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-[236px] shrink-0 border-r border-white/7 bg-[linear-gradient(180deg,rgba(7,12,23,0.98),rgba(6,10,20,0.98))] px-4 py-5 lg:flex lg:flex-col">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-[0_0_0_6px_rgba(239,68,68,0.12)]">
              <IconPokeball className="h-7 w-7 text-rose-500" />
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-tight text-white">
                Poke<span className="text-violet-400">Price</span>
              </div>
              <div className="text-xs text-slate-400">Truth in every price.</div>
            </div>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[15px] transition ${
                    ("active" in item && item.active)
                      ? "bg-[linear-gradient(90deg,rgba(124,58,237,0.95),rgba(168,85,247,0.82))] text-white shadow-[0_10px_32px_rgba(124,58,237,0.35)]"
                      : "text-slate-300 hover:bg-white/4 hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 space-y-7 border-t border-white/7 pt-6 text-sm">
            <div>
              <div className="mb-3 px-2 text-xs uppercase tracking-[0.18em] text-slate-500">Analytics</div>
              <div className="space-y-1">
                {ANALYTICS_ITEMS.map((item) => (
                  <button key={item} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-slate-300 hover:bg-white/4 hover:text-white">
                    <IconChartLine className="h-4 w-4" />
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 px-2 text-xs uppercase tracking-[0.18em] text-slate-500">Account</div>
              <div className="space-y-1">
                {ACCOUNT_ITEMS.map((item) => (
                  <button key={item} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-slate-300 hover:bg-white/4 hover:text-white">
                    <IconClipboard className="h-4 w-4" />
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-auto space-y-4">
            <SectionCard className="p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/18 text-violet-300">
                  <IconShield className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">Verified Pricing.</div>
                  <div className="text-sm text-slate-400">Real Value.</div>
                </div>
              </div>
              <p className="text-sm leading-6 text-slate-400">
                Every price is labeled by source and confidence.
              </p>
              <button className="mt-4 flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200">
                Learn more <IconChevronRight className="h-4 w-4" />
              </button>
            </SectionCard>

            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-300">
              <button className="flex flex-1 items-center justify-between rounded-xl border border-white/8 bg-[#101827] px-3 py-2.5">
                <span>{currency}</span>
                <IconChevronDown className="h-4 w-4 text-slate-500" />
              </button>
              <button className="rounded-xl border border-white/8 bg-[#101827] px-3 py-2.5">☾</button>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <img
                alt="Trainer Red avatar"
                className="h-11 w-11 rounded-full border border-violet-400/40 object-cover"
                src="https://images.pokemontcg.io/base4/5.png"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">Trainer Red</div>
                <div className="text-xs text-slate-400">Collector</div>
                <div className="text-sm text-violet-300">Pro Plan</div>
              </div>
              <IconChevronDown className="h-4 w-4 text-slate-500" />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/6 bg-[#07101dcc]/80 px-4 py-4 backdrop-blur-xl sm:px-6 xl:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/8 bg-[#0d1628]/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] xl:max-w-[700px]">
                <IconSearch className="h-5 w-5 text-slate-400" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-slate-500"
                  defaultValue=""
                  placeholder="Search Pokémon cards, sets, TG/SVP, keywords..."
                />
                <div className="hidden items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-400 sm:flex">
                  <span>⌘</span>
                  <span>K</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 xl:justify-end">
                <button
                  className="flex items-center gap-2 rounded-2xl border border-white/8 bg-[#0d1628] px-4 py-3 text-sm font-medium text-slate-200"
                  onClick={() => setCurrency((prev) => (prev === "CAD" ? "USD" : "CAD"))}
                >
                  {currency}
                  <IconChevronDown className="h-4 w-4 text-slate-500" />
                </button>

                <button className="relative grid h-12 w-12 place-items-center rounded-2xl border border-white/8 bg-[#0d1628] text-slate-300">
                  <IconBell className="h-5 w-5" />
                  <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-violet-500 text-[11px] font-semibold text-white">3</span>
                </button>

                <button className="flex items-center gap-2 rounded-2xl border border-white/8 bg-[#0d1628] px-2 py-2 text-sm text-slate-200">
                  <img
                    alt="Profile avatar"
                    className="h-8 w-8 rounded-full border border-violet-500/40 object-cover"
                    src="https://images.pokemontcg.io/base4/5.png"
                  />
                  <IconChevronDown className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-5 sm:px-6 xl:px-8">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-w-0 space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h1 className="text-4xl font-semibold tracking-tight text-white">Welcome back, Trainer! 👋</h1>
                    <p className="mt-2 text-lg text-slate-400">Here&apos;s what&apos;s happening with your collection.</p>
                  </div>
                  <div className="flex items-center gap-3 self-start">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                      Prices updated 2m ago
                    </div>
                    <button className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.05]">
                      Customize
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
                  <MetricCard
                    label="Portfolio Value"
                    value={formatMoney(kpis.portfolioValue, currency)}
                    delta="6.47% (7d)"
                    positive
                  />
                  <MetricCard
                    label="Realizable Value (Net)"
                    value={formatMoney(kpis.realizableValue, currency)}
                    delta="5.11% (7d)"
                    positive
                  />
                  <MetricCard
                    label="Total Invested"
                    value={formatMoney(kpis.totalInvested, currency)}
                    delta="0.00% (7d)"
                    positive={false}
                    neutral
                  />
                  <SectionCard className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
                          <span>ROI</span>
                          <IconInfo className="h-4 w-4" />
                        </div>
                        <div className="text-[2.1rem] font-semibold tracking-tight">{kpis.roi.toFixed(2)}%</div>
                        <div className="mt-2 flex items-center gap-2 text-sm text-emerald-400">
                          <IconTrendUp className="h-4 w-4" />
                          4.02% (7d)
                        </div>
                      </div>
                      <div>
                        <div className="mb-3 text-sm text-slate-400">Confidence Coverage</div>
                        <ConfidenceDonut />
                      </div>
                    </div>
                  </SectionCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
                  <SectionCard className="p-5">
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[1.75rem] font-semibold tracking-tight">Portfolio Value Over Time</h2>
                        <IconInfo className="h-4 w-4 text-slate-500" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1.5">
                        {(["7D", "1M", "3M", "6M", "1Y", "ALL"] as TimeRange[]).map((item) => (
                          <button
                            key={item}
                            className={`rounded-xl px-3 py-1.5 text-sm transition ${
                              item === range
                                ? "bg-[linear-gradient(90deg,#7c3aed,#a855f7)] text-white shadow-[0_8px_24px_rgba(124,58,237,0.35)]"
                                : "text-slate-400 hover:text-white"
                            }`}
                            onClick={() => setRange(item)}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>
                    <PortfolioChart points={PORTFOLIO_SERIES[range]} />
                  </SectionCard>

                  <SectionCard className="p-5">
                    <div className="mb-5 flex items-center gap-2">
                      <h2 className="text-[1.65rem] font-semibold tracking-tight">Price Sources Guide</h2>
                      <IconInfo className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="space-y-4">
                      {SOURCE_GUIDE.map((source, index) => (
                        <div key={source.name} className="flex items-start gap-3">
                          <div className={`mt-1 grid h-6 w-6 place-items-center rounded-full ${index < 2 ? "bg-sky-500/20 text-sky-300" : index < 4 ? "bg-amber-500/20 text-amber-300" : "bg-violet-500/20 text-violet-300"}`}>
                            {index < 2 ? "✓" : index < 4 ? "○" : "Σ"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-white">{source.name}</div>
                            <div className="text-sm text-slate-400">{source.desc}</div>
                          </div>
                          <StatusBadge tone={source.tone} label={source.badge} />
                        </div>
                      ))}
                    </div>
                    <button className="mt-6 flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200">
                      Learn more about our pricing methodology <IconChevronRight className="h-4 w-4" />
                    </button>
                  </SectionCard>
                </div>

                <SectionCard className="overflow-hidden p-5">
                  <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h2 className="text-[1.75rem] font-semibold tracking-tight">Top Collection Holdings</h2>
                    </div>
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                      <div className="grid gap-3 sm:grid-cols-4">
                        {[
                          "All Sets",
                          "All Conditions",
                          "All Types",
                        ].map((label) => (
                          <button key={label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                            {label}
                            <IconChevronDown className="h-4 w-4 text-slate-500" />
                          </button>
                        ))}
                        <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-400 sm:col-span-1 xl:min-w-[240px]">
                          <IconSearch className="h-4 w-4" />
                          Search in collection...
                        </div>
                      </div>
                      <button className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-200">
                        <IconClipboard className="h-4 w-4" />
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          <th className="pb-2 pr-4 font-medium">Card</th>
                          <th className="pb-2 pr-4 font-medium">Set</th>
                          <th className="pb-2 pr-4 font-medium">Condition</th>
                          <th className="pb-2 pr-4 font-medium">Qty</th>
                          <th className="pb-2 pr-4 font-medium">Cost Basis (Each)</th>
                          <th className="pb-2 pr-4 font-medium">Total Invested</th>
                          <th className="pb-2 pr-4 font-medium">Market Value (Each)</th>
                          <th className="pb-2 pr-4 font-medium">Total Value</th>
                          <th className="pb-2 text-right font-medium">ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((row) => (
                          <tr key={row.id} className="rounded-2xl bg-white/[0.02] text-slate-200">
                            <td className="rounded-l-2xl px-3 py-3">
                              <div className="flex items-center gap-3">
                                <img alt={row.name} src={row.image} className="h-12 w-12 rounded-xl border border-white/8 object-cover" />
                                <div>
                                  <div className="font-medium text-white">{row.name}</div>
                                  <div className="text-slate-400">{row.number}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-slate-300">{row.set}</td>
                            <td className="px-3 py-3">
                              <ConditionPill condition={row.condition} />
                            </td>
                            <td className="px-3 py-3 text-slate-300">{row.qty}</td>
                            <td className="px-3 py-3 text-slate-300">{formatMoney(row.costBasis, currency)}</td>
                            <td className="px-3 py-3 text-slate-300">{formatMoney(row.totalInvested, currency)}</td>
                            <td className="px-3 py-3 text-slate-300">{formatMoney(row.marketValue, currency)}</td>
                            <td className="px-3 py-3 text-slate-300">{formatMoney(row.totalValue, currency)}</td>
                            <td className="rounded-r-2xl px-3 py-3 text-right font-medium text-emerald-400">+{row.roi.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button className="mt-4 flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200">
                    View full collection <IconChevronRight className="h-4 w-4" />
                  </button>
                </SectionCard>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {BOTTOM_FEATURES.map((feature) => (
                    <SectionCard key={feature.title} className="p-5">
                      <div className="mb-4 text-4xl leading-none">{feature.icon}</div>
                      <div className="text-xl font-semibold tracking-tight text-white">{feature.title}</div>
                      <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-400">{feature.desc}</p>
                      <button className="mt-4 flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200">
                        {feature.cta} <IconChevronRight className="h-4 w-4" />
                      </button>
                    </SectionCard>
                  ))}
                </div>
              </div>

              <aside className="space-y-5">
                <SectionCard className="p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h2 className="text-[1.65rem] font-semibold tracking-tight">Watchlist (4)</h2>
                    <button className="text-sm font-medium text-violet-300 hover:text-violet-200">View all</button>
                  </div>
                  <div className="space-y-4">
                    {WATCHLIST.map((item) => (
                      <div key={item.name} className="flex items-center gap-3">
                        <img alt={item.name} src={item.image} className="h-14 w-14 rounded-xl border border-white/8 object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-white">{item.name}</div>
                          <div className="truncate text-sm text-slate-400">{item.subtitle}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-white">{formatMoney(item.priceCad, currency)}</div>
                          <div className={`text-sm ${item.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatPercent(item.change)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="mt-5 flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200">
                    Go to Watchlist <IconChevronRight className="h-4 w-4" />
                  </button>
                </SectionCard>

                <SectionCard className="p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h2 className="text-[1.65rem] font-semibold tracking-tight">Alerts</h2>
                    <button className="text-sm font-medium text-violet-300 hover:text-violet-200">View all</button>
                  </div>
                  <div className="space-y-4">
                    {ALERTS.map((alert, index) => (
                      <div key={alert.title} className="flex items-start gap-3">
                        <div className={`mt-1 grid h-9 w-9 place-items-center rounded-full ${index === 0 ? "bg-violet-500/18 text-violet-300" : index === 1 ? "bg-amber-500/18 text-amber-300" : "bg-sky-500/18 text-sky-300"}`}>
                          {index === 0 ? <IconBell className="h-4 w-4" /> : index === 1 ? <IconTrendUp className="h-4 w-4" /> : <IconStar className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white">{alert.title}</div>
                          <div className="text-sm text-slate-400">{alert.subtitle}</div>
                        </div>
                        <div className="text-right text-sm">
                          {alert.delta !== undefined ? (
                            <>
                              <div className={`font-medium ${alert.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatPercent(alert.delta)}</div>
                              <div className="text-slate-400">{alert.value}</div>
                            </>
                          ) : (
                            <>
                              <div className="font-medium text-white">{alert.value}</div>
                              <div className="text-slate-400">{alert.deltaLabel}</div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="mt-5 flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200">
                    Manage Alerts <IconChevronRight className="h-4 w-4" />
                  </button>
                </SectionCard>

                <SectionCard className="p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h2 className="text-[1.65rem] font-semibold tracking-tight">Recent Activity</h2>
                    <button className="text-sm font-medium text-violet-300 hover:text-violet-200">View all</button>
                  </div>
                  <div className="space-y-4">
                    {RECENT_ACTIVITY.map((item) => (
                      <div key={`${item.title}-${item.time}`} className="flex items-start gap-3">
                        <div className={`grid h-9 w-9 place-items-center rounded-full ${activityTone(item.tone)}`}>
                          {item.tone === "green" ? "+" : item.tone === "violet" ? "$" : item.tone === "amber" ? "★" : "▣"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-white">{item.title}</div>
                          <div className="text-sm text-slate-400">{item.subtitle}</div>
                        </div>
                        <div className="text-sm text-slate-500">{item.time}</div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function activityTone(tone: "green" | "violet" | "amber" | "blue") {
  return {
    green: "bg-emerald-500/18 text-emerald-300",
    violet: "bg-violet-500/18 text-violet-300",
    amber: "bg-amber-500/18 text-amber-300",
    blue: "bg-sky-500/18 text-sky-300",
  }[tone];
}

function MetricCard({
  label,
  value,
  delta,
  positive,
  neutral,
}: {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  neutral?: boolean;
}) {
  const spark = positive ? [12, 18, 16, 28, 34, 29, 21, 17, 23, 31, 27, 24, 42, 39, 44, 41] : [22, 25, 23, 26, 31, 28, 36, 34, 27, 30, 25, 24, 38, 43, 41, 44];
  return (
    <SectionCard className="p-5">
      <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
        <span>{label}</span>
        <IconInfo className="h-4 w-4" />
      </div>
      <div className="text-[2.05rem] font-semibold tracking-tight text-white">{value}</div>
      <div className={`mt-2 flex items-center gap-2 text-sm ${neutral ? "text-slate-400" : positive ? "text-emerald-400" : "text-rose-400"}`}>
        {neutral ? <span>—</span> : positive ? <IconTrendUp className="h-4 w-4" /> : <IconTrendDown className="h-4 w-4" />}
        {delta}
      </div>
      <div className="mt-4">
        <MiniSparkline values={spark} />
      </div>
    </SectionCard>
  );
}

function StatusBadge({ tone, label }: { tone: "green" | "amber" | "blue"; label: string }) {
  const styles = {
    green: "bg-emerald-500/18 text-emerald-300",
    amber: "bg-amber-500/18 text-amber-300",
    blue: "bg-sky-500/18 text-sky-300",
  }[tone];
  return <span className={`rounded-xl px-3 py-1 text-xs font-medium ${styles}`}>{label}</span>;
}

function ConditionPill({ condition }: { condition: "NM" | "LP" }) {
  return (
    <span
      className={`inline-flex rounded-xl px-2.5 py-1 text-xs font-semibold ${
        condition === "NM" ? "bg-emerald-500/18 text-emerald-300" : "bg-amber-500/18 text-amber-300"
      }`}
    >
      {condition}
    </span>
  );
}
