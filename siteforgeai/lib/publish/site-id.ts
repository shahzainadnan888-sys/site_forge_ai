import { randomBytes } from "node:crypto";

const ID_RE = /^[a-f0-9]{8,32}$/;

/**
 * New id for a published site (lowercase hex; safe for subdomains, paths, and Vercel project names).
 */
export function generateSiteId() {
  return randomBytes(10).toString("hex").slice(0, 16);
}

export function isValidSiteId(id: string) {
  return ID_RE.test(id);
}

/**
 * Vercel project name: lowercase, alphanumeric, hyphens, 1–100.
 */
export function toVercelProjectName(siteId: string) {
  const s = `sf-site-${siteId}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (s.length < 2) return `sf-x-${Date.now()}`;
  return s.slice(0, 100);
}
