import type { Metadata } from "next";
import { AboutMission } from "../components/about/AboutMission";
import { AboutStoryHero } from "../components/about/AboutStoryHero";
import { HowAILayers } from "../components/about/HowAILayers";
import { TeamCards } from "../components/about/TeamCards";
import { AmbientPointer } from "../components/AmbientPointer";
import { FloatingBlobs } from "../components/FloatingBlobs";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "About — SiteForge AI",
  description:
    "Simple, fast website generation: landing pages, single-page portfolios, and ready-made templates. Build and launch a professional site without coding.",
};

export default function AboutPage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <FloatingBlobs />
      <Navbar />
      <AmbientPointer className="relative flex-1">
        <main className="min-h-0 w-full">
          <AboutStoryHero />
          <AboutMission />
          <HowAILayers />
          <TeamCards />
          <Footer />
        </main>
      </AmbientPointer>
    </div>
  );
}
