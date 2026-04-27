import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AmbientPointer } from "../components/AmbientPointer";
import { FloatingBlobs } from "../components/FloatingBlobs";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";
import { EditorWorkspace } from "../components/editor/EditorWorkspace";
import { readVerifiedFirebaseSession } from "@/lib/auth/server-session";

export const metadata: Metadata = {
  title: "Editor — SiteForge AI",
  description: "Visual and AI-assisted website editor.",
};

export default async function EditorPage() {
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
          <EditorWorkspace />
          <Footer />
        </main>
      </AmbientPointer>
    </div>
  );
}
