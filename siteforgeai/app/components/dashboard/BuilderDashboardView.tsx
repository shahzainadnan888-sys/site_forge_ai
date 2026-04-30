"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Tooltip } from "@/app/components/Tooltip";
import { PublishSuccessModal } from "@/app/components/dashboard/PublishSuccessModal";
import {
  emitSiteforgeSessionUpdate,
  SITEFORGE_SESSION_EVENT,
} from "@/lib/siteforge-credits";
import { DEFAULT_SIGNUP_CREDITS, GENERATION_CREDIT_COST } from "@/lib/credit-economy";
import { isMultiPageWebsiteRequest, MULTI_PAGE_NOT_ALLOWED } from "@/lib/generate-prompt-guards";
import { freeCreditsBlockedMessageMultiline } from "@/lib/free-credit-blocked-message";
import { enforceSinglePageAnchors } from "@/lib/sanitize-generated-html";
import {
  claimLegacyProjectIntoUserKeys,
  getProjectLocalStorageKeys,
  readSessionUidFromLocalStorage,
  subscribeSessionUidChange,
} from "@/lib/siteforge-project-storage";

const SESSION_KEY = "siteforge-session";
const DEFAULT_DASHBOARD_PROMPT =
  "Build a modern SaaS landing page for a productivity app with hero, feature list, testimonials, and clear pricing cards.";
const MIN_CREDITS_TO_GENERATE = GENERATION_CREDIT_COST;
type Stage = "idle" | "generating" | "ready";
type PreviewDevice = "pc" | "tablet" | "mobile";
type FontPreset = "Inter" | "Poppins" | "Manrope" | "Montserrat" | "Playfair Display";
type SelectedKind = "none" | "text" | "image" | "navbar" | "other";

function ImagePlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M4 5.5A1.5 1.5 0 015.5 4h7A1.5 1.5 0 0114 5.5v7a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 014 12.5v-7z" />
      <path d="M5.5 12l2.7-2.7a1 1 0 011.4 0l2.9 2.9" />
      <path d="M10.5 8.2h.01" />
      <path d="M18 8v8m-4-4h8" />
    </svg>
  );
}

function readSessionCredits(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { credits?: number };
    return typeof parsed.credits === "number" ? parsed.credits : 0;
  } catch {
    return 0;
  }
}

function readHasSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { email?: string };
    return typeof parsed.email === "string" && parsed.email.length > 0;
  } catch {
    return false;
  }
}

function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

async function syncCreditsFromServer(): Promise<number | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as
      | {
          ok: true;
          user: {
            uid: string;
            credits: number;
            fullName: string;
            email: string;
            avatarDataUrl?: string;
            freeCreditsBlocked?: boolean;
          };
        }
      | { ok: false; error?: string }
      | null;
    if (!res.ok || !data || !data.ok) return null;
    const currentRaw = localStorage.getItem(SESSION_KEY);
    const current = currentRaw ? (JSON.parse(currentRaw) as Record<string, unknown>) : {};
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        ...current,
        uid: data.user.uid,
        fullName: data.user.fullName,
        email: data.user.email,
        credits: data.user.credits,
        freeCreditsBlocked: data.user.freeCreditsBlocked === true,
        ...(data.user.avatarDataUrl ? { avatarDataUrl: data.user.avatarDataUrl } : {}),
      })
    );
    emitSiteforgeSessionUpdate();
    return data.user.credits;
  } catch {
    return null;
  }
}

export function BuilderDashboardView() {
  const router = useRouter();
  const [credits, setCredits] = useState(0);
  const [hasSession, setHasSession] = useState(false);
  const [creditGateMessage, setCreditGateMessage] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [generationElapsedSec, setGenerationElapsedSec] = useState(0);
  const [prompt, setPrompt] = useState(DEFAULT_DASHBOARD_PROMPT);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("pc");
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [draftHtml, setDraftHtml] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishSubmitting, setPublishSubmitting] = useState(false);
  const [publishResultUrl, setPublishResultUrl] = useState("");
  const [publishName, setPublishName] = useState("");
  const [immersivePreview, setImmersivePreview] = useState(false);
  const [previewModeOn, setPreviewModeOn] = useState(true);
  const [themeColorA, setThemeColorA] = useState("#7c3aed");
  const [themeColorB, setThemeColorB] = useState("#06b6d4");
  const [fontPreset, setFontPreset] = useState<FontPreset>("Inter");
  const [selectedKind, setSelectedKind] = useState<SelectedKind>("none");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [editorMessage, setEditorMessage] = useState("");
  const [showNavEditor, setShowNavEditor] = useState(false);
  const [navLinksDraft, setNavLinksDraft] = useState("Home\nFeatures\nAbout\nPricing\nContact");
  const [logoTextDraft, setLogoTextDraft] = useState("Brand");
  const [pendingImageUrl, setPendingImageUrl] = useState("");
  const [promptReferenceImageDataUrl, setPromptReferenceImageDataUrl] = useState<string | null>(null);
  const [promptReferenceImageName, setPromptReferenceImageName] = useState("");
  const [editorTab, setEditorTab] = useState<"content" | "design">("content");
  const [toolbarPos, setToolbarPos] = useState({ x: 80, y: 80 });
  const publishDisabled =
    !hasSession || stage !== "ready" || publishSubmitting || publishName.trim().length < 3;
  const previewWrapperRef = useRef<HTMLDivElement>(null);
  const toolbarDragRef = useRef<{ dragging: boolean; dx: number; dy: number }>({
    dragging: false,
    dx: 0,
    dy: 0,
  });
  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const promptImageInputRef = useRef<HTMLInputElement>(null);
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const fullscreenFrameRef = useRef<HTMLIFrameElement>(null);
  /** Only reset the generate screen when the signed-in user (or sign-out) changes — not on every session/credits sync. */
  const lastScopeKeyForEntryEffect = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setCredits(readSessionCredits());
      setHasSession(readHasSession());
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener(SITEFORGE_SESSION_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener(SITEFORGE_SESSION_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      const next = await syncCreditsFromServer();
      if (typeof next === "number") setCredits(next);
    })();
  }, []);

  useEffect(() => {
    const onDashboardEntry = () => {
      try {
        const uid = readSessionUidFromLocalStorage();
        if (uid) {
          claimLegacyProjectIntoUserKeys(uid);
        }
        const scopeKey = uid ?? "__signed_out__";
        if (lastScopeKeyForEntryEffect.current === scopeKey) {
          return;
        }
        lastScopeKeyForEntryEffect.current = scopeKey;
        const { htmlKey, promptKey } = getProjectLocalStorageKeys(uid);
        const storedHtml = localStorage.getItem(htmlKey) || "";
        const storedPrompt = localStorage.getItem(promptKey) || "";
        if (storedHtml.includes("</html>")) {
          const safeStoredHtml = enforceSinglePageAnchors(storedHtml);
          setGeneratedHtml(safeStoredHtml);
          setDraftHtml(safeStoredHtml);
          setPrompt(storedPrompt || DEFAULT_DASHBOARD_PROMPT);
          setStage("ready");
          setIsEditorMode(false);
          setImmersivePreview(false);
          setGenerationError("");
          return;
        }
        setStage("idle");
        setGeneratedHtml("");
        setPrompt(DEFAULT_DASHBOARD_PROMPT);
        setGenerationError("");
      } catch {
        // Ignore localStorage hydration issues.
      }
    };
    onDashboardEntry();
    return subscribeSessionUidChange(onDashboardEntry);
  }, []);

  useEffect(() => {
    if (stage !== "ready" || !generatedHtml.includes("</html>")) return;
    try {
      const uid = readSessionUidFromLocalStorage();
      const { htmlKey, promptKey } = getProjectLocalStorageKeys(uid);
      localStorage.setItem(htmlKey, generatedHtml);
      localStorage.setItem(promptKey, prompt);
    } catch {
      // ignore localStorage persistence failures
    }
  }, [stage, generatedHtml, prompt]);

  /** After /editor, restore “Website ready” (prompt + actions) from localStorage. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem("siteforge-hydrate-dashboard") !== "1") return;
      sessionStorage.removeItem("siteforge-hydrate-dashboard");
      const uid = readSessionUidFromLocalStorage();
      const { htmlKey, promptKey } = getProjectLocalStorageKeys(uid);
      const storedHtml = localStorage.getItem(htmlKey);
      const storedPrompt = localStorage.getItem(promptKey);
      if (storedHtml?.includes("</html>")) {
        const safeStoredHtml = enforceSinglePageAnchors(storedHtml);
        setGeneratedHtml(safeStoredHtml);
        if (storedPrompt) setPrompt(storedPrompt);
        setStage("ready");
        setIsEditorMode(false);
        setImmersivePreview(false);
        setShowNavEditor(false);
        setSelectedKind("none");
        setSelectedLabel("");
        setEditorMessage("");
      }
    } catch {
      // ignore
    }
  }, []);

  const canGenerate = credits >= MIN_CREDITS_TO_GENERATE;

  useEffect(() => {
    if (canGenerate) setCreditGateMessage("");
  }, [canGenerate]);

  useEffect(() => {
    if (stage !== "generating") return;
    const startedAt = Date.now();
    setGenerationElapsedSec(0);
    const timer = window.setInterval(() => {
      setGenerationElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [stage]);

  const dispatchParticles = () => {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent("sf-mode-switch"));
    });
  };

  const getPreviewDoc = () => previewFrameRef.current?.contentDocument ?? null;

  const clearSelection = (doc: Document) => {
    doc.querySelectorAll("[data-sf-selected='true']").forEach((el) => {
      const node = el as HTMLElement;
      node.removeAttribute("data-sf-selected");
      node.style.outline = "";
      node.style.outlineOffset = "";
    });
  };

  const inferKind = (el: HTMLElement): SelectedKind => {
    const tag = el.tagName.toLowerCase();
    if (tag === "img") return "image";
    if (tag === "nav" || tag === "header") return "navbar";
    if (/^(p|span|h1|h2|h3|h4|h5|h6|a|li|button|strong|em)$/.test(tag)) return "text";
    return "other";
  };

  const bindVisualSelection = (doc: Document) => {
    const root = doc.documentElement as HTMLElement;
    if (root.dataset.sfSelectionBound === "1") return;
    root.dataset.sfSelectionBound = "1";
    doc.addEventListener("click", (event) => {
      if (!isEditorMode) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      clearSelection(doc);
      target.setAttribute("data-sf-selected", "true");
      target.style.outline = "2px solid #60a5fa";
      target.style.outlineOffset = "2px";
      const kind = inferKind(target);
      setSelectedKind(kind);
      setSelectedLabel(target.tagName.toLowerCase());
      const iframeRect = previewFrameRef.current?.getBoundingClientRect();
      const wrapperRect = previewWrapperRef.current?.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (iframeRect && wrapperRect) {
        const toolbarW = Math.min(290, Math.max(160, wrapperRect.width - 24));
        const nextX = Math.max(
          12,
          Math.min(
            targetRect.left - iframeRect.left + 12,
            Math.max(12, wrapperRect.width - toolbarW - 12)
          )
        );
        const nextY = Math.max(
          12,
          Math.min(
            targetRect.top - iframeRect.top - 52,
            Math.max(12, wrapperRect.height - 70)
          )
        );
        setToolbarPos({ x: nextX, y: nextY });
      }
      setEditorMessage("");
    });
  };

  const applyEditorStylesToFrame = (frame: HTMLIFrameElement | null) => {
    const doc = frame?.contentDocument;
    if (!doc) return;
    const root = doc.documentElement;
    if (!root) return;
    root.style.setProperty("--sf-theme-a", themeColorA);
    root.style.setProperty("--sf-theme-b", themeColorB);

    let styleTag = doc.getElementById("sf-editor-style") as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = doc.createElement("style");
      styleTag.id = "sf-editor-style";
      doc.head.appendChild(styleTag);
    }
    // Do not override generated page typography or nav/hero backgrounds here — that made
    // the dashboard iframe look different from /preview and /editor (raw HTML only).
    styleTag.textContent = `
      :root {
        --sf-theme-a: ${themeColorA};
        --sf-theme-b: ${themeColorB};
      }
      .btn, button, [role="button"], a.cta, .cta, .button {
        transition: all .25s ease !important;
      }
      .btn:hover, button:hover, [role="button"]:hover, a.cta:hover, .cta:hover, .button:hover {
        filter: brightness(1.06);
      }
      [data-sf-selected="true"] {
        outline: 2px solid #60a5fa !important;
        outline-offset: 2px !important;
      }
    `;

    // Visual (WYSIWYG) editor mode: edit directly in rendered page, not raw HTML text.
    try {
      doc.designMode = isEditorMode ? "on" : "off";
    } catch {
      // Ignore designMode failures for restrictive documents.
    }
    if (doc.body) {
      doc.body.style.outline = isEditorMode ? "2px dashed rgba(124,58,237,0.45)" : "none";
      doc.body.style.outlineOffset = isEditorMode ? "8px" : "0";
    }
    if (isEditorMode) bindVisualSelection(doc);
  };

  useEffect(() => {
    const html = isEditorMode ? draftHtml : generatedHtml;
    if (!html) return;
    const safeHtml = enforceSinglePageAnchors(html);
    if (previewFrameRef.current) {
      previewFrameRef.current.srcdoc = safeHtml;
    }
    if (immersivePreview && fullscreenFrameRef.current) {
      fullscreenFrameRef.current.srcdoc = safeHtml;
    }
  }, [generatedHtml, draftHtml, isEditorMode, immersivePreview]);

  useEffect(() => {
    applyEditorStylesToFrame(previewFrameRef.current);
    applyEditorStylesToFrame(fullscreenFrameRef.current);
  }, [themeColorA, themeColorB, fontPreset, generatedHtml, draftHtml, isEditorMode]);

  useEffect(() => {
    if (!generatedHtml) {
      setDraftHtml("");
      return;
    }
    setDraftHtml(generatedHtml);
  }, [generatedHtml]);

  const handleGenerateWebsite = async () => {
    if (stage === "generating") return;
    if (!canGenerate) return;
    if (isMultiPageWebsiteRequest(prompt)) {
      setGenerationError(MULTI_PAGE_NOT_ALLOWED);
      return;
    }
    setGenerationError("");
    setPublishError("");
    setStage("generating");
    setProgress(0);
    setGeneratedHtml("");
    setIsEditorMode(false);
    dispatchParticles();
    setProgress(2);

    // Deduct in the UI as soon as generation starts; the API charges in the same way on request start.
    setCredits((c) => Math.max(0, c - MIN_CREDITS_TO_GENERATE));
    try {
      const rawSession = localStorage.getItem(SESSION_KEY);
      if (rawSession) {
        const parsed = JSON.parse(rawSession) as { credits?: number; [k: string]: unknown };
        if (typeof parsed.credits === "number") {
          localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({
              ...parsed,
              credits: Math.max(0, parsed.credits - MIN_CREDITS_TO_GENERATE),
            })
          );
          emitSiteforgeSessionUpdate();
        }
      }
    } catch {
      // ignore local storage parse errors
    }

    try {
      const res = await fetch("/api/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, ...(promptReferenceImageDataUrl ? { referenceImageDataUrl: promptReferenceImageDataUrl } : {}) }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string; details?: string } | null;
        throw new Error(err?.details ? `${err.error}\n${err.details}` : err?.error || "Could not generate website.");
      }

      const contentType = res.headers.get("Content-Type") || "";
      let finalHtml = "";
      let remainingCredits: number | undefined;

      if (contentType.includes("application/x-ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            const event = JSON.parse(line) as
              | { type: "progress"; progress: number }
              | { type: "result"; html: string; remainingCredits?: number }
              | { type: "error"; error?: string };

            if (event.type === "progress") {
              setProgress((prev) => Math.max(prev, Math.min(100, Math.floor(event.progress))));
              continue;
            }
            if (event.type === "error") {
              throw new Error(event.error || "Generation failed.");
            }
            if (event.type === "result") {
              finalHtml = event.html;
              remainingCredits = event.remainingCredits;
            }
          }
        }
      } else {
        const data = (await res.json().catch(() => null)) as
          | { ok: true; html: string; remainingCredits?: number }
          | { ok: false; error?: string; details?: string }
          | null;
        if (!data || !("ok" in data) || !data.ok) {
          const err = data && "details" in data && data.details ? `${data.error}\n${data.details}` : data?.error;
          throw new Error(err || "Could not generate website.");
        }
        finalHtml = data.html;
        remainingCredits = data.remainingCredits;
      }

      if (!finalHtml.includes("<style") || !finalHtml.includes("</html>")) {
        throw new Error("Generated output is not valid full website HTML.");
      }
      if (typeof remainingCredits === "number") {
        setCredits(remainingCredits);
        try {
          const raw = localStorage.getItem(SESSION_KEY);
          const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          localStorage.setItem(
            SESSION_KEY,
            JSON.stringify({
              ...parsed,
              credits: remainingCredits,
            })
          );
          emitSiteforgeSessionUpdate();
        } catch {
          // ignore local cache errors
        }
      }
      setGeneratedHtml(enforceSinglePageAnchors(finalHtml));
      const uid = readSessionUidFromLocalStorage();
      const { htmlKey, promptKey } = getProjectLocalStorageKeys(uid);
      localStorage.setItem(htmlKey, finalHtml);
      localStorage.setItem(promptKey, prompt);
      setProgress(100);
      setPreviewDevice("pc");
      setPreviewModeOn(true);
      setImmersivePreview(false);
      setStage("ready");
      setGenerationElapsedSec(0);
      setPromptReferenceImageDataUrl(null);
      setPromptReferenceImageName("");
      dispatchParticles();
    } catch (error) {
      void (async () => {
        const next = await syncCreditsFromServer();
        if (typeof next === "number") setCredits(next);
      })();
      setGenerationError(error instanceof Error ? error.message : "Generation failed.");
      setStage("idle");
      setProgress(0);
      setGenerationElapsedSec(0);
    }
  };

  const handleUploadPromptReferenceImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setGenerationError("Please upload an image file only.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });
    setPromptReferenceImageDataUrl(dataUrl);
    setPromptReferenceImageName(file.name || "reference-image");
    setGenerationError("");
  };

  const handleGenerateClick = () => {
    if (stage === "generating") return;
    if (!canGenerate) {
      let blocked = false;
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const p = JSON.parse(raw) as { freeCreditsBlocked?: boolean };
          blocked = p.freeCreditsBlocked === true;
        }
      } catch {
        blocked = false;
      }
      if (hasSession && blocked) {
        setCreditGateMessage(freeCreditsBlockedMessageMultiline());
      } else {
        setCreditGateMessage(
          hasSession
            ? "Buy credits on the Plans page: /plans"
            : "Please first login to generate."
        );
      }
      return;
    }
    setCreditGateMessage("");
    void handleGenerateWebsite();
  };

  const handleEnterEditor = () => {
    if (!generatedHtml) return;
    setDraftHtml(generatedHtml);
    setIsEditorMode(true);
    setSelectedKind("none");
    setSelectedLabel("");
    setEditorTab("content");
    setEditorMessage("Editor is active. Click any element to edit.");
  };

  const handleExitEditor = () => {
    setIsEditorMode(false);
    if (generatedHtml) setDraftHtml(generatedHtml);
    setShowNavEditor(false);
    setSelectedKind("none");
    setSelectedLabel("");
    setEditorMessage("");
  };

  const handleSaveEditor = () => {
    if (!generatedHtml) return;
    const liveDoc = previewFrameRef.current?.contentDocument;
    if (liveDoc?.documentElement?.outerHTML) {
      setGeneratedHtml(enforceSinglePageAnchors(`<!DOCTYPE html>\n${liveDoc.documentElement.outerHTML}`));
    } else {
      setGeneratedHtml(enforceSinglePageAnchors(draftHtml));
    }
    setIsEditorMode(false);
    setShowNavEditor(false);
    setEditorMessage("Changes saved.");
  };

  const applyNavPanelChanges = () => {
    const doc = getPreviewDoc();
    if (!doc) return;
    const nav = (doc.querySelector("nav") || doc.querySelector("header")) as HTMLElement | null;
    if (!nav) {
      setEditorMessage("No navigation bar found in this website.");
      return;
    }
    const logoTarget =
      (nav.querySelector(".logo") as HTMLElement | null) ||
      (nav.querySelector("h1,h2,strong,a,span") as HTMLElement | null);
    if (logoTarget && logoTextDraft.trim()) {
      logoTarget.textContent = logoTextDraft.trim();
    }
    const names = navLinksDraft
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 8);
    const links = [...nav.querySelectorAll("a")];
    links.forEach((a, idx) => {
      const name = names[idx];
      if (!name) return;
      (a as HTMLAnchorElement).textContent = name;
      (a as HTMLAnchorElement).setAttribute("href", `#${name.toLowerCase().replace(/\s+/g, "-")}`);
    });
    setShowNavEditor(false);
    setEditorMessage("Navigation bar updated.");
  };

  const handleEditSelectedImage = () => {
    const doc = getPreviewDoc();
    if (!doc) return;
    const selected = doc.querySelector("[data-sf-selected='true']") as HTMLElement | null;
    if (!selected || selected.tagName.toLowerCase() !== "img") {
      setEditorMessage("Select an image first.");
      return;
    }
    const next = pendingImageUrl.trim();
    if (!next) {
      setEditorMessage("Paste image URL first.");
      return;
    }
    (selected as HTMLImageElement).src = next;
    setEditorMessage("Image replaced.");
  };

  const handleUploadSelectedImage = async (file: File) => {
    const doc = getPreviewDoc();
    if (!doc) return;
    const selected = doc.querySelector("[data-sf-selected='true']") as HTMLElement | null;
    if (!selected || selected.tagName.toLowerCase() !== "img") {
      setEditorMessage("Select an image first.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });
    (selected as HTMLImageElement).src = dataUrl;
    setEditorMessage("Local image uploaded.");
  };

  const handleRegenerateSelectedImage = () => {
    const doc = getPreviewDoc();
    if (!doc) return;
    const selected = doc.querySelector("[data-sf-selected='true']") as HTMLElement | null;
    if (!selected || selected.tagName.toLowerCase() !== "img") {
      setEditorMessage("Select an image first.");
      return;
    }
    const img = selected as HTMLImageElement;
    const seed = encodeURIComponent(`website-${Date.now()}`);
    img.src = `https://picsum.photos/seed/${seed}/1200/900`;
    setEditorMessage("Image regenerated.");
  };

  const onToolbarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    toolbarDragRef.current.dragging = true;
    toolbarDragRef.current.dx = e.clientX - toolbarPos.x;
    toolbarDragRef.current.dy = e.clientY - toolbarPos.y;
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!toolbarDragRef.current.dragging) return;
      const wrapperRect = previewWrapperRef.current?.getBoundingClientRect();
      if (!wrapperRect) return;
      const nx = e.clientX - toolbarDragRef.current.dx;
      const ny = e.clientY - toolbarDragRef.current.dy;
      const tw = Math.min(290, Math.max(160, wrapperRect.width - 24));
      const clampedX = Math.max(8, Math.min(nx, wrapperRect.width - tw - 8));
      const clampedY = Math.max(8, Math.min(ny, wrapperRect.height - 72));
      setToolbarPos({ x: clampedX, y: clampedY });
    };
    const onUp = () => {
      toolbarDragRef.current.dragging = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handlePublish = async () => {
    if (!hasSession || stage !== "ready") return;
    const html = ensurePreviewHtml();
    if (!html.trim() || !/<\/html>/i.test(html)) {
      setPublishError("Generate a website first, then publish.");
      return;
    }
    setPublishError("");
    setPublishSubmitting(true);
    try {
      const uid = readSessionUidFromLocalStorage();
      const normalizedPublishName = publishName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!normalizedPublishName) {
        throw new Error("Please enter username or website name.");
      }
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          html,
          username: normalizedPublishName,
          ...(uid ? { userId: uid } : {}),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok: true;
            success?: true;
            username?: string;
            url: string;
            message?: string;
          }
        | { ok: false; error?: string }
        | null;
      if (!res.ok || !data || !data.ok) {
        const msg = data && "error" in data ? data.error : "Publish failed.";
        throw new Error(msg || "Publish failed.");
      }
      setPublishResultUrl(data.url);
      setPublishModalOpen(true);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setPublishSubmitting(false);
    }
  };

  const ensurePreviewHtml = () => {
    const frameSrcDoc = previewFrameRef.current?.srcdoc?.trim();
    if (frameSrcDoc) return enforceSinglePageAnchors(frameSrcDoc);
    const currentHtml = (isEditorMode ? draftHtml : generatedHtml)?.trim();
    if (currentHtml) return enforceSinglePageAnchors(currentHtml);
    const previewDoc = previewFrameRef.current?.contentDocument;
    if (previewDoc?.documentElement?.outerHTML) {
      return enforceSinglePageAnchors(`<!DOCTYPE html>${previewDoc.documentElement.outerHTML}`);
    }
    return "";
  };

  useEffect(() => {
    if (!immersivePreview) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const unlockScroll = () => {
      document.body.style.overflow = prev;
    };
    // Ensure fullscreen frame always receives the currently visible preview content.
    const htmlForPreview = ensurePreviewHtml();
    if (htmlForPreview && fullscreenFrameRef.current) {
      fullscreenFrameRef.current.srcdoc = htmlForPreview;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImmersivePreview(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pagehide", unlockScroll);
    return () => {
      window.removeEventListener("pagehide", unlockScroll);
      unlockScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [immersivePreview]);

  const previewCanvasWidth =
    previewDevice === "mobile" ? "375px" : previewDevice === "tablet" ? "768px" : "100%";

  return (
    <section className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6 sm:pb-24">
      {(stage === "idle" || stage === "generating") && (
        <div className="relative min-h-[min(680px,90svh)] overflow-hidden rounded-3xl border p-4 sm:min-h-[680px] sm:p-8" style={{ borderColor: "var(--sf-border)", background: "color-mix(in srgb, var(--sf-card) 72%, transparent)" }}>
          <div className="absolute inset-0 blur-md" aria-hidden>
            <div className="sf-floating-thumb left-8 top-10" />
            <div className="sf-floating-thumb right-16 top-24 sf-thumb-delay-2" />
            <div className="sf-floating-thumb bottom-20 left-24 sf-thumb-delay-3" />
            <div className="sf-floating-thumb bottom-16 right-10 sf-thumb-delay-4" />
          </div>

          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-bold sm:text-4xl" style={{ color: "var(--sf-text)" }}>
              AI Website Generator
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base" style={{ color: "var(--sf-text-muted)" }}>
              Describe your website and generate a polished draft in seconds.
            </p>
            <div className="mx-auto mt-6 max-w-2xl">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="h-36 w-full rounded-2xl border bg-transparent px-4 py-3 text-sm outline-none sm:text-base"
                style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                placeholder="Type your website prompt..."
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => promptImageInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                  title="Upload design reference image"
                >
                  <ImagePlusIcon />
                  <span>Add design image</span>
                </button>
                {promptReferenceImageName ? (
                  <span className="truncate text-xs" style={{ color: "var(--sf-text-muted)" }}>
                    {promptReferenceImageName}
                  </span>
                ) : null}
              </div>
              <input
                ref={promptImageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleUploadPromptReferenceImage(file);
                }}
              />
            </div>

            {stage === "idle" && (
              <div className="mx-auto mt-6 flex w-full max-w-2xl flex-col items-center">
                <Tooltip
                  side="bottom"
                  className="w-full max-w-md justify-center sm:w-auto"
                  label={
                    canGenerate
                      ? `Uses ${MIN_CREDITS_TO_GENERATE} credits to generate a draft from your description.`
                      : `You need at least ${MIN_CREDITS_TO_GENERATE} credits to generate a website.`
                  }
                >
                  <button
                    type="button"
                    onClick={handleGenerateClick}
                    aria-disabled={!canGenerate}
                    className={`sf-cta-glow inline-flex h-11 w-full max-w-md items-center justify-center rounded-full px-7 text-sm font-semibold text-white sm:w-auto ${
                      !canGenerate ? "cursor-not-allowed opacity-45 grayscale-[0.2]" : ""
                    }`}
                    style={{
                      background: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))",
                    }}
                  >
                    Generate Website
                  </button>
                </Tooltip>
                {creditGateMessage && (
                  <p
                    className="mt-7 whitespace-pre-line rounded-lg border px-3 py-2 text-left text-sm"
                    style={{
                      borderColor: "rgba(239,68,68,0.35)",
                      color: "#ef4444",
                      background: "color-mix(in srgb, #ef4444 8%, transparent)",
                    }}
                    role="alert"
                  >
                    {creditGateMessage}
                  </p>
                )}
                {generationError && (
                  <p
                    className="mt-3 rounded-lg border px-3 py-2 text-left text-sm"
                    style={{
                      borderColor: "rgba(239,68,68,0.35)",
                      color: "#ef4444",
                      background: "color-mix(in srgb, #ef4444 8%, transparent)",
                    }}
                    role="alert"
                  >
                    {generationError}
                  </p>
                )}
              </div>
            )}
          </div>

          {stage === "generating" && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-sm">
              <div className="sf-generating-card w-[min(92vw,820px)] rounded-2xl border p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--sf-border)" }}>
                  <span className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
                    yourwebsite.com
                  </span>
                  <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))" }}>
                    Generating
                  </span>
                </div>
                <div className="h-[min(440px,52svh)] rounded-xl border p-4 sm:h-[440px]" style={{ borderColor: "var(--sf-border)", background: "color-mix(in srgb, var(--sf-card) 88%, transparent)" }}>
                  <div className="sf-shimmer-block h-full rounded-lg" />
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs sm:text-sm">
                    <span style={{ color: "var(--sf-text-muted)" }}>
                      Generating website · Elapsed {formatElapsed(generationElapsedSec)}
                    </span>
                    <span style={{ color: "var(--sf-text)" }}>{progress}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--sf-card) 70%, var(--sf-border))" }}>
                    <div className="sf-progress-stripes h-full" style={{ width: `${progress}%`, backgroundColor: "var(--sf-accent-from)", transition: "width 0.24s ease-out" }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === "ready" && (
        <div className="space-y-5">
          <article className="sf-dashboard-panel animate-[fade-up_0.35s_ease-out_forwards] p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <p className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>
                Your prompt
              </p>
              <span
                className="w-fit rounded-full border px-3 py-1 text-[11px] font-medium"
                style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}
              >
                Input used for this generation
              </span>
            </div>
            <p
              className="mt-3 rounded-xl border px-4 py-3 text-sm leading-relaxed sm:text-[15px]"
              style={{
                borderColor: "var(--sf-border)",
                color: "var(--sf-text)",
                background: "color-mix(in srgb, var(--sf-card) 90%, transparent)",
              }}
            >
              {prompt}
            </p>
          </article>

          <article className="sf-dashboard-panel animate-[fade-up_0.4s_ease-out_forwards] p-3 sm:p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>
                  Generated Website
                </p>
                <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
                  Status: Website Ready
                </p>
              </div>
              <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end lg:max-w-[min(100%,32rem)]">
                <button
                  type="button"
                  onClick={() => {
                    if (!generatedHtml) return;
                    const puid = readSessionUidFromLocalStorage();
                    const { htmlKey, promptKey } = getProjectLocalStorageKeys(puid);
                    localStorage.setItem(htmlKey, generatedHtml);
                    localStorage.setItem(promptKey, prompt);
                    router.push("/editor");
                  }}
                  className="min-h-[2.5rem] rounded-full border px-3 py-2 text-sm font-semibold sm:px-4"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const htmlForPreview = ensurePreviewHtml();
                    if (htmlForPreview) {
                      const puid = readSessionUidFromLocalStorage();
                      const { htmlKey, promptKey } = getProjectLocalStorageKeys(puid);
                      localStorage.setItem(htmlKey, htmlForPreview);
                      localStorage.setItem(promptKey, prompt);
                    }
                    setImmersivePreview(true);
                  }}
                  className="min-h-[2.5rem] rounded-full border px-3 py-2 text-sm font-semibold sm:px-4"
                  style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={publishDisabled}
                  className="col-span-2 min-h-[2.5rem] rounded-full px-3 py-2 text-sm font-semibold text-[#072b14] sm:col-span-1"
                  style={{ background: "#86ef5b", opacity: publishDisabled ? 0.55 : 1, cursor: publishDisabled ? "not-allowed" : "pointer" }}
                >
                  {publishSubmitting ? "Publishing..." : "Publish Website"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const uid = readSessionUidFromLocalStorage();
                      const { htmlKey } = getProjectLocalStorageKeys(uid);
                      localStorage.removeItem(htmlKey);
                    } catch {
                      // ignore storage errors
                    }
                    setGeneratedHtml("");
                    setDraftHtml("");
                    setStage("idle");
                    setPromptReferenceImageDataUrl(null);
                    setPromptReferenceImageName("");
                    dispatchParticles();
                  }}
                  className="col-span-2 min-h-[2.5rem] rounded-full border px-3 py-2 text-sm font-semibold text-white sm:col-span-1"
                  style={{
                    borderColor: "transparent",
                    background: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))",
                  }}
                >
                  Regenerate
                </button>
              </div>
            </div>
            {publishError ? (
              <p className="mt-3 text-sm font-medium" style={{ color: "#f87171" }}>
                {publishError}
              </p>
            ) : null}
            <div className="mt-3">
              <input
                type="text"
                value={publishName}
                onChange={(e) => setPublishName(e.target.value)}
                placeholder="Enter username or website name (e.g. john-portfolio)"
                className="h-10 w-full rounded-xl border bg-transparent px-3 text-sm outline-none"
                style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
              />
            </div>
          </article>

          <article className="sf-dashboard-panel animate-[fade-up_0.45s_ease-out_forwards] p-4 sm:p-5">
              {isEditorMode && (
                <div className="mb-4 rounded-xl border p-3" style={{ borderColor: "var(--sf-border)" }}>
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
                      Theme colors
                    </span>
                    <input
                      type="color"
                      value={themeColorA}
                      onChange={(e) => setThemeColorA(e.target.value)}
                      aria-label="Primary theme color"
                    />
                    <input
                      type="color"
                      value={themeColorB}
                      onChange={(e) => setThemeColorB(e.target.value)}
                      aria-label="Secondary theme color"
                    />
                    <span className="ml-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
                      Fonts
                    </span>
                    <select
                      value={fontPreset}
                      onChange={(e) => setFontPreset(e.target.value as FontPreset)}
                      className="rounded-md border px-2 py-1 text-xs"
                      style={{ borderColor: "var(--sf-border)", background: "var(--sf-card)", color: "var(--sf-text)" }}
                    >
                      <option>Inter</option>
                      <option>Poppins</option>
                      <option>Manrope</option>
                      <option>Montserrat</option>
                      <option>Playfair Display</option>
                    </select>
                    <span className="ml-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
                      Preview mode
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewModeOn((v) => !v)}
                      className="rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                    >
                      {previewModeOn ? "On" : "Off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNavEditor(true)}
                      className="rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                    >
                      Edit navigation bar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={publishDisabled}
                      className="rounded-full px-3 py-1 text-xs font-semibold text-[#072b14]"
                      style={{ background: "#86ef5b", opacity: publishDisabled ? 0.55 : 1, cursor: publishDisabled ? "not-allowed" : "pointer" }}
                    >
                      {publishSubmitting ? "…" : "Publish"}
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEditor}
                      className="rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                    >
                      Save edits
                    </button>
                    <button
                      type="button"
                      onClick={handleExitEditor}
                      className="rounded-full border px-3 py-1 text-xs font-semibold"
                      style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}
                    >
                      Exit editor
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: "var(--sf-border)", color: "var(--sf-text-muted)" }}>
                  Single Page App
                </span>
              </div>

              {isEditorMode && (
                <div className="mb-3 rounded-xl border p-3" style={{ borderColor: "var(--sf-border)" }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
                    Visual editor mode
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--sf-text-muted)" }}>
                    Click directly inside the preview to edit text and content visually.
                  </p>
                  {selectedLabel ? (
                    <p className="mt-1 text-xs" style={{ color: "var(--sf-accent-from)" }}>
                      Selected: {selectedLabel}
                    </p>
                  ) : null}
                  {editorMessage ? (
                    <p className="mt-1 text-xs" style={{ color: "var(--sf-accent-from)" }}>
                      {editorMessage}
                    </p>
                  ) : null}
                </div>
              )}

              <div
                className="relative overflow-hidden rounded-xl border p-3 transition-all duration-300"
                style={{
                  borderColor: "var(--sf-border)",
                  background:
                    "linear-gradient(180deg, color-mix(in srgb, var(--sf-card) 96%, transparent), color-mix(in srgb, var(--sf-card) 82%, transparent))",
                }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                    Live AI-generated website
                  </div>
                </div>

                <div
                  className="pointer-events-none absolute inset-0 -z-10 blur-2xl"
                  style={{
                    background:
                      "radial-gradient(600px circle at 50% 20%, color-mix(in srgb, var(--sf-accent-from) 14%, transparent), transparent 70%)",
                  }}
                  aria-hidden
                />

                <div
                  className={`flex flex-col gap-3 lg:flex-row ${isEditorMode ? "lg:items-start" : "justify-center"}`}
                >
                  {isEditorMode && (
                    <aside
                      className="order-2 w-full max-w-full shrink-0 rounded-xl border p-3 lg:order-1 lg:max-w-[300px]"
                      style={{ borderColor: "var(--sf-border)" }}
                    >
                      <div className="mb-3 inline-flex rounded-full border p-1" style={{ borderColor: "var(--sf-border)" }}>
                        <button
                          type="button"
                          onClick={() => setEditorTab("content")}
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          style={{
                            background: editorTab === "content" ? "var(--sf-accent-from)" : "transparent",
                            color: editorTab === "content" ? "#fff" : "var(--sf-text-muted)",
                          }}
                        >
                          Content
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorTab("design")}
                          className="rounded-full px-3 py-1 text-xs font-semibold"
                          style={{
                            background: editorTab === "design" ? "var(--sf-accent-from)" : "transparent",
                            color: editorTab === "design" ? "#fff" : "var(--sf-text-muted)",
                          }}
                        >
                          Design
                        </button>
                      </div>
                      {editorTab === "content" ? (
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={() => setShowNavEditor(true)}
                            className="w-full rounded-full border px-3 py-2 text-xs font-semibold"
                            style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                          >
                            Edit navigation bar
                          </button>
                          <p className="text-xs" style={{ color: "var(--sf-text-muted)" }}>
                            Select text/image in preview to edit. Selected: {selectedLabel || "none"}
                          </p>
                          <input
                            type="url"
                            value={pendingImageUrl}
                            onChange={(e) => setPendingImageUrl(e.target.value)}
                            placeholder="Image URL for selected image"
                            className="w-full rounded-md border px-2 py-2 text-xs"
                            style={{ borderColor: "var(--sf-border)", background: "var(--sf-card)", color: "var(--sf-text)" }}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleEditSelectedImage}
                              className="rounded-full border px-3 py-1 text-xs font-semibold"
                              style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                            >
                              Replace image
                            </button>
                            <button
                              type="button"
                              onClick={() => imageUploadInputRef.current?.click()}
                              className="rounded-full border px-3 py-1 text-xs font-semibold"
                              style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
                            >
                              Upload image
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
                            Theme colors
                          </p>
                          <div className="flex items-center gap-2">
                            <input type="color" value={themeColorA} onChange={(e) => setThemeColorA(e.target.value)} />
                            <input type="color" value={themeColorB} onChange={(e) => setThemeColorB(e.target.value)} />
                          </div>
                          <select
                            value={fontPreset}
                            onChange={(e) => setFontPreset(e.target.value as FontPreset)}
                            className="w-full rounded-md border px-2 py-2 text-xs"
                            style={{ borderColor: "var(--sf-border)", background: "var(--sf-card)", color: "var(--sf-text)" }}
                          >
                            <option>Inter</option>
                            <option>Poppins</option>
                            <option>Manrope</option>
                            <option>Montserrat</option>
                            <option>Playfair Display</option>
                          </select>
                        </div>
                      )}
                    </aside>
                  )}
                  <div ref={previewWrapperRef} className="relative order-1 flex w-full min-w-0 justify-center lg:order-2">
                    <div
                      className="w-full min-w-0 overflow-auto rounded-lg border"
                      style={{
                        borderColor: "var(--sf-border)",
                        minHeight: "min(720px, 75svh)",
                        background: "#06070d",
                        maxWidth: "100%",
                      }}
                    >
                      <iframe
                        ref={previewFrameRef}
                        title="Generated website preview"
                        className="h-[min(720px,75svh)] w-full min-w-0 border-0 bg-white sm:h-[720px]"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups"
                        onLoad={() => applyEditorStylesToFrame(previewFrameRef.current)}
                      />
                    </div>
                  </div>
                </div>
                <input
                  ref={imageUploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleUploadSelectedImage(file);
                  }}
                />

                {isEditorMode && selectedKind === "text" && (
                  <div className="pointer-events-none absolute inset-0 z-10 border-2 border-dashed border-sky-400/70" />
                )}

                {isEditorMode && selectedKind !== "none" && (
                  <div
                    className="pointer-events-auto absolute z-30 w-[min(290px,calc(100%-0.75rem))] max-w-[calc(100vw-2rem)] rounded-xl border bg-white/95 p-2 text-xs shadow-xl"
                    style={{ left: `${toolbarPos.x}px`, top: `${toolbarPos.y}px` }}
                  >
                    <div
                      onMouseDown={onToolbarMouseDown}
                      className="mb-2 cursor-move rounded-md border px-2 py-1 text-[11px] font-semibold text-slate-700"
                    >
                      Selected: {selectedLabel || selectedKind} (drag)
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedKind === "image" && (
                        <>
                          <button
                            type="button"
                            onClick={handleRegenerateSelectedImage}
                            className="rounded-full border px-3 py-1 font-semibold text-slate-800"
                          >
                            Regenerate
                          </button>
                          <button
                            type="button"
                            onClick={() => imageUploadInputRef.current?.click()}
                            className="rounded-full border px-3 py-1 font-semibold text-slate-800"
                          >
                            Upload
                          </button>
                          <button
                            type="button"
                            onClick={handleEditSelectedImage}
                            className="rounded-full border px-3 py-1 font-semibold text-slate-800"
                          >
                            Edit URL
                          </button>
                        </>
                      )}
                      {selectedKind === "text" && (
                        <span className="text-[11px] text-slate-700">Text selected. Type directly in preview.</span>
                      )}
                      {selectedKind === "navbar" && (
                        <button
                          type="button"
                          onClick={() => setShowNavEditor(true)}
                          className="rounded-full border px-3 py-1 font-semibold text-slate-800"
                        >
                          Edit navigation bar
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {isEditorMode && (
                  <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border bg-white/95 px-2 py-2 text-xs shadow-lg sm:px-3">
                    <button
                      type="button"
                      onClick={() => setEditorTab("design")}
                      className="rounded-full border px-3 py-1 font-semibold"
                      style={{ borderColor: "var(--sf-border)", color: "#111827" }}
                    >
                      Design
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditorTab("content");
                        setEditorMessage("Click any text/image in preview to edit content.");
                      }}
                      className="rounded-full border px-3 py-1 font-semibold"
                      style={{ borderColor: "var(--sf-border)", color: "#111827" }}
                    >
                      Edit content
                    </button>
                  </div>
                )}
              </div>

              {isEditorMode && showNavEditor && (
                <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-900">Edit navigation bar</h3>
                      <button
                        type="button"
                        onClick={() => setShowNavEditor(false)}
                        className="rounded-full border px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        Close
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-slate-700">
                        Logo text
                        <input
                          type="text"
                          value={logoTextDraft}
                          onChange={(e) => setLogoTextDraft(e.target.value)}
                          className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-slate-900"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Navigation links (one per line)
                        <textarea
                          value={navLinksDraft}
                          onChange={(e) => setNavLinksDraft(e.target.value)}
                          rows={6}
                          className="mt-1 w-full rounded-md border px-2 py-2 text-sm text-slate-900"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowNavEditor(false)}
                        className="rounded-full border px-4 py-2 text-xs font-semibold text-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={applyNavPanelChanges}
                        className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
          </article>
        </div>
      )}

      {immersivePreview && stage === "ready" && (
        <div
          className="fixed inset-0 z-[300] flex flex-col"
          style={{ background: "var(--sf-bg)" }}
          role="dialog"
          aria-modal
          aria-label="Full screen website preview"
        >
          <div
            className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b px-2 py-2.5 sm:gap-3 sm:px-4"
            style={{ borderColor: "var(--sf-border)" }}
          >
            <button
              type="button"
              onClick={() => setImmersivePreview(false)}
              className="inline-flex h-9 items-center justify-center rounded-full border px-3 text-xs font-semibold transition sm:px-4 sm:text-sm"
              style={{
                borderColor: "var(--sf-border)",
                color: "var(--sf-text)",
                background: "color-mix(in srgb, var(--sf-card) 90%, transparent)",
              }}
            >
              Exit preview
            </button>
            <div
              className="inline-flex items-center gap-1 rounded-full border p-1"
              style={{ borderColor: "var(--sf-border)" }}
            >
              {(["pc", "tablet", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setPreviewDevice(d)}
                  className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
                  style={{
                    color: previewDevice === d ? "white" : "var(--sf-text-muted)",
                    background:
                      previewDevice === d
                        ? "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))"
                        : "transparent",
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
            <div className="mx-auto flex justify-center">
              <div
                className="overflow-auto rounded-lg border pb-8 transition-all duration-300 ease-out"
                style={{
                  borderColor: "var(--sf-border)",
                  background: "#06070d",
                  minHeight: "100%",
                  width: previewCanvasWidth,
                  maxWidth: "100%",
                }}
              >
                <iframe
                  ref={fullscreenFrameRef}
                  title="Generated website fullscreen preview"
                  className="min-h-[85vh] w-full border-0 bg-white"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups"
                  onLoad={() => applyEditorStylesToFrame(fullscreenFrameRef.current)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      <PublishSuccessModal
        open={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        siteUrl={publishResultUrl}
      />
    </section>
  );
}
