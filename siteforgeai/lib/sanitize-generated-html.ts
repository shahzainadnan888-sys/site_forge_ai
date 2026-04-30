/**
 * Post-processes model HTML for single-page in-iframe preview.
 * Strips <base>, rewrites in-site nav to #anchors, and never leaves full http(s) URLs
 * in <a href> (models often add the user's real domain — those clicks escape the preview).
 */

const LABEL_TO_ANCHOR: Record<string, string> = {
  home: "#home",
  skills: "#skills",
  features: "#features",
  about: "#about",
  projects: "#projects",
  pricing: "#pricing",
  contact: "#contact",
  services: "#features",
};

function anchorForExternalHref(linkText: string, rawHref: string): string {
  const t = linkText.replace(/\s+/g, " ").trim().toLowerCase();
  if (LABEL_TO_ANCHOR[t]) return LABEL_TO_ANCHOR[t];
  for (const key of Object.keys(LABEL_TO_ANCHOR) as (keyof typeof LABEL_TO_ANCHOR)[]) {
    if (t === key) return LABEL_TO_ANCHOR[key];
    if (t.startsWith(key + " ") || t.endsWith(" " + key) || t.includes(" " + key + " ")) {
      return LABEL_TO_ANCHOR[key];
    }
  }
  if (/\b(home|hero|welcome)\b/.test(t)) return "#home";
  if (/\b(feature|service)s?\b/.test(t)) return "#features";
  if (/\babout\b|\b(story|bio)\b/.test(t)) return "#about";
  if (/\b(project|portfolio|work)\b/.test(t)) return "#projects";
  if (/\b(pricing|plan)\b/.test(t)) return "#pricing";
  if (/\bcontact\b|get in touch|reach us|message\b/.test(t)) return "#contact";
  if (/\bskill\b/.test(t)) return "#skills";

  try {
    const h = rawHref.trim();
    const u = h.startsWith("//") ? new URL("https:" + h) : new URL(h, "https://placeholder.local");
    const segs = u.pathname.split("/").filter(Boolean);
    const last = (segs[segs.length - 1] || "").toLowerCase().replace(/\.(html?|php)$/i, "");
    if (last && LABEL_TO_ANCHOR[last]) return LABEL_TO_ANCHOR[last];
    for (const seg of segs) {
      if (seg && LABEL_TO_ANCHOR[seg]) return LABEL_TO_ANCHOR[seg];
    }
  } catch {
    /* ignore */
  }
  return "#home";
}

function anchorFromHrefPath(rawHref: string): string | null {
  try {
    const cleaned = rawHref.trim();
    if (!cleaned || cleaned.startsWith("#")) return null;
    const u = cleaned.startsWith("//") ? new URL("https:" + cleaned) : new URL(cleaned, "https://placeholder.local");
    const combined = `${u.pathname} ${u.hash}`.toLowerCase();
    if (/\b(home|hero|welcome)\b/.test(combined)) return "#home";
    if (/\b(skill|skills)\b/.test(combined)) return "#skills";
    if (/\b(feature|features|service|services)\b/.test(combined)) return "#features";
    if (/\babout|story|bio\b/.test(combined)) return "#about";
    if (/\b(project|projects|portfolio|work)\b/.test(combined)) return "#projects";
    if (/\b(pricing|price|plan|plans)\b/.test(combined)) return "#pricing";
    if (/\b(contact|reach|get-in-touch|getintouch)\b/.test(combined)) return "#contact";
    return null;
  } catch {
    return null;
  }
}

export function enforceSinglePageAnchors(html: string): string {
  let output = html.replace(/<base\b[^>]*>/gi, "");
  output = output.replace(/\bhref=(["'])\/[^"']*\1/gi, 'href="#home"');
  output = output.replace(/\bhref=(["'])https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^"']*\1/gi, 'href="#home"');
  output = output.replace(/\baction=(["'])https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^"']*\1/gi, 'action="#home"');
  output = output.replace(/\baction=(["'])\/[^"']*\1/gi, 'action="#home"');
  output = output.replace(/\bsrc=(["'])https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^"']*\1/gi, 'src="about:blank"');
  output = output.replace(/\bsrc=(["'])\/[^"']*\1/gi, 'src="about:blank"');
  output = output.replace(
    /\b(on\w+)=("|')([\s\S]*?)(\2)/gi,
    (full, attr, quote, code, closingQuote) => {
      const script = String(code || "");
      const hasLocalhostNav =
        /https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(script) ||
        /\b(?:window\.)?location\.(?:href|assign|replace)\s*=\s*["'][^"']*\/[^"']*["']/i.test(script) ||
        /\b(?:window\.)?location\.(?:assign|replace)\s*\(\s*["'][^"']*["']\s*\)/i.test(script);
      if (!hasLocalhostNav) return full;
      return `${attr}=${quote}event&&event.preventDefault&&event.preventDefault();location.hash='#home';${closingQuote}`;
    }
  );
  output = output.replace(
    /\b(?:window\.)?location\.(href|assign|replace)\s*=\s*["']https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^"']*["']/gi,
    "location.hash='#home'"
  );
  output = output.replace(
    /\b(?:window\.)?location\.(assign|replace)\s*\(\s*["']https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^"']*["']\s*\)/gi,
    "location.hash='#home'"
  );
  output = output.replace(
    /(<a\b[^>]*?)\s+target=(["'])(?:_parent|_top)\2/gi,
    "$1"
  );

  output = output.replace(
    /<(header|div|nav)([^>]*?)>([\s\S]*?(theme|colors|fonts|preview|publish|edit navigation|add section)[\s\S]*?)<\/\1>/gi,
    (full, _tag, attrs) => {
      const attrText = String(attrs || "").toLowerCase();
      const looksLikeTopBar =
        attrText.includes("position:fixed") ||
        attrText.includes("position: sticky") ||
        attrText.includes("top:0") ||
        attrText.includes("z-index");
      return looksLikeTopBar ? "" : full;
    }
  );

  output = output.replace(
    /<a([^>]*?)href=(['"])([^'"]*)(['"])([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, pre, _q1, href, _q2, post, inner) => {
      const text = String(inner).replace(/<[^>]*>/g, "").trim();
      const textLower = text.toLowerCase();
      const mapped = LABEL_TO_ANCHOR[textLower];
      const normalizedHref = String(href || "").trim().toLowerCase();
      const fromHref = anchorFromHrefPath(String(href || ""));
      if (normalizedHref.startsWith("mailto:") || normalizedHref.startsWith("tel:")) {
        return full;
      }
      if (normalizedHref.startsWith("javascript:")) {
        return `<a${pre}href="#home"${post}>${inner}</a>`;
      }
      const isHash = normalizedHref.startsWith("#");
      const isExternal = /^https?:\/\//i.test(normalizedHref) || normalizedHref.startsWith("//");

      if (isExternal) {
        const dest = mapped || fromHref || anchorForExternalHref(text, String(href));
        return `<a${pre}href="${dest}"${post}>${inner}</a>`;
      }
      if (mapped) {
        return `<a${pre}href="${mapped}"${post}>${inner}</a>`;
      }
      if (fromHref) {
        return `<a${pre}href="${fromHref}"${post}>${inner}</a>`;
      }
      if (!isHash) {
        return `<a${pre}href="#home"${post}>${inner}</a>`;
      }
      if (normalizedHref === "#" || normalizedHref === "") {
        return `<a${pre}href="#home"${post}>${inner}</a>`;
      }
      return full;
    }
  );

  if (!/id=["']sf-spa-guard["']/.test(output)) {
    output = output.replace(
      /<\/head>/i,
      `<style id="sf-spa-guard">
html,body{max-width:100%;overflow-x:hidden;scroll-behavior:smooth}
*,*::before,*::after{box-sizing:border-box}
img,video,canvas,svg,iframe{max-width:100%;height:auto}
section,main,header,footer,div{max-width:100%}
pre,code{white-space:pre-wrap;word-break:break-word}
@media (max-width: 1024px){
  nav ul, nav .menu, .nav-links{flex-wrap:wrap!important;gap:10px!important}
}
@media (max-width: 768px){
  h1{font-size:clamp(1.8rem,7vw,2.6rem)!important;line-height:1.15!important}
  h2{font-size:clamp(1.35rem,5vw,2rem)!important;line-height:1.2!important}
  section,main,header,footer{padding-left:min(5vw,24px)!important;padding-right:min(5vw,24px)!important}
}
</style></head>`
    );
  }

  if (!/id=["']sf-spa-scroll["']/.test(output)) {
    output = output.replace(
      /<\/body>/i,
      `<script id="sf-spa-scroll">(function(){
var map={home:'home',skills:'skills',features:'features',about:'about',projects:'projects',pricing:'pricing',contact:'contact',services:'features'};
var keywordMap={
  home:/\\b(home|hero|welcome)\\b/i,
  skills:/\\b(skills?)\\b/i,
  features:/\\b(features?|services?)\\b/i,
  about:/\\b(about|how it works|story)\\b/i,
  projects:/\\b(projects?|portfolio|work)\\b/i,
  pricing:/\\b(pricing|plans?)\\b/i,
  contact:/\\b(contact|get in touch|reach us)\\b/i
};
function textOf(el){return (el&&el.textContent||'').replace(/\\s+/g,' ').trim();}
function ensureSection(id){
  if(document.getElementById(id)) return;
  var blocks=[].slice.call(document.querySelectorAll('section,main,article,div'));
  for(var i=0;i<blocks.length;i++){
    var t=textOf(blocks[i]);
    if(keywordMap[id]&&keywordMap[id].test(t) && !blocks[i].id){blocks[i].id=id;return;}
  }
  for(var j=0;j<blocks.length;j++){
    if(!blocks[j].id){blocks[j].id=id;return;}
  }
}
Object.keys(map).forEach(ensureSection);
var parentOrigin='';
try{parentOrigin=String(window.top.location.protocol)+'//'+window.top.location.host;}catch(e0){}
function isExternalUrl(href){
  if(!href)return false;
  if(/^mailto:/i.test(href)||/^tel:/i.test(href)||/^javascript:/i.test(href))return false;
  return /^https?:\\/\\//i.test(href)||href.slice(0,2)==='//';
}
function idFromHref(href){
  var h=(href||'').trim().toLowerCase();
  if(!h)return '';
  if(h.charAt(0)==='#'){return h.slice(1).split('?')[0];}
  if(/mailto:|tel:|javascript:/i.test(h))return '';
  if(/\\b(home|hero|welcome)\\b/.test(h))return 'home';
  if(/\\b(skill|skills)\\b/.test(h))return 'skills';
  if(/\\b(feature|features|service|services)\\b/.test(h))return 'features';
  if(/\\babout|story|bio\\b/.test(h))return 'about';
  if(/\\b(project|projects|portfolio|work)\\b/.test(h))return 'projects';
  if(/\\b(pricing|price|plan|plans)\\b/.test(h))return 'pricing';
  if(/\\b(contact|reach|get-in-touch|getintouch)\\b/.test(h))return 'contact';
  return '';
}
function sameApp(href){
  if(!href)return true;
  if(href.charAt(0)==='#')return false;
  if(/^mailto:/i.test(href)||/^tel:/i.test(href)||/^javascript:/i.test(href))return false;
  if(isExternalUrl(href))return false;
  if(href.charAt(0)==='/')return true;
  if(!/^https?:/i.test(href)&&href.slice(0,2)!=='//'){return!/^#/.test(href);}
  try{
    var u=href.slice(0,2)==='//'?new URL('https:'+href):new URL(href,parentOrigin||window.location.href);
    var p=new URL(parentOrigin||window.location.href);
    if((u.protocol==='http:'||u.protocol==='https:')&&u.origin===p.origin)return true;
  }catch(x){}
  return false;
}
var links=[].slice.call(document.querySelectorAll('a[href]'));
links.forEach(function(a){
  var href=(a.getAttribute('href')||'').trim();
  var label=textOf(a).toLowerCase();
  var id=map[label];
  if(!id){
    var fromHref=idFromHref(href);
    if(fromHref)id=fromHref;
  }
  if(!id&&href.charAt(0)==='#'){var h0=href.slice(1).split('?')[0];if(h0)id=h0;}
  if(!id&&label){for(var k in map){if(map.hasOwnProperty(k)&&k.length>0&&(label===k||label.indexOf(k)!==-1)){id=map[k];break;}}}
  if(isExternalUrl(href)){
    if(!id)id=map[label]||'home';
    a.setAttribute('href','#'+id);
    a.removeAttribute('target');
  }else if(sameApp(href)){
    if(!id)id='home';
    a.setAttribute('href','#'+id);
    a.removeAttribute('target');
  }else if(!/^mailto:|^tel:|^javascript:/i.test(href)&&(href===''||href==='#'||href==='#/'||!href)){
    a.setAttribute('href','#home');
  }
});
document.addEventListener('click',function(e){
  var t=e.target;
  while(t&&t.tagName!=='A'){t=t.parentElement;}
  if(!t)return;
  var href=t.getAttribute('href')||'';
  if(!href.startsWith('#'))return;
  var target=document.querySelector(href);
  if(!target){target=document.getElementById('home');}
  if(!target)return;
  e.preventDefault();
  target.scrollIntoView({behavior:'smooth',block:'start'});
});
window.addEventListener('error',function(e){
  var msg=String((e&&e.message)||'').toLowerCase();
  if(msg.indexOf('localhost')!==-1&&msg.indexOf('refused')!==-1){
    e.preventDefault&&e.preventDefault();
  }
},true);
document.addEventListener('click',function(e){
  var n=e.target;
  while(n&&n.tagName!=='A'&&n.tagName!=='BUTTON'){n=n.parentElement;}
  if(!n)return;
  var href='';
  if(n.tagName==='A') href=String(n.getAttribute('href')||'').trim();
  var onclick=String(n.getAttribute('onclick')||'');
  var badHref=/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(href)||href.charAt(0)==='/';
  var badOnclick=/https?:\/\/(?:localhost|127\.0\.0\.1)/i.test(onclick)||/location\.(href|assign|replace)/i.test(onclick);
  if(badHref||badOnclick){
    e.preventDefault();
    var home=document.getElementById('home');
    if(home&&home.scrollIntoView) home.scrollIntoView({behavior:'smooth',block:'start'});
    location.hash='#home';
  }
},true);
document.addEventListener('submit',function(e){
  var form=e.target;
  if(!(form&&form.tagName==='FORM'))return;
  var action=(form.getAttribute('action')||'').trim();
  var id=idFromHref(action)||'contact';
  var target=document.getElementById(id)||document.getElementById('contact')||document.getElementById('home');
  if(target){
    e.preventDefault();
    target.scrollIntoView({behavior:'smooth',block:'start'});
  }else{
    e.preventDefault();
  }
},true);
})();</script></body>`
    );
  }

  return output;
}
