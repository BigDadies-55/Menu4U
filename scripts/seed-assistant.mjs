import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

const entries = [
  // ── shifts ────────────────────────────────────────────────────────────
  { page: "shifts", question: "איך מוסיפים משמרת לעובד?", answer: "לחץ על תא ריק בטבלת השבוע (בצומת של עובד ויום). יפתח חלון עם סוגי המשמרת הזמינים — בחר את הסוג הרצוי ולחץ עליו.", tags: ["משמרת","הוספה","עובד"], isDefault: true },
  { page: "shifts", question: "איך מוחקים משמרת?", answer: "לחץ על המשמרת הקיימת בטבלה. יפתח תפריט עם אפשרות מחיקה (סמל פח). לחץ עליה לאישור.", tags: ["מחיקה","משמרת"], isDefault: false },
  { page: "shifts", question: "איך שולחים SMS לעובדים?", answer: "לחץ על כפתור 'שלח SMS' בפינה. בחר 'כל העובדים' או עובד ספציפי, בדוק את תצוגת ההודעה ולחץ 'שלח'.", tags: ["sms","שליחה","עובדים"], isDefault: true },
  { page: "shifts", question: "מה עושה 'נקה שבוע'?", answer: "מוחק את כל המשמרות של השבוע הנוכחי. יש לך 6 שניות לבטל את הפעולה עם כפתור 'בטל' שמופיע בתחתית.", tags: ["נקה","מחיקה","שבוע"], isDefault: false },
  { page: "shifts", question: "איך משנים את שמות סוגי המשמרת?", answer: "לחץ על 'הגדרות' (גלגל שיניים) ליד כפתורי ניווט השבוע. שם תוכל לשנות שם, שעות, צבע ונראות לכל סוג משמרת.", tags: ["הגדרות","שם","סוג"], isDefault: true },
  { page: "shifts", question: "איך מנווטים בין שבועות?", answer: "השתמש בכפתורי החצים בראש המסך — חץ ימינה לשבוע הבא, חץ שמאלה לשבוע הקודם.", tags: ["ניווט","שבוע"], isDefault: false },
  { page: "shifts", question: "מה הטאב 'תפעולי' מציג?", answer: "הטאב התפעולי מציג היסטוריית SMS ששלחת: כמה הודעות נשלחו, עלות ב-SMS units, תאריכים ופירוט מלא ביומן שליחות.", tags: ["תפעולי","sms","היסטוריה"], isDefault: true },
  { page: "shifts", question: "איך מוסיפים סוג משמרת חדש?", answer: "פתח הגדרות משמרת ← גלול לתחתית ← לחץ '+ הוסף סוג משמרת'. הגדר שם, שעות וצבע.", tags: ["הגדרות","הוספה","סוג"], isDefault: false },

  // ── orders ────────────────────────────────────────────────────────────
  { page: "orders", question: "איך מחפשים הזמנה?", answer: "השתמש בשדה החיפוש בראש הדף. ניתן לחפש לפי מספר הזמנה, שם לקוח או מספר שולחן.", tags: ["חיפוש","הזמנה"], isDefault: true },
  { page: "orders", question: "מה ההבדל בין סטטוסי ההזמנה?", answer: "PENDING=ממתין לאישור, CONFIRMED=אושרה, PREPARING=במטבח, READY=מוכן להגשה, DELIVERED=הוגש, PAID=שולם, CANCELLED=בוטל.", tags: ["סטטוס","הזמנה"], isDefault: true },
  { page: "orders", question: "איך מבטלים הזמנה?", answer: "פתח את ההזמנה ← לחץ על תפריט הפעולות ← בחר 'בטל הזמנה'. ביטול דורש אישור מנהל.", tags: ["ביטול","הזמנה"], isDefault: false },

  // ── menus ────────────────────────────────────────────────────────────
  { page: "menus", question: "איך מוסיפים קטגוריה חדשה?", answer: "לחץ על '+ קטגוריה חדשה' בצד שמאל של עמוד התפריט. הזן שם ואייקון. הקטגוריה תופיע בסוף הרשימה.", tags: ["קטגוריה","הוספה"], isDefault: true },
  { page: "menus", question: "איך מוסיפים פריט לתפריט?", answer: "בחר קטגוריה ← לחץ '+ הוסף פריט'. מלא שם, תיאור, מחיר ותמונה. שמור כדי שיופיע בתפריט.", tags: ["פריט","הוספה"], isDefault: true },
  { page: "menus", question: "איך מסתירים פריט מבלי למחוק?", answer: "לחץ על הפריט ← בטל את הסימון 'פעיל'. הפריט יוסתר מהתפריט הציבורי אך יישמר במערכת.", tags: ["הסתרה","פריט","פעיל"], isDefault: true },
  { page: "menus", question: "איך מגדירים תוספות (modifiers)?", answer: "פתח פריט לעריכה ← גלול ל'קבוצות תוספות' ← לחץ '+ הוסף קבוצה'. הגדר שם, האם חובה, ומקסימום בחירות.", tags: ["תוספות","modifiers","קבוצה"], isDefault: false },

  // ── users ────────────────────────────────────────────────────────────
  { page: "users", question: "איך מוסיפים משתמש חדש?", answer: "לחץ '+ משתמש חדש' בראש הדף. הזן אימייל, שם ותפקיד. המשתמש יקבל אימייל עם סיסמה זמנית.", tags: ["משתמש","הוספה"], isDefault: true },
  { page: "users", question: "מה ההבדל בין התפקידים?", answer: "SUPER_ADMIN=גישה מלאה לכל, ADMIN=ניהול מלא, OWNER=בעל מסעדה, SHIFT_MANAGER=ניהול משמרות, WAITER=מלצר, DISPLAY=מסך תצוגה בלבד.", tags: ["תפקיד","הרשאות"], isDefault: true },
  { page: "users", question: "איך מאפסים סיסמה למשתמש?", answer: "לחץ על כפתור העריכה (עיפרון) ← עבור ללשונית 'אבטחה' ← הזן סיסמה חדשה ← שמור. המשתמש יתבקש לשנות סיסמה בכניסה הבאה.", tags: ["סיסמה","איפוס"], isDefault: false },

  // ── settings ────────────────────────────────────────────────────────
  { page: "settings", question: "איך משנים את לוגו המסעדה?", answer: "הגדרות ← עיצוב ← לחץ על תמונת הלוגו הנוכחית ← העלה תמונה חדשה. הגודל המומלץ 200x200 פיקסל.", tags: ["לוגו","עיצוב"], isDefault: true },
  { page: "settings", question: "איך מפעילים הזמנות?", answer: "הגדרות ← הזמנות ← הפעל את מתג 'אפשר הזמנות'. לאחר מכן הגדר שעות פעילות ומספר שולחנות.", tags: ["הזמנות","הפעלה"], isDefault: true },

  // ── dashboard ────────────────────────────────────────────────────────
  { page: "dashboard", question: "מה מציגים הגרפים בדשבורד?", answer: "הדשבורד מציג: הכנסות יומיות/שבועיות, מספר הזמנות, פריטים פופולריים ועומס לפי שעה.", tags: ["גרף","נתונים","סטטיסטיקה"], isDefault: true },
  { page: "dashboard", question: "איך מסנן לפי תאריך?", answer: "בראש הדשבורד יש בורר תאריכים. ניתן לבחור: היום, השבוע, החודש, או טווח מותאם אישית.", tags: ["סינון","תאריך"], isDefault: true },
];

async function run() {
  if (!process.env.DATABASE_URL) { console.log("[seed-assistant] No DATABASE_URL — skipping."); return; }
  await client.connect();
  console.log("[seed-assistant] Seeding assistant entries...");
  let inserted = 0, skipped = 0;
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
    } catch (err) {
      console.warn("[seed-assistant] warn:", err.message);
      skipped++;
    }
  }
  await client.end();
  console.log(`[seed-assistant] Done — ${inserted} inserted, ${skipped} skipped.`);
}

run().catch(e => { console.error("[seed-assistant] Fatal:", e.message); process.exit(1); });
