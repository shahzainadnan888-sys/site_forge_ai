import type { Metadata } from "next";
import { PlansView } from "../components/plans/PlansView";
import { AmbientPointer } from "../components/AmbientPointer";
import { FloatingBlobs } from "../components/FloatingBlobs";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Buy Credits — SiteForge AI",
  description: "Buy AI credits: 10 credits per website generation, 2 credits per edit. New users get 16 credits free.",
};

export default function PlansPage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <FloatingBlobs />
      <Navbar />
      <AmbientPointer className="relative flex-1">
        <main className="min-h-0 w-full">
          <PlansView />
          <Footer />
        </main>
      </AmbientPointer>
    </div>
  );
}
