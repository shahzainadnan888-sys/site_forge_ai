export class CsrfError extends Error {
  constructor(message = "CSRF check failed.") {
    super(message);
    this.name = "CsrfError";
  }
}

function normalizeHost(value: string | null): string {
  return (value || "").trim().toLowerCase();
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) {
    throw new CsrfError("Missing origin header.");
  }

  const originHost = normalizeHost(new URL(origin).host);
  const forwardedHost = normalizeHost(req.headers.get("x-forwarded-host"));
  const host = normalizeHost(req.headers.get("host"));
  const requestHost = forwardedHost || host;

  if (!requestHost || originHost !== requestHost) {
    throw new CsrfError("Origin does not match request host.");
  }
}
