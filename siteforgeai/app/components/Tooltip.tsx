"use client";

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

type TooltipProps = {
  /** Visible hint text (keep concise). */
  label: string;
  children: ReactNode;
  /** `bottom` works better inside `overflow: hidden` cards (e.g. dashboard). */
  side?: "top" | "bottom";
  className?: string;
};

export function Tooltip({ label, children, side = "top", className = "" }: TooltipProps) {
  const id = useId();

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": id,
      })
    : (
        <span className="inline-flex" aria-describedby={id}>
          {children}
        </span>
      );

  const position =
    side === "top"
      ? "bottom-full left-1/2 mb-2 -translate-x-1/2"
      : "left-1/2 top-full mt-2 -translate-x-1/2";

  return (
    <span className={`group/sf-tooltip relative inline-flex max-w-full items-center ${className}`}>
      {trigger}
      <span
        id={id}
        role="tooltip"
        className={`sf-tooltip-bubble pointer-events-none absolute z-[200] w-max max-w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border px-2.5 py-1.5 text-left text-xs font-medium leading-snug text-balance shadow-lg transition duration-200 [opacity:0] [visibility:hidden] group-hover/sf-tooltip:[opacity:1] group-hover/sf-tooltip:[visibility:visible] group-focus-within/sf-tooltip:[opacity:1] group-focus-within/sf-tooltip:[visibility:visible] ${position} `}
        style={{
          borderColor: "var(--sf-border)",
          color: "var(--sf-text)",
          background: "var(--sf-card)",
          boxShadow: "0 8px 28px color-mix(in srgb, black 20%, transparent)",
        }}
      >
        {label}
      </span>
    </span>
  );
}
