export async function sendSignupOtpEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  const from =
    process.env.RESEND_FROM?.trim() ||
    "SiteForge AI <onboarding@resend.dev>";
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: "Your SiteForge AI verification code",
    html: `<p>Your verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>This code expires in 15 minutes. If you did not request it, you can ignore this email.</p>`,
  });
  if (error) {
    throw new Error(error.message || "Failed to send email.");
  }
}
