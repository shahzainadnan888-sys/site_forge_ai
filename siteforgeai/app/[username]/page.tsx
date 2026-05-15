import { renderPublishedSitePage } from "@/lib/published-site/render-published-page";

type Props = {
  params: Promise<{ username: string }>;
};

export default async function PublishedSiteHomePage({ params }: Props) {
  const { username } = await params;
  return renderPublishedSitePage(username);
}
