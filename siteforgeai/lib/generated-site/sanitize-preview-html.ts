import {
  enforceSinglePageAnchors,
  stripInjectedPreviewArtifacts,
  stripLoopbackForMultiPage,
  stripLoopbackFromStyleAndLinkTags,
  stripSinglePageOnlyScripts,
} from "@/lib/sanitize-generated-html";
import { injectNavPolish } from "@/lib/generated-site/nav-polish";
import type { SitePageMap } from "@/lib/generated-site/types";

const PREVIEW_NAV_SCRIPT = `<script id="sf-preview-router">(function(){
function norm(s){return String(s||'').toLowerCase().replace(/^\\/+|\\/+$/g,'').replace(/\\.html?$/,'').replace(/[^a-z0-9-]/g,'-').replace(/^-+|-+$/g,'');}
function slugFromHref(href){
  href=(href||'').trim();
  if(!href||/^mailto:|^tel:|^javascript:/i.test(href))return null;
  if(/^https?:\\/\\//i.test(href)||href.indexOf('//')===0)return null;
  if(href.charAt(0)==='#'){var id=norm(href.slice(1));return id==='home'||id==='index'?'':id;}
  var path=(href.split('#')[0].split('?')[0]||'').trim();
  if(path==='/'||path===''||/^\\.\\/?$/i.test(path)||/^index\\.html?$/i.test(path))return '';
  if(path.charAt(0)==='/')path=path.slice(1);
  if(path.indexOf('./')===0)path=path.slice(2);
  var parts=path.split('/').filter(Boolean);
  if(parts.length>=2)path=parts[parts.length-1];
  path=path.replace(/\\.html?$/i,'').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/^-+|-+$/g,'');
  return path==='home'||path==='index'?'':path;
}
function navTo(slug){
  try{parent.postMessage({type:'sf-preview-nav',path:slug?'/'+slug:'/'},'*');}catch(x){}
}
function setActive(slug){
  document.body.setAttribute('data-sf-page',slug);
  try{window.dispatchEvent(new Event('sf-nav-sync'));}catch(e){}
}
document.addEventListener('click',function(e){
  var el=e.target;
  while(el&&el.tagName!=='A'){el=el.parentElement;}
  if(!el)return;
  var href=(el.getAttribute('href')||'').trim();
  if(/localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::1\\]/i.test(href)){
    e.preventDefault();
    if(e.stopImmediatePropagation)e.stopImmediatePropagation();
    return false;
  }
  var slug=slugFromHref(href);
  if(slug===null)return;
  e.preventDefault();
  e.stopPropagation();
  if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  setActive(slug);
  navTo(slug);
  return false;
},true);
})();</script>`;

/** Iframe preview: single-page uses hash anchors; multi-page uses postMessage to swap pages. */
export function preparePreviewHtml(
  html: string,
  opts?: { multiPage?: boolean; username?: string; pageSlug?: string }
): string {
  if (opts?.multiPage) {
    const slug = opts.pageSlug ?? "";
    let out = stripInjectedPreviewArtifacts(html);
    out = out.replace(/<base\b[^>]*>/gi, "");
    out = stripLoopbackFromStyleAndLinkTags(out);
    out = stripLoopbackForMultiPage(out);
    out = stripSinglePageOnlyScripts(out);
    out = injectNavPolish(out, slug, { username: opts.username, includeScript: true });
    if (!/id=["']sf-preview-router["']/.test(out)) {
      out = out.replace(/<\/body>/i, `${PREVIEW_NAV_SCRIPT}</body>`);
    }
    return out;
  }
  return enforceSinglePageAnchors(html);
}

export function getPreviewHtmlForSlug(pages: SitePageMap, slug: string, opts?: { multiPage?: boolean }): string {
  const key = slug in pages ? slug : "";
  const html = pages[key] ?? pages[""] ?? "";
  if (!html) return "";
  const multi = opts?.multiPage ?? Object.keys(pages).length > 1;
  return preparePreviewHtml(html, { multiPage: multi, pageSlug: key });
}
