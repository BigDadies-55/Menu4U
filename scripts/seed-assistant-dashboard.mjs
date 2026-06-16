import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

const entries = [
  // ── כרטיסי KPI ───────────────────────────────────────────────────────────
  { page: "dashboard", question: "מה מציגים כרטיסי הסיכום בדשבורד?", answer: "4 כרטיסים בראש: הזמנות היום, הכנסה היום, הזמנות פתוחות, צפיות בתפריט היום. הנתונים מתעדכנים בזמן אמת.", tags: ["כרטיס","KPI","סיכום"], isDefault: true },
  { page: "dashboard", question: "איך משנים את תקופת הגרף?", answer: "לחץ על כפתורי התקופה מעל הגרף: 7 ימים / 30 ימים / שנה. הגרף יתעדכן להציג את ההכנסות וההזמנות בתקופה הנבחרת.", tags: ["גרף","תקופה","ימים"], isDefault: true },

  // ── גרפים ────────────────────────────────────────────────────────────────
  { page: "dashboard", question: "מה מציג גרף ההכנסות?", answer: "קו רציף = הכנסות יומיות בש\"ח. קו מקווקו = מספר הזמנות. ריחוף מעל נקודה מציג תאריך, הכנסה וכמות הזמנות.", tags: ["גרף","הכנסות","הזמנות"], isDefault: true },
  { page: "dashboard", question: "מה מציג גרף הסטטוסים (עוגה)?", answer: "גרף עוגה מציג את התפלגות ההזמנות לפי סטטוס (ממתין, אושר, מכין, מוכן, סופק, שולם, בוטל). לחיצה על מקטע מסנן את הרשימה.", tags: ["גרף","עוגה","סטטוס"], isDefault: false },

  // ── הזמנות פעילות ────────────────────────────────────────────────────────
  { page: "dashboard", question: "איך רואים הזמנות ממתינות לאישור?", answer: "בדשבורד מוצג מונה 'ממתין לאישור' בצהוב. לחיצה על כרטיס הזמנה פותחת אפשרויות: אשר הזמנה, קדם פריט, בטל הזמנה.", tags: ["ממתין","אישור","הזמנה"], isDefault: true },
  { page: "dashboard", question: "מה המשמעות של גבול אדום על הזמנה?", answer: "הזמנה עם גבול אדום ממתינה מעל 20 דקות ועדיין לא הושלמה — דורשת תשומת לב מיידית.", tags: ["אדום","דחוף","המתנה"], isDefault: true },
  { page: "dashboard", question: "איך מאשרים הזמנה מהדשבורד?", answer: "לחץ על ההזמנה ← לחץ 'אשר הזמנה'. ניתן גם לקדם סטטוס פריט ('קדם') או לבטל ('בטל').", tags: ["אישור","הזמנה","דשבורד"], isDefault: true },

  // ── טבלת הזמנות ─────────────────────────────────────────────────────────
  { page: "dashboard", question: "מה מציגה טבלת 'הזמנות אחרונות'?", answer: "מציגה: מזהה הזמנה, מספר שולחן, סכום, סטטוס וכמה זמן עבר. לחיצה על 'כל ההזמנות' עוברת לדף הניהול המלא.", tags: ["טבלה","הזמנות","אחרונות"], isDefault: true },
  { page: "dashboard", question: "מה מציגה טבלת 'פריטים מובילים'?", answer: "מציגה את הפריטים הנמכרים ביותר: דירוג, שם פריט, כמות שנמכרה, הכנסה. מבוסס על תקופת הגרף הנבחרת.", tags: ["פריטים","מובילים","מכירות"], isDefault: false },

  // ── ביצועי מסעדות ───────────────────────────────────────────────────────
  { page: "dashboard", question: "מה מציגות פסי ביצועי המסעדות?", answer: "לכל מסעדה מוצג פס התקדמות עם אחוז השלמת הזמנות. ירוק = מעל 70%, כחול = 50-70%, צהוב = 30-50%, אדום = מתחת ל-30%.", tags: ["ביצועים","מסעדה","אחוז"], isDefault: false },

  // ── מנוי ומערכת ──────────────────────────────────────────────────────────
  { page: "dashboard", question: "מה פירוש הבאנר הכתום בדשבורד?", answer: "בנר כתום מציין שמנוי של מסעדה עומד לפוג — מוצגים שם המסעדה ומספר הימים הנותרים. יש לחדש את המנוי.", tags: ["מנוי","פקיעה","אזהרה"], isDefault: true },
  { page: "dashboard", question: "האם הדשבורד מתעדכן אוטומטית?", answer: "כן — הדשבורד מאזין לאירועים בזמן אמת (SSE). כמו כן יש ריענון אוטומטי כל 60 שניות. ניתן לרענן ידנית עם כפתור הרענון.", tags: ["עדכון","אוטומטי","SSE"], isDefault: true },
  { page: "dashboard", question: "מה מציג המונה 'טבלאות פעילות'?", answer: "מספר השולחנות עם הזמנות פתוחות כרגע. לחיצה על הכרטיס עוברת לדף ניהול ההזמנות.", tags: ["שולחנות","פעיל","מונה"], isDefault: false },

  // ── סינון מסעדה ─────────────────────────────────────────────────────────
  { page: "dashboard", question: "איך בוחרים מסעדה בדשבורד?", answer: "למשתמשי SUPER_ADMIN ובעלי מספר מסעדות: בחר מסעדה מהתפריט הנפתח בראש הדשבורד. ברירת המחדל היא המסעדה הראשית.", tags: ["מסעדה","בחירה","סינון"], isDefault: true },

  // ── סטטיסטיקות שבועיות ──────────────────────────────────────────────────
  { page: "dashboard", question: "איפה רואים נתוני ביצועים שבועיים?", answer: "בתחתית הדשבורד מוצגים: סה\"כ הזמנות שבועיות, הכנסה שבועית, אחוז השלמה ואחוז ביטולים.", tags: ["שבועי","ביצועים","סטטיסטיקות"], isDefault: false },
];

async function run() {
  if (!process.env.DATABASE_URL) { console.log("[seed-dashboard] No DATABASE_URL — skipping."); return; }
  await client.connect();
  console.log("[seed-dashboard] Seeding dashboard assistant entries...");
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
    } catch (err) { console.warn("[seed-dashboard] warn:", err.message); }
  }
  await client.end();
  console.log(`[seed-dashboard] Done — ${inserted} entries.`);
}

run().catch(e => { console.error("[seed-dashboard] Fatal:", e.message); process.exit(1); });
