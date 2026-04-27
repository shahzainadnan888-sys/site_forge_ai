"use client";

import { useCallback, useRef } from "react";

type Props = { className?: string; children: React.ReactNode };

export function AmbientPointer({ className = "", children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty("--px", `${x}%`);
    el.style.setProperty("--py", `${y}%`);
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={onMove}
      style={
        {
          "--px": "50%",
          "--py": "40%",
        } as React.CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 transition-[opacity,background] duration-300 [mask-image:radial-gradient(50%_50%_at_50%_50%,#000,transparent)] max-md:hidden"
        style={{
          background: `radial-gradient(500px circle at var(--px) var(--py), color-mix(in srgb, var(--sf-accent-from) 14%, transparent), transparent 45%)`,
        }}
      />
      {children}
    </div>
  );
}
