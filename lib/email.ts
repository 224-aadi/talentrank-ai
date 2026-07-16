export type EmailProvider = "disabled" | "resend" | "postmark" | "sendgrid" | "webhook";

export type EmailDeliveryResult = {
  provider: EmailProvider;
  delivered: boolean;
  detail: string;
  messageId?: string;
};

export type TransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  template: "invite" | "password_reset" | "diagnostic";
  metadata?: Record<string, string>;
};

function provider(): EmailProvider {
  const configured = (process.env.TALENTRANK_EMAIL_PROVIDER || "").toLowerCase();
  if (configured === "resend" || configured === "postmark" || configured === "sendgrid" || configured === "webhook") return configured;
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.POSTMARK_SERVER_TOKEN) return "postmark";
  if (process.env.SENDGRID_API_KEY) return "sendgrid";
  if (process.env.TALENTRANK_EMAIL_WEBHOOK_URL) return "webhook";
  return "disabled";
}

export function emailConfig() {
  const activeProvider = provider();
  const from = process.env.TALENTRANK_EMAIL_FROM || "";
  const appUrl = process.env.TALENTRANK_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return {
    provider: activeProvider,
    from,
    appUrl,
    ready:
      Boolean(from) &&
      ((activeProvider === "resend" && Boolean(process.env.RESEND_API_KEY)) ||
        (activeProvider === "postmark" && Boolean(process.env.POSTMARK_SERVER_TOKEN)) ||
        (activeProvider === "sendgrid" && Boolean(process.env.SENDGRID_API_KEY)) ||
        (activeProvider === "webhook" && Boolean(process.env.TALENTRANK_EMAIL_WEBHOOK_URL))),
  };
}

export function absoluteAppUrl(pathOrUrl: string, origin?: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const configuredBase = process.env.TALENTRANK_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const requestBase = origin && !/^https?:\/\/0\.0\.0\.0(?::\d+)?$/i.test(origin) ? origin : "";
  const base = configuredBase || requestBase || "http://localhost:3000";
  return new URL(pathOrUrl, base).toString();
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseAddress(value: string) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return { email: value.trim() };
  return { name: match[1].replace(/^"|"$/g, "").trim() || undefined, email: match[2].trim() };
}

async function parseProviderResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.message || payload?.error || payload?.errors?.[0]?.message || `Email provider returned HTTP ${response.status}.`;
    throw new Error(String(detail));
  }
  return payload;
}

export async function sendTransactionalEmail(input: TransactionalEmailInput): Promise<EmailDeliveryResult> {
  const config = emailConfig();
  if (!config.ready) {
    return {
      provider: config.provider,
      delivered: false,
      detail: config.provider === "disabled" ? "Email provider is not configured." : "Email provider is missing required credentials.",
    };
  }

  if (config.provider === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: config.from, to: [input.to], subject: input.subject, text: input.text, html: input.html }),
    });
    const payload = await parseProviderResponse(response);
    return { provider: "resend", delivered: true, detail: "Resend accepted the email.", messageId: payload?.id };
  }

  if (config.provider === "postmark") {
    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "x-postmark-server-token": String(process.env.POSTMARK_SERVER_TOKEN),
        "content-type": "application/json",
      },
      body: JSON.stringify({ From: config.from, To: input.to, Subject: input.subject, TextBody: input.text, HtmlBody: input.html }),
    });
    const payload = await parseProviderResponse(response);
    return { provider: "postmark", delivered: true, detail: "Postmark accepted the email.", messageId: payload?.MessageID };
  }

  if (config.provider === "sendgrid") {
    const from = parseAddress(config.from);
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from,
        subject: input.subject,
        content: [
          { type: "text/plain", value: input.text },
          { type: "text/html", value: input.html },
        ],
      }),
    });
    await parseProviderResponse(response);
    return {
      provider: "sendgrid",
      delivered: true,
      detail: "SendGrid accepted the email.",
      messageId: response.headers.get("x-message-id") || undefined,
    };
  }

  const response = await fetch(String(process.env.TALENTRANK_EMAIL_WEBHOOK_URL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.TALENTRANK_EMAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.TALENTRANK_EMAIL_WEBHOOK_TOKEN}` } : {}),
    },
    body: JSON.stringify({ ...input, from: config.from }),
  });
  const payload = await parseProviderResponse(response);
  return { provider: "webhook", delivered: true, detail: "Email webhook accepted the email.", messageId: payload?.id || payload?.messageId };
}

export async function sendInviteEmail(input: { to: string; name: string; inviteUrl: string; organizationId: string; origin?: string }) {
  const url = absoluteAppUrl(input.inviteUrl, input.origin);
  const safeName = escapeHtml(input.name);
  const safeOrg = escapeHtml(input.organizationId);
  return sendTransactionalEmail({
    to: input.to,
    subject: "You're invited to TalentRank AI",
    template: "invite",
    metadata: { organizationId: input.organizationId },
    text: `Hi ${input.name},\n\nYou've been invited to TalentRank AI for ${input.organizationId}.\n\nAccept your invite: ${url}\n\nThis link expires in 7 days.`,
    html: `<p>Hi ${safeName},</p><p>You've been invited to TalentRank AI for <strong>${safeOrg}</strong>.</p><p><a href="${escapeHtml(url)}">Accept your invite</a></p><p>This link expires in 7 days.</p>`,
  });
}

export async function sendPasswordResetEmail(input: { to: string; resetUrl: string; origin?: string }) {
  const url = absoluteAppUrl(input.resetUrl, input.origin);
  return sendTransactionalEmail({
    to: input.to,
    subject: "Reset your TalentRank AI password",
    template: "password_reset",
    text: `Reset your TalentRank AI password:\n\n${url}\n\nThis link expires in 1 hour. If you did not request it, you can ignore this email.`,
    html: `<p>Reset your TalentRank AI password:</p><p><a href="${escapeHtml(url)}">Reset password</a></p><p>This link expires in 1 hour. If you did not request it, you can ignore this email.</p>`,
  });
}
