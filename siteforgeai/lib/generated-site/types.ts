/** Slug keys: "" = home, "about", "contact", etc. (no leading slash). */
export type SitePageMap = Record<string, string>;

export type GeneratedSiteResult = {
  appType: "single" | "multi";
  /** Primary page (home) for backward compatibility. */
  html: string;
  pages: SitePageMap;
};

export const DEFAULT_PAGE_SLUGS = ["", "about", "services", "contact"] as const;
