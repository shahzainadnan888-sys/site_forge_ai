import { injectNavPolish } from "@/lib/generated-site/nav-polish";
import { normalizePageSlug } from "@/lib/generated-site/normalize-slug";

const LOOPBACK_HOST = String.raw`(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])`;
const LOOPBACK_ORIGIN = String.raw`https?:\/\/${LOOPBACK_HOST}(?::\d+)?`;

function stripLoopback(html: string): string {
  let out = html.replace(/<base\b[^>]*>/gi, "");
  out = out.replace(new RegExp(String.raw`\bhref=(["'])(?:${LOOPBACK_ORIGIN}|//${LOOPBACK_HOST}[^"']*)\1`, "gi"), 'href="/"');
  out = out.replace(new RegExp(String.raw`\bsrc=(["'])(?:${LOOPBACK_ORIGIN}|//${LOOPBACK_HOST}[^"']*)\1`, "gi"), 'src="about:blank"');
  out = out.replace(new RegExp(String.raw`\baction=(["'])(?:${LOOPBACK_ORIGIN}|//${LOOPBACK_HOST}[^"']*)\1`, "gi"), 'action="/contact"');
  out = out.replace(
    new RegExp(String.raw`url\s*\(\s*["']?${LOOPBACK_ORIGIN}[^)"']*["']?\s*\)`, "gi"),
    "none"
  );
  return out;
}

/** Prefix internal root-relative links with /{username} for published routing. */
export function preparePublishedHtml(html: string, username: string, pageSlug = ""): string {
  const base = `/${encodeURIComponent(username)}`.replace(/\/+$/, "") || "";
  let out = stripLoopback(html);

  out = out.replace(
    /<a([^>]*?)href=(['"])([^'"]*)(['"])([^>]*)>/gi,
    (full, pre, q1, href, q2, post) => {
      const h = String(href || "").trim();
      if (!h || /^mailto:|^tel:|^javascript:/i.test(h)) return full;
      if (/^https?:\/\//i.test(h) || h.startsWith("//")) return full;
      if (h.startsWith("#")) return full;

      if (h === "/" || h === "") {
        return `<a${pre}href="${base || "/"}"${post}>`;
      }
      if (h.startsWith("/")) {
        const slug = normalizePageSlug(h.slice(1));
        const path = slug ? `${base}/${slug}` : base || "/";
        return `<a${pre}href="${path}"${post}>`;
      }
      return full;
    }
  );

  return injectNavPolish(out, pageSlug, { username, includeScript: true });
}
