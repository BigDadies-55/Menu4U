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
  maxWidth = 1280,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  maxWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      dir="rtl"
      style={{
        width: "100%",
        maxWidth,
        margin: "0 auto",
        padding: "20px 32px",
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
