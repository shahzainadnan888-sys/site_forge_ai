"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  siteUrl: string;
  subUrl?: string;
};

export function PublishSuccessModal({ open, onClose, siteUrl, subUrl }: Props) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ background: "rgba(6,7,13,0.55)" }}
      role="dialog"
      aria-modal
      aria-labelledby="sf-publish-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border p-5 shadow-2xl"
        style={{
          borderColor: "var(--sf-border)",
          background: "var(--sf-card)",
        }}
      >
        <h2
          id="sf-publish-title"
          className="text-lg font-semibold"
          style={{ color: "var(--sf-text)" }}
        >
          Your site is live 🚀
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--sf-text-muted)" }}>
          People can open your published page with the link below. Re-publishing updates the same URL.
        </p>
        <div className="mt-4 break-all rounded-xl border p-2.5 text-xs" style={{ borderColor: "var(--sf-border)" }}>
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="font-medium" style={{ color: "var(--sf-accent-from)" }}>
            {siteUrl}
          </a>
        </div>
        {subUrl ? (
          <p className="mt-2 text-[11px]" style={{ color: "var(--sf-text-muted)" }}>
            With DNS: <span className="break-all">{subUrl}</span>
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.open(siteUrl, "_blank", "noopener,noreferrer")}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-full px-3 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))" }}
          >
            Open website
          </button>
          <button
            type="button"
            onClick={() => void copy(siteUrl)}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-full border px-3 text-sm font-semibold"
            style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-full border py-2 text-sm font-medium"
          style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
