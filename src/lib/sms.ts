// Inforu SMS gateway — https://www.inforu.co.il
// Env vars required: INFORU_USERNAME, INFORU_API_TOKEN, INFORU_SENDER_NAME

const INFORU_URL = "https://api.inforu.co.il/SendMessageXml.ashx";

function toIsraeliE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+972${digits}`;
}

export async function sendSms(phone: string, message: string): Promise<boolean> {
  const username = process.env.INFORU_USERNAME;
  const token    = process.env.INFORU_API_TOKEN;
  const sender   = process.env.INFORU_SENDER_NAME ?? "Menu4U";

  if (!username || !token) {
    console.warn("[sms] INFORU_USERNAME / INFORU_API_TOKEN not configured");
    return false;
  }

  const to = toIsraeliE164(phone);

  const xml = `<Inforu>
    <User>
      <Username>${username}</Username>
      <ApiToken>${token}</ApiToken>
    </User>
    <Content><Message>${message}</Message></Content>
    <Recipients><PhoneNumber>${to}</PhoneNumber></Recipients>
    <Settings><SenderName>${sender}</SenderName></Settings>
  </Inforu>`;

  try {
    const res = await fetch(INFORU_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ InforuXML: xml }),
    });
    const text = await res.text();
    // Inforu returns XML — Status=1 means success
    return text.includes("<Status>1</Status>") || text.includes("Status>1<");
  } catch (e) {
    console.error("[sms] send failed", e);
    return false;
  }
}

export async function sendSmsBulk(
  phones: string[],
  message: string
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(phones.map(p => sendSms(p, message)));
  const sent   = results.filter(r => r.status === "fulfilled" && r.value).length;
  const failed = results.length - sent;
  return { sent, failed };
}
