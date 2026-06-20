// ── Israeli payroll movement-file generators ─────────────────────────────────
// Turns a month's per-employee hour breakdown into the "קובץ תנועות / קליטת
// נתונים" text that Israeli payroll bureaus ingest. Each bureau has its own field
// order; the layouts below cover the common case (employee key + wage-component
// code + quantity-in-hours). Pay-component codes are configurable per restaurant,
// so a bureau-specific code map can be plugged in without touching this file.
//
// NOTE: exact column specs are installation-specific. These presets follow the
// documented common structure; validate against your bureau's import spec before
// production payroll runs.

export type PayrollVendor = "GENERIC" | "HILAN" | "MALAM" | "SYNEL" | "MICHPAL";

export const VENDOR_LABELS: Record<PayrollVendor, string> = {
  GENERIC: "כללי (CSV)",
  HILAN:   "חילן",
  MALAM:   "מלם",
  SYNEL:   "סינאל",
  MICHPAL: "מיכפל",
};

export type PayrollEmployee = {
  employeeNo: string;
  idNumber: string;
  name: string;
  department: string;
  project: string;
  regularHours: number;
  ot125Hours: number;
  ot150Hours: number;
};

export type PayCodeSettings = { regularCode: string; ot125Code: string; ot150Code: string };

export type MovementRow = {
  employeeNo: string; idNumber: string; name: string;
  code: string; codeLabel: string; hours: number;
};

const h2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Explode each employee into one movement row per non-zero wage component. */
export function buildMovementRows(employees: PayrollEmployee[], s: PayCodeSettings): MovementRow[] {
  const rows: MovementRow[] = [];
  for (const e of employees) {
    const add = (code: string, codeLabel: string, hours: number) => {
      if (hours > 0.001) rows.push({ employeeNo: e.employeeNo, idNumber: e.idNumber, name: e.name, code, codeLabel, hours });
    };
    add(s.regularCode, "שעות רגילות 100%", e.regularHours);
    add(s.ot125Code,   "שעות נוספות 125%", e.ot125Hours);
    add(s.ot150Code,   "שעות נוספות 150%", e.ot150Hours);
  }
  return rows;
}

function toCsv(rows: (string | number)[][]): string {
  // BOM so Hebrew opens correctly in Excel / bureau importers.
  return "﻿" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
}

/**
 * Build a bureau-specific movement file. `month` is "YYYY-MM".
 * Returns { content, extension } ready for download.
 */
export function buildPayrollFile(
  vendor: PayrollVendor,
  employees: PayrollEmployee[],
  settings: PayCodeSettings,
  month: string,
): { content: string; ext: string } {
  const rows = buildMovementRows(employees, settings);
  const [y, m] = month.split("-");
  const mmYYYY = `${m}${y}`;

  switch (vendor) {
    // Hilan "קליטת נתונים" — מספר עובד, קוד שכר, כמות.
    case "HILAN": {
      const data = rows.map(r => [r.employeeNo, r.code, h2(r.hours)]);
      return { content: toCsv([["מספר עובד", "קוד שכר", "כמות"], ...data]), ext: "csv" };
    }
    // Malam movement file — מספר עובד, קוד רכיב, כמות, חודש (MMYYYY).
    case "MALAM": {
      const data = rows.map(r => [r.employeeNo, r.code, h2(r.hours), mmYYYY]);
      return { content: toCsv([["מספר עובד", "קוד רכיב", "כמות", "חודש"], ...data]), ext: "csv" };
    }
    // Synel — keyed on national-ID, tab-delimited as the T&A export expects.
    case "SYNEL": {
      const lines = rows.map(r => [r.idNumber || r.employeeNo, r.code, h2(r.hours)].join("\t"));
      return { content: "﻿" + ["תעודת זהות\tקוד\tכמות", ...lines].join("\r\n"), ext: "txt" };
    }
    // Michpal — מספר עובד, קוד, כמות, חודש; fixed comma layout, no header.
    case "MICHPAL": {
      const data = rows.map(r => [r.employeeNo, r.code, h2(r.hours), mmYYYY]);
      return { content: toCsv(data), ext: "csv" };
    }
    // Generic — full, human-readable CSV with every field.
    default: {
      const header = ["מספר עובד", 'ת"ז', "שם", "קוד שכר", "תיאור רכיב", "כמות שעות", "חודש"];
      const data = rows.map(r => [r.employeeNo, r.idNumber, r.name, r.code, r.codeLabel, h2(r.hours), mmYYYY]);
      return { content: toCsv([header, ...data]), ext: "csv" };
    }
  }
}
