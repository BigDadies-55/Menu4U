# Menu4U — מסמך יכולות המערכת

---

## 1. סקירה כללית

**Menu4U** היא פלטפורמת SaaS לניהול תפריטים והזמנות למסעדות.  
המערכת משלבת **back-office מלא** לבעלי מסעדות וצוות עם **דף תפריט ציבורי** ללקוחות.

---

## 2. סטאק טכנולוגי

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | Next.js 16 App Router, React 19, TypeScript 5 |
| עיצוב | Tailwind CSS 4, Radix UI, Lucide Icons |
| Backend | Next.js API Routes (Server Components + Route Handlers) |
| ORM | Prisma 7.8.0 |
| מסד נתונים | PostgreSQL (Neon Serverless) |
| אותנטיקציה | NextAuth v5 (JWT stateless), bcryptjs |
| תמונות | Cloudinary + Next.js Image Optimization |
| מייל | Nodemailer (SMTP) + Resend (API) |
| SMS | Inforu (ספק ישראלי) |
| Hosting | Vercel |
| Real-time | Server-Sent Events (SSE) |
| ייצוא | xlsx (Excel עם תמיכה ב-RTL עברית) |
| QR Codes | qrcode + qrcode.react |

---

## 3. מבנה הפרויקט

```
Menu4U/
├── src/
│   ├── app/
│   │   ├── admin/              # Back-office (18 מודולים)
│   │   ├── api/                # API Routes (30+ endpoints)
│   │   ├── menu/[restaurantId] # דף תפריט ציבורי
│   │   ├── login/              # כניסה למערכת
│   │   ├── verify-email/       # אימות מייל
│   │   ├── change-password/    # שינוי סיסמה מאולץ
│   │   └── terms/              # אישור תנאי שימוש
│   ├── components/admin/       # רכיבי UI משותפים
│   ├── lib/                    # לוגיקת ליבה (auth, email, SMS, etc.)
│   ├── generated/prisma/       # Prisma Client מוגנרט
│   └── types/                  # הרחבות TypeScript
├── prisma/
│   ├── schema.prisma           # 24 מודלים
│   └── migrations/             # 11 migrations (עד מאי 2026)
└── scripts/                    # seed + migrate runners
```

---

## 4. מודולי ה-Admin (Back-office)

### 4.1 מסעדות
- יצירה, עריכה, מחיקה של מסעדות (SUPER_ADMIN בלבד)
- שדות: שם, תיאור, לוגו, כתובת, טלפון, אתר, Google Maps, רשתות חברתיות
- ערכת עיצוב לתפריט הציבורי (theme + palette)
- תמיכה בקבוצות מסעדות (RestaurantGroup)

### 4.2 תפריטים
- יצירת תפריטים מרובים למסעדה אחת
- תזמון תפריט לפי יום בשבוע ושעה
- סימון תפריט ראשי (isPrimary)
- קטגוריות עם תמונות, סדר מיון ו-autoReady
- פריטים עם: מחיר, תמונה, תגיות (צמחוני / טבעוני / ללא גלוטן)
- מודיפיירים (קבוצות בחירה, מחיר נוסף, חובה/אופציונלי)

### 4.3 הזמנות
- צפייה בכל ההזמנות עם סינון
- שינוי סטטוס: PENDING → CONFIRMED → PREPARING → READY → DELIVERED → PAID
- ניהול קורסים (מנה ראשונה / עיקרית / קינוח)
- Fire items למטבח לפי קורס
- מעקב סטטוס לפי פריט (heldUntilFired, firedAt, doneAt, servedAt)
- ניהול שולחן (פתיחה / סגירה / סיכום)

### 4.4 מסכי מטבח (KDS)
4 תצוגות לבחירה:
- **Table** — טבלת סטטוסים רגילה
- **Kanban** — לוח קנבן לפי סטטוס
- **Tickets** — כרטיסיות הזמנה
- **Station Dark** — תחנת מטבח בצבע אפל (dark mode)

Real-time updates דרך SSE.

### 4.5 תחנת מלצר
- יצירת הזמנות חדשות
- מעקב אחר פריטים שהוזמנו

### 4.6 קופאי
- עיבוד תשלומים
- החלת הנחות לויאלטי וקופונים

### 4.7 לויאלטי
- הרשמת חברים (לפי טלפון, ייחודי למסעדה)
- הצברת נקודות (pointsPerShekel)
- פדיון נקודות לקופונים
- סוגי קופונים: DISCOUNT_PERCENT / AMOUNT / FREE_ITEM
- בונוס קבלת פנים + בונוס יום הולדת
- היסטוריית עסקאות (EARN / REDEEM / BONUS / MANUAL)
- מעקב top-items

### 4.8 CRM
- יצירת קמפיינים שיווקיים
- שליחה דרך SMS (Inforu) ו/או מייל
- תזמון קמפיין
- סטטיסטיקות משלוח

### 4.9 לקוחות
- מאגר קשר לקוחות (שם, טלפון, מייל, הערות)

### 4.10 משתמשים
- יצירת משתמשים, שיוך למסעדות, הגדרת תפקיד
- ניהול סיסמאות (reset, force change)
- תפקידים: SUPER_ADMIN / ADMIN / OWNER / EDITOR / VIEWER / WAITER / DISPLAY

### 4.11 לוגים
- Audit trail מלא לכל פעולה
- סינון לפי תאריך, משתמש, פעולה, ישות
- ייצוא CSV בעברית (UTF-8 BOM, RTL)
- שמירה ל-1 שנה

### 4.12 הגדרות
- מדיניות סיסמאות (גיל, אורך, מורכבות, היסטוריה, idle timeout)
- הגדרות אתר גלובליות (siteName, לוגו, domain, copyright, adminPalette)

### 4.13 Layout Builder
- עיצוב מותאם אישית לתפריט הציבורי

---

## 5. דף התפריט הציבורי

- נגיש בכתובת `/menu/[restaurantId]` — ללא צורך בהתחברות
- טוען נתונים server-side (SEO + ביצועים)
- מיישם לוגיק תזמון: הצגת התפריט הפעיל לפי יום/שעה
- כפתורי פעולה: שיחה, WhatsApp, Google Maps, אתר
- מעקב צפיות אוטומטי (MenuView analytics)
- תמיכה ב-QR Code

### 4 ערכות עיצוב לתפריט:
| שם | סגנון |
|----|-------|
| **Luxury** | זהב / שחור |
| **Fresh** | טורקיז / כחול כהה |
| **Nature** | ירוק |
| **Bold** | ורוד |

---

## 6. מודל הנתונים (24 מודלים)

| מודל | תפקיד |
|------|-------|
| User | משתמשי המערכת (email, סיסמה, תפקיד גלובלי, דגלים) |
| RestaurantUser | קשר משתמש-מסעדה + תפקיד ייחודי |
| Restaurant | ישות המסעדה (כל הפרטים + הגדרות) |
| Menu | תפריט (תזמון, isPrimary, isActive) |
| Category | קטגוריה בתפריט (תמונה, סדר, autoReady) |
| Item | פריט תפריט (מחיר, תמונה, תגיות, מודיפיירים) |
| ItemModifierGroup | קבוצת מודיפיירים (required, max selections) |
| ItemModifier | מודיפייר בודד (תווית, תוספת מחיר) |
| Order | הזמנה (סטטוס, סכום, הנחת לויאלטי) |
| OrderItem | שורה בהזמנה (קורס, סטטוס, זמני fire/done/served) |
| OrderItemModifier | מודיפיירים שהוחלו על פריט |
| OrderStatusLog | היסטוריית שינויי סטטוס |
| OrderCounter | מונה הזמנות אוטומטי למסעדה |
| TableSession | מעקב שולחן (פתיחה/סגירה/סיכום) |
| Customer | מאגר לקוחות |
| LoyaltyMember | חבר לויאלטי (טלפון ייחודי למסעדה, נקודות) |
| LoyaltyTransaction | ספר תנועות נקודות |
| LoyaltyCoupon | קופון שנוצר (קוד, סוג, ערך, תפוגה) |
| LoyaltySettings | הגדרות לויאלטי למסעדה |
| RestaurantGroup | קבוצת מסעדות |
| MenuView | Analytics: צפיות בתפריט/קטגוריה/פריט |
| AuditLog | רישום ביקורת (userId, IP, פעולה, meta JSON) |
| PasswordHistory | היסטוריית סיסמאות למשתמש |
| PasswordPolicy | מדיניות סיסמאות גלובלית |
| SiteConfig | הגדרות אתר גלובליות |

**Enums:**
- `Role`: SUPER_ADMIN, ADMIN, OWNER, EDITOR, VIEWER, WAITER, DISPLAY
- `OrderStatus`: PENDING, CONFIRMED, PREPARING, READY, DELIVERED, CANCELLED, PAID

---

## 7. API Endpoints (30+)

### Admin (מוגן — דורש session + role)
| קטגוריה | Methods |
|---------|---------|
| Restaurants | GET / POST / PATCH / DELETE |
| Menus | GET / POST / PATCH / DELETE |
| Categories | GET / POST / PATCH / DELETE |
| Items | GET / POST / PATCH / DELETE |
| Orders | GET / PATCH (status, fire, item-status, close-table) |
| Orders Stream | GET (SSE real-time) |
| Waiter | POST (place order) |
| Users | GET / POST / PATCH / DELETE |
| Loyalty | GET / POST (member, earn, redeem, stats) |
| CRM | GET / POST / PATCH / DELETE / POST send |
| Customers | GET / POST / PATCH / DELETE |
| Upload | POST (Cloudinary) |
| Analytics | GET (MenuView aggregation) |
| Backup | POST trigger / restore / GET status |
| Logs | GET / GET csv-export |
| Settings | GET / PATCH (password policy, site config) |
| Groups | GET / POST / PATCH / DELETE |

### Public (ללא auth)
| Endpoint | תפקיד |
|---------|-------|
| GET `/api/menu/[id]` | טעינת תפריט |
| POST `/api/menu/[id]/track` | מעקב צפיות |
| POST `/api/menu/[id]/order` | יצירת הזמנה |
| GET/POST `/api/loyalty/[id]` | לויאלטי ציבורי |

### System
| Endpoint | תפקיד |
|---------|-------|
| POST `/api/setup?secret=X` | אתחול מערכת ראשוני |
| POST `/api/migrate` | הרצת migrations |
| GET `/api/cron/...` | משימות מתוזמנות (backup, CRM) |

---

## 8. אבטחה

- **RBAC** — תפקיד גלובלי + תפקיד לכל מסעדה
- **bcryptjs** — hashing סיסמאות (12 salt rounds)
- **JWT stateless** — אין session table
- **מדיניות סיסמאות** — גיל מקסימלי, אורך מינימלי, מורכבות, היסטוריה, idle timeout
- **Rate Limiting** — על endpoint-ים רגישים
- **CSRF** — מוגן דרך NextAuth
- **Audit Logging** — כל פעולה עם IP + meta
- **Protected endpoints** — setup/migrate מוגנים עם secret token
- **Email Verification** — אימות מייל בהרשמה
- **Force Password Change** — דגל mustChangePassword

---

## 9. Real-time ו-Analytics

- **SSE** — מסך מטבח מקבל עדכוני הזמנות בזמן אמת
- **MenuView** — מעקב צפיות בדף תפריט, קטגוריה, פריט
- **Dashboard Stats** — אגרגציה לפי תפקיד (SUPER_ADMIN רואה הכל, אחרים רק המסעדות שלהם)

---

## 10. היסטוריית Migrations

| # | תוכן |
|---|------|
| 1 | Init — כל המודלים הבסיסיים |
| 2 | שדות מסעדה (טלפון, כתובת, אתר) |
| 3 | תגיות פריטים (צמחוני, טבעוני, גלוטן) |
| 4 | תפקיד OWNER + RestaurantUser junction |
| 5 | מיקום מסעדה + Google Maps |
| 6 | KDS view modes |
| 7 | palette למסעדה + הזמנות |
| 8 | OrderItem.servedAt |
| 9 | Category.autoReady |
| 10 | Restaurant.splashImage |
| 11 | מדיניות סיסמאות + דגלי משתמש |

---

## 11. משתני סביבה נדרשים (.env)

```env
DATABASE_URL=postgresql://...
AUTH_SECRET=...
NEXTAUTH_URL=...
AUTH_URL=...
NEXT_PUBLIC_APP_URL=...
GMAIL_USER=...
GMAIL_APP_PASSWORD=...
INFORU_USERNAME=...
INFORU_API_TOKEN=...
INFORU_SENDER_NAME=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CRON_SECRET=...
SETUP_SECRET=...
```

---

*נוצר: מאי 2026 | גרסת מערכת: Next.js 16, Prisma 7.8.0*
