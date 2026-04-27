import type { Metadata } from "next";
import { ContactFormView } from "../components/contact/ContactFormView";
import { AmbientPointer } from "../components/AmbientPointer";
import { FloatingBlobs } from "../components/FloatingBlobs";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Contact — SiteForge AI",
  description:
    "Reach out to the SiteForge AI team for product help, demos, and support.",
};

export default function ContactPage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <FloatingBlobs />
      <Navbar />
      <AmbientPointer className="relative flex-1">
        <main className="min-h-0 w-full">
          <ContactFormView />
          <Footer />
        </main>
      </AmbientPointer>
    </div>
  );
}
