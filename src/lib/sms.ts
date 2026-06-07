// Inforu SMS gateway (API v2) — https://www.inforu.co.il
// Env vars required: INFORU_USERNAME, INFORU_API_TOKEN, INFORU_SENDER_NAME
//
// v2 is a JSON REST API authenticated with HTTP Basic auth:
//   Authorization: Basic base64("<username>:<apiToken>")
// Success is indicated by StatusId === 1 in the JSON response.

const INFORU_URL = "https://capi.inforu.co.il/api/v2/SMS/SendSms";

/** Distinct reason a send can fail — surfaced to the UI for diagnosis. */
export type SmsError = "not_configured" | "gateway_error" | "network_error";

export class SmsConfigError extends Error {
  constructor() {
    super("SMS gateway not configured (INFORU_USERNAME / INFORU_API_TOKEN missing)");
    this.name = "SmsConfigError";
  }
}

/** Normalize to the local Israeli format Inforu expects (e.g. 0501234567). */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0"))   return digits;
  return `0${digits}`;
}

function authHeader(username: string, token: string): string {
  return `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`;
}

function buildPayload(phones: string[], message: string, sender: string) {
  return {
    Data: {
      Message: message,
      Recipients: phones.map(p => ({ Phone: normalizePhone(p) })),
      Settings: { Sender: sender },
    },
  };
}

export function isSmsConfigured(): boolean {
  return !!(process.env.INFORU_USERNAME && process.env.INFORU_API_TOKEN);
}

/** Diagnostic: which INFORU_* vars are present (never exposes the values). */
export function smsConfigStatus() {
  return {
    hasUsername: !!process.env.INFORU_USERNAME,
    hasToken:    !!process.env.INFORU_API_TOKEN,
    senderName:  process.env.INFORU_SENDER_NAME ?? "Menu4U (default)",
    endpoint:    INFORU_URL,
  };
}

/** Low-level send to one or more recipients in a single API call. */
async function postToInforu(
  phones: string[],
  message: string
): Promise<{ ok: boolean; httpStatus?: number; response?: string; error?: string }> {
  const username = process.env.INFORU_USERNAME;
  const token    = process.env.INFORU_API_TOKEN;
  const sender   = process.env.INFORU_SENDER_NAME ?? "Menu4U";

  if (!username || !token) return { ok: false, error: "not_configured" };

  try {
    const res = await fetch(INFORU_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader(username, token),
      },
      body: JSON.stringify(buildPayload(phones, message, sender)),
    });
    const text = await res.text();
    let statusId: number | undefined;
    try { statusId = JSON.parse(text)?.StatusId; } catch { /* non-JSON response */ }
    const ok = statusId === 1;
    if (!ok) console.error("[sms] gateway rejected send:", text.slice(0, 400));
    return { ok, httpStatus: res.status, response: text.slice(0, 600) };
  } catch (e) {
    console.error("[sms] send failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

export async function sendSms(phone: string, message: string): Promise<boolean> {
  if (!isSmsConfigured()) throw new SmsConfigError();
  const r = await postToInforu([phone], message);
  return r.ok;
}

/** Send one SMS and return the raw gateway response for diagnosis. */
export async function sendSmsDetailed(phone: string, message: string) {
  return postToInforu([phone], message);
}

export async function sendSmsBulk(
  phones: string[],
  message: string
): Promise<{ sent: number; failed: number }> {
  // Surface a missing-config error up front instead of marking every number as "failed".
  if (!isSmsConfigured()) throw new SmsConfigError();
  if (phones.length === 0) return { sent: 0, failed: 0 };

  // v2 accepts many recipients in a single request.
  const r = await postToInforu(phones, message);
  return r.ok
    ? { sent: phones.length, failed: 0 }
    : { sent: 0, failed: phones.length };
}
