"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EDIT_APPLY_CREDIT_COST } from "@/lib/credit-economy";
import {
  claimLegacyProjectIntoUserKeys,
  getProjectLocalStorageKeys,
  readSessionUidFromLocalStorage,
  subscribeSessionUidChange,
} from "@/lib/siteforge-project-storage";
import { emitSiteforgeSessionUpdate } from "@/lib/siteforge-credits";

const HYDRATE_DASHBOARD_KEY = "siteforge-hydrate-dashboard";
const SESSION_KEY = "siteforge-session";

type Device = "pc" | "tablet" | "mobile";

export function EditorWorkspace() {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [html, setHtml] = useState("");
  const [prompt, setPrompt] = useState("");
  const [instruction, setInstruction] = useState("");
  const [attachedImageDataUrl, setAttachedImageDataUrl] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [applyProgress, setApplyProgress] = useState(0);
  const [error, setError] = useState("");
  const [saveToast, setSaveToast] = useState("");
  const [device, setDevice] = useState<Device>("pc");

  useEffect(() => {
    const load = () => {
      const uid = readSessionUidFromLocalStorage();
      if (uid) {
        claimLegacyProjectIntoUserKeys(uid);
      }
      const { htmlKey, promptKey } = getProjectLocalStorageKeys(uid);
      setHtml(localStorage.getItem(htmlKey) || "");
      setPrompt(localStorage.getItem(promptKey) || "");
    };
    load();
    return subscribeSessionUidChange(load);
  }, []);

  useEffect(() => {
    if (!iframeRef.current || !html) return;
    iframeRef.current.srcdoc = html;
  }, [html]);

  useEffect(() => {
    if (!busy) {
      setApplyProgress(0);
      return;
    }
    setApplyProgress(8);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const target = Math.min(94, 8 + (elapsed / 35000) * 86);
      setApplyProgress((prev) => Math.max(prev, Math.round(target)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [busy]);

  const applyAiEdit = async () => {
    if (!instruction.trim() || !html.trim()) {
      setError("Enter what you want to change, then try again.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const liveHtml = iframeRef.current?.contentDocument?.documentElement?.outerHTML;
      const sourceHtml = liveHtml ? `<!DOCTYPE html>\n${liveHtml}` : html;
      const imageContext = attachedImageDataUrl
        ? `\n\nAttached image context:\n- The user attached an image in chat: "${attachedImageName || "uploaded-image"}".\n- If the user asks to add/replace/update an image, set that target <img> src exactly to this token: __UPLOADED_IMAGE__\n- Do not alter image source unless user asks for image changes.`
        : "";
      const res = await fetch("/api/edit-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: sourceHtml,
          instruction: `User request (make only the exact requested edits. Do not change anything else):\n${instruction.trim()}${imageContext}`,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; html: string; remainingCredits?: number }
        | { ok: false; error?: string; details?: string }
        | null;
      if (res.status === 402) {
        throw new Error("Insufficient credits. Buy credits on the Plans page to continue.");
      }
      if (!res.ok || !data || !("ok" in data) || !data.ok) {
        const err =
          data && "ok" in data && data.ok === false
            ? (data as { error?: string; details?: string })
            : null;
        const msg = err?.details
          ? `${err.error ?? "Error"}\n${err.details}`
          : err?.error;
        throw new Error(msg || "Unable to apply AI edit.");
      }
      let nextHtml = data.html;
      if (typeof data.remainingCredits === "number") {
        try {
          const raw = localStorage.getItem(SESSION_KEY);
          const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({
              ...parsed,
              credits: data.remainingCredits,
            })
          );
          emitSiteforgeSessionUpdate();
        } catch {
          // ignore
        }
      }
      if (attachedImageDataUrl) {
        nextHtml = nextHtml.replace(/__UPLOADED_IMAGE__/g, attachedImageDataUrl);
      }
      setApplyProgress(100);
      setHtml(nextHtml);
      const puid = readSessionUidFromLocalStorage();
      const { htmlKey } = getProjectLocalStorageKeys(puid);
      localStorage.setItem(htmlKey, nextHtml);
      setInstruction("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to apply AI edit.");
    } finally {
      setBusy(false);
    }
  };

  const handleUploadImage = async (file: File) => {
    setError("");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });
    setAttachedImageDataUrl(dataUrl);
    setAttachedImageName(file.name || "uploaded-image");
  };

  const saveCurrent = () => {
    const liveHtml = iframeRef.current?.contentDocument?.documentElement?.outerHTML;
    const next = liveHtml ? `<!DOCTYPE html>\n${liveHtml}` : html;
    setHtml(next);
    const puid = readSessionUidFromLocalStorage();
    const { htmlKey } = getProjectLocalStorageKeys(puid);
    localStorage.setItem(htmlKey, next);
    setSaveToast("Edits saved successfully.");
    window.setTimeout(() => setSaveToast(""), 2200);
  };

  const exitToBuilder = () => {
    saveCurrent();
    try {
      sessionStorage.setItem(HYDRATE_DASHBOARD_KEY, "1");
    } catch {
      // ignore
    }
    router.push("/dashboard");
  };

  const width = device === "mobile" ? "390px" : device === "tablet" ? "820px" : "100%";

  return (
    <section className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 sm:px-6">
      <article
        className="flex flex-col gap-4 rounded-2xl border p-3 lg:flex-row lg:items-stretch"
        style={{ borderColor: "var(--sf-border)" }}
      >
        <aside
          className="order-2 w-full shrink-0 lg:order-1 lg:sticky lg:top-24 lg:max-w-sm lg:self-start"
          style={{ minWidth: "min(100%, 20rem)" }}
        >
          <div
            className="flex h-full min-h-[280px] flex-col gap-3 rounded-2xl border p-4"
            style={{ borderColor: "var(--sf-border)", background: "color-mix(in srgb, var(--sf-card) 88%, transparent)" }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>
                Edit with AI
              </h2>
              <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:max-w-[16rem] sm:w-auto">
                <button
                  type="button"
                  onClick={saveCurrent}
                  className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                >
                  Save edit
                </button>
                <button
                  type="button"
                  onClick={exitToBuilder}
                  className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}
                >
                  Exit editor
                </button>
              </div>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--sf-text-muted)" }}>
              Describe the changes you want to make. Be specific. The current page (as shown in the preview) is
              sent to the model, which returns an updated version.
            </p>
            <label htmlFor="sf-editor-instruction" className="text-xs font-medium" style={{ color: "var(--sf-text)" }}>
              Describe the changes you want to make
            </label>
            <p className="text-[11px]" style={{ color: "var(--sf-text-muted)" }}>
              Describe the changes you want to make in detail text.
            </p>
            <textarea
              id="sf-editor-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder='Example: "Make the main heading larger and use a deep blue. Add a bit more space under the hero."'
              className="min-h-[160px] w-full flex-1 resize-y rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
            />
            <button
              type="button"
              onClick={() => void applyAiEdit()}
              disabled={busy}
              className="w-full rounded-full px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-70"
              style={{ background: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))" }}
            >
              {busy ? "Applying…" : "Apply changes"}
            </button>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--sf-text-muted)" }}>
              Each apply uses {EDIT_APPLY_CREDIT_COST} credits.
            </p>
            {busy ? (
              <div className="mt-2">
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ background: "color-mix(in srgb, var(--sf-border) 72%, transparent)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${applyProgress}%`,
                      background: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))",
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px]" style={{ color: "var(--sf-text-muted)" }}>
                  Applying edits... {applyProgress}%
                </p>
              </div>
            ) : null}
            {error ? <p className="text-xs text-red-500">{error}</p> : null}
            <div className="mt-1 border-t pt-3" style={{ borderColor: "var(--sf-border)" }}>
              <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
                <strong>Attach image to chat</strong> and describe how you want it changed/used. It will only be
                applied when you click <strong>Apply changes</strong>.
              </p>
              {attachedImageDataUrl ? (
                <p className="mt-1 text-[11px]" style={{ color: "var(--sf-text-muted)" }}>
                  Attached: <span className="font-semibold">{attachedImageName || "uploaded-image"}</span>
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 w-full rounded-full border px-4 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
              >
                {attachedImageDataUrl ? "Replace attached image" : "Attach image"}
              </button>
            </div>
          </div>
        </aside>

        <div className="order-1 min-w-0 flex-1 lg:order-2">
          <div className="mb-3">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                Use the <strong>edit panel</strong> (below on small screens, on the left on large screens) to
                describe the changes you want. The model updates your full page.
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--sf-text-muted)" }}>
                Original prompt: {prompt || "No prompt found."}
              </p>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <div
                className="inline-flex items-center gap-1 rounded-full border p-1"
                style={{ borderColor: "var(--sf-border)" }}
              >
                {(["pc", "tablet", "mobile"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDevice(d)}
                    className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
                    style={{
                      color: device === d ? "white" : "var(--sf-text-muted)",
                      background:
                        device === d
                          ? "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))"
                          : "transparent",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <a
                href="/preview?return=%2Feditor"
                className="rounded-full border px-4 py-2 text-xs font-semibold"
                style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
              >
                Preview page
              </a>
            </div>
          </div>
          <div className="flex min-w-0 justify-center">
            <div
              className="min-w-0 overflow-auto rounded-xl border"
              style={{ borderColor: "var(--sf-border)", width, maxWidth: "100%", minHeight: "min(78vh, 85svh)" }}
            >
              <iframe
                ref={iframeRef}
                title="Editor preview"
                className="min-h-[min(78vh,85svh)] w-full min-w-0 border-0 bg-white"
                sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups"
              />
            </div>
          </div>
        </div>
      </article>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleUploadImage(file);
        }}
      />
      {saveToast ? (
        <div className="pointer-events-none fixed right-4 top-20 z-[500]">
          <div
            className="rounded-xl border px-3 py-2 text-sm font-semibold shadow-xl"
            style={{
              borderColor: "color-mix(in srgb, var(--sf-accent-from) 35%, var(--sf-border))",
              background: "color-mix(in srgb, var(--sf-card) 92%, transparent)",
              color: "var(--sf-text)",
            }}
          >
            {saveToast}
          </div>
        </div>
      ) : null}
    </section>
  );
}
