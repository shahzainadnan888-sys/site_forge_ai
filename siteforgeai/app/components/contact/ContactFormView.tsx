export function ContactFormView() {
  return (
    <>
      <section className="relative mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-2xl text-center">
          <p
            className="sf-fade-up sf-animate-delay-1 mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
            style={{
              borderColor: "var(--sf-border)",
              color: "var(--sf-text-muted)",
              background: "color-mix(in srgb, var(--sf-card) 60%, transparent)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
                boxShadow: "0 0 8px var(--sf-glow)",
              }}
            />
            Contact
          </p>
          <h1
            className="sf-fade-up sf-animate-delay-2 text-4xl font-bold leading-tight tracking-tight sm:text-5xl"
            style={{ color: "var(--sf-text)" }}
          >
            Let&apos;s build your next site
          </h1>
          <p
            className="sf-fade-up sf-animate-delay-3 mx-auto mt-4 text-base sm:text-lg"
            style={{ color: "var(--sf-text-muted)" }}
          >
            Tell us what you are working on and we will get back with a tailored
            walkthrough.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <div
            className="sf-fade-up sf-animate-delay-3 rounded-2xl border p-6 sm:p-7"
            style={{
              borderColor: "var(--sf-border)",
              background: "color-mix(in srgb, var(--sf-card) 70%, transparent)",
            }}
          >
            <h2
              className="text-base font-semibold tracking-tight"
              style={{ color: "var(--sf-text)" }}
            >
              Direct contact
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              For general inquiries, business partnerships, and feedback.
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <span className="block text-xs font-medium uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
                  Email
                </span>
                <div className="mt-0.5 flex flex-col items-start gap-1">
                  <a
                    href="mailto:support@buildwithsiteforge.com"
                    className="block break-all font-medium underline-offset-2 transition hover:underline"
                    style={{ color: "var(--sf-accent-from)" }}
                  >
                    support@buildwithsiteforge.com
                  </a>
                  <a
                    href="mailto:hello@buildwithsiteforce.com"
                    className="block break-all font-medium underline-offset-2 transition hover:underline"
                    style={{ color: "var(--sf-accent-from)" }}
                  >
                    hello@buildwithsiteforce.com
                  </a>
                </div>
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M6.94 8.5h3.08V19H6.94zM8.48 4a1.79 1.79 0 110 3.58 1.79 1.79 0 010-3.58zm3.47 4.5h2.95v1.43h.04c.41-.78 1.41-1.6 2.9-1.6 3.1 0 3.67 2.04 3.67 4.69V19h-3.08v-5.31c0-1.27-.02-2.9-1.77-2.9-1.78 0-2.05 1.38-2.05 2.81V19h-3.08V8.5z" />
                </svg>
                LinkedIn
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.46-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.35 1.08 2.92.83.09-.65.35-1.08.63-1.33-2.22-.25-4.56-1.1-4.56-4.92 0-1.08.39-1.97 1.02-2.66-.1-.25-.44-1.26.1-2.62 0 0 .84-.27 2.75 1.01A9.58 9.58 0 0112 6.84c.85 0 1.7.11 2.5.33 1.91-1.28 2.75-1.01 2.75-1.01.54 1.36.2 2.37.1 2.62.64.69 1.02 1.58 1.02 2.66 0 3.83-2.35 4.67-4.58 4.91.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0012 2z" />
                </svg>
                GitHub
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: "var(--sf-border)", color: "var(--sf-text)" }}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.9 2H22l-6.77 7.73L23 22h-6.1l-4.79-6.27L6.65 22H3.54l7.24-8.27L1 2h6.25l4.33 5.74L18.9 2zm-1.07 18h1.69L6.33 3.9H4.52L17.83 20z" />
                </svg>
                X
              </a>
            </div>
          </div>

          <div
            className="sf-fade-up sf-animate-delay-4 rounded-2xl border p-6 sm:p-7"
            style={{
              borderColor: "var(--sf-border)",
              background: "color-mix(in srgb, var(--sf-card) 70%, transparent)",
            }}
          >
            <h2
              className="text-base font-semibold tracking-tight"
              style={{ color: "var(--sf-text)" }}
            >
              Founder
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              Leadership behind SiteForge AI.
            </p>
            <ul className="mt-4 space-y-3 text-sm" style={{ color: "var(--sf-text)" }}>
              <li>
                <span className="text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                  Founder
                </span>
                <p className="mt-0.5 font-medium">Shahzain Adnan</p>
              </li>
              <li>
                <span className="text-xs font-medium" style={{ color: "var(--sf-text-muted)" }}>
                  Co-Founder
                </span>
                <p className="mt-0.5 font-medium">Arooj Zahra</p>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 sm:pb-24">
        <form
          className="sf-contact-shell sf-fade-up sf-animate-delay-4 p-6 sm:p-8"
          action="#"
          method="post"
        >
          <div className="grid gap-5">
            <div className="sf-field">
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                placeholder=" "
                className="sf-field-control h-12 px-4 text-base"
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
                placeholder=" "
                className="sf-field-control h-12 px-4 text-base"
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
              className="sf-cta-glow mt-2 inline-flex h-12 items-center justify-center rounded-full px-8 text-base font-semibold text-white transition hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(90deg, var(--sf-accent-from), var(--sf-accent-to))`,
              }}
            >
              Send Message
            </button>
          </div>
        </form>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          <article
            id="privacy-policy"
            className="rounded-2xl border p-6 sm:p-7"
            style={{ borderColor: "var(--sf-border)", background: "color-mix(in srgb, var(--sf-card) 72%, transparent)" }}
          >
            <h2 className="text-lg font-semibold" style={{ color: "var(--sf-text)" }}>
              Privacy Policy
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              We value your privacy.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
              Information we collect
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm" style={{ color: "var(--sf-text)" }}>
              <li>Email address when you sign in with Google</li>
              <li>Basic usage data to improve our service</li>
            </ul>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--sf-text-muted)" }}>
              How we use your information
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm" style={{ color: "var(--sf-text)" }}>
              <li>To provide access to your account</li>
              <li>To improve our platform</li>
            </ul>
            <p className="mt-3 text-sm" style={{ color: "var(--sf-text)" }}>
              We do not sell or share your personal data with third parties.
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--sf-text)" }}>
              Data security: we take reasonable steps to protect your information.
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--sf-text)" }}>
              Contact: support@buildwithsiteforge.com
            </p>
          </article>

          <article
            id="terms-of-service"
            className="rounded-2xl border p-6 sm:p-7"
            style={{ borderColor: "var(--sf-border)", background: "color-mix(in srgb, var(--sf-card) 72%, transparent)" }}
          >
            <h2 className="text-lg font-semibold" style={{ color: "var(--sf-text)" }}>
              Terms of Service
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              By using this website, you agree to the following terms.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-sm" style={{ color: "var(--sf-text)" }}>
              <li>Use of service: use this platform responsibly and do not misuse the system.</li>
              <li>Accounts: you are responsible for your account activity.</li>
              <li>Payments: purchases and credits are final; no refunds unless stated otherwise.</li>
              <li>Limitation of liability: we are not responsible for damages from use of this service.</li>
              <li>Changes: we may update these terms at any time.</li>
            </ul>
            <p className="mt-3 text-sm" style={{ color: "var(--sf-text)" }}>
              Contact: support@buildwithsiteforge.com
            </p>
          </article>

          <article
            id="support"
            className="rounded-2xl border p-6 sm:p-7"
            style={{ borderColor: "var(--sf-border)", background: "color-mix(in srgb, var(--sf-card) 72%, transparent)" }}
          >
            <h2 className="text-lg font-semibold" style={{ color: "var(--sf-text)" }}>
              Support
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--sf-text-muted)" }}>
              Need help? We are here for you.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-sm" style={{ color: "var(--sf-text)" }}>
              <li>Common issues</li>
              <li>Login problems</li>
              <li>Payment issues</li>
              <li>Account questions</li>
              <li>Contact us</li>
            </ul>
            <p className="mt-3 text-sm" style={{ color: "var(--sf-text)" }}>
              Email: support@buildwithsiteforge.com
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--sf-text)" }}>
              Response time: we usually reply within 24 hours.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
