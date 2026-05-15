"use client";

import { useCallback, useEffect, useState } from "react";
import { getPreviewHtmlForSlug } from "@/lib/generated-site/sanitize-preview-html";
import type { SitePageMap } from "@/lib/generated-site/types";
import { normalizePageSlug } from "@/lib/generated-site/normalize-slug";
import {
  getProjectLocalStorageKeys,
  readPagesFromLocalStorage,
  readSessionUidFromLocalStorage,
} from "@/lib/siteforge-project-storage";

export function usePreviewPages() {
  const [pages, setPages] = useState<SitePageMap>({});
  const [pageSlug, setPageSlug] = useState("");
  const [isMulti, setIsMulti] = useState(false);

  const loadFromStorage = useCallback(() => {
    const uid = readSessionUidFromLocalStorage();
    const { htmlKey } = getProjectLocalStorageKeys(uid);
    const storedPages = readPagesFromLocalStorage(uid);
    const rawHtml = typeof window !== "undefined" ? localStorage.getItem(htmlKey) || "" : "";

    if (storedPages && Object.keys(storedPages).length > 0) {
      const keys = Object.keys(storedPages).filter((k) => storedPages[k]?.includes("</html>"));
      setPages(storedPages);
      setIsMulti(keys.length > 1);
      setPageSlug("");
      return;
    }
    if (rawHtml.includes("</html>")) {
      setPages({ "": rawHtml });
      setIsMulti(false);
      setPageSlug("");
    } else {
      setPages({});
      setIsMulti(false);
      setPageSlug("");
    }
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    const onNav = (event: MessageEvent) => {
      if (event.data?.type !== "sf-preview-nav" || typeof event.data.path !== "string") return;
      const slug = normalizePageSlug(String(event.data.path).replace(/^\//, ""));
      setPageSlug(slug);
    };
    window.addEventListener("message", onNav);
    return () => window.removeEventListener("message", onNav);
  }, []);

  const previewHtml = getPreviewHtmlForSlug(pages, pageSlug, { multiPage: isMulti });

  return {
    pages,
    setPages,
    pageSlug,
    setPageSlug,
    isMulti,
    previewHtml,
    loadFromStorage,
  };
}
