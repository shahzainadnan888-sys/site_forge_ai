import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BuilderDashboardView } from "../components/dashboard/BuilderDashboardView";
import { AmbientPointer } from "../components/AmbientPointer";
import { FloatingBlobs } from "../components/FloatingBlobs";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";
import { getCurrentServerUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Dashboard — SiteForge AI",
  description:
    "AI Builder dashboard with prompt composer, generation progress, preview, and project history.",
};

export default async function DashboardPage() {
  const user = await getCurrentServerUser();
  if (!user) {
    redirect("/get-started?message=Please%20first%20login%20to%20generate.");
  }
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <FloatingBlobs />
      <Navbar />
      <AmbientPointer className="relative flex-1">
        <main className="min-h-0 w-full">
          <BuilderDashboardView />
          <Footer />
        </main>
      </AmbientPointer>
    </div>
  );
}
