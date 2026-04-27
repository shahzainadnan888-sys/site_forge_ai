import type { Metadata } from "next";
import { AccountView } from "../components/account/AccountView";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

export const metadata: Metadata = {
  title: "Account — SiteForge AI",
  description: "View your account profile and credit balance in SiteForge AI.",
};

export default function AccountPage() {
  return (
    <div className="min-h-full">
      <Navbar />
      <AccountView />
      <Footer />
    </div>
  );
}
