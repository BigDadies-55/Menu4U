import { NextResponse } from "next/server";

// Simple in-memory OTP store (resets on server restart, good enough for restaurant use)
const otpStore = new Map<string, { code: string; expires: number; email: string }>();

export async function POST(req: Request, { params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = await params;
  const body = await req.json();
  const { action, email, code } = body;

  if (action === "send") {
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "invalid email" }, { status: 400 });
    }
    // Generate 6-digit code
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const key = `${restaurantId}:${email}`;
    otpStore.set(key, { code: otp, expires: Date.now() + 10 * 60 * 1000, email });

    // Send email via the existing email mechanism
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "noreply@menu4u.co.il",
        to: email,
        subject: "קוד אימות — מועדון לקוחות",
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
            <h2 style="color: #c9a84c;">קוד האימות שלך</h2>
            <p>הקוד שלך הוא:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #333; background: #fff; padding: 20px; text-align: center; border-radius: 8px; border: 2px solid #c9a84c;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">הקוד תקף ל-10 דקות.</p>
          </div>
        `,
      });
    } catch (e) {
      console.error("Email send error:", e);
      // In development, log the OTP
      if (process.env.NODE_ENV !== "production") {
        console.log(`[OTP DEV] ${email}: ${otp}`);
      }
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "verify") {
    if (!email || !code) return NextResponse.json({ error: "missing params" }, { status: 400 });
    const key = `${restaurantId}:${email}`;
    const stored = otpStore.get(key);
    if (!stored || stored.expires < Date.now()) {
      return NextResponse.json({ error: "expired" }, { status: 400 });
    }
    if (stored.code !== code) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    otpStore.delete(key);
    return NextResponse.json({ ok: true, verified: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
