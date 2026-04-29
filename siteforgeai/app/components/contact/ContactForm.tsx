"use client";

import { useEffect, useState } from "react";

const SUPPORT_EMAIL = "support@buildwithsiteforge.com";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOAST_MS = 4800;

function CheckCircleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#22c55e" />
      <path
        d="M8 12l2 2 4-5"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [toastOpen, setToastOpen] = useState(false);

  useEffect(() => {
    if (!toastOpen) return;
    const t = window.setTimeout(() => setToastOpen(false), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toastOpen]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;
    setErrorMessage("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const message = String(fd.get("message") ?? "").trim();

    if (!name || !email || !message) {
      setStatus("error");
      setErrorMessage("All fields are required.");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setStatus("error");
      setErrorMessage("Email must be valid.");
      return;
    }

    setStatus("loading");

    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      let data: { success?: boolean; ok?: boolean; error?: string } = {};
      try {
        data = (await r.json()) as typeof data;
      } catch {
        data = {};
      }
      const ok = r.ok && data.success === true;
      if (!ok) {
        setStatus("error");
        setErrorMessage("Failed to send message");
        return;
      }
      form.reset();
      setStatus("idle");
      setToastOpen(true);
    } catch {
      setStatus("error");
      setErrorMessage("Failed to send message");
    }
  }

  return (
    <form className="sf-contact-shell sf-fade-up sf-animate-delay-4 p-6 sm:p-8" onSubmit={handleSubmit}>
      <div className="grid gap-5">
        <div className="sf-field">
          <input
            id="contact-name"
            name="name"
            type="text"
            required
            disabled={status === "loading"}
            placeholder=" "
            className="sf-field-control h-12 px-4 text-base"
            autoComplete="name"
          />
          <label htmlFor="contact-name" className="sf-floating-label">
            Name
          </label>
        </div>

        <div className="sf-field">
          <input
            id="contact-email"
            name="email"
            type="email"
            required
            disabled={status === "loading"}
            placeholder=" "
            className="sf-field-control h-12 px-4 text-base"
            autoComplete="email"
          />
          <label htmlFor="contact-email" className="sf-floating-label">
            Email
          </label>
        </div>

        <div className="sf-field">
          <textarea
            id="contact-message"
            name="message"
            required
            disabled={status === "loading"}
            placeholder=" "
            rows={6}
            className="sf-field-control sf-field-textarea resize-y px-4 pb-4 pt-5 text-base"
          />
          <label htmlFor="contact-message" className="sf-floating-label">
            Message
          </label>
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="sf-cta-glow mt-2 inline-flex h-12 items-center justify-center rounded-full px-8 text-base font-semibold text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
          style={{
            background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
          }}
        >
          {status === "loading" ? "Sending..." : "Send Message"}
        </button>

        {status === "error" && errorMessage ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: "rgba(248,113,113,0.45)",
              color: "#fca5a5",
              background: "color-mix(in srgb, #ef4444 12%, transparent)",
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <p className="text-center text-xs" style={{ color: "var(--sf-text-muted)" }}>
          This sends to{" "}
          <a
            href={"mailto:" + SUPPORT_EMAIL}
            className="font-medium underline-offset-2 transition hover:underline"
            style={{ color: "var(--sf-accent-from)" }}
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>

      {toastOpen ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-5 left-5 z-[100] flex max-w-[min(100vw-2rem,22rem)] animate-[sf-toast-in_0.35s_ease-out]"
        >
          <div
            className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm"
            style={{
              borderColor: "color-mix(in srgb, #22c55e 35%, var(--sf-border))",
              background: "color-mix(in srgb, var(--sf-card) 92%, transparent)",
              boxShadow: "0 12px 40px color-mix(in srgb, #000 22%, transparent)",
            }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircleIcon />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-semibold" style={{ color: "var(--sf-text)" }}>
                Message sent
              </p>
              <p className="mt-0.5 text-xs leading-snug" style={{ color: "var(--sf-text-muted)" }}>
                Your message has been sent successfully.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
