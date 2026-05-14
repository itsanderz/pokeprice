"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for debugging; in production, send to telemetry
    console.error("PokePrice Error Boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto">
          <span className="text-2xl">⚠️</span>
        </div>
        <div>
          <h2 className="text-xl font-bold font-display mb-2">Something went wrong</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            We hit an unexpected error. This usually means a card had missing pricing data or the API was temporarily unreachable.
          </p>
        </div>
        {process.env.NODE_ENV === "development" && (
          <div className="text-left bg-surface-raised border border-border rounded-lg p-3 overflow-auto">
            <div className="text-[10px] font-mono text-rose-400 mb-1">{error.name}</div>
            <div className="text-[10px] font-mono text-text-secondary">{error.message}</div>
            {error.stack && (
              <pre className="text-[9px] font-mono text-text-tertiary mt-2 whitespace-pre-wrap">{error.stack}</pre>
            )}
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-primary text-bg text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg border border-border bg-surface-raised text-text-secondary text-sm font-semibold hover:text-text transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
