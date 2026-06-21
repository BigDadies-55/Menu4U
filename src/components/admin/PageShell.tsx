import React from "react";
import { T } from "@/lib/ui";

/**
 * טמפלט תוכן אחיד לכל דפי הניהול:
 * padding, רוחב מקסימלי, כותרת, תת-כותרת ואזור פעולות — במקום אחד.
 * כל הפרופים אופציונליים, כך שׁ-<PageShell>{children}</PageShell> ממשיך לעבוד כמו קודם.
 *
 * מסכי מלצר (full-bleed) מוחרגים אוטומטית ב-AdminShell ולא משתמשים בטמפלט הזה.
 */
export default function PageShell({
  title,
  subtitle,
  actions,
  maxWidth,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** רוחב מקסימלי אופציונלי. ללא ערך — הדף ריספונסיבי וממלא את כל רוחב המסך. */
  maxWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      dir="rtl"
      style={{
        width: "100%",
        maxWidth: maxWidth ?? "100%",
        margin: "0 auto",
        // padding ריספונסיבי: צר במובייל, רחב בדסקטופ
        padding: "clamp(14px, 2.5vw, 28px) clamp(16px, 3vw, 40px)",
      }}
    >
      {(title || actions) && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            {title && (
              <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.2 }}>
                {title}
              </h1>
            )}
            {subtitle && (
              <p style={{ fontSize: 13, color: T.muted, margin: "4px 0 0" }}>{subtitle}</p>
            )}
          </div>
          {actions && <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>}
        </header>
      )}

      {children}
    </div>
  );
}
