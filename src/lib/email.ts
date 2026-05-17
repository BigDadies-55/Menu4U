import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOtpEmail(email: string, otp: string, name?: string | null) {
  const displayName = name ?? email;

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Menu4U <noreply@menu4u.co.il>",
    to: email,
    subject: `קוד האימות שלך - Menu4U`,
    html: `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1208,#3d2b00);padding:32px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#C9A84C;letter-spacing:2px;">Menu4U</div>
            <div style="font-size:13px;color:#a08040;margin-top:4px;">מערכת ניהול תפריטים</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 32px;">
            <p style="font-size:16px;color:#333;margin:0 0 8px;">שלום ${displayName},</p>
            <p style="font-size:15px;color:#555;margin:0 0 32px;">להשלמת אימות המייל שלך, הזן את הקוד הבא:</p>
            <div style="background:#faf5e4;border:2px solid #C9A84C;border-radius:12px;padding:24px;text-align:center;margin-bottom:32px;">
              <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#8B6914;font-family:'Courier New',monospace;">${otp}</div>
              <div style="font-size:13px;color:#a08040;margin-top:8px;">הקוד תקף ל-15 דקות</div>
            </div>
            <p style="font-size:13px;color:#999;margin:0;">אם לא ביקשת קוד זה, ניתן להתעלם ממייל זה.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
            <p style="font-size:12px;color:#aaa;margin:0;">© 2026 Menu4U · כל הזכויות שמורות</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}
