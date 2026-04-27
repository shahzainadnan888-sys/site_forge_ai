"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const DURATION_MS = 550;

function getRouteLoadingText(pathname: string) {
  if (pathname === "/") return "Home page loading...";

  const name = pathname
    .replace(/^\/+/, "")
    .split("/")[0]
    .replace(/[-_]/g, " ")
    .trim();

  if (!name) return "Page loading...";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} loading...`;
}

export function GlobalPageLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState(getRouteLoadingText(pathname));
  const [exiting, setExiting] = useState(false);
  const rafRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    rafRef.current = null;
    hideTimerRef.current = null;
  };

  const runLoader = useCallback((durationMs: number) => {
    clearTimers();
    setVisible(true);
    setExiting(false);
    setProgress(0);
    setLoadingText(getRouteLoadingText(pathname));

    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = t - start;
      const ratio = Math.min(elapsed / durationMs, 1);
      setProgress(Math.round(ratio * 100));
      if (ratio < 1) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      setExiting(true);
      hideTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, 280);
    };

    rafRef.current = window.requestAnimationFrame(tick);
  }, [pathname]);

  useEffect(() => {
    runLoader(DURATION_MS);
    return () => clearTimers();
  }, [pathname, runLoader]);

  if (!visible) return null;

  return (
    <div
      className={`sf-page-loader ${exiting ? "sf-page-loader-exit" : "sf-page-loader-enter"}`}
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div className="sf-page-loader-particles" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="sf-page-loader-particle"
            style={{
              left: `${8 + ((i * 11) % 84)}%`,
              top: `${12 + ((i * 17) % 74)}%`,
              animationDelay: `${(i % 6) * 0.25}s`,
              animationDuration: `${5.4 + (i % 4) * 0.7}s`,
            }}
          />
        ))}
      </div>

      <div className="sf-page-loader-card">
        <p className="sf-page-loader-logo">SiteForge AI</p>
        <p className="sf-page-loader-text">{loadingText}</p>

        <div className="sf-page-loader-spinner-wrap" aria-hidden>
          <span className="sf-page-loader-spinner-glow" />
          <span className="sf-page-loader-spinner" />
        </div>

        <div className="sf-page-loader-progress-wrap">
          <div
            className="sf-page-loader-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="sf-page-loader-percent">{progress}%</p>
      </div>
    </div>
  );
}
