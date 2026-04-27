/**
 * Optional Cloudflare Turnstile verification. When TURNSTILE_SECRET_KEY is unset,
 * verification is skipped (backwards compatible). Add NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * to the client and pass `turnstileToken` in the JSON body of protected POSTs.
 */
export async function verifyTurnstileIfConfigured(
  token: string | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: true };
  }
  if (typeof token !== "string" || !token.trim()) {
    return { ok: false, error: "Missing Turnstile verification. Refresh and try again." };
  }
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token.trim());
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });
    const data = (await r.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data?.success) return { ok: true };
    return {
      ok: false,
      error: "Security check failed. Refresh the page and try again.",
    };
  } catch {
    return { ok: false, error: "Security verification could not be completed." };
  }
}
