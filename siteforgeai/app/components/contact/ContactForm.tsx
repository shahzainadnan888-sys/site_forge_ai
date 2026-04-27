"use client";

import { useState } from "react";

const SUPPORT_EMAIL = "support@buildwithsiteforge.com";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setErrorMessage("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const message = String(fd.get("message") ?? "").trim();

    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) {
        setStatus("error");
        setErrorMessage(data.error || "Something went wrong.");
        return;
      }
      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
      setErrorMessage(
        "We could not reach the server. Please try again or email " + SUPPORT_EMAIL + "."
      );
    }
  }

  return (
    <form
      className="sf-contact-shell sf-fade-up sf-animate-delay-4 p-6 sm:p-8"
      onSubmit={handleSubmit}
      onInput={() => {
        if (status === "success") {
          setStatus("idle");
        }
      }}
    >
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

        {status === "success" ? (
          <p className="text-sm" style={{ color: "var(--sf-accent-from)" }}>
            Message sent. We will reply to you at the email you provided.
          </p>
        ) : null}

        {status === "error" && errorMessage ? (
          <p className="text-sm" style={{ color: "var(--sf-text-muted)" }}>
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "loading"}
          className="sf-cta-glow mt-2 inline-flex h-12 items-center justify-center rounded-full px-8 text-base font-semibold text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
          style={{
            background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
          }}
        >
          {status === "loading" ? "Sending…" : "Send message"}
        </button>

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
    </form>
  );
}
