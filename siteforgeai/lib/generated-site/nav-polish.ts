import { hrefToPageSlug } from "@/lib/generated-site/reconcile-pages";
import { normalizePageSlug } from "@/lib/generated-site/normalize-slug";

export const NAV_POLISH_CSS = `
<style id="sf-nav-polish">
:root {
  --sf-accent: linear-gradient(90deg, #7c3aed, #d946ef);
  --sf-nav-text: inherit;
  --sf-nav-muted: rgba(128, 128, 128, 0.85);
}
html { scroll-behavior: smooth; }
body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
main, [role="main"] {
  animation: sf-pageIn .45s ease both;
}
@keyframes sf-pageIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
header a, nav a, .nav a, [class*="nav"] a {
  position: relative;
  text-decoration: none;
  transition: color .2s ease, background .2s ease, box-shadow .2s ease, transform .2s ease;
  border-radius: 0.5rem;
  padding: 0.35rem 0.75rem;
}
header a:not(.sf-nav-active):not(.active):hover,
nav a:not(.sf-nav-active):not(.active):hover {
  background: rgba(124, 58, 237, 0.12);
  transform: translateY(-1px);
}
header a.sf-nav-active, nav a.sf-nav-active,
header a.active, nav a.active {
  background: var(--sf-accent) !important;
  color: #fff !important;
  font-weight: 600;
  box-shadow: 0 4px 18px rgba(124, 58, 237, 0.35);
}
header a.sf-nav-active:hover, nav a.sf-nav-active:hover {
  transform: none;
  filter: brightness(1.05);
}
section { padding-block: clamp(2.5rem, 6vw, 4.5rem); }
h1 { letter-spacing: -0.02em; line-height: 1.15; }
h2 { letter-spacing: -0.01em; line-height: 1.25; }
p { line-height: 1.65; }
img { border-radius: 0.75rem; }
@media (max-width: 768px) {
  header, nav {
    flex-wrap: wrap !important;
    gap: 0.35rem !important;
    justify-content: center !important;
  }
  header a, nav a {
    font-size: 0.875rem;
    padding: 0.4rem 0.65rem;
  }
  section { padding-inline: 1rem; }
}
@media (prefers-reduced-motion: reduce) {
  main, [role="main"] { animation: none; }
  header a, nav a { transition: none; }
}
</style>`.trim();

export const NAV_ACTIVE_SCRIPT = `<script id="sf-nav-active">(function(){
function norm(s){return String(s||'').toLowerCase().replace(/^\\/+|\\/+$/g,'').replace(/\\.html?$/,'').replace(/[^a-z0-9-]/g,'-').replace(/^-+|-+$/g,'');}
function slugFromHref(href){
  href=(href||'').trim();
  if(!href||/^mailto:|^tel:|^javascript:/i.test(href))return null;
  if(/^https?:\\/\\//i.test(href))return null;
  if(href.charAt(0)==='#'){var id=norm(href.slice(1));return id==='home'||id==='index'?'':id;}
  var path=(href.split('#')[0].split('?')[0]||'').trim();
  if(path==='/'||path==='')return '';
  var parts=path.replace(/^\\/+/, '').split('/').filter(Boolean);
  if(parts.length>=2) return norm(parts[parts.length-1]);
  if(parts.length===1) return norm(parts[0])==='home'||norm(parts[0])==='index'?'':norm(parts[0]);
  return '';
}
function currentSlug(){
  var fromBody=document.body&&document.body.getAttribute('data-sf-page');
  if(fromBody!==null&&fromBody!==undefined)return fromBody;
  var parts=location.pathname.replace(/\\/+$/,'').split('/').filter(Boolean);
  if(parts.length<=1)return '';
  return norm(parts[parts.length-1]);
}
function apply(){
  var slug=currentSlug();
  var links=document.querySelectorAll('header a[href], nav a[href], .nav-links a[href]');
  links.forEach(function(a){
    var linkSlug=slugFromHref(a.getAttribute('href')||'');
    if(linkSlug===null)return;
    var on=linkSlug===slug;
    a.classList.toggle('sf-nav-active',on);
    a.classList.toggle('active',on);
    if(on)a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);
else apply();
window.addEventListener('sf-nav-sync',apply);
})();</script>`;

export function slugFromNavHref(href: string, username?: string): string | null {
  const h = (href || "").trim();
  if (!h || /^mailto:|^tel:|^javascript:/i.test(h)) return null;
  if (/^https?:\/\//i.test(h) && !username) return null;

  if (username) {
    const base = `/${encodeURIComponent(username)}`.replace(/\/+$/, "");
    if (h === base || h === `${base}/` || h === "/") return "";
    if (h.startsWith(`${base}/`)) {
      return normalizePageSlug(h.slice(base.length + 1));
    }
  }

  return hrefToPageSlug(h);
}

function setBodyPageSlug(html: string, slug: string): string {
  return html.replace(/<body([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s*data-sf-page\s*=\s*["'][^"']*["']/gi, "");
    return `<body${cleaned} data-sf-page="${slug}">`;
  });
}

function markActiveInNavBlock(block: string, currentSlug: string, username?: string): string {
  return block.replace(/<a\b([^>]*)>/gi, (_full, attrs: string) => {
    const href = attrs.match(/\bhref\s*=\s*(["'])([^"']*)\1/i)?.[2] ?? "";
    const linkSlug = slugFromNavHref(href, username);
    if (linkSlug === null) return `<a${attrs}>`;

    const isActive = linkSlug === currentSlug;
    let cleaned = attrs
      .replace(/\sclass\s*=\s*(["'])[^"']*\1/gi, "")
      .replace(/\saria-current\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sdata-sf-nav\s*=\s*["'][^"']*["']/gi, "");

    if (isActive) {
      cleaned += ` class="sf-nav-active active" aria-current="page" data-sf-nav="active"`;
    } else {
      cleaned += ` data-sf-nav="link"`;
    }
    return `<a${cleaned}>`;
  });
}

/** Mark the correct navbar link active for this page slug (server-side). */
export function markActiveNavForSlug(html: string, currentSlug: string, opts?: { username?: string }): string {
  let out = setBodyPageSlug(html, currentSlug);

  out = out.replace(/(<(?:nav|header)\b[\s\S]*?<\/(?:nav|header)>)/gi, (block) =>
    markActiveInNavBlock(block, currentSlug, opts?.username)
  );

  return out;
}

export function injectNavPolish(html: string, pageSlug: string, opts?: { username?: string; includeScript?: boolean }): string {
  let out = markActiveNavForSlug(html, pageSlug, { username: opts?.username });

  if (!/id=["']sf-nav-polish["']/.test(out)) {
    out = out.replace(/<\/head>/i, `${NAV_POLISH_CSS}\n</head>`);
  }

  if (opts?.includeScript !== false && !/id=["']sf-nav-active["']/.test(out)) {
    out = out.replace(/<\/body>/i, `${NAV_ACTIVE_SCRIPT}\n</body>`);
  }

  return out;
}
