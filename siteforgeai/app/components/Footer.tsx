"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const productLinks = [
  { label: "Home", href: "/" },
  { label: "Get started", href: "/get-started" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Plans", href: "/plans" },
  { label: "Services", href: "/services" },
  { label: "Account", href: "/account" },
] as const;

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Features", href: "/" },
  { label: "Support", href: "/contact" },
] as const;

function FooterIcon({ type }: { type: "email" | "founder" | "cofounder" }) {
  if (type === "email") {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8l8 6 8-6" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a5 5 0 100-10 5 5 0 000 10z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21a8 8 0 0116 0" />
    </svg>
  );
}

export function Footer() {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setInView(true);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <footer
      ref={ref}
      className={`relative mt-10 overflow-hidden border-t py-14 transition-all duration-700 ${
        inView ? "opacity-100 translate-y-0" : "translate-y-6 opacity-0"
      }`}
      style={{
        borderColor: "var(--sf-border)",
        background:
          "radial-gradient(1200px circle at 5% 0%, color-mix(in srgb, var(--sf-accent-from) 12%, transparent), transparent 45%), radial-gradient(900px circle at 95% 100%, color-mix(in srgb, var(--sf-accent-to) 10%, transparent), transparent 42%), var(--sf-bg)",
      }}
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-2 xl:grid-cols-4">
        <section>
          <h2
            className="text-xl font-bold tracking-tight"
            style={{
              backgroundImage: "linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            SiteForge AI
          </h2>
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--sf-text)" }}>
            Build Websites with AI in Seconds
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: "var(--sf-text-muted)" }}>
            Generate, customize, and publish conversion-ready websites with a modern AI builder designed for speed.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--sf-text)" }}>
            Product
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {productLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="sf-footer-underline sf-footer-glow-link">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--sf-text)" }}>
            Company
          </h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {companyLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="transition-colors duration-300 hover:text-[var(--sf-accent-from)]"
                  style={{ color: "var(--sf-text-muted)" }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--sf-text)" }}>
            Contact
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex min-w-0 items-start gap-2.5" style={{ color: "var(--sf-text-muted)" }}>
              <FooterIcon type="email" />
              <span className="min-w-0 break-words">support@buildwithsiteforge.com</span>
            </li>
            <li className="flex items-center gap-2.5" style={{ color: "var(--sf-text-muted)" }}>
              <FooterIcon type="founder" />
              <span>Founder: Shahzain Adnan</span>
            </li>
            <li className="flex items-center gap-2.5" style={{ color: "var(--sf-text-muted)" }}>
              <FooterIcon type="cofounder" />
              <span>Co-Founder: Arooj Zahra</span>
            </li>
          </ul>
        </section>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-4 border-t px-4 pt-6 sm:flex-row sm:px-6" style={{ borderColor: "var(--sf-border)" }}>
        <p className="text-center text-sm sm:text-left" style={{ color: "var(--sf-text-muted)" }}>
          © 2026 SiteForge AI. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm sm:justify-end">
          <Link href="#" className="sf-footer-glow-link" style={{ color: "var(--sf-text-muted)" }}>
            Privacy Policy
          </Link>
          <Link href="#" className="sf-footer-glow-link" style={{ color: "var(--sf-text-muted)" }}>
            Terms
          </Link>
          <Link href="/contact" className="sf-footer-glow-link" style={{ color: "var(--sf-text-muted)" }}>
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
