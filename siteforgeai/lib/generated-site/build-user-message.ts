import { defaultSlugsForSiteType, detectSiteType, typeSpecificGenerationBlock } from "@/lib/generated-site/detect-site-type";
import { imageGuidanceForPrompt } from "@/lib/generated-site/image-catalog";
import { wantsSinglePageOnly } from "@/lib/generate-prompt-guards";

const PER_PAGE_CONTENT = `
EACH PAGE MUST BE FULLY DESIGNED (never empty or placeholder-only):
- HOME: hero with headline, subtext, CTA buttons, hero image, trust/social proof strip.
- ABOUT: bio paragraph, skills/tags, experience timeline, profile photo.
- PROJECTS: 3+ project cards with image, title, tech stack, description, CTA button each.
- CONTACT: contact form (name, email, message), email/location, social links.
- SERVICES/PRODUCTS/SHOP: relevant grids with images, titles, descriptions, prices/CTAs.
- PRICING: 3 tier cards with features and CTA.
- MENU/GALLERY: restaurant dishes or food photography grid.`;

export function buildGenerationUserMessage(prompt: string): string {
  const type = detectSiteType(prompt);
  const single = wantsSinglePageOnly(prompt);
  const typeBlock = typeSpecificGenerationBlock(type);
  const imageBlock = imageGuidanceForPrompt(type);

  const multiReminder = single
    ? ""
    : `
MULTI-PAGE (mandatory):
- Output EVERY page: ${defaultSlugsForSiteType(type)
        .map((s) => (s ? `<!-- SITEFORGE_PAGE:${s} -->` : "<!-- SITEFORGE_PAGE: --> (home)"))
        .join(" then ")}.
- Identical navbar on all pages linking to: ${defaultSlugsForSiteType(type)
        .map((s) => (s ? `/${s}` : "/"))
        .join(", ")}.
- Do NOT stop after 2 pages — generate ALL pages with complete unique content per page.`;

  return `${prompt.trim()}

${typeBlock}
${multiReminder}
${PER_PAGE_CONTENT}

${imageBlock}

VISUAL & UX:
- Premium agency-grade UI: glass cards, subtle gradients (violet→fuchsia→cyan), shadows, rounded-2xl, hover animations.
- NEVER use picsum.photos or random stock — only themed Unsplash URLs from the image list above.
- Mobile responsive with hamburger menu under 768px.`.trim();
}
