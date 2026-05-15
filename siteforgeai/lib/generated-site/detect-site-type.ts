export type SiteType =
  | "portfolio"
  | "business"
  | "ecommerce"
  | "saas"
  | "agency"
  | "restaurant"
  | "blog"
  | "landing"
  | "general";

export function detectSiteType(prompt: string): SiteType {
  const t = prompt.toLowerCase();
  if (/\b(ecommerce|e-commerce|online store|shop|storefront|product catalog)\b/.test(t)) return "ecommerce";
  if (/\b(saas|software product|subscription app|b2b platform)\b/.test(t)) return "saas";
  if (/\b(restaurant|cafe|coffee shop|bakery|menu|dining)\b/.test(t)) return "restaurant";
  if (/\b(agency|marketing agency|creative agency|studio)\b/.test(t)) return "agency";
  if (/\b(blog|magazine|news site|publication)\b/.test(t)) return "blog";
  if (/\b(portfolio|personal site|developer|designer|freelance|resume|cv)\b/.test(t)) return "portfolio";
  if (/\b(landing page|startup landing|product launch)\b/.test(t)) return "landing";
  if (/\b(business|company|corporate|professional services|consulting)\b/.test(t)) return "business";
  return "general";
}

export function defaultSlugsForSiteType(type: SiteType): string[] {
  switch (type) {
    case "portfolio":
      return ["", "about", "projects", "contact"];
    case "ecommerce":
      return ["", "products", "shop", "contact"];
    case "saas":
      return ["", "features", "pricing", "contact"];
    case "restaurant":
      return ["", "menu", "gallery", "contact"];
    case "agency":
      return ["", "services", "projects", "contact"];
    case "blog":
      return ["", "blog", "about", "contact"];
    case "business":
      return ["", "services", "about", "contact"];
    case "landing":
      return [""];
    default:
      return ["", "about", "services", "contact"];
  }
}

export function typeSpecificGenerationBlock(type: SiteType): string {
  const blocks: Record<SiteType, string> = {
    portfolio: `SITE TYPE: Portfolio — include hero with professional headshot area, skills strip, featured project grid (3–6 cards with images), about story, and contact CTA. Navbar: Home, About, Projects, Contact (each must be a separate generated page).`,
    business: `SITE TYPE: Business — include trust badges, services grid, team/testimonials, stats, and contact. Use professional corporate layout.`,
    ecommerce: `SITE TYPE: E-commerce — include hero promo banner, category chips, product grid (6+ product cards with image, title, price), featured collection, and shop-style navigation.`,
    saas: `SITE TYPE: SaaS — include hero with product mockup, feature grid, integration logos strip, pricing table (3 tiers), testimonials, and signup CTA sections.`,
    agency: `SITE TYPE: Agency — include bold hero, case study cards, services, client logos, team, and contact.`,
    restaurant: `SITE TYPE: Restaurant — include atmospheric hero, menu highlights, gallery grid, hours/location, reservation CTA.`,
    blog: `SITE TYPE: Blog — include featured post hero, article cards grid, categories, author bio, newsletter signup.`,
    landing: `SITE TYPE: Landing page — single high-converting page with hero, benefits, social proof, FAQ, CTA (use single-page hash nav unless user asked for multiple pages).`,
    general: `SITE TYPE: General — infer the best sections from the user request; use premium layout patterns appropriate to the topic.`,
  };
  return blocks[type];
}
