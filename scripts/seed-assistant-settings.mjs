import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

const entries = [
  // ── כללי ──────────────────────────────────────────────────────────────────
  { page: "settings", question: "איך משנים את שם האתר?", answer: "לשונית 'כללי' ← שדה 'שם האתר'. השם מוצג בסרגל הצדדי ובכותרת הדפדפן. לחץ 'שמור'.", tags: ["שם","אתר","כללי"], isDefault: true },
  { page: "settings", question: "איך מעלים לוגו?", answer: "לשונית 'כללי' ← לחץ על אזור הלוגו ← העלה קובץ PNG/SVG (מינימום 200×200 פיקסל). הלוגו יוצג בסרגל הצדדי ליד שם האתר.", tags: ["לוגו","תמונה","העלאה"], isDefault: true },
  { page: "settings", question: "איך משנים את הדומיין הראשי?", answer: "לשונית 'כללי' ← שדה 'דומיין ראשי'. הגדרה זו משמשת לקישורי מערכת ומייל.", tags: ["דומיין","כתובת","כללי"], isDefault: false },

  // ── מראה ─────────────────────────────────────────────────────────────────
  { page: "settings", question: "איך משנים את ערכת הצבעים של הממשק?", answer: "לשונית 'מראה' ← בחר אחת מערכות הצבעים הקיימות. תצוגה מקדימה מוצגת בזמן אמת. לחץ 'שמור'.", tags: ["צבעים","ערכה","מראה","theme"], isDefault: true },

  // ── אבטחה ────────────────────────────────────────────────────────────────
  { page: "settings", question: "איך מגדירים מדיניות סיסמאות?", answer: "לשונית 'אבטחה' ← הגדר: אורך מינימלי (6-32), תפוגה (0-365 ימים), היסטוריה (0-10 סיסמאות קודמות), דרישות (אות גדולה, מספר, תו מיוחד) ← שמור.", tags: ["סיסמה","מדיניות","אבטחה"], isDefault: true },
  { page: "settings", question: "איך מגדירים ניתוק אוטומטי בחוסר פעילות?", answer: "לשונית 'אבטחה' ← שדה 'פסק זמן חוסר פעילות' ← הגדר שעות (0 = ללא ניתוק). אחרי הזמן הנקוב, המשתמש ינותק אוטומטית.", tags: ["ניתוק","אוטומטי","פעמון","idle"], isDefault: false },
  { page: "settings", question: "מה אומר 'היסטוריית סיסמאות'?", answer: "מונע מהמשתמש לחזור לסיסמה שכבר השתמש בה. ערך 5 פירושו שלא ניתן לחזור ל-5 הסיסמאות האחרונות.", tags: ["היסטוריה","סיסמה","אבטחה"], isDefault: false },

  // ── גיבוי ────────────────────────────────────────────────────────────────
  { page: "settings", question: "איך מבצעים גיבוי ידני?", answer: "לשונית 'מתקדם' ← חלק 'גיבוי' ← לחץ 'גבה עכשיו'. בחר מסעדה או 'הכל' ← המערכת תייצר קובץ JSON להורדה.", tags: ["גיבוי","ידני","JSON"], isDefault: true },
  { page: "settings", question: "איך מגדירים גיבוי אוטומטי?", answer: "גיבוי אוטומטי מופעל דרך משתנה סביבה BACKUP_SCHEDULE (יומי/שבועי). בחלק 'גיבוי' ניתן לראות את לוח הזמנים הנוכחי ואת 5 הגיבויים האחרונים.", tags: ["גיבוי","אוטומטי","תזמון"], isDefault: false },
  { page: "settings", question: "איך מורידים גיבוי?", answer: "לשונית 'מתקדם' ← 'גיבוי' ← בחר גיבוי מהרשימה (5 האחרונים) ← לחץ '⬇️ הורד'. הקובץ הוא JSON עם כל הנתונים.", tags: ["גיבוי","הורדה","JSON"], isDefault: true },

  // ── שחזור ────────────────────────────────────────────────────────────────
  { page: "settings", question: "איך משחזרים מגיבוי?", answer: "לשונית 'מתקדם' ← חלק 'שחזור' ← גרור קובץ JSON לאזור הייבוא ← המערכת תציג תצוגה מקדימה של שינויים (ייצור/עדכון) ← אשר שחזור.", tags: ["שחזור","גיבוי","ייבוא"], isDefault: true },
  { page: "settings", question: "האם שחזור מוחק נתונים קיימים?", answer: "לא מוחק — השחזור מעדכן נתונים קיימים ומוסיף חדשים. לפני שחזור מוצגת תצוגה מקדימה של כמה רשומות ייוצרו ויעודכנו.", tags: ["שחזור","מחיקה","אזהרה"], isDefault: false },

  // ── ניקוי הזמנות ─────────────────────────────────────────────────────────
  { page: "settings", question: "איך מוחקים את כל ההזמנות?", answer: "לשונית 'מתקדם' ← חלק 'מחיקת הזמנות' ← לחץ 'מחק הכל' ← אשר בדיאלוג האזהרה. פעולה זו בלתי הפיכה!", tags: ["מחיקה","הזמנות","ניקוי"], isDefault: false },
  { page: "settings", question: "האם ניתן לבטל מחיקת הזמנות?", answer: "לא. מחיקת הזמנות היא סופית ובלתי הפיכה. מומלץ לבצע גיבוי לפני פעולה זו.", tags: ["מחיקה","בלתי הפיך","גיבוי"], isDefault: false },
];

async function run() {
  if (!process.env.DATABASE_URL) { console.log("[seed-settings] No DATABASE_URL — skipping."); return; }
  await client.connect();
  console.log("[seed-settings] Seeding settings assistant entries...");
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
    } catch (err) { console.warn("[seed-settings] warn:", err.message); }
  }
  await client.end();
  console.log(`[seed-settings] Done — ${inserted} entries.`);
}

run().catch(e => { console.error("[seed-settings] Fatal:", e.message); process.exit(1); });
