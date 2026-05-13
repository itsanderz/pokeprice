"use client";

export default function Sparkline({ data, positive, hasRealData = true, className = "h-8" }: { data: number[]; positive: boolean; hasRealData?: boolean; className?: string }) {
  if (!hasRealData || data.length < 3) {
    return (
      <div className={`w-full ${className} flex items-center justify-center`}>
        <span className="text-[9px] font-mono text-text-tertiary uppercase tracking-wider">Insufficient data</span>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(" ");

  const color = positive ? "#34d399" : "#fb7185";
  const gradId = `sg-${positive}-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`w-full ${className}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points} 100,100`} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
