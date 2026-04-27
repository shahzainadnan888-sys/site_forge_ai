import type { Metadata } from "next";
import { GetStartedView } from "../components/auth/GetStartedView";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Get Started — SiteForge AI",
  description:
    "Sign in or create an account to start building websites with AI on SiteForge AI.",
};

export default function GetStartedPage() {
  return (
    <div className="min-h-full">
      <Navbar />
      <GetStartedView />
      <Footer />
    </div>
  );
}
