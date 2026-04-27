import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { FAVICON_PATH } from "@/lib/brand";
import { GlobalCursorFx } from "./components/GlobalCursorFx";
import { GlobalSignUpToast } from "./components/GlobalSignUpToast";
import { GlobalZeroCreditsToast } from "./components/GlobalZeroCreditsToast";
import { PromoCreditsBootstrap } from "./components/PromoCreditsBootstrap";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeInitScript = `(function(){try{var s=localStorage.getItem("siteforge-theme");if(s==="dark"){document.documentElement.classList.add("dark");}else if(s==="light"){document.documentElement.classList.remove("dark");}else if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Site Forge Ai",
  icons: {
    icon: FAVICON_PATH,
    shortcut: FAVICON_PATH,
    apple: FAVICON_PATH,
  },
};

/** Ensures correct scaling on phones and tablets. */
export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
    >
      <body
        className="flex min-h-full min-w-0 flex-col overflow-x-hidden"
        style={{ background: "var(--sf-bg)" }}
      >
        <Script id="siteforge-theme" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <GlobalCursorFx />
        <PromoCreditsBootstrap />
        <Suspense fallback={null}>
          <GlobalSignUpToast />
        </Suspense>
        <GlobalZeroCreditsToast />
        {children}
      </body>
    </html>
  );
}