# Menu4U — מסמך מערכת

---

## 1. מטרת המערכת

**Menu4U** היא פלטפורמת SaaS לניהול תפריטים דיגיטליים למסעדות.

המערכת מספקת שתי שכבות עיקריות:
- **בק-אופיס לניהול** — ממשק ניהול מאובטח לבעלי מסעדות ומנהלים, לניהול תפריטים, פריטים, משתמשים ואנליטיקס
- **דף ציבורי ללקוחות** — דף תפריט יפה וחוויתי שגולשים רואים ללא כל התחברות

---

## 2. ארכיטקטורה טכנית

### Stack

| שכבה | טכנולוגיה |
|------|-----------|
| Framework | Next.js 16.2.6 (App Router) |
| שפה | TypeScript 5 |
| ORM | Prisma 7.8.0 |
| DB | PostgreSQL (Neon — Serverless) |
| Auth | NextAuth v5 (JWT, Credentials) |
| עיצוב | Tailwind CSS v4 |
| תמונות | Cloudinary |
| Hosting | Vercel |

### מבנה תיקיות

```
src/
├── app/
│   ├── admin/              # בק-אופיס (Server + Client Components)
│   │   ├── page.tsx        # דשבורד
│   │   ├── restaurants/    # ניהול מסעדות
│   │   ├── menus/          # ניהול תפריטים, קטגוריות, פריטים
│   │   ├── users/          # ניהול משתמשים
│   │   ├── orders/         # הזמנות
│   │   └── logs/           # לוג פעולות
│   ├── api/
│   │   ├── admin/          # API routes מאובטחים (CRUD)
│   │   ├── auth/           # NextAuth handler
│   │   ├── menu/           # API ציבורי (tracking)
│   │   ├── migrate/        # הרצת מיגרציות DB
│   │   └── setup/          # אתחול ראשוני של המערכת
│   ├── menu/[restaurantId] # דף תפריט ציבורי
│   └── login/              # דף התחברות
├── components/admin/       # AdminShell, Sidebar, ImageUpload
└── lib/
    ├── auth.ts             # הגדרת NextAuth
    ├── prisma.ts           # Prisma client singleton
    ├── permissions.ts      # Role hierarchy + helpers
    └── audit.ts            # Audit logging helper
```

### עיקרון הרינדור

- **Server Components** — דשבורד, עמודי ניהול, דף תפריט ציבורי (מהיר, SEO)
- **Client Components** — טפסים, מצב UI, פעולות CRUD אינטראקטיביות (`"use client"`)
- **API Routes** — כל הלוגיקה העסקית עוברת דרך route handlers ב-`/api/admin/`

---

## 3. מודל הנתונים

```
User ─────────────────────── RestaurantUser ──── Restaurant
  │  (global role)            (per-restaurant role)      │
  │                                                       │
  └─ Account / Session                            Menu ──┘
                                                    │
                                               Category
                                                    │
                                                  Item
                                                    │
                                               OrderItem ── Order
                                                    
MenuView (analytics)
AuditLog (system logs)
```

### מודלים עיקריים

**User** — משתמש מערכת עם תפקיד גלובלי, אימות בסיסמה (bcrypt)

**Restaurant** — מסעדה עם פרטי קשר, לוגו, ציון תזמון תפריטים, ועיצוב (theme)

**RestaurantUser** — שיוך משתמש-מסעדה עם תפקיד ספציפי לאותה מסעדה

**Menu** — תפריט השייך למסעדה, תומך ב: `isPrimary`, תזמון ימים+שעות

**Category** — קטגוריה בתפריט עם תמונה ומיון

**Item** — פריט תפריט עם מחיר, תמונה, תגיות (צמחוני/טבעוני/ללא גלוטן)

**MenuView** — מעקב צפיות ציבוריות (דף, קטגוריה, פריט)

**AuditLog** — לוג פעולות מערכת ניהול (נשמר שנה)

---

## 4. מערכת הרשאות

### היררכיית תפקידים

```
SUPER_ADMIN (4)  ← גישה מלאה לכל המערכת
     │
  ADMIN (3)      ← ניהול משתמשים, לוגים, כל מסעדות המשויכות
     │
  OWNER (2)      ← ניהול תפריטים ופריטים של המסעדה
     │
 EDITOR (2)      ← עריכת תפריטים ופריטים (זהה ל-OWNER)
     │
 VIEWER (1)      ← קריאה בלבד
```

### כללי גישה

| פעולה | תפקיד מינימלי |
|-------|--------------|
| יצירה/עריכה/מחיקה של מסעדה | SUPER_ADMIN |
| ניהול משתמשים + שיוך למסעדות | ADMIN |
| צפייה בלוג פעולות | ADMIN |
| יצירה/עריכה/מחיקה של תפריט, קטגוריה, פריט | EDITOR |
| העלאת תמונות | EDITOR |
| צפייה בדשבורד ואנליטיקס | כל תפקיד |
| דף תפריט ציבורי | ללא התחברות |

**הגנה כפולה:** כל endpoint בודק גם תפקיד גלובלי וגם שיוך לפי `RestaurantUser`.

---

## 5. יכולות המערכת

### ניהול מסעדות (SUPER_ADMIN)
- יצירה, עריכה, מחיקה של מסעדה
- שדות: שם, תיאור, לוגו, כתובת, טלפון, טלפון הזמנות, אתר, קישור מפה
- בחירת עיצוב (theme) לדף הציבורי מתוך 4 נושאים

### ניהול תפריטים
- מספר תפריטים למסעדה
- **תפריט ראשי** (`isPrimary`) — מוצג כברירת מחדל
- **תזמון** — הגדרת ימי שבוע + שעות להפעלה אוטומטית של תפריט
- קטגוריות עם תמונה ומיון גרירה
- פריטים עם: מחיר, תמונה (Cloudinary), תגיות תזונה, מיון

### דף תפריט ציבורי
- נגיש ב-`/menu/[restaurantId]` ללא התחברות
- לוגיקת תצוגה: תפריט ראשי → תזמון → קטגוריות ופריטים פעילים
- **4 עיצובים:**
  - `luxury` — זהב על שחור (ברירת מחדל)
  - `fresh` — תכלת על כחול כהה
  - `nature` — ירוק על כהה
  - `bold` — ורוד/בוהק על כהה
- כפתורי קישור לטלפון + WhatsApp + מפות + אתר
- מעקב צפיות אוטומטי (דף, קטגוריה, פריט)

### ניהול משתמשים (ADMIN+)
- יצירת משתמשים עם תפקיד
- שיוך/הסרה ממסעדות ספציפיות
- עדכון תפקיד וסיסמה
- הגנה: לא ניתן ליצור SUPER_ADMIN ללא הרשאה

### אנליטיקס
- צפיות לתקופה נבחרת (7 ימים / 30 ימים / שנה)
- סה"כ צפיות היסטורי
- קטגוריות ופריטים הנצפים ביותר לכל מסעדה

### לוג פעולות (ADMIN+)
- תיעוד כל פעולות הניהול: CRUD על כל ישות, התחברויות, שינויי סיסמה
- פילטרים: סוג פעולה, ישות, חיפוש טקסט, טווח תאריכים
- הסתרת הרצות מיגרציה (צ'קבוקס)
- ייצוא CSV לאקסל (UTF-8 BOM לתמיכה בעברית)
- שמירה אוטומטית שנה אחת, מחיקה lazy

---

## 6. API Endpoints

### Public
| Method | Path | תיאור |
|--------|------|-------|
| GET | `/menu/[restaurantId]` | דף תפריט ציבורי |
| POST | `/api/menu/[restaurantId]/track` | מעקב צפיות |

### Admin — Restaurants
| Method | Path | הרשאה |
|--------|------|-------|
| GET | `/api/admin/restaurants` | SUPER_ADMIN |
| POST | `/api/admin/restaurants` | SUPER_ADMIN |
| PATCH | `/api/admin/restaurants/[id]` | SUPER_ADMIN |
| DELETE | `/api/admin/restaurants/[id]` | SUPER_ADMIN |

### Admin — Menus / Categories / Items
| Method | Path | הרשאה |
|--------|------|-------|
| POST | `/api/admin/menus` | EDITOR+ |
| PATCH | `/api/admin/menus/[id]` | EDITOR+ |
| DELETE | `/api/admin/menus/[id]` | EDITOR+ |
| POST/PATCH/DELETE | `/api/admin/categories/[id]` | EDITOR+ |
| POST/PATCH/DELETE | `/api/admin/items/[id]` | EDITOR+ |

### Admin — Users
| Method | Path | הרשאה |
|--------|------|-------|
| POST | `/api/admin/users` | ADMIN+ |
| PATCH/DELETE | `/api/admin/users/[id]` | ADMIN+ |
| POST/DELETE | `/api/admin/users/[id]/restaurants` | ADMIN+ |

### Admin — Other
| Method | Path | תיאור |
|--------|------|-------|
| POST | `/api/admin/upload` | העלאת תמונה ל-Cloudinary |
| POST | `/api/admin/profile/password` | שינוי סיסמה עצמית |
| GET | `/api/admin/analytics` | נתוני אנליטיקס |
| GET | `/api/admin/logs` | לוג פעולות |

### System
| Method | Path | תיאור |
|--------|------|-------|
| GET | `/api/setup?secret=X` | אתחול ראשוני (משתמש admin) |
| GET | `/api/migrate?secret=X` | הרצת מיגרציות DB |

---

## 7. תשתית ו-Deployment

### Vercel
- Deploy אוטומטי מ-GitHub
- `build` script: `prisma generate && rm -f prisma/seed.ts && next build`
- `postinstall`: `prisma generate && rm -f prisma/seed.ts`
- `tsconfig.build.json` — מוודא ש-TypeScript worker לא מסרק את `prisma/`

### Neon PostgreSQL
- Serverless PostgreSQL
- חיבור דרך `@prisma/adapter-pg` עם connection string

### Cloudinary
- אחסון תמונות לוגואים, קטגוריות ופריטים
- תיקיה: `menu4u/`

### משתני סביבה

| משתנה | שימוש |
|-------|-------|
| `DATABASE_URL` | חיבור ל-PostgreSQL |
| `NEXTAUTH_SECRET` | חתימת JWT |
| `NEXTAUTH_URL` | כתובת הדומיין |
| `CLOUDINARY_CLOUD_NAME` | שם ה-cloud |
| `CLOUDINARY_API_KEY` | מפתח Cloudinary |
| `CLOUDINARY_API_SECRET` | סוד Cloudinary |
| `SETUP_SECRET` | הגנה על endpoints של setup/migrate |

---

## 8. תהליך אתחול ראשוני

1. Deploy ל-Vercel עם כל משתני הסביבה
2. קריאה ל-`/api/setup?secret=SETUP_SECRET` — יוצר משתמש Super Admin
3. קריאה ל-`/api/migrate?secret=SETUP_SECRET` — יוצר עמודות ממיגרציות ידניות
4. כניסה ל-`/login` עם `admin@menu4u.com` / `admin123`
5. שינוי סיסמה מיד לאחר הכניסה

---

## 9. אבטחה

- **כל endpoints מאובטחים** עם בדיקת session + role
- **הגנת CSRF** — NextAuth מטפל אוטומטית
- **bcrypt** לאחסון סיסמאות (12 salt rounds)
- **JWT** — אין שמירת session בDB, stateless
- **הגנה היררכית** — SUPER_ADMIN לא יכול להיות שנה ע"י ADMIN
- **Audit log** — כל פעולה קריטית מתועדת עם userId, IP וזמן

---

*גרסה: 0.1.0 | עדכון אחרון: מאי 2026*
