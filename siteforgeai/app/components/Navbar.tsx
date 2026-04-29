"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_LOGO_PATH } from "@/lib/brand";
import { SITEFORGE_SESSION_EVENT } from "@/lib/siteforge-credits";
import { Tooltip } from "@/app/components/Tooltip";

const STORAGE = "siteforge-theme";
const SESSION_KEY = "siteforge-session";
type Session = {
  uid?: string;
  fullName?: string;
  email?: string;
  credits?: number;
  avatarDataUrl?: string;
  freeCreditsBlocked?: boolean;
} | null;

function toggleTheme() {
  const next = document.documentElement.classList.contains("dark")
    ? "light"
    : "dark";
  localStorage.setItem(STORAGE, next);
  document.documentElement.classList.toggle("dark", next === "dark");
}

const contactMenuLinks = [
  { href: "/contact#privacy-policy", label: "Privacy Policy" },
  { href: "/contact#terms-of-service", label: "Terms of Service" },
  { href: "/contact#support", label: "Support" },
] as const;

const links = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/plans", label: "Plans" },
  { href: "/contact", label: "Contact" },
] as const;

function SunIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
    >
      <ellipse cx="12" cy="6" rx="6" ry="2.5" />
      <path d="M6 6v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6" />
      <path d="M6 11v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5" />
    </svg>
  );
}

function DiamondIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l3-4h6l3 4-6 12-6-12z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18" />
    </svg>
  );
}

function LogoIcon() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-transform duration-300 group-hover:scale-105">
      <img
        src={SITE_LOGO_PATH}
        alt="SiteForge AI logo"
        width={36}
        height={36}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [credits, setCredits] = useState(0);
  const [session, setSession] = useState<Session>(null);

  useEffect(() => {
    const readSession = () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) {
          setCredits(0);
          setSession(null);
          return;
        }
        const parsed = JSON.parse(raw) as Session;
        setSession(parsed ?? null);
        setCredits(typeof parsed?.credits === "number" ? parsed.credits : 0);
      } catch {
        setCredits(0);
        setSession(null);
      }
    };

    readSession();
    window.addEventListener("storage", readSession);
    window.addEventListener("focus", readSession);
    window.addEventListener(SITEFORGE_SESSION_EVENT, readSession);
    return () => {
      window.removeEventListener("storage", readSession);
      window.removeEventListener("focus", readSession);
      window.removeEventListener(SITEFORGE_SESSION_EVENT, readSession);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const unlockScroll = () => {
      document.body.style.overflow = prev;
    };
    window.addEventListener("pagehide", unlockScroll);
    return () => {
      window.removeEventListener("pagehide", unlockScroll);
      unlockScroll();
    };
  }, [mobileOpen]);

  const avatarLabel = useMemo(() => {
    const base = session?.fullName?.trim() || session?.email?.trim() || "U";
    const parts = base.split(" ").filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
    return (parts[0]?.slice(0, 2) || "U").toUpperCase();
  }, [session]);

  return (
    <header
      className="sticky top-0 z-50 border-b transition-colors"
      style={{
        borderColor: "var(--sf-border)",
        background: "var(--sf-nav-glass)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <Link href="/" className="group flex min-w-0 shrink items-center gap-2 sm:gap-2.5">
          <LogoIcon />
          <span
            className="truncate text-base font-semibold tracking-tight sm:text-lg"
            style={{ color: "var(--sf-text)" }}
          >
            SiteForge AI
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {links.map((l) => (
            l.href === "/contact" ? (
              <div key={l.href} className="group relative">
                <Link
                  href={l.href}
                  className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-100"
                  style={{ color: "var(--sf-text-muted)" }}
                >
                  {l.label}
                  <span className="text-[10px] opacity-75">▼</span>
                </Link>
                <div
                  className="invisible absolute right-0 top-full z-50 mt-2 min-w-[12rem] rounded-xl border p-2 opacity-0 shadow-xl transition-all duration-150 group-hover:visible group-hover:opacity-100"
                  style={{
                    borderColor: "var(--sf-border)",
                    background: "var(--sf-card)",
                  }}
                >
                  {contactMenuLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-lg px-3 py-2 text-xs font-medium transition hover:opacity-100"
                      style={{ color: "var(--sf-text-muted)" }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-medium transition-colors hover:opacity-100"
                style={{ color: "var(--sf-text-muted)" }}
              >
                {l.label}
              </Link>
            )
          ))}
        </nav>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border transition-all md:hidden"
            style={{
              borderColor: "var(--sf-border)",
              color: "var(--sf-text)",
              background: "var(--sf-card)",
            }}
            aria-expanded={mobileOpen}
            aria-controls="siteforge-mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
          <Tooltip label="Switch between light and dark mode">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-full border transition-all hover:scale-105"
              style={{
                borderColor: "var(--sf-border)",
                color: "var(--sf-text)",
                background: "var(--sf-card)",
              }}
              aria-label="Toggle color theme"
            >
              <span className="block dark:hidden" aria-hidden>
                <MoonIcon />
              </span>
              <span className="hidden dark:block" aria-hidden>
                <SunIcon />
              </span>
            </button>
          </Tooltip>
          <div
            className="inline-flex h-9 max-w-[min(100%,9.5rem)] items-center overflow-hidden rounded-full border pl-2 pr-0.5 sm:h-10 sm:max-w-none sm:pl-3 sm:pr-1"
            style={{
              borderColor: "var(--sf-border)",
              background: "color-mix(in srgb, var(--sf-card) 78%, transparent)",
              color: "var(--sf-text)",
            }}
          >
            <Tooltip side="bottom" label="Your AI credit balance. Generating a site uses 10 credits; each AI edit uses 2 credits.">
              <span
                className="inline-flex min-w-0 cursor-default items-center gap-1 pr-2 text-xs font-semibold sm:gap-1.5 sm:pr-3 sm:text-sm"
                style={{ color: "var(--sf-accent-from)" }}
              >
                <CoinIcon />
                {credits}
              </span>
            </Tooltip>
            <Tooltip side="bottom" label="View plan tiers, pricing, and our contact page.">
              <Link
                href="/plans"
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold sm:h-8 sm:gap-1.5 sm:px-3 sm:text-sm"
                style={{
                  color: "#0b0f1a",
                  background: "#86ef5b",
                }}
              >
                <DiamondIcon />
                <span className="max-[380px]:hidden sm:inline">Upgrade</span>
              </Link>
            </Tooltip>
          </div>
          {session ? (
            <Tooltip label="Open your profile and account details">
              <Link
                href="/account"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border text-sm font-semibold transition hover:scale-105"
                style={{
                  borderColor: "var(--sf-border)",
                  color: "white",
                  background: session.avatarDataUrl
                    ? "var(--sf-card)"
                    : `linear-gradient(135deg, var(--sf-accent-from), var(--sf-accent-to))`,
                  boxShadow: session.avatarDataUrl ? "none" : "0 0 18px var(--sf-glow)",
                }}
                aria-label="Open account page"
              >
                {session.avatarDataUrl ? (
                  <img
                    src={session.avatarDataUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    width={40}
                    height={40}
                  />
                ) : (
                  avatarLabel
                )}
              </Link>
            </Tooltip>
          ) : (
            <Tooltip label="Sign in or create a free account to get started.">
              <Link
                href="/get-started"
                className="sf-cta-glow inline-flex h-9 max-w-[6.5rem] items-center justify-center truncate rounded-full px-3 text-xs font-semibold text-white transition hover:scale-[1.02] active:scale-[0.98] sm:h-10 sm:max-w-none sm:px-5 sm:text-sm"
                style={{
                  background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
                }}
              >
                <span className="sm:hidden">Start</span>
                <span className="hidden sm:inline">Get started</span>
              </Link>
            </Tooltip>
          )}
        </div>
      </div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 top-16 z-40 bg-black/40 md:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <nav
        id="siteforge-mobile-nav"
        className={
          mobileOpen
            ? "absolute left-0 right-0 top-full z-50 max-h-[min(70vh,calc(100dvh-4rem))] overflow-y-auto border-b md:hidden"
            : "hidden"
        }
        style={
          mobileOpen
            ? {
                borderColor: "var(--sf-border)",
                background: "var(--sf-nav-glass)",
                backdropFilter: "blur(12px)",
              }
            : undefined
        }
        aria-hidden={!mobileOpen}
      >
        <ul className="mx-auto max-w-6xl space-y-0.5 px-4 py-3 sm:px-6">
          {links.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    color: active ? "var(--sf-text)" : "var(--sf-text-muted)",
                    background: active
                      ? "color-mix(in srgb, var(--sf-card) 85%, transparent)"
                      : "transparent",
                  }}
                >
                  {l.label}
                </Link>
                {l.href === "/contact" ? (
                  <div className="mt-1 space-y-0.5 pl-3">
                    {contactMenuLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block rounded-lg px-3 py-2 text-xs font-medium transition-colors"
                        style={{ color: "var(--sf-text-muted)" }}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
