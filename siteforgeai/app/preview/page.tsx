import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AmbientPointer } from "../components/AmbientPointer";
import { FloatingBlobs } from "../components/FloatingBlobs";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";
import { PreviewWorkspace } from "../components/editor/PreviewWorkspace";
import { readVerifiedFirebaseSession } from "@/lib/auth/server-session";

export const metadata: Metadata = {
  title: "Preview — SiteForge AI",
  description: "Separate page for generated website preview across devices.",
};

export default async function PreviewPage() {
  const session = await readVerifiedFirebaseSession();
  if (!session) {
    redirect("/get-started");
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <FloatingBlobs />
      <Navbar />
      <AmbientPointer className="relative flex-1">
        <main className="min-h-0 w-full">
          <PreviewWorkspace />
          <Footer />
        </main>
      </AmbientPointer>
    </div>
  );
}
