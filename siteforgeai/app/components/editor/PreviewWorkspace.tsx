"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePreviewPages } from "@/lib/generated-site/use-preview-pages";
import {
  claimLegacyProjectIntoUserKeys,
  readSessionUidFromLocalStorage,
  subscribeSessionUidChange,
} from "@/lib/siteforge-project-storage";

type Device = "pc" | "tablet" | "mobile";

export function PreviewWorkspace() {
  const router = useRouter();
  const [device, setDevice] = useState<Device>("pc");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { previewHtml, loadFromStorage } = usePreviewPages();

  useEffect(() => {
    const load = () => {
      const uid = readSessionUidFromLocalStorage();
      if (uid) claimLegacyProjectIntoUserKeys(uid);
      loadFromStorage();
    };
    load();
    return subscribeSessionUidChange(load);
  }, [loadFromStorage]);

  useEffect(() => {
    if (!iframeRef.current || !previewHtml) return;
    iframeRef.current.srcdoc = previewHtml;
  }, [previewHtml]);

  const width = device === "mobile" ? "390px" : device === "tablet" ? "820px" : "100%";

  const exitPreview = () => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("return");
    if (raw) {
      try {
        const u = new URL(raw, window.location.origin);
        if (u.origin === window.location.origin && u.pathname.startsWith("/")) {
          router.push(`${u.pathname}${u.search}${u.hash}`);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  };

  return (
    <section className="mx-auto max-w-[1240px] px-4 pb-16 pt-8 sm:px-6">
      <article className="sf-elevate rounded-2xl border p-3" style={{ borderColor: "var(--sf-border)" }}>
        <div className="mb-3 flex flex-col items-center gap-2">
          <p className="text-center text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
            Preview page — use the site navbar to switch pages
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={exitPreview}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
            >
              Exit preview
            </button>
            <div className="inline-flex items-center gap-1 rounded-full border p-1" style={{ borderColor: "var(--sf-border)" }}>
              {(["pc", "tablet", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDevice(d)}
                  className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
                  style={{
                    color: device === d ? "white" : "var(--sf-text-muted)",
                    background: device === d ? "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))" : "transparent",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 justify-center">
          <div
            className="min-w-0 overflow-auto rounded-xl border"
            style={{ borderColor: "var(--sf-border)", width, maxWidth: "100%", minHeight: "min(80vh, 90svh)" }}
          >
            <iframe
              ref={iframeRef}
              title="Preview page iframe"
              className="min-h-[min(80vh,90svh)] w-full min-w-0 border-0 bg-white"
              sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups"
            />
          </div>
        </div>
      </article>
    </section>
  );
}
