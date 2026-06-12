import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Entry = { page: string; question: string; answer: string; tags: string[]; isDefault: boolean };

const entries: Entry[] = [
  // ── משמרות ──────────────────────────────────────────────────────────────
  { page: "shifts", question: "איך יוצרים משמרת חדשה?", answer: "לחץ על '+ משמרת חדשה' בראש הדף. בחר תאריך, שעות התחלה וסיום, ותפקיד. לחץ 'שמור'.", tags: ["משמרת","יצירה","חדש"], isDefault: true },
  { page: "shifts", question: "איך מוסיפים עובד למשמרת?", answer: "לחץ על המשמרת ← לחץ '+ הוסף עובד' ← בחר עובד מהרשימה. ניתן להוסיף כמה עובדים.", tags: ["עובד","הוספה","משמרת"], isDefault: true },
  { page: "shifts", question: "איך שולחים SMS לעובדים?", answer: "לחץ 'שלח SMS' ← בחר משמרת ← בחר עובדים ← ערוך את תוכן ההודעה ← לחץ 'שלח'. ניתן לבחור פורמט מקוצר (ללא שעות).", tags: ["SMS","הודעה","עובד"], isDefault: true },
  { page: "shifts", question: "מה זה פורמט מקוצר ב-SMS?", answer: "פורמט מקוצר שולח הודעה ללא שעות משמרת — רק יום ותאריך. מתאים כשהעובדים כבר יודעים את השעות.", tags: ["SMS","פורמט","קצר"], isDefault: false },
  { page: "shifts", question: "איך רואים יומן שליחות SMS?", answer: "לחץ על טאב 'תפעולי' ← ראה את כל השליחות עם: מסעדה, תאריך, מספר עובדים, כמות SMS, תווים ותוצאה.", tags: ["יומן","SMS","תפעולי"], isDefault: true },
  { page: "shifts", question: "איך מסננים ביומן שליחות?", answer: "בטאב תפעולי יש סינון לפי תאריך/שעה 'מ-עד' ופרסטים מהירים: שבוע זה / החודש.", tags: ["סינון","יומן","תאריך"], isDefault: false },
  { page: "shifts", question: "איך מעדכנים משמרת קיימת?", answer: "לחץ על המשמרת ברשימה ← שנה את הפרטים הרצויים ← לחץ 'שמור'.", tags: ["עדכון","משמרת","עריכה"], isDefault: false },
  { page: "shifts", question: "איך מוחקים משמרת?", answer: "לחץ על סמל האשפה ליד המשמרת ← אשר מחיקה. פעולה זו מוחקת גם את שיוכי העובדים למשמרת.", tags: ["מחיקה","משמרת"], isDefault: false },

  // ── הזמנות ────────────────────────────────────────────────────────────
  { page: "orders", question: "מה הם סטטוסי ההזמנה?", answer: "ממתין ← אושר ← מכין ← מוכן ← סופק ← שולם / בוטל. כל סטטוס מסומן בצבע שונה. הזמנה חדשה נכנסת כ'ממתין'.", tags: ["סטטוס","זרימה","הזמנה"], isDefault: true },
  { page: "orders", question: "איך מאשרים הזמנה?", answer: "בכרטיס השולחן, לחץ 'אשר הכל' — כל ההזמנות הממתינות יאושרו. או בסרגל 'אשר' לחץ על השולחן הספציפי.", tags: ["אישור","ממתין","הזמנה"], isDefault: true },
  { page: "orders", question: "איך מבצעים תשלום?", answer: "לחץ על 'חשבון' בכרטיס השולחן ← בחר אחוז טיפ ← בחר אמצעי תשלום: כרטיס, מזומן, אפליקציה ← לחץ 'אשר תשלום'.", tags: ["תשלום","חשבון","טיפ"], isDefault: true },
  { page: "orders", question: "איך מבטלים פריט מהזמנה?", answer: "פתח את כרטיס ההזמנה ← לחץ על X ליד הפריט. הפריט יסומן כ'בוטל' ולא ייכלל בחשבון.", tags: ["ביטול","פריט","הזמנה"], isDefault: true },
  { page: "orders", question: "מה פירוש הגבול האדום על שולחן?", answer: "גבול אדום מציין שהזמנה פתוחה מעל 20 דקות ועדיין לא הושלמה — שולחן דחוף.", tags: ["דחוף","אדום","המתנה"], isDefault: true },
  { page: "orders", question: "איך יוצרים הזמנה חדשה ידנית?", answer: "לחץ '+ הזמנה חדשה' ← בחר שולחן ← הזן מספר סועדים ← הוסף פריטים ← לחץ 'שלח הזמנה'.", tags: ["הזמנה","יצירה","ידנית"], isDefault: true },
  { page: "orders", question: "האם ההזמנות מתעדכנות אוטומטית?", answer: "כן — המסך מתעדכן בזמן אמת דרך SSE. אם החיבור נפסק, יש ריענון אוטומטי כל 30 שניות.", tags: ["עדכון","אוטומטי","realtime"], isDefault: true },
  { page: "orders", question: "איך מסננים הזמנות לפי תאריך?", answer: "לחץ על אייקון הלוח (📅) בסרגל הבקרה ← הגדר תאריך ושעה 'מ' ו'עד'.", tags: ["סינון","תאריך","טווח"], isDefault: false },
  { page: "orders", question: "מה זה 'קורס' בהזמנה?", answer: "קורס הוא שלב בארוחה: מנה ראשונה, עיקרית, קינוח. ניתן לירות קורס ספציפי (Fire) כדי להתחיל הכנתו במטבח.", tags: ["קורס","קורסים","מנה"], isDefault: false },
  { page: "orders", question: "איפה רואים סטטיסטיקות הזמנות?", answer: "לחץ על 'סטטיסטיקות' בתפריט הצדדי. תראה KPIs ל-7/30/90 יום: שיעור השלמה, ביטולים, זמן שירות וגרפים.", tags: ["סטטיסטיקות","stats","analytics"], isDefault: true },

  // ── תפריט ─────────────────────────────────────────────────────────────
  { page: "menus", question: "איך יוצרים תפריט חדש?", answer: "לחץ על '+ תפריט חדש' בסרגל הצדדי. הזן שם לתפריט ולחץ 'צור'. התפריט יתווסף לרשימה.", tags: ["תפריט","יצירה","חדש"], isDefault: true },
  { page: "menus", question: "מה זה תפריט ראשי (★)?", answer: "תפריט ראשי הוא התפריט שמוצג כברירת מחדל ללקוחות. ניתן להגדיר רק תפריט אחד כראשי. הוא מסומן בכוכבית ★.", tags: ["ראשי","כוכב","primary"], isDefault: true },
  { page: "menus", question: "איך מגדירים לוח זמנים לתפריט?", answer: "לחץ על סמל השעון ⏰ ליד התפריט ← פתח 'הגדרות לוח זמנים'. בחר ימי שבוע ושעות. שמור.", tags: ["לוח זמנים","שעות","schedule"], isDefault: true },
  { page: "menus", question: "איך מוסיפים קטגוריה?", answer: "בתפריט הפתוח, לחץ '+ קטגוריה חדשה'. הזן שם ותמונה (אופציונלי) ולחץ 'צור'.", tags: ["קטגוריה","הוספה","יצירה"], isDefault: true },
  { page: "menus", question: "מה זה 'ללא מטבח' (🍹)?", answer: "קטגוריה 'ללא מטבח' גורמת לפריטים להסתמן כמוכנים אוטומטית — מבלי לעבור דרך מסך המטבח. מתאים לבר, שתייה.", tags: ["מטבח","בר","autoReady"], isDefault: true },
  { page: "menus", question: "איך מוסיפים פריט לתפריט?", answer: "פתח קטגוריה ← לחץ '+ פריט חדש'. מלא שם ומחיר (חובה), תיאור, תמונה ושדות נוספים. לחץ 'שמור'.", tags: ["פריט","הוספה","יצירה"], isDefault: true },
  { page: "menus", question: "איך מסתירים פריט מבלי למחוק?", answer: "לחץ על הפריט ← לחץ 'השבת'. הפריט יוצג עם קו חוצה ולא יוצג ללקוחות.", tags: ["הסתרה","השבתה","נראות"], isDefault: true },
  { page: "menus", question: "איך מגדירים אלרגנים לפריט?", answer: "בטופס עריכת הפריט, גלול לחלק 'אלרגנים' ← בחר מ-14 האלרגנים הסטנדרטיים.", tags: ["אלרגן","בריאות","אלרגיה"], isDefault: true },
  { page: "menus", question: "מה עושה 'אלרגנים אוטו'?", answer: "לחץ '⚠️ אלרגנים אוטו' — המערכת סורקת את שמות הפריטים ומזהה אלרגנים נפוצים אוטומטית.", tags: ["אלרגן","אוטומטי","סריקה"], isDefault: true },
  { page: "menus", question: "מה זה קבוצות תוספות (Modifiers)?", answer: "תוספות מאפשרות ללקוחות לבצע התאמות לפריט — למשל: 'רמת עשייה', 'תוספות' (+5₪).", tags: ["תוספות","modifiers","אפשרויות"], isDefault: true },
  { page: "menus", question: "איך מייצאים את התפריט לאקסל?", answer: "לחץ '📤 יצוא' ← בחר 'Excel (.xlsx)'. קובץ אקסל יורד עם כל הקטגוריות והפריטים.", tags: ["יצוא","אקסל","export"], isDefault: true },
  { page: "menus", question: "איך מייבאים תפריט מאקסל?", answer: "לחץ '📥 יבוא' ← גרור קובץ אקסל לאזור הייבוא. המערכת תציג תצוגה מקדימה לפני יצירת הפריטים.", tags: ["יבוא","אקסל","import"], isDefault: true },

  // ── משתמשים ───────────────────────────────────────────────────────────
  { page: "users", question: "איך מוסיפים משתמש חדש?", answer: "לחץ '+ משתמש חדש' ← הזן שם, אימייל ובחר תפקיד ← שייך מסעדות ← לחץ 'צור'. יישלח אימייל הזמנה.", tags: ["משתמש","יצירה","הזמנה"], isDefault: true },
  { page: "users", question: "מה התפקידים האפשריים?", answer: "SUPER_ADMIN, ADMIN, OWNER, SHIFT_MANAGER, EDITOR, VIEWER, WAITER, DISPLAY. כל תפקיד מעניק הרשאות שונות.", tags: ["תפקיד","הרשאות","role"], isDefault: true },
  { page: "users", question: "איך משנים תפקיד למשתמש?", answer: "לחץ על המשתמש ← לחץ '✏️ ערוך' ← שנה את שדה התפקיד ← שמור.", tags: ["תפקיד","עריכה","שינוי"], isDefault: true },
  { page: "users", question: "איך מאפסים סיסמה למשתמש?", answer: "בטופס עריכת המשתמש ← לחץ 'איפוס סיסמה' ← הזן סיסמה חדשה.", tags: ["סיסמה","איפוס","שינוי"], isDefault: true },
  { page: "users", question: "מה זה PIN מנהל ולמה צריך?", answer: "PIN מנהל (4-8 ספרות) מאפשר אישור פעולות רגישות במסך מלצר. מיועד לתפקידי ADMIN/OWNER/SHIFT_MANAGER.", tags: ["PIN","מנהל","אישור"], isDefault: true },
  { page: "users", question: "איך משייכים מסעדה למשתמש?", answer: "בטופס עריכת המשתמש, בחלק 'מסעדות' ← לחץ '+ הוסף מסעדה' ← בחר מהרשימה.", tags: ["מסעדה","שיוך","הרשאה"], isDefault: true },
  { page: "users", question: "איך מחפשים משתמש?", answer: "השתמש בשדה החיפוש בראש הדף — ניתן לחפש לפי שם או אימייל. התוצאות מתעדכנות בזמן אמת.", tags: ["חיפוש","שם","אימייל"], isDefault: true },

  // ── הגדרות ────────────────────────────────────────────────────────────
  { page: "settings", question: "איך משנים את שם האתר?", answer: "לשונית 'כללי' ← שדה 'שם האתר'. השם מוצג בסרגל הצדדי. לחץ 'שמור'.", tags: ["שם","אתר","כללי"], isDefault: true },
  { page: "settings", question: "איך מעלים לוגו?", answer: "לשונית 'כללי' ← לחץ על אזור הלוגו ← העלה קובץ PNG/SVG (מינימום 200×200 פיקסל).", tags: ["לוגו","תמונה","העלאה"], isDefault: true },
  { page: "settings", question: "איך משנים את ערכת הצבעים של הממשק?", answer: "לשונית 'מראה' ← בחר אחת מערכות הצבעים. תצוגה מקדימה בזמן אמת. לחץ 'שמור'.", tags: ["צבעים","ערכה","מראה","theme"], isDefault: true },
  { page: "settings", question: "איך מגדירים מדיניות סיסמאות?", answer: "לשונית 'אבטחה' ← הגדר אורך מינימלי, תפוגה, היסטוריה ודרישות (אות גדולה, מספר, תו מיוחד) ← שמור.", tags: ["סיסמה","מדיניות","אבטחה"], isDefault: true },
  { page: "settings", question: "איך מבצעים גיבוי ידני?", answer: "לשונית 'מתקדם' ← חלק 'גיבוי' ← לחץ 'גבה עכשיו'. בחר מסעדה או 'הכל' ← הורד קובץ JSON.", tags: ["גיבוי","ידני","JSON"], isDefault: true },
  { page: "settings", question: "איך משחזרים מגיבוי?", answer: "לשונית 'מתקדם' ← חלק 'שחזור' ← גרור קובץ JSON ← המערכת תציג תצוגה מקדימה ← אשר שחזור.", tags: ["שחזור","גיבוי","ייבוא"], isDefault: true },

  // ── דשבורד ────────────────────────────────────────────────────────────
  { page: "dashboard", question: "מה מציגים כרטיסי הסיכום בדשבורד?", answer: "4 כרטיסים: הזמנות היום, הכנסה היום, הזמנות פתוחות, צפיות בתפריט היום. מתעדכנים בזמן אמת.", tags: ["כרטיס","KPI","סיכום"], isDefault: true },
  { page: "dashboard", question: "איך משנים את תקופת הגרף?", answer: "לחץ על כפתורי התקופה מעל הגרף: 7 ימים / 30 ימים / שנה.", tags: ["גרף","תקופה","ימים"], isDefault: true },
  { page: "dashboard", question: "מה מציג גרף ההכנסות?", answer: "קו רציף = הכנסות יומיות. קו מקווקו = מספר הזמנות. ריחוף מציג תאריך, הכנסה וכמות הזמנות.", tags: ["גרף","הכנסות","הזמנות"], isDefault: true },
  { page: "dashboard", question: "איך מאשרים הזמנה מהדשבורד?", answer: "לחץ על ההזמנה ← לחץ 'אשר הזמנה'. ניתן גם לקדם סטטוס פריט ('קדם') או לבטל.", tags: ["אישור","הזמנה","דשבורד"], isDefault: true },
  { page: "dashboard", question: "מה פירוש הגבול האדום על הזמנה?", answer: "הזמנה ממתינה מעל 20 דקות ועדיין לא הושלמה — דורשת תשומת לב מיידית.", tags: ["אדום","דחוף","המתנה"], isDefault: true },
  { page: "dashboard", question: "מה פירוש הבאנר הכתום בדשבורד?", answer: "בנר כתום מציין שמנוי של מסעדה עומד לפוג — מוצגים שם המסעדה ומספר הימים הנותרים.", tags: ["מנוי","פקיעה","אזהרה"], isDefault: true },
  { page: "dashboard", question: "האם הדשבורד מתעדכן אוטומטית?", answer: "כן — הדשבורד מאזין לאירועים בזמן אמת (SSE) וגם מרענן אוטומטית כל 60 שניות.", tags: ["עדכון","אוטומטי","SSE"], isDefault: true },
];

const SEED_TOKEN = "seed-assistant-t4b-2024";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!secret || secret !== SEED_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  // Create tables if not exist
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AssistantEntry" (
        "id" TEXT NOT NULL,
        "page" TEXT NOT NULL DEFAULT 'general',
        "question" TEXT NOT NULL,
        "answer" TEXT NOT NULL,
        "tags" TEXT[] DEFAULT '{}',
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "score" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AssistantEntry_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AssistantFeedback" (
        "id" TEXT NOT NULL,
        "entryId" TEXT NOT NULL,
        "page" TEXT NOT NULL,
        "question" TEXT NOT NULL,
        "rating" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AssistantFeedback_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AssistantUnanswered" (
        "id" TEXT NOT NULL,
        "page" TEXT NOT NULL,
        "question" TEXT NOT NULL,
        "count" INTEGER NOT NULL DEFAULT 1,
        "resolved" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AssistantUnanswered_pkey" PRIMARY KEY ("id")
      )
    `);
    results.push("✓ tables created/verified");
  } catch (e) {
    results.push(`✗ table creation: ${e instanceof Error ? e.message : e}`);
  }

  // Seed entries
  let inserted = 0, skipped = 0;
  for (const e of entries) {
    try {
      const id = crypto.randomUUID();
      const existing = await prisma.$queryRawUnsafe<{count: bigint}[]>(
        `SELECT COUNT(*) as count FROM "AssistantEntry" WHERE page=$1 AND question=$2`,
        e.page, e.question
      );
      if (Number(existing[0].count) > 0) { skipped++; continue; }
      await prisma.$executeRawUnsafe(
        `INSERT INTO "AssistantEntry" (id, page, question, answer, tags, "isDefault") VALUES ($1,$2,$3,$4,$5,$6)`,
        id, e.page, e.question, e.answer,
        `{${e.tags.map(t => `"${t}"`).join(",")}}`, e.isDefault
      );
      inserted++;
    } catch (err) {
      results.push(`✗ ${e.question.slice(0, 40)}: ${err instanceof Error ? err.message : err}`);
    }
  }

  results.push(`✓ inserted ${inserted}, skipped ${skipped} (already exist)`);
  return NextResponse.json({ ok: true, results });
}
