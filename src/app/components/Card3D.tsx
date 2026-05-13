"use client";

import { useRef, useState, useCallback } from "react";

export default function Card3D({
  children,
  className,
  holographic = false,
}: {
  children: React.ReactNode;
  className?: string;
  holographic?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("");
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({ opacity: 0 });

  const handleMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rx = ((y - cy) / cy) * -10;
    const ry = ((x - cx) / cx) * 10;
    setTransform(`perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`);
    setGlareStyle({
      background: `radial-gradient(circle at ${(x / rect.width) * 100}% ${(y / rect.height) * 100}%, rgba(255,255,255,0.12) 0%, transparent 50%)`,
      opacity: 1,
    });
  }, []);

  const handleLeave = useCallback(() => {
    setTransform("perspective(1000px) rotateX(0deg) rotateY(0deg)");
    setGlareStyle({ opacity: 0 });
  }, []);

  return (
    <div
      ref={ref}
      className={`relative ${className || ""}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ transform, transition: "transform 0.15s ease-out" }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-xl transition-opacity duration-300"
        style={glareStyle}
      />
      {holographic && (
        <div className="pointer-events-none absolute -inset-px z-20 rounded-xl overflow-hidden">
          <div className="holographic-shimmer absolute inset-0" />
        </div>
      )}
      {children}
    </div>
  );
}
