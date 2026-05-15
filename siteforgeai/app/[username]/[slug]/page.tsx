import { renderPublishedSitePage } from "@/lib/published-site/render-published-page";

type Props = {
  params: Promise<{ username: string; slug: string }>;
};

export default async function PublishedSiteSubPage({ params }: Props) {
  const { username, slug } = await params;
  return renderPublishedSitePage(username, [slug]);
}
