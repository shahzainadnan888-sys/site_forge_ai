import type { Metadata } from "next";
import { ServicesView } from "../components/services/ServicesView";
import { AmbientPointer } from "../components/AmbientPointer";
import { FloatingBlobs } from "../components/FloatingBlobs";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Services — SiteForge AI",
  description:
    "Streamlined website generation: responsive, high-quality single-page sites in minutes. Templates, landing pages, and portfolios—production-ready, no coding required.",
};

export default function ServicesPage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <FloatingBlobs />
      <Navbar />
      <AmbientPointer className="relative flex-1">
        <main className="min-h-0 w-full">
          <ServicesView />
          <Footer />
        </main>
      </AmbientPointer>
    </div>
  );
}
