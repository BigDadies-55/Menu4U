// Inforu SMS gateway — https://www.inforu.co.il
// Env vars required: INFORU_USERNAME, INFORU_API_TOKEN, INFORU_SENDER_NAME

const INFORU_URL = "https://api.inforu.co.il/SendMessageXml.ashx";

/** Distinct reason a send can fail — surfaced to the UI for diagnosis. */
export type SmsError = "not_configured" | "gateway_error" | "network_error";

export class SmsConfigError extends Error {
  constructor() {
    super("SMS gateway not configured (INFORU_USERNAME / INFORU_API_TOKEN missing)");
    this.name = "SmsConfigError";
  }
}

function toIsraeliE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+972${digits}`;
}

/** Escape characters that would otherwise break the XML payload. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function isSmsConfigured(): boolean {
  return !!(process.env.INFORU_USERNAME && process.env.INFORU_API_TOKEN);
}

export async function sendSms(phone: string, message: string): Promise<boolean> {
  const username = process.env.INFORU_USERNAME;
  const token    = process.env.INFORU_API_TOKEN;
  const sender   = process.env.INFORU_SENDER_NAME ?? "Menu4U";

  if (!username || !token) {
    console.warn("[sms] INFORU_USERNAME / INFORU_API_TOKEN not configured");
    throw new SmsConfigError();
  }

  const to = toIsraeliE164(phone);

  const xml = `<Inforu>
    <User>
      <Username>${xmlEscape(username)}</Username>
      <ApiToken>${xmlEscape(token)}</ApiToken>
    </User>
    <Content><Message>${xmlEscape(message)}</Message></Content>
    <Recipients><PhoneNumber>${xmlEscape(to)}</PhoneNumber></Recipients>
    <Settings><SenderName>${xmlEscape(sender)}</SenderName></Settings>
  </Inforu>`;

  try {
    const res = await fetch(INFORU_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ InforuXML: xml }),
    });
    const text = await res.text();
    // Inforu returns XML — Status=1 means success
    const ok = text.includes("<Status>1</Status>") || text.includes("Status>1<");
    if (!ok) {
      console.error("[sms] gateway rejected send:", text.slice(0, 300));
    }
    return ok;
  } catch (e) {
    console.error("[sms] send failed", e);
    return false;
  }
}

export async function sendSmsBulk(
  phones: string[],
  message: string
): Promise<{ sent: number; failed: number }> {
  // Surface a missing-config error up front instead of marking every number as "failed".
  if (!isSmsConfigured()) {
    throw new SmsConfigError();
  }
  const results = await Promise.allSettled(phones.map(p => sendSms(p, message)));
  const sent   = results.filter(r => r.status === "fulfilled" && r.value).length;
  const failed = results.length - sent;
  return { sent, failed };
}
