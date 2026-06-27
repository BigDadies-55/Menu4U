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
  // isDefault: true רק ל-5 הכי שימושיים
  { page: "menus", question: "איך מוסיפים פריט לתפריט?", answer: "פתח קטגוריה בלחיצה עליה ← לחץ '+ פריט חדש' (כפתור כתום). מלא שם ומחיר (חובה), תיאור, תמונה ושדות נוספים ← לחץ 'שמור'.", tags: ["פריט","הוספה","יצירה"], isDefault: true },
  { page: "menus", question: "איך מגדירים אלרגנים לפריט?", answer: "בטופס עריכת הפריט, גלול לחלק 'אלרגנים' ← בחר מ-14 האלרגנים הסטנדרטיים: גלוטן, חלב, ביצים, דגים, בוטנים, סויה, אגוזים, שומשום ועוד.", tags: ["אלרגן","בריאות","אלרגיה"], isDefault: true },
  { page: "menus", question: "מה עושה 'אלרגנים אוטו'?", answer: "לחץ '✨ אלרגנים אוטו' בראש הדף — המערכת סורקת את שמות וניאורי כל הפריטים ב-48 כללי זיהוי ומסמנת אלרגנים אוטומטית. מציגה כמה פריטים עודכנו.", tags: ["אלרגן","אוטומטי","סריקה","batch"], isDefault: true },
  { page: "menus", question: "מה זה תפריט ראשי (★)?", answer: "תפריט ראשי מוצג כברירת מחדל ללקוחות. רק תפריט אחד יכול להיות ראשי בכל פעם — הגדרת תפריט חדש כראשי מבטלת אוטומטית את הקודם. מסומן בכוכבית ★ בסרגל.", tags: ["ראשי","כוכב","primary"], isDefault: true },
  { page: "menus", question: "מה זה קבוצות תוספות (Modifiers)?", answer: "תוספות מאפשרות ללקוחות להתאים פריט — למשל: 'רמת עשייה' (בינוני/טוב), 'תוספות' (+5₪). ניתן להגדיר מינימום/מקסימום בחירות ולסמן קבוצה כחובה.", tags: ["תוספות","modifiers","אפשרויות"], isDefault: true },
  // isDefault: false
  { page: "menus", question: "איך יוצרים תפריט חדש?", answer: "לחץ '+' בסרגל הצדדי מתחת לרשימת התפריטים. הזן שם לתפריט ← לחץ 'צור'. התפריט יתווסף לרשימה ויהיה פתוח לעריכה.", tags: ["תפריט","יצירה","חדש"], isDefault: false },
  { page: "menus", question: "איך מגדירים לוח זמנים לתפריט?", answer: "לחץ ⚙️ ליד התפריט בסרגל ← בחלק 'לוח זמנים' בחר ימי שבוע (ריק = כל הימים) ושעות התחלה/סיום (ריק = כל השעות) ← שמור.", tags: ["לוח זמנים","שעות","schedule","ימים"], isDefault: false },
  { page: "menus", question: "איך מוסיפים קטגוריה?", answer: "לחץ '+ קטגוריה חדשה' בראש אזור הקטגוריות. הזן שם (חובה) ותמונה (אופציונלי). ניתן להוסיף תרגומים ל-EN/RU/FR ← לחץ 'צור'.", tags: ["קטגוריה","הוספה","יצירה"], isDefault: false },
  { page: "menus", question: "מה זה תחנת מטבח לקטגוריה?", answer: "כל קטגוריה יכולה להיות משויכת לתחנת מטבח (גריל, בר, פסטה וכו'). בכרטיס הקטגוריה לחץ על הסלקטור בראש הכרטיס ← בחר תחנה. אם לתחנה הוגדר 'דלג על מטבח' — הפריטים יסומנו כמוכנים אוטומטית.", tags: ["מטבח","תחנה","autoReady","בר"], isDefault: false },
  { page: "menus", question: "איך מסתירים פריט מבלי למחוק?", answer: "פתח קטגוריה ← לחץ ⋮ ליד הפריט ← בחר '🔴 השבת'. הפריט יוצג עם נקודה אפורה ולא יוצג ללקוחות. לשחזור: ⋮ ← '🟢 הפעל'.", tags: ["הסתרה","השבתה","נראות","inactive"], isDefault: false },
  { page: "menus", question: "איך מייצאים את התפריט?", answer: "לחץ '📤 ייצא' ← בחר פורמט: 'Excel (.xlsx)' — גיליון שטוח עם כל הפריטים, מתאים לעריכה. 'JSON' — מבנה מלא עם כל הנתונים, מתאים לגיבוי או ייבוא מחדש.", tags: ["יצוא","אקסל","JSON","export"], isDefault: false },
  { page: "menus", question: "איך מייבאים תפריט?", answer: "לחץ '📥 ייבא' ← גרור קובץ JSON או Excel. המערכת מציגה תצוגה מקדימה (מספר תפריטים, קטגוריות, פריטים) ← אשר. יש סרגל התקדמות בזמן הייבוא.", tags: ["יבוא","אקסל","JSON","import","preview"], isDefault: false },
  // חדשות
  { page: "menus", question: "איך מוסיפים תוספות (Modifiers) לפריט?", answer: "פתח קטגוריה ← ⋮ ← '✏️ ערוך פריט' ← גלול לחלק 'קבוצות תוספות'. לחץ '+ הוסף קבוצה' ← הזן שם קבוצה, האם חובה, מקסימום בחירות ← הוסף אפשרויות עם מחיר (+₪) ← שמור.", tags: ["תוספות","modifiers","קבוצה","הוספה"], isDefault: false },
  { page: "menus", question: "איך מעתיקים תוספות מפריט קיים?", answer: "בטופס עריכת פריט ← חלק 'קבוצות תוספות' ← לחץ '📋 העתק מתבנית'. תוצג רשימה של פריטים שיש להם תוספות ← בחר פריט מקור ← כל הקבוצות שלו יועתקו.", tags: ["תוספות","העתקה","תבנית","modifiers"], isDefault: false },
  { page: "menus", question: "איך מסמנים פריט כצמחוני / טבעוני / ללא גלוטן?", answer: "בטופס עריכת הפריט ← חלק 'תזונה' ← סמן: 🌿 צמחוני, 🌱 טבעוני, GF ללא גלוטן. הסימונים מוצגים כתגיות על הפריט בתפריט הלקוח.", tags: ["צמחוני","טבעוני","גלוטן","תזונה","vegan"], isDefault: false },
  { page: "menus", question: "איך מוסיפים תגיות לפריט?", answer: "בטופס עריכת הפריט ← חלק 'תגיות' ← הקלד תגית ולחץ Enter (או כפתור 'הוסף'). תגיות מוצגות כשבבים כתומים על הפריט. לחץ × להסרת תגית.", tags: ["תגיות","tags","שבב"], isDefault: false },
  { page: "menus", question: "איך מגדירים זמן הכנה לפריט?", answer: "בטופס עריכת הפריט ← חלק '⏱ זמן הכנה'. בחר מהירים: 5/10/15/20/30/45 דקות, או הזן ערך ידני (1-180). זמן ההכנה מוצג כתגית ⏱ על הפריט.", tags: ["זמן הכנה","prepTime","דקות"], isDefault: false },
  { page: "menus", question: "איך מוסיפים תרגום לפריט או קטגוריה?", answer: "בטופס עריכה ← פתח חלק 'תרגומים' ← בחר שפה (EN/RU/FR) ← הזן שם ותיאור. התרגומים משמשים להצגת התפריט לדוברי אותה שפה.", tags: ["תרגום","שפה","EN","RU","FR","בינלאומי"], isDefault: false },
  { page: "menus", question: "איך מורידים קובץ דוגמה לייבוא?", answer: "לחץ '📋 קובץ דוגמה' ← בחר פורמט: JSON (מבנה מלא לדוגמה) או Excel (גיליון עם עמודות והנחיות). השתמש בקובץ כתבנית למילוי הנתונים שלך.", tags: ["דוגמה","תבנית","ייבוא","sample"], isDefault: false },
  { page: "menus", question: "האם מחיקת קטגוריה מוחקת גם את הפריטים?", answer: "כן — מחיקת קטגוריה מוחקת את כל הפריטים שבה. מחיקת תפריט שלם מוחקת את כל הקטגוריות והפריטים. המערכת מציגה אזהרה לפני הפעולה.", tags: ["מחיקה","cascade","קטגוריה","פריטים"], isDefault: false },
  { page: "menus", question: "איך משנים את סדר הקטגוריות?", answer: "בכרטיס כל קטגוריה יש כפתורי ▲▼ בפינה. לחץ ▲ להזזה למעלה, ▼ למטה. הכפתורים מושבתים בקצוות הרשימה.", tags: ["סדר","קטגוריה","ממיין","▲▼"], isDefault: false },
  { page: "menus", question: "איך מוסיפים תמונה לפריט או קטגוריה?", answer: "בטופס עריכה ← לחץ על אזור התמונה ← בחר קובץ מהמחשב. תומך ב-JPG, PNG, WebP. התמונה מוצגת כתמונה מוקטנת על הכרטיס.", tags: ["תמונה","העלאה","image","תמונות"], isDefault: false },
  { page: "menus", question: "איך עוברים בין מסעדות בממשק התפריט?", answer: "בסרגל הצדדי, בראש הרשימה — לחץ על שם המסעדה הנוכחית ← בחר מסעדה אחרת מהרשימה. התפריטים והקטגוריות יתעדכנו למסעדה שנבחרה.", tags: ["מסעדה","מעבר","החלפה","סרגל"], isDefault: false },

  // ── משתמשים ───────────────────────────────────────────────────────────
  // isDefault: true רק ל-5 הכי שימושיים
  { page: "users", question: "איך מוסיפים משתמש חדש?", answer: "לחץ '+ הוסף משתמש' בראש הדף. הזן שם מלא, אימייל וטלפון, בחר תפקיד ושייך מסעדות ← לחץ 'צור משתמש ושלח הזמנה'. יישלח אימייל הזמנה אוטומטית.", tags: ["משתמש","יצירה","הזמנה"], isDefault: true },
  { page: "users", question: "מה פירוש הסטטוסים של משתמש?", answer: "ממתין לאימות — המשתמש טרם אישר את האימייל ולא יכול להתחבר. נדרש שינוי סיסמה — אדמין כפה שינוי, ייאלץ לעדכן בכניסה הבאה. מאומת ✓ — הכל תקין.", tags: ["סטטוס","אימות","ממתין","פעיל"], isDefault: true },
  { page: "users", question: "מה זה PIN מנהל ולמה צריך?", answer: "PIN מנהל (4 ספרות) מאפשר אישור פעולות רגישות במסך מלצר. מיועד לתפקידי ADMIN/OWNER/SHIFT_MANAGER. מוגדר בתוך טופס עריכת המשתמש.", tags: ["PIN","מנהל","אישור"], isDefault: true },
  { page: "users", question: "איך משייכים מסעדה למשתמש?", answer: "לחץ ⋮ ← '🏪 ניהול מסעדות' ← בחר מסעדה מהרשימה ← לחץ 'הוסף'. ניתן לשייך מספר מסעדות לאותו משתמש.", tags: ["מסעדה","שיוך","הרשאה"], isDefault: true },
  { page: "users", question: "מה התפקידים האפשריים?", answer: "SUPER_ADMIN, ADMIN, OWNER, SHIFT_MANAGER, EDITOR, VIEWER, WAITER, BARTENDER, DISPLAY. היררכיה: SUPER_ADMIN > ADMIN > OWNER > SHIFT_MANAGER > EDITOR > WAITER = BARTENDER > VIEWER > DISPLAY.", tags: ["תפקיד","הרשאות","role","היררכיה"], isDefault: true },
  // isDefault: false
  { page: "users", question: "איך משנים תפקיד למשתמש?", answer: "לחץ ⋮ ← '✎ ערוך פרטים' (זמין רק ל-ADMIN/SUPER_ADMIN) ← שנה את שדה 'הרשאה' ← שמור.", tags: ["תפקיד","עריכה","שינוי"], isDefault: false },
  { page: "users", question: "איך מאפסים סיסמה למשתמש?", answer: "לחץ ⋮ ליד המשתמש ← '🔑 איפוס סיסמה' ← הזן סיסמה חדשה (מינימום 6 תווים) ← לחץ 'אפס סיסמה'.", tags: ["סיסמה","איפוס","שינוי"], isDefault: false },
  { page: "users", question: "איך מחפשים משתמש?", answer: "השתמש בשדה החיפוש בסרגל הסינון — ניתן לחפש לפי שם, שם משתמש (@username) או אימייל. התוצאות מתעדכנות בזמן אמת.", tags: ["חיפוש","שם","אימייל","username"], isDefault: false },
  // חדשות
  { page: "users", question: "איך מסננים משתמשים לפי תפקיד?", answer: "בסרגל הסינון, לחץ על אחד הכפתורים: 'כל המשתמשים' / 'מנהלים' / 'מלצרים' / 'ממתין לאימות'. ניתן לשלב סינון עם חיפוש טקסט.", tags: ["סינון","תפקיד","מנהלים","מלצרים"], isDefault: false },
  { page: "users", question: "איך כופים על משתמש לשנות סיסמה?", answer: "לחץ ⋮ ← '🔐 כפה שינוי סיסמה'. בכניסה הבאה המשתמש יידרש לבחור סיסמה חדשה. לביטול: לחץ שוב '🔐 בטל כפיית שינוי סיסמה'.", tags: ["סיסמה","כפייה","אבטחה"], isDefault: false },
  { page: "users", question: "איך מוחקים משתמש?", answer: "לחץ ⋮ ← '🗑️ מחק משתמש' ← אשר. פעולה זו בלתי הפיכה — המשתמש יוסר מהמערכת לחלוטין.", tags: ["מחיקה","משתמש","הסרה"], isDefault: false },
  { page: "users", question: "איך שולחים הזמנה מחדש למשתמש לא מאומת?", answer: "לחץ ⋮ ← '📨 שלח הזמנה מחדש'. האפשרות מופיעה רק למשתמשים שעדיין לא אימתו אימייל. הקישור החדש תקף ל-72 שעות.", tags: ["הזמנה","אימות","שליחה מחדש","email"], isDefault: false },
  { page: "users", question: "מה ההבדל בין טאב 'משתמשים' לטאב 'הזמנות'?", answer: "משתמשים — רשימת כל המשתמשים הרשומים במערכת. הזמנות — קישורי הזמנה שנשלחו לאנשים שטרם השלימו רישום וטרם הפכו למשתמשים.", tags: ["הזמנות","טאב","הבדל","invites"], isDefault: false },
  { page: "users", question: "המשתמש לא קיבל אימייל הזמנה — מה עושים?", answer: "אם שליחת האימייל נכשלה, המערכת מציגה אוטומטית חלון עם קישור הזמנה. לחץ '📋 העתק' ושלח למשתמש ישירות. הקישור תקף ל-72 שעות. לאחר מכן ניתן לשלוח מחדש דרך ⋮.", tags: ["אימייל","כשל","קישור","הזמנה","fallback"], isDefault: false },
  { page: "users", question: "לכמה זמן תקף קישור הזמנה?", answer: "72 שעות. אם פג תוקפו — לחץ ⋮ ← '📨 שלח הזמנה מחדש' כדי ליצור קישור חדש.", tags: ["קישור","תוקף","72 שעות","הזמנה"], isDefault: false },
  { page: "users", question: "מה קורה כשמשתמש לא מאמת אימייל?", answer: "המשתמש נשאר במצב 'ממתין לאימות' ולא יוכל להתחבר. שלח לו הזמנה מחדש דרך ⋮ ← '📨 שלח הזמנה מחדש'.", tags: ["אימות","ממתין","אימייל","כניסה"], isDefault: false },
  { page: "users", question: "מה ההבדל בין WAITER לBARTENDER?", answer: "אין הבדל בהרשאות — שניהם מקבלים גישה זהה למסך המלצר. ההבדל הוא בשם התפקיד המוצג בלבד.", tags: ["WAITER","BARTENDER","הרשאות","הבדל"], isDefault: false },
  { page: "users", question: "מה תפקיד DISPLAY?", answer: "תפקיד DISPLAY מיועד למסכי תצוגה (TV/קיוסק) — גישת קריאה בלבד לתפריטים. אינו יכול לבצע פעולות ניהוליות ואינו מיועד לשימוש אדם.", tags: ["DISPLAY","תצוגה","קיוסק","TV"], isDefault: false },
  { page: "users", question: "אילו תפקידים יכולים לערוך משתמשים?", answer: "רק ADMIN ו-SUPER_ADMIN רואים את אפשרות '✎ ערוך פרטים'. SUPER_ADMIN יכול לנהל גם ADMIN. תפקידים נמוכים יותר אינם יכולים לשנות פרטי משתמשים.", tags: ["הרשאות","עריכה","ADMIN","SUPER_ADMIN"], isDefault: false },
  { page: "users", question: "מה ההיררכיה בין התפקידים?", answer: "SUPER_ADMIN > ADMIN > OWNER > SHIFT_MANAGER > EDITOR > WAITER = BARTENDER > VIEWER > DISPLAY. כל תפקיד יכול לנהל רק תפקידים הנמוכים ממנו בהיררכיה.", tags: ["היררכיה","תפקיד","הרשאות","סדר"], isDefault: false },
  { page: "users", question: "מה הדרישות לשם משתמש?", answer: "3-30 תווים. אותיות לטיניות קטנות (a-z), ספרות (0-9), ותווים: . _ - בלבד. לא ניתן להשתמש באותיות גדולות, עברית, או תווים מיוחדים אחרים.", tags: ["שם משתמש","username","דרישות","פורמט"], isDefault: false },
  { page: "users", question: "למה חובה טלפון בעת יצירת משתמש?", answer: "הטלפון משמש לאימות OTP — בעת הרשמה, המשתמש מקבל קוד חד-פעמי ב-SMS לאישור זהותו.", tags: ["טלפון","OTP","אימות","SMS"], isDefault: false },
  { page: "users", question: "מה מספר עובד ואיך נוצר?", answer: "מספר עובד נוצר אוטומטית בעת יצירת המשתמש. הוא מוצג בטופס עריכה ומשמש לזיהוי פנימי. לא ניתן לשנותו ידנית.", tags: ["מספר עובד","אוטומטי","זיהוי","employeeNo"], isDefault: false },
  { page: "users", question: "האם ניתן לשייך משתמש למספר מסעדות?", answer: "כן — ניתן לשייך משתמש אחד למספר מסעדות. הוסף כל מסעדה בנפרד דרך ⋮ ← '🏪 ניהול מסעדות'.", tags: ["מסעדות","שיוך","מרובה"], isDefault: false },
  { page: "users", question: "איך יודעים מתי משתמש התחבר לאחרונה?", answer: "בטבלת המשתמשים יש עמודת 'כניסה אחרונה'. אם המשתמש מעולם לא התחבר — מוצג '—'.", tags: ["כניסה","אחרונה","פעילות","lastLogin"], isDefault: false },

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
