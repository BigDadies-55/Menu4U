import nodemailer from "nodemailer";

function createTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendWelcomeEmail(email: string, name?: string | null) {
  const displayName = name ?? email;
  const adminUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://menu4u.co.il";

  await createTransport().sendMail({
    from: `"Menu4U" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `ברוכים הבאים ל-Menu4U! 🎉`,
    html: `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ede8;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0a0a0a 0%,#1a1208 60%,#3d2b00 100%);padding:40px 32px;text-align:center;">
            <div style="font-size:32px;font-weight:900;color:#C9A84C;letter-spacing:3px;text-shadow:0 2px 8px rgba(0,0,0,0.4);">Menu4U</div>
            <div style="font-size:13px;color:#a08040;margin-top:6px;letter-spacing:1px;">מערכת ניהול תפריטים דיגיטליים</div>
            <div style="margin-top:20px;font-size:28px;">🎉</div>
          </td>
        </tr>

        <!-- Welcome -->
        <tr>
          <td style="padding:40px 36px 24px;">
            <h1 style="font-size:24px;font-weight:900;color:#1a1208;margin:0 0 12px;">ברוכים הבאים, ${displayName}!</h1>
            <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 16px;">
              החשבון שלך אומת בהצלחה ✓
            </p>
            <p style="font-size:15px;color:#444;line-height:1.8;margin:0;">
              מעכשיו יש לך גישה לפלטפורמה המתקדמת ביותר לניהול תפריטים דיגיטליים למסעדות בישראל.
              אמרו שלום לתפריטי נייר — וברוכים הבאים לעידן החדש של חווית הלקוח.
            </p>
          </td>
        </tr>

        <!-- Features box -->
        <tr>
          <td style="padding:0 36px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5e4;border:1px solid #e8d99a;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="padding:20px 24px 8px;">
                  <div style="font-size:14px;font-weight:700;color:#8B6914;margin-bottom:16px;">🍽️ מה תוכל לעשות עם Menu4U?</div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 24px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #f0e4a0;">
                        <div style="font-size:14px;font-weight:700;color:#333;">✦&nbsp; תפריטים דיגיטליים מרשימים</div>
                        <div style="font-size:13px;color:#777;margin-top:3px;padding-right:16px;">QR קוד אחד, עולם שלם של תוכן — זמין 24/7 לכל לקוח</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #f0e4a0;">
                        <div style="font-size:14px;font-weight:700;color:#333;">✦&nbsp; ניהול פריטים וקטגוריות</div>
                        <div style="font-size:13px;color:#777;margin-top:3px;padding-right:16px;">עדכן מחיר, תמונה או תיאור תוך שניות — בכל מקום, מכל מכשיר</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #f0e4a0;">
                        <div style="font-size:14px;font-weight:700;color:#333;">✦&nbsp; תמיכה בריבוי מסעדות</div>
                        <div style="font-size:13px;color:#777;margin-top:3px;padding-right:16px;">נהל כמה סניפים ומותגים ממסך ניהול אחד מרוכז</div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <div style="font-size:14px;font-weight:700;color:#333;">✦&nbsp; סטטיסטיקות וצפיות</div>
                        <div style="font-size:13px;color:#777;margin-top:3px;padding-right:16px;">דע מה הלקוחות שלך אוהבים ואילו פריטים מושכים את תשומת הלב</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tip -->
        <tr>
          <td style="padding:0 36px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7ff;border-right:4px solid #4f8ef7;border-radius:8px;">
              <tr>
                <td style="padding:16px 20px;">
                  <div style="font-size:13px;font-weight:700;color:#2563eb;margin-bottom:4px;">💡 טיפ ראשון</div>
                  <div style="font-size:13px;color:#444;line-height:1.6;">התחל ביצירת מסעדה ראשונה והעלאת התפריט — זה לוקח פחות מ-5 דקות ותוצאות מיידיות ללקוחות שלך.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 36px 40px;text-align:center;">
            <a href="${adminUrl}/admin" style="display:inline-block;padding:16px 48px;background:linear-gradient(135deg,#C9A84C,#8B6914);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.5px;box-shadow:0 4px 16px rgba(139,105,20,0.35);">
              → כניסה למערכת הניהול
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1a1208;padding:24px 36px;text-align:center;">
            <p style="font-size:12px;color:#a08040;margin:0 0 4px;letter-spacing:1px;">Menu4U · מערכת ניהול תפריטים דיגיטליים</p>
            <p style="font-size:11px;color:#6b5a30;margin:0;">© 2026 Menu4U · כל הזכויות שמורות</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendInviteEmail(email: string, inviteLink: string, name?: string | null) {
  const displayName = name ?? email;
  const adminUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://menu4u.co.il";

  await createTransport().sendMail({
    from: `"Tech4Bites" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `הוזמנת להצטרף למערכת Tech4Bites`,
    html: `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0b0e;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0b0e;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#110f12;border:1px solid rgba(201,164,82,0.18);border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
        <tr>
          <td style="background:linear-gradient(135deg,#0a0804,#1c1205,#3d2b00);padding:36px 32px;text-align:center;border-bottom:1px solid rgba(201,164,82,0.15);">
            <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:white;letter-spacing:5px;">TECH4<span style="color:#C9A452;">BITES</span></div>
            <div style="font-size:11px;color:rgba(201,164,82,0.55);margin-top:6px;letter-spacing:2px;">פורטל ניהול מסעדות</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 24px;">
            <p style="font-size:16px;color:#d8cfc0;margin:0 0 8px;">שלום ${displayName},</p>
            <p style="font-size:14px;color:#6b6070;line-height:1.7;margin:0 0 28px;">
              הוזמנת להצטרף למערכת הניהול של Tech4Bites.<br>
              לחץ על הכפתור למטה כדי לבחור סיסמה ולהתחיל להשתמש במערכת.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(201,164,82,0.07);border:1px solid rgba(201,164,82,0.22);border-radius:14px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 28px;">
                  <div style="font-size:11px;font-weight:700;color:#6b6070;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">הזמנה עבור</div>
                  <div style="font-size:15px;color:white;font-family:'Courier New',monospace;" dir="ltr">${email}</div>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(239,68,68,0.07);border-right:3px solid rgba(239,68,68,0.5);border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:12px 16px;">
                  <div style="font-size:12px;color:#fca5a5;">⏱ הקישור תקף ל-72 שעות בלבד</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 36px 36px;text-align:center;">
            <a href="${inviteLink}" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#6b470d,#C9A452);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.5px;">
              הגדר סיסמה והצטרף ←
            </a>
            <p style="font-size:11px;color:#4a4050;margin-top:16px;">אם הכפתור לא עובד, העתק את הקישור:</p>
            <p style="font-size:10px;color:#6b6070;word-break:break-all;" dir="ltr">${inviteLink}</p>
          </td>
        </tr>
        <tr>
          <td style="background:rgba(0,0,0,0.3);padding:20px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="font-size:11px;color:#4a4050;margin:0;">© 2026 Tech4Bites · כל הזכויות שמורות</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendTempPasswordEmail(email: string, tempPassword: string, name?: string | null) {
  const displayName = name ?? email;
  const adminUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "https://menu4u.co.il";

  await createTransport().sendMail({
    from: `"Tech4Bites" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `גישה למערכת Tech4Bites – פרטי כניסה`,
    html: `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d0b0e;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0b0e;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#110f12;border:1px solid rgba(201,164,82,0.18);border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.6);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0a0804,#1c1205,#3d2b00);padding:36px 32px;text-align:center;border-bottom:1px solid rgba(201,164,82,0.15);">
            <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:white;letter-spacing:5px;">TECH4<span style="color:#C9A452;">BITES</span></div>
            <div style="font-size:11px;color:rgba(201,164,82,0.55);margin-top:6px;letter-spacing:2px;">פורטל ניהול מסעדות</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 24px;">
            <p style="font-size:16px;color:#d8cfc0;margin:0 0 8px;">שלום ${displayName},</p>
            <p style="font-size:14px;color:#6b6070;line-height:1.7;margin:0 0 28px;">
              נוצר עבורך חשבון חדש במערכת הניהול של Tech4Bites.<br>
              להלן פרטי הכניסה הזמניים שלך — <strong style="color:#dfc07e;">נדרש לשנות סיסמה בכניסה הראשונה.</strong>
            </p>
            <!-- Credentials box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(201,164,82,0.07);border:1px solid rgba(201,164,82,0.22);border-radius:14px;margin-bottom:28px;">
              <tr>
                <td style="padding:24px 28px;">
                  <div style="margin-bottom:16px;">
                    <div style="font-size:10px;font-weight:700;color:#6b6070;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;">אימייל</div>
                    <div style="font-size:15px;color:white;font-family:'Courier New',monospace;" dir="ltr">${email}</div>
                  </div>
                  <div style="border-top:1px solid rgba(255,255,255,0.07);padding-top:16px;">
                    <div style="font-size:10px;font-weight:700;color:#6b6070;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:5px;">סיסמה זמנית</div>
                    <div style="font-size:22px;font-weight:900;color:#C9A452;font-family:'Courier New',monospace;letter-spacing:3px;" dir="ltr">${tempPassword}</div>
                  </div>
                </td>
              </tr>
            </table>
            <!-- Warning -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(239,68,68,0.08);border-right:3px solid #ef4444;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:14px 18px;">
                  <div style="font-size:13px;color:#fca5a5;font-weight:600;">⚠ אל תשתף את הסיסמה הזמנית</div>
                  <div style="font-size:12px;color:#6b6070;margin-top:4px;line-height:1.6;">עם כניסתך הראשונה תתבקש לבחור סיסמה אישית חדשה. הסיסמה הזמנית תפוג לאחר השימוש הראשון.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding:0 36px 36px;text-align:center;">
            <a href="${adminUrl}/login" style="display:inline-block;padding:14px 44px;background:linear-gradient(135deg,#6b470d,#C9A452);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.5px;">
              כניסה למערכת ←
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:rgba(0,0,0,0.3);padding:20px 32px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="font-size:11px;color:#4a4050;margin:0;">© 2026 Tech4Bites · כל הזכויות שמורות</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

export async function sendOtpEmail(email: string, otp: string, name?: string | null) {
  const displayName = name ?? email;

  await createTransport().sendMail({
    from: `"Menu4U" <${process.env.GMAIL_USER}>`,
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
