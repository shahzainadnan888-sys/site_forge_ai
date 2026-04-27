"use client";

import { SITEFORGE_SESSION_EVENT } from "@/lib/siteforge-credits";

const SESSION_KEY = "siteforge-session";

/** Pre–per-user isolation: one blob shared by all users on the same browser. */
const LEGACY_HTML_KEY = "siteforge-generated-html";
const LEGACY_PROMPT_KEY = "siteforge-generated-prompt";

const HTML_PREFIX = "siteforge-generated-html::";
const PROMPT_PREFIX = "siteforge-generated-prompt::";

/**
 * Read Firebase `uid` from the client session object (must be set by /api/auth/me and sign-in).
 */
export function readSessionUidFromLocalStorage(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { uid?: string };
    return typeof p.uid === "string" && p.uid.length > 0 ? p.uid : null;
  } catch {
    return null;
  }
}

export function getProjectLocalStorageKeys(uid: string | null | undefined) {
  if (uid) {
    return { htmlKey: `${HTML_PREFIX}${uid}`, promptKey: `${PROMPT_PREFIX}${uid}` };
  }
  return { htmlKey: LEGACY_HTML_KEY, promptKey: LEGACY_PROMPT_KEY };
}

/**
 * The first time we see a signed-in `uid` after this fix, copy any legacy global draft into
 * that uid’s keys and clear the legacy keys so other accounts on the same device don’t see it.
 */
export function claimLegacyProjectIntoUserKeys(uid: string): void {
  if (typeof window === "undefined" || !uid) return;
  const { htmlKey, promptKey } = getProjectLocalStorageKeys(uid);
  try {
    if (localStorage.getItem(htmlKey)) {
      try {
        localStorage.removeItem(LEGACY_HTML_KEY);
        localStorage.removeItem(LEGACY_PROMPT_KEY);
      } catch {
        // ignore
      }
      return;
    }
    const legHtml = localStorage.getItem(LEGACY_HTML_KEY);
    if (!legHtml || !legHtml.includes("</html>")) {
      return;
    }
    localStorage.setItem(htmlKey, legHtml);
    const legPr = localStorage.getItem(LEGACY_PROMPT_KEY);
    if (legPr) {
      localStorage.setItem(promptKey, legPr);
    }
  } catch {
    // ignore
  } finally {
    try {
      localStorage.removeItem(LEGACY_HTML_KEY);
      localStorage.removeItem(LEGACY_PROMPT_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Re-run a callback when the tab session updates (e.g. different user sign-in).
 */
export function subscribeSessionUidChange(cb: () => void): () => void {
  const on = () => {
    cb();
  };
  window.addEventListener("storage", on);
  window.addEventListener(SITEFORGE_SESSION_EVENT, on);
  return () => {
    window.removeEventListener("storage", on);
    window.removeEventListener(SITEFORGE_SESSION_EVENT, on);
  };
}

const PUBLISHED_SITE_KEY_PREFIX = "siteforge-published-site-id::";

export function publishedSiteIdStorageKey(uid: string | null | undefined) {
  if (uid) return `${PUBLISHED_SITE_KEY_PREFIX}${uid}`;
  return "siteforge-published-site-id";
}

export function readPublishedSiteIdFromLocalStorage(uid: string | null | undefined): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(publishedSiteIdStorageKey(uid));
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writePublishedSiteIdToLocalStorage(uid: string | null | undefined, siteId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(publishedSiteIdStorageKey(uid), siteId);
  } catch {
    // ignore
  }
}
