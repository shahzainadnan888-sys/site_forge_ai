import type { SiteType } from "@/lib/generated-site/detect-site-type";

/** Curated Unsplash images — stable IDs, relevant to each site category. */
type ImageRole = "hero" | "card" | "avatar" | "product" | "food" | "team" | "office" | "feature";

const U = (id: string, w: number, h: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const CATALOG: Record<SiteType, Record<ImageRole, string[]>> = {
  portfolio: {
    hero: [U("photo-1498050108023-c5249f4df085", 1200, 700)],
    card: [
      U("photo-1460925895917-afdab827c52f", 600, 400),
      U("photo-1555066931-4365d14bab8c", 600, 400),
      U("photo-1551650975-87deedd944c3", 600, 400),
    ],
    avatar: [U("photo-1507003211169-0a1dd7228f2d", 200, 200)],
    product: [],
    food: [],
    team: [],
    office: [U("photo-1522071820081-009f0129c71c", 600, 400)],
    feature: [U("photo-1517694712202-14dd9538aa43", 800, 500)],
  },
  business: {
    hero: [U("photo-1497366216548-37526070297c", 1200, 700)],
    card: [U("photo-1552664730-d307ca884978", 600, 400), U("photo-1600880292203-757bb62b4baf", 600, 400)],
    avatar: [U("photo-1573496359142-b8d87734a5a2", 200, 200)],
    product: [],
    food: [],
    team: [U("photo-1522071820081-009f0129c71c", 400, 400), U("photo-1580489944761-15a19d654956", 400, 400)],
    office: [U("photo-1497366754035-f200968a6e72", 800, 500)],
    feature: [U("photo-1553877522-43269d4ea984", 800, 500)],
  },
  ecommerce: {
    hero: [U("photo-1441986300917-64674bd600d8", 1200, 700)],
    card: [
      U("photo-1523275335684-37898b6baf30", 600, 400),
      U("photo-1505740420928-5e560c06d30e", 600, 400),
      U("photo-1572635196237-14bfecc7d2b5", 600, 400),
    ],
    avatar: [],
    product: [
      U("photo-1523275335684-37898b6baf30", 500, 500),
      U("photo-1505740420928-5e560c06d30e", 500, 500),
      U("photo-1572635196237-14bfecc7d2b5", 500, 500),
      U("photo-1560343090-f0409e92752a", 500, 500),
    ],
    food: [],
    team: [],
    office: [],
    feature: [U("photo-1472851294608-062f824d29cc", 800, 500)],
  },
  saas: {
    hero: [U("photo-1551434678-e076c223a692", 1200, 700)],
    card: [U("photo-1551288049-bebda4e38f71", 600, 400), U("photo-1460925895917-afdab827c52f", 600, 400)],
    avatar: [U("photo-1560250097-0b93528c311a", 200, 200)],
    product: [],
    food: [],
    team: [],
    office: [U("photo-1553877522-43269d4ea984", 800, 500)],
    feature: [U("photo-1551288049-bebda4e38f71", 800, 500)],
  },
  agency: {
    hero: [U("photo-1497366216548-37526070297c", 1200, 700)],
    card: [U("photo-1553877522-43269d4ea984", 600, 400), U("photo-1460925895917-afdab827c52f", 600, 400)],
    avatar: [U("photo-1472099645785-5658abf4ff4e", 200, 200)],
    product: [],
    food: [],
    team: [U("photo-1522071820081-009f0129c71c", 400, 400)],
    office: [U("photo-1497366754035-f200968a6e72", 800, 500)],
    feature: [U("photo-1552664730-d307ca884978", 800, 500)],
  },
  restaurant: {
    hero: [U("photo-1517248135467-4c7edcad34c4", 1200, 700)],
    card: [
      U("photo-1546069901-ba9599a7e63c", 600, 400),
      U("photo-1565299624946-b28f40a0ae38", 600, 400),
      U("photo-1565958011703-44f9824ba126", 600, 400),
    ],
    avatar: [],
    product: [],
    food: [
      U("photo-1546069901-ba9599a7e63c", 500, 400),
      U("photo-1565299624946-b28f40a0ae38", 500, 400),
      U("photo-1565958011703-44f9824ba126", 500, 400),
    ],
    team: [],
    office: [U("photo-1517248135467-4c7edcad34c4", 800, 500)],
    feature: [U("photo-1414235073718-3379a7450c05", 800, 500)],
  },
  blog: {
    hero: [U("photo-1499750310107-5be932f6606b", 1200, 700)],
    card: [U("photo-1456324502049-3e8a1b9d6f3d", 600, 400), U("photo-1504711434969-e33886168f5c", 600, 400)],
    avatar: [U("photo-1535713875002-d1d0cf377fde", 200, 200)],
    product: [],
    food: [],
    team: [],
    office: [],
    feature: [U("photo-1499750310107-5be932f6606b", 800, 500)],
  },
  landing: {
    hero: [U("photo-1551434678-e076c223a692", 1200, 700)],
    card: [U("photo-1553877522-43269d4ea984", 600, 400)],
    avatar: [U("photo-1472099645785-5658abf4ff4e", 200, 200)],
    product: [],
    food: [],
    team: [],
    office: [],
    feature: [U("photo-1460925895917-afdab827c52f", 800, 500)],
  },
  general: {
    hero: [U("photo-1497366216548-37526070297c", 1200, 700)],
    card: [U("photo-1553877522-43269d4ea984", 600, 400), U("photo-1460925895917-afdab827c52f", 600, 400)],
    avatar: [U("photo-1472099645785-5658abf4ff4e", 200, 200)],
    product: [U("photo-1523275335684-37898b6baf30", 500, 500)],
    food: [U("photo-1546069901-ba9599a7e63c", 500, 400)],
    team: [U("photo-1522071820081-009f0129c71c", 400, 400)],
    office: [U("photo-1497366754035-f200968a6e72", 800, 500)],
    feature: [U("photo-1552664730-d307ca884978", 800, 500)],
  },
};

export function getThemedImage(siteType: SiteType, role: ImageRole, index = 0): string {
  const pool = CATALOG[siteType]?.[role] ?? CATALOG.general[role];
  if (!pool?.length) {
    const fallback = CATALOG.general.card[0] ?? CATALOG.general.hero[0];
    return fallback;
  }
  return pool[index % pool.length];
}

export function inferImageRole(tag: string, attrs: string): ImageRole {
  const ctx = `${tag} ${attrs}`.toLowerCase();
  if (/hero|banner|jumbotron/.test(ctx)) return "hero";
  if (/avatar|profile|headshot|portrait/.test(ctx)) return "avatar";
  if (/product|shop|item|catalog/.test(ctx)) return "product";
  if (/food|dish|menu|restaurant/.test(ctx)) return "food";
  if (/team|staff|member/.test(ctx)) return "team";
  if (/office|workspace|corporate/.test(ctx)) return "office";
  if (/feature|service/.test(ctx)) return "feature";
  return "card";
}

/** Replace picsum/random placeholders with category-appropriate Unsplash images. */
export function rewriteImagesForSiteType(html: string, siteType: SiteType): string {
  let index = 0;
  return html.replace(/<img\b([^>]*?)>/gi, (full, attrs) => {
    const role = inferImageRole(full, attrs);
    const src = getThemedImage(siteType, role, index++);
    if (/\bsrc\s*=\s*["'][^"']*["']/i.test(full)) {
      const current = full.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
      if (/picsum\.photos|placeholder|via\.placeholder|placehold\.co/i.test(current)) {
        return full.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${src}"`);
      }
      return full;
    }
    return `<img src="${src}" loading="lazy" ${attrs}>`;
  });
}

export function imageGuidanceForPrompt(siteType: SiteType): string {
  const hero = getThemedImage(siteType, "hero", 0);
  const card = getThemedImage(siteType, "card", 0);
  return `IMAGES (use these exact URLs — themed for ${siteType}, never picsum.photos):
- Hero/banner: ${hero}
- Cards/thumbnails: ${card}
- Use additional <img> with similar professional ${siteType} photography (workspace, products, food, or team as appropriate).`;
}
