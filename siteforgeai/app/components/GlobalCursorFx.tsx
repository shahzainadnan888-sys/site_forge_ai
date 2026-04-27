"use client";

import { useEffect, useRef, useState } from "react";

const ACTION_TARGETS = "button, a, [data-glow]";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Pt = { x: number; y: number };

const TRAIL_MAX = 10;
const TRAIL_MIN_DIST = 8;
const TRAIL_THROTTLE_MS = 48;

export function GlobalCursorFx() {
  const [reduced, setReduced] = useState(false);
  const [isHoveringAction, setIsHoveringAction] = useState(false);
  const [isHoveringEditable, setIsHoveringEditable] = useState(false);
  const [trail, setTrail] = useState<Pt[]>([]);
  const [active, setActive] = useState(false);

  const posRef = useRef<Pt>({ x: 0, y: 0 });
  const targetRef = useRef<Pt>({ x: 0, y: 0 });
  const displayPosRef = useRef<Pt>({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const trailRafRef = useRef(0);
  const lastTrailAddRef = useRef(0);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(false);
  const hoverActionRef = useRef(false);
  const hoverEditableRef = useRef(false);

  const syncHoverRefs = (action: boolean, editable: boolean) => {
    if (action !== hoverActionRef.current) {
      hoverActionRef.current = action;
      setIsHoveringAction(action);
    }
    if (editable !== hoverEditableRef.current) {
      hoverEditableRef.current = editable;
      setIsHoveringEditable(editable);
    }
  };

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const applyPosToDom = (x: number, y: number) => {
    const el = cursorRef.current;
    if (!el) return;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  };

  useEffect(() => {
    const mm = (e: MouseEvent) => {
      const p = { x: e.clientX, y: e.clientY };
      posRef.current = p;
      targetRef.current = p;
      if (!activeRef.current) {
        setActive(true);
        displayPosRef.current = p;
        applyPosToDom(p.x, p.y);
      }
      if (e.target instanceof Element) {
        syncHoverRefs(
          e.target.matches(ACTION_TARGETS),
          e.target.getAttribute("contenteditable") === "true",
        );
      } else {
        syncHoverRefs(false, false);
      }
      if (trailRafRef.current) return;
      trailRafRef.current = requestAnimationFrame(() => {
        trailRafRef.current = 0;
        const now = performance.now();
        if (now - lastTrailAddRef.current < TRAIL_THROTTLE_MS) {
          return;
        }
        setTrail((prev) => {
          const last = prev[0];
          if (last && Math.hypot(p.x - last.x, p.y - last.y) < TRAIL_MIN_DIST) {
            return prev;
          }
          lastTrailAddRef.current = now;
          return [{ x: p.x, y: p.y }, ...prev].slice(0, TRAIL_MAX);
        });
      });
    };

    const onDocMouseOut = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      if (activeRef.current) {
        setActive(false);
      }
    };

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener("change", onMq);

    window.addEventListener("mousemove", mm, { passive: true });
    document.addEventListener("mouseout", onDocMouseOut, true);

    return () => {
      window.removeEventListener("mousemove", mm);
      document.removeEventListener("mouseout", onDocMouseOut, true);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  useEffect(() => {
    if (reduced) {
      return;
    }
    const tick = () => {
      const t = targetRef.current;
      const cur = displayPosRef.current;
      const k = 0.22;
      const next: Pt = {
        x: lerp(cur.x, t.x, k),
        y: lerp(cur.y, t.y, k),
      };
      displayPosRef.current = next;
      applyPosToDom(next.x, next.y);
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafRef.current);
    };
  }, [reduced]);

  if (reduced) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
      aria-hidden
    >
      {trail.map((p, i) => (
        <div
          key={i}
          className="sf-cursor-trail-dot"
          style={{ left: p.x, top: p.y, opacity: (i + 1) / (trail.length + 2) }}
        />
      ))}
      <div
        ref={cursorRef}
        className={[
          "sf-global-cursor",
          !active && "sf-global-cursor-hidden",
          isHoveringAction && "sf-global-cursor-action",
          isHoveringEditable && "sf-global-cursor-editable",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ left: posRef.current.x, top: posRef.current.y }}
      />
    </div>
  );
}
