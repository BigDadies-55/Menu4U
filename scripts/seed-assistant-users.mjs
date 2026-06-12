import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

const entries = [
  // ── יצירה והזמנה ─────────────────────────────────────────────────────────
  { page: "users", question: "איך מוסיפים משתמש חדש?", answer: "לחץ '+ משתמש חדש' ← הזן שם, אימייל ובחר תפקיד ← שייך מסעדות ← לחץ 'צור'. המשתמש יקבל אימייל הזמנה לקבוע סיסמה.", tags: ["משתמש","יצירה","הזמנה"], isDefault: true },
  { page: "users", question: "מה קורה אחרי יצירת משתמש?", answer: "נשלח אימייל הזמנה עם קישור לאיפוס סיסמה (תוקף 72 שעות). אם האימייל לא הגיע, ניתן להעתיק את הקישור ולשלוח ידנית.", tags: ["הזמנה","אימייל","קישור"], isDefault: true },
  { page: "users", question: "איך שולחים שוב אימייל הזמנה?", answer: "לחץ על המשתמש ← לחץ 'שלח שוב הזמנה'. פעולה זו זמינה למשתמשים שטרם אישרו את חשבונם.", tags: ["הזמנה","אימייל","שליחה"], isDefault: false },

  // ── תפקידים ─────────────────────────────────────────────────────────────
  { page: "users", question: "מה התפקידים האפשריים?", answer: "SUPER_ADMIN, ADMIN, OWNER, SHIFT_MANAGER, EDITOR, VIEWER, WAITER, DISPLAY. כל תפקיד מעניק הרשאות שונות. WAITER ו-DISPLAY מיועדים למסכי שטח.", tags: ["תפקיד","הרשאות","role"], isDefault: true },
  { page: "users", question: "מה ההבדל בין ADMIN ל-OWNER?", answer: "OWNER הוא בעל המסעדה — גישה מלאה לנתוני המסעדה שלו. ADMIN הוא מנהל מערכת שיכול לנהל הגדרות כלל-מערכתיות. SUPER_ADMIN רואה את כל המסעדות.", tags: ["admin","owner","הרשאות"], isDefault: false },
  { page: "users", question: "מה תפקיד WAITER מאפשר?", answer: "WAITER מקבל גישה למסכי מלצר (waiter-pos, waiter-floor). אינו יכול לגשת להגדרות, ניהול משתמשים או תפריטים.", tags: ["מלצר","waiter","הרשאות"], isDefault: false },
  { page: "users", question: "איך משנים תפקיד למשתמש?", answer: "לחץ על המשתמש ← לחץ '✏️ ערוך' ← שנה את שדה התפקיד ← שמור. השינוי נכנס לתוקף בכניסה הבאה של המשתמש.", tags: ["תפקיד","עריכה","שינוי"], isDefault: true },

  // ── שיוך מסעדות ──────────────────────────────────────────────────────────
  { page: "users", question: "איך משייכים מסעדה למשתמש?", answer: "בטופס עריכת המשתמש, בחלק 'מסעדות' ← לחץ '+ הוסף מסעדה' ← בחר מהרשימה. ניתן לשייך מספר מסעדות.", tags: ["מסעדה","שיוך","הרשאה"], isDefault: true },
  { page: "users", question: "מה קורה אם משתמש לא משויך למסעדה?", answer: "משתמש שאינו SUPER_ADMIN ואינו משויך למסעדה יופנה לדף שגיאה בכניסה. חשוב לשייך לפחות מסעדה אחת.", tags: ["מסעדה","שיוך","שגיאה"], isDefault: false },

  // ── ניהול סיסמה ─────────────────────────────────────────────────────────
  { page: "users", question: "איך מאפסים סיסמה למשתמש?", answer: "בטופס עריכת המשתמש ← לחץ 'איפוס סיסמה' ← הזן סיסמה חדשה. המשתמש יוכל להתחבר עם הסיסמה החדשה.", tags: ["סיסמה","איפוס","שינוי"], isDefault: true },
  { page: "users", question: "איך מחייבים משתמש להחליף סיסמה?", answer: "בטופס עריכת המשתמש ← הפעל 'חייב החלפת סיסמה'. בכניסה הבאה, המשתמש יתבקש לקבוע סיסמה חדשה לפני גישה למערכת.", tags: ["סיסמה","חובה","אבטחה"], isDefault: false },

  // ── PIN מנהל ────────────────────────────────────────────────────────────
  { page: "users", question: "מה זה PIN מנהל ולמה צריך?", answer: "PIN מנהל (4-8 ספרות) מאפשר אישור פעולות רגישות במסך מלצר — כמו פתיחת שולחן סגור או ביטול הזמנה. מיועד לתפקידי ADMIN/OWNER/SHIFT_MANAGER.", tags: ["PIN","מנהל","אישור"], isDefault: true },
  { page: "users", question: "איך מגדירים PIN למנהל?", answer: "ערוך משתמש עם תפקיד מנהל ← לחץ 'הגדר PIN' ← הזן PIN בן 4-8 ספרות ← שמור.", tags: ["PIN","הגדרה","מנהל"], isDefault: false },

  // ── חיפוש ומחיקה ─────────────────────────────────────────────────────────
  { page: "users", question: "איך מחפשים משתמש?", answer: "השתמש בשדה החיפוש בראש הדף — ניתן לחפש לפי שם או אימייל. התוצאות מתעדכנות בזמן אמת.", tags: ["חיפוש","שם","אימייל"], isDefault: true },
  { page: "users", question: "איך מוחקים משתמש?", answer: "לחץ על המשתמש ← לחץ '🗑️ מחק' ← אשר בדיאלוג. המחיקה היא סופית ולא ניתן לשחזר.", tags: ["מחיקה","משתמש"], isDefault: false },
  { page: "users", question: "איך בודקים אם משתמש התחבר?", answer: "בכרטיס המשתמש מוצג 'כניסה אחרונה' עם תאריך ושעה. אם לא מוצג — המשתמש טרם התחבר (ייתכן שממתין לאישור).", tags: ["כניסה","אחרונה","בדיקה"], isDefault: false },
];

async function run() {
  if (!process.env.DATABASE_URL) { console.log("[seed-users] No DATABASE_URL — skipping."); return; }
  await client.connect();
  console.log("[seed-users] Seeding users assistant entries...");
  let inserted = 0;
  for (const e of entries) {
    const id = crypto.randomUUID();
    try {
      await client.query(
        `INSERT INTO "AssistantEntry" (id, page, question, answer, tags, "isDefault")
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [id, e.page, e.question, e.answer, e.tags, e.isDefault]
      );
      inserted++;
    } catch (err) { console.warn("[seed-users] warn:", err.message); }
  }
  await client.end();
  console.log(`[seed-users] Done — ${inserted} entries.`);
}

run().catch(e => { console.error("[seed-users] Fatal:", e.message); process.exit(1); });
