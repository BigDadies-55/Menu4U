"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TermsPage() {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setScrolledToBottom(true);
    }
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  async function handleAccept() {
    if (!checked || !scrolledToBottom) return;
    setLoading(true);
    const res = await fetch("/api/admin/terms/accept", { method: "POST" });
    if (res.ok) {
      router.replace("/admin");
    } else {
      setLoading(false);
    }
  }

  const canAccept = scrolledToBottom && checked;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(135deg,#0a0a0a 0%,#1a1208 100%)" }}
      dir="rtl"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-8 pt-8 pb-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 text-center">כתב הצהרה, אישור ותנאי שימוש</h1>
          <p className="text-sm text-gray-500 text-center mt-1">יש לקרוא ולאשר לפני השימוש במערכת</p>
        </div>

        <div
          ref={scrollRef}
          className="px-8 py-6 overflow-y-auto text-sm text-gray-800 leading-7 space-y-5"
          style={{ height: "380px" }}
        >
          <p className="text-xs text-gray-500 italic">
            מסמך זה מהווה הסכם מחייב בין המשתמש לבין הנהלת מערכת Menu4U. קריאה והסכמה לתנאים הכלולים בו מהווים תנאי הכרחי לשימוש במערכת.
          </p>

          <section>
            <h2 className="font-bold text-gray-900 mb-1">1. הצהרת המשתמש לגבי בעלות זכויות יוצרים</h2>
            <p>
              המשתמש מצהיר ומתחייב בזאת כי כל תוכן שיועלה על ידו למערכת — לרבות תמונות, טקסטים, לוגואים, גרפיקות וכל חומר אחר — הינו בבעלותו הבלעדית, ו/או כי קיבל רישיון מפורש ותקין מבעל הזכויות המקורי להשתמש בו ולהעלותו. המשתמש מצהיר כי לא יעלה כל חומר שיש בו הפרה של זכויות יוצרים, סימן מסחרי, פטנט, סוד מסחרי, זכות לפרטיות, זכות לפרסום, או כל זכות קניינית אחרת של כל אדם או גוף שהוא.
            </p>
            <p>
              העלאת תוכן פוגעני, מיני, מסית, גזעני, מבזה, מאיים, בלתי חוקי או בלתי הולם אסורה בהחלט ותגרור הסרה מיידית של החשבון, ועשויה לעלות בנקיטת הליכים משפטיים.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-1">2. העדר אחריות של הנהלת המערכת (Disclaimer)</h2>
            <p>
              הנהלת מערכת Menu4U אינה בודקת, מאשרת, או אחראית בכל דרך שהיא לתכנים המועלים על ידי המשתמשים. כל תוכן שמועלה הינו באחריות המשתמש בלבד. הנהלת המערכת שומרת לעצמה את הזכות להסיר, ללא הודעה מוקדמת, כל תוכן שנמצא כמפר את תנאי השימוש או שהתקבלה לגביו תלונה.
            </p>
            <p>
              מערכת Menu4U ניתנת "כמות שהיא" (AS IS), ללא אחריות מכל סוג — מפורשת או משתמעת. הנהלת המערכת אינה ערבה לזמינות, רציפות, דיוק או התאמה לצורך מסוים של השירות.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-1">3. התחייבות לשיפוי ופיצוי בגין נזקים</h2>
            <p>
              המשתמש מתחייב לשפות ולפצות את הנהלת מערכת Menu4U, עובדיה, מנהליה, שותפיה וספקיה, בגין כל תביעה, נזק, הפסד, עלות או הוצאה — לרבות שכר טרחת עורכי דין — הנובעים מהפרת תנאי שימוש אלה, מהפרת זכויות צד שלישי, או מכל שימוש בלתי חוקי בשירות.
            </p>
            <p>
              אחריות משפטית בגין הפרת זכויות יוצרים, פרסום לשון הרע, פגיעה בפרטיות, הונאה, או כל עוולה אחרת תחול באופן בלעדי על המשתמש שהעלה את התוכן.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-1">4. מנגנון הודעה והסרה (Notice and Take-Down)</h2>
            <p>
              אם אתם סבורים שתוכן כלשהו שפורסם במערכת מפר את זכויותיכם, אנא פנו אלינו עם פרטי הפרה, הוכחת בעלות וזהות. אנו נבחן כל פנייה ונפעל להסרת תוכן מפר בהתאם לחוק.
            </p>
            <p>
              שליחת הודעת DMCA שקרית ו/או הטרדה של בעלי חשבונות חוקיים תחשב לשימוש לרעה ועלולה לגרור אחריות משפטית.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900 mb-1">5. תיעוד דיגיטלי, אכיפה וסמכות שיפוט</h2>
            <p>
              אישור תנאי שימוש אלה מתועד דיגיטלית: נשמרים כתובת ה-IP של המשתמש, ה-User Agent, ותאריך ושעת האישור. תיעוד זה ישמש כראיה לצורכי אכיפה ו/או הליכים משפטיים.
            </p>
            <p>
              הסכם זה כפוף לדיני מדינת ישראל. כל מחלוקת תידון בבתי המשפט המוסמכים במחוז תל אביב, אלא אם הוסכם אחרת בכתב.
            </p>
            <p>
              הנהלת המערכת שומרת לעצמה את הזכות לשנות תנאים אלה בכל עת. שינויים מהותיים יפורסמו מראש. המשך השימוש לאחר הודעה על שינוי מהווה הסכמה לתנאים המעודכנים.
            </p>
          </section>

          <p className="text-xs text-gray-500 border-t pt-4 mt-4">
            גרסה 1.0 | תאריך עדכון אחרון: מאי 2026 | כל הזכויות שמורות © Menu4U
          </p>
        </div>

        <div className="px-8 pb-8 pt-4 border-t border-gray-100 space-y-4">
          {!scrolledToBottom && (
            <p className="text-xs text-amber-600 text-center">
              יש לגלול עד סוף המסמך כדי להפעיל את כפתור האישור
            </p>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-amber-500 shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              אני מאשר שקראתי את כתב ההצהרה ותנאי השימוש ומסכים לכל האמור בו
            </span>
          </label>

          <button
            onClick={handleAccept}
            disabled={!canAccept || loading}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all"
            style={{
              background: canAccept
                ? "linear-gradient(90deg,#d97706,#b45309)"
                : "#d1d5db",
              cursor: canAccept ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "שומר..." : "אישור וכניסה למערכת"}
          </button>
        </div>
      </div>
    </div>
  );
}
