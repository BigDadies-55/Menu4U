"use client";

import { T } from "@/lib/ui";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import ImageUpload from "@/components/admin/ImageUpload";
import PageShell from "@/components/admin/PageShell";
import { AssistantWidget } from "@/components/admin/AssistantWidget";

type ItemTranslationsMap = { en?: { name?: string; description?: string }; ru?: { name?: string; description?: string }; fr?: { name?: string; description?: string } };
type CatTranslationsMap  = { en?: { name?: string }; ru?: { name?: string }; fr?: { name?: string } };

type Item = {
  id: string; name: string; description: string | null; price: number;
  image: string | null; isActive: boolean; isVegetarian: boolean;
  isVegan: boolean; isGlutenFree: boolean; tags: string[]; allergens: string[]; prepTime: number | null; sortOrder: number;
  translations?: ItemTranslationsMap | null;
};

type Category = {
  id: string; name: string; image: string | null;
  items: Item[]; isActive: boolean; autoReady: boolean; kitchenStationId: string | null; sortOrder: number; course: number;
  translations?: CatTranslationsMap | null;
};

type Station = { id: string; restaurantId: string; code: string; label: string; skipKitchen: boolean };

type Menu = {
  id: string; name: string; isActive: boolean; isPrimary: boolean;
  scheduleDays: string[]; scheduleFrom: string | null; scheduleTo: string | null;
  categories: Category[];
};
type Restaurant = { id: string; name: string; menus: Menu[] };

// Import file types
type ImportItem = {
  name: string; description?: string; price: number;
  isVegetarian?: boolean; isVegan?: boolean; isGlutenFree?: boolean;
  tags?: string[]; allergens?: string[]; prepTime?: number | null; sortOrder?: number;
};
type ImportCategory = { name: string; sortOrder?: number; items: ImportItem[] };
type ImportMenu = {
  name: string; isPrimary?: boolean; scheduleDays?: string[];
  scheduleFrom?: string | null; scheduleTo?: string | null;
  categories: ImportCategory[];
};
type ImportFile = { version?: number; restaurantName?: string; exportedAt?: string; menus: ImportMenu[] };

const DAYS_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const emptyScheduleForm = { isPrimary: false, scheduleDays: [] as string[], scheduleFrom: "", scheduleTo: "" };

const emptyItemTr  = (): ItemTranslationsMap => ({ en: { name: "", description: "" }, ru: { name: "", description: "" }, fr: { name: "", description: "" } });
const emptyCatTr   = (): CatTranslationsMap  => ({ en: { name: "" }, ru: { name: "" }, fr: { name: "" } });
const ALLERGEN_LIST = [
  { key: "GLUTEN",      label: "גלוטן" },
  { key: "MILK",        label: "חלב" },
  { key: "EGGS",        label: "ביצים" },
  { key: "FISH",        label: "דגים" },
  { key: "PEANUTS",     label: "בוטנים" },
  { key: "SOYBEANS",    label: "סויה" },
  { key: "NUTS",        label: "אגוזים" },
  { key: "SESAME",      label: "שומשום" },
  { key: "CRUSTACEANS", label: "סרטנים" },
  { key: "MOLLUSCS",    label: "רכיכות" },
  { key: "CELERY",      label: "סלרי" },
  { key: "MUSTARD",     label: "חרדל" },
  { key: "SULPHITES",   label: "גופרית" },
  { key: "LUPIN",       label: "לופין" },
] as const;

const emptyItemForm = { name: "", description: "", price: "", image: "", isVegetarian: false, isVegan: false, isGlutenFree: false, tags: [] as string[], allergens: [] as string[], prepTime: "", translations: emptyItemTr() };
const emptyCategoryForm = { name: "", description: "", image: "", course: 1, translations: emptyCatTr() };

type ModOption = { id?: string; label: string; priceAdd: number; order: number };
type ModGroup  = { id?: string; name: string; required: boolean; maxSelect: number; order: number; options: ModOption[] };

type TemplatePick = { id: string; name: string; required: boolean; maxSelect: number; order: number; options: ModOption[]; item: { id: string; name: string } };

const SAMPLE_DATA: ImportFile = {
  "version": 1,
  "restaurantName": "דוגמא - מסעדה",
  "exportedAt": "2026-05-24T00:00:00.000Z",
  "menus": [
    {
      "name": "תפריט ראשי",
      "isPrimary": true,
      "scheduleDays": [],
      "scheduleFrom": null,
      "scheduleTo": null,
      "categories": [
        {
          "name": "מנות ראשונות",
          "sortOrder": 0,
          "items": [
            { "name": "סלט ים תיכוני", "description": "עגבניות, מלפפון, זיתים ופטה", "price": 42, "isVegetarian": true, "isVegan": false, "isGlutenFree": true, "tags": [], "allergens": ["MILK"], "prepTime": 5, "sortOrder": 0 },
            { "name": "ברוסקטה קלאסית", "description": "לחם קלוי עם עגבניות ובזיליקום", "price": 38, "isVegetarian": true, "isVegan": true, "isGlutenFree": false, "tags": [], "allergens": ["GLUTEN"], "prepTime": 8, "sortOrder": 1 },
            { "name": "מרק עגבניות", "description": "מרק עגבניות טרי עם שמנת ובזיליקום", "price": 36, "isVegetarian": true, "isVegan": false, "isGlutenFree": true, "tags": ["חם"], "allergens": ["MILK"], "prepTime": 10, "sortOrder": 2 }
          ]
        },
        {
          "name": "מנות עיקריות",
          "sortOrder": 1,
          "items": [
            { "name": "סטייק אנטריקוט 300 גר'", "description": "סטייק בבישול לבחירה עם ירקות קלויים", "price": 148, "isVegetarian": false, "isVegan": false, "isGlutenFree": true, "tags": ["בשר", "ללא גלוטן"], "allergens": [], "prepTime": 20, "sortOrder": 0 },
            { "name": "פילה סלמון", "description": "פילה סלמון צלוי עם אורז ולימון", "price": 118, "isVegetarian": false, "isVegan": false, "isGlutenFree": true, "tags": ["דגים"], "allergens": ["FISH"], "prepTime": 18, "sortOrder": 1 },
            { "name": "פסטה ארביאטה", "description": "פנה ברוטב עגבניות חריף עם שום", "price": 68, "isVegetarian": true, "isVegan": true, "isGlutenFree": false, "tags": ["חריף"], "allergens": ["GLUTEN"], "prepTime": 15, "sortOrder": 2 },
            { "name": "המבורגר ביתי", "description": "המבורגר 200 גר' עם חסה, עגבנייה ורוטב", "price": 88, "isVegetarian": false, "isVegan": false, "isGlutenFree": false, "tags": ["פופולרי"], "allergens": ["GLUTEN", "EGGS"], "prepTime": 15, "sortOrder": 3 }
          ]
        },
        {
          "name": "קינוחים",
          "sortOrder": 2,
          "items": [
            { "name": "קרם ברולה", "description": "קרם צרפתי קלאסי עם ציפוי סוכר", "price": 42, "isVegetarian": true, "isVegan": false, "isGlutenFree": true, "tags": [], "allergens": ["MILK", "EGGS"], "prepTime": 5, "sortOrder": 0 },
            { "name": "פונדנט שוקולד", "description": "עוגת שוקולד חמה עם גלידת וניל", "price": 48, "isVegetarian": true, "isVegan": false, "isGlutenFree": false, "tags": ["שוקולד", "חם"], "allergens": ["MILK", "EGGS", "GLUTEN"], "prepTime": 12, "sortOrder": 1 },
            { "name": "טירמיסו", "description": "קינוח איטלקי קלאסי עם קפה ומסקרפונה", "price": 44, "isVegetarian": true, "isVegan": false, "isGlutenFree": false, "tags": [], "allergens": ["MILK", "EGGS", "GLUTEN"], "prepTime": 3, "sortOrder": 2 }
          ]
        }
      ]
    },
    {
      "name": "תפריט שתייה",
      "isPrimary": false,
      "scheduleDays": [],
      "scheduleFrom": null,
      "scheduleTo": null,
      "categories": [
        {
          "name": "משקאות חמים",
          "sortOrder": 0,
          "items": [
            { "name": "אספרסו", "description": "קפה איטלקי קלאסי", "price": 12, "isVegetarian": true, "isVegan": true, "isGlutenFree": true, "tags": ["קפה"], "allergens": [], "prepTime": 3, "sortOrder": 0 },
            { "name": "קפה לאטה", "description": "אספרסו עם חלב מוקצף", "price": 18, "isVegetarian": true, "isVegan": false, "isGlutenFree": true, "tags": ["קפה"], "allergens": ["MILK"], "prepTime": 4, "sortOrder": 1 },
            { "name": "תה נענע", "description": "תה נענע טרי", "price": 14, "isVegetarian": true, "isVegan": true, "isGlutenFree": true, "tags": [], "allergens": [], "prepTime": 3, "sortOrder": 2 }
          ]
        },
        {
          "name": "משקאות קרים",
          "sortOrder": 1,
          "items": [
            { "name": "לימונדה טרייה", "description": "לימון, מנטה וסוכר", "price": 22, "isVegetarian": true, "isVegan": true, "isGlutenFree": true, "tags": ["טרי"], "allergens": [], "prepTime": 5, "sortOrder": 0 },
            { "name": "מיץ תפוזים סחוט", "description": "מיץ תפוזים טרי", "price": 26, "isVegetarian": true, "isVegan": true, "isGlutenFree": true, "tags": ["טרי", "בריא"], "allergens": [], "prepTime": 3, "sortOrder": 1 }
          ]
        }
      ]
    }
  ]
};

function downloadJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadXlsx(data: ImportFile, filename: string) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Flat rows: one row per item
  type XlsxRow = {
    "תפריט": string;
    "קטגוריה": string;
    "שם פריט": string;
    "תיאור": string;
    "מחיר (₪)": number;
    "צמחוני": string;
    "טבעוני": string;
    "ללא גלוטן": string;
    "תגיות": string;
    "אלרגנים": string;
    "זמן הכנה (דק')": string;
  };
  const rows: XlsxRow[] = [];
  for (const menu of data.menus) {
    for (const cat of menu.categories) {
      for (const item of cat.items) {
        rows.push({
          "תפריט": menu.name,
          "קטגוריה": cat.name,
          "שם פריט": item.name,
          "תיאור": item.description ?? "",
          "מחיר (₪)": item.price,
          "צמחוני": item.isVegetarian ? "כן" : "לא",
          "טבעוני": item.isVegan ? "כן" : "לא",
          "ללא גלוטן": item.isGlutenFree ? "כן" : "לא",
          "תגיות": (item.tags ?? []).join(", "),
          "אלרגנים": (item.allergens ?? []).join(", "),
          "זמן הכנה (דק')": item.prepTime != null ? String(item.prepTime) : "",
        });
      }
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 32 },
    { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 28 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "תפריט");

  // Instructions sheet
  const instrRows = [
    { "הוראות": "מלא/י את גיליון 'תפריט' בהתאם לעמודות." },
    { "הוראות": "עמודות חובה: תפריט, קטגוריה, שם פריט, מחיר (₪)" },
    { "הוראות": "צמחוני / טבעוני / ללא גלוטן: כתוב כן או לא" },
    { "הוראות": "תגיות: הפרד בפסיקים (לדוגמא: חריף, פופולרי)" },
    { "הוראות": "אלרגנים: הפרד בפסיקים — ערכים אפשריים: GLUTEN, MILK, EGGS, FISH, PEANUTS, SOYBEANS, NUTS, SESAME, CRUSTACEANS, MOLLUSCS, CELERY, MUSTARD, SULPHITES, LUPIN" },
    { "הוראות": "זמן הכנה: מספר בדקות (אפשרי להשאיר ריק)" },
  ];
  const wsInstr = XLSX.utils.json_to_sheet(instrRows);
  wsInstr["!cols"] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "הוראות");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function parseXlsxToImportFile(file: File): Promise<ImportFile> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: "" });

  // Group rows into hierarchy
  const menusMap = new Map<string, Map<string, ImportItem[]>>();
  for (const row of rows) {
    const menuName = String(row["תפריט"] ?? "").trim();
    const catName  = String(row["קטגוריה"] ?? "").trim();
    const itemName = String(row["שם פריט"] ?? "").trim();
    if (!menuName || !catName || !itemName) continue;

    if (!menusMap.has(menuName)) menusMap.set(menuName, new Map());
    const cats = menusMap.get(menuName)!;
    if (!cats.has(catName)) cats.set(catName, []);

    const rawPrice = row["מחיר (₪)"] ?? row["מחיר"];
    const price = parseFloat(String(rawPrice)) || 0;
    const tagsRaw      = String(row["תגיות"]         ?? "").trim();
    const allergensRaw = String(row["אלרגנים"]       ?? "").trim();
    const prepRaw      = String(row["זמן הכנה (דק')"] ?? row["זמן הכנה"] ?? "").trim();

    cats.get(catName)!.push({
      name: itemName,
      description: String(row["תיאור"] ?? "").trim(),
      price,
      isVegetarian: String(row["צמחוני"] ?? "").trim() === "כן",
      isVegan:      String(row["טבעוני"] ?? "").trim() === "כן",
      isGlutenFree: String(row["ללא גלוטן"] ?? "").trim() === "כן",
      tags:      tagsRaw      ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [],
      allergens: allergensRaw ? allergensRaw.split(",").map(a => a.trim().toUpperCase()).filter(Boolean) : [],
      prepTime: prepRaw ? parseInt(prepRaw) || null : null,
      sortOrder: cats.get(catName)!.length,
    });
  }

  const menus: ImportMenu[] = [];
  let menuIdx = 0;
  for (const [menuName, catsMap] of menusMap.entries()) {
    const categories: ImportCategory[] = [];
    let catIdx = 0;
    for (const [catName, items] of catsMap.entries()) {
      categories.push({ name: catName, sortOrder: catIdx++, items });
    }
    menus.push({ name: menuName, isPrimary: menuIdx === 0, scheduleDays: [], scheduleFrom: null, scheduleTo: null, categories });
    menuIdx++;
  }
  return { version: 1, menus };
}

// Shared dark input style
const darkInput: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.14)",
  color: "#ffffff",
  borderRadius: 8,
  padding: "8px 12px",
  width: "100%",
  outline: "none",
  fontSize: 14,
};

function ModifierGroupsEditor({ itemId, restaurantId }: { itemId: string; restaurantId: string }) {
  const [groups, setGroups] = useState<ModGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);   // tracks unsaved changes
  const [templates, setTemplates] = useState<TemplatePick[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/items/${itemId}/modifiers`)
      .then(r => r.json())
      .then(data => { setGroups(data); setLoading(false); setDirty(false); })
      .catch(() => setLoading(false));
  }, [itemId]);

  async function openTemplates() {
    setShowTemplates(true);
    if (templates.length > 0) return;
    setTemplatesLoading(true);
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurantId}/modifier-templates`);
      const data: TemplatePick[] = await res.json();
      // Exclude groups that belong to this item
      setTemplates(data.filter(t => t.item.id !== itemId));
    } finally {
      setTemplatesLoading(false);
    }
  }

  function copyTemplate(t: TemplatePick) {
    setGroups(g => {
      if (g.some(grp => grp.name === t.name)) return g;
      return [...g, {
        name: t.name, required: t.required, maxSelect: t.maxSelect, order: g.length,
        options: t.options.map((o, i) => ({ label: o.label, priceAdd: o.priceAdd, order: i })),
      }];
    });
    setDirty(true);
    setShowTemplates(false);
  }

  function addGroup() {
    setGroups(g => [...g, { name: "", required: false, maxSelect: 1, order: g.length, options: [] }]);
    setDirty(true);
  }

  function removeGroup(gi: number) {
    setGroups(g => g.filter((_, i) => i !== gi));
    setDirty(true);
  }

  function updateGroup(gi: number, patch: Partial<ModGroup>) {
    setGroups(g => g.map((grp, i) => i === gi ? { ...grp, ...patch } : grp));
    setDirty(true);
  }

  function addOption(gi: number) {
    setGroups(g => g.map((grp, i) => i === gi
      ? { ...grp, options: [...grp.options, { label: "", priceAdd: 0, order: grp.options.length }] }
      : grp));
    setDirty(true);
  }

  function removeOption(gi: number, oi: number) {
    setGroups(g => g.map((grp, i) => i === gi
      ? { ...grp, options: grp.options.filter((_, j) => j !== oi) }
      : grp));
    setDirty(true);
  }

  function updateOption(gi: number, oi: number, patch: Partial<ModOption>) {
    setGroups(g => g.map((grp, i) => i === gi
      ? { ...grp, options: grp.options.map((opt, j) => j === oi ? { ...opt, ...patch } : opt) }
      : grp));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/items/${itemId}/modifiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groups),
      });
      if (res.ok) {
        const updated: ModGroup[] = await res.json();
        setGroups(updated);   // sync IDs from DB
        setDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ fontSize: 13, color: T.muted, padding: "8px 0" }}>טוען...</div>;

  return (
    <div className="space-y-3">
      {groups.map((grp, gi) => (
        <div key={gi} style={{ border: "1px solid #2d3239", borderRadius: 12, padding: 12, background: T.surface }} className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={grp.name}
              onChange={e => updateGroup(gi, { name: e.target.value })}
              placeholder="שם קבוצה (לדוגמא: עשייה)"
              style={{ ...darkInput, flex: 1, fontSize: 13, padding: "6px 10px" }}
            />
            <button type="button" onClick={() => removeGroup(gi)} style={{ color: T.red, fontSize: 13, padding: "0 8px" }}>✕</button>
          </div>
          <div className="flex gap-3 items-center flex-wrap" style={{ fontSize: 12 }}>
            <label className="flex items-center gap-1 cursor-pointer" style={{ color: T.sub }}>
              <input type="checkbox" checked={grp.required} onChange={e => updateGroup(gi, { required: e.target.checked })} className="rounded"/>
              חובה
            </label>
            <label className="flex items-center gap-1.5" style={{ color: T.sub }}>
              בחירה מקסימלית:
              <input
                type="number" min={1} max={10} value={grp.maxSelect}
                onChange={e => updateGroup(gi, { maxSelect: parseInt(e.target.value) || 1 })}
                style={{ width: 48, textAlign: "center", padding: "2px 4px", background: T.raised, border: "1px solid #3a3f47", color: T.text, borderRadius: 6, fontSize: 12 }}
              />
            </label>
          </div>
          <div className="space-y-1">
            {grp.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-1.5">
                <input
                  value={opt.label}
                  onChange={e => updateOption(gi, oi, { label: e.target.value })}
                  placeholder="אפשרות (מדיום, גדול...)"
                  style={{ ...darkInput, flex: 1, fontSize: 13, padding: "5px 8px" }}
                />
                <input
                  type="number" min={0} step={0.5} value={opt.priceAdd}
                  onChange={e => updateOption(gi, oi, { priceAdd: parseFloat(e.target.value) || 0 })}
                  placeholder="₪0"
                  style={{ width: 64, textAlign: "center", fontSize: 13, padding: "5px 4px", background: T.raised, border: "1px solid #3a3f47", color: T.text, borderRadius: 8 }}
                  title="תוספת מחיר"
                />
                <button type="button" onClick={() => removeOption(gi, oi)} style={{ color: T.red, fontSize: 12 }}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => addOption(gi)} style={{ color: T.gold, fontSize: 12, fontWeight: 500 }}>+ הוסף אפשרות</button>
        </div>
      ))}
      {/* Template picker */}
      {showTemplates && (
        <div style={{ border: "1px solid rgba(252,196,25,0.3)", background: "rgba(252,196,25,0.08)", borderRadius: 12, padding: 12 }} className="space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <span style={{ fontSize: 12, fontWeight: 600, color: T.gold }}>בחר קבוצה להעתיק</span>
            <button type="button" onClick={() => setShowTemplates(false)} style={{ color: T.muted, fontSize: 12 }}>✕</button>
          </div>
          {templatesLoading && <div style={{ fontSize: 12, color: T.muted, padding: "4px 0" }}>טוען...</div>}
          {!templatesLoading && templates.length === 0 && (
            <div style={{ fontSize: 12, color: T.muted, padding: "4px 0" }}>אין קבוצות מוגדרות בפריטים אחרים</div>
          )}
          {!templatesLoading && templates.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => copyTemplate(t)}
              style={{ width: "100%", textAlign: "right", padding: "6px 12px", borderRadius: 8, background: T.panel, border: "1px solid #2d3239", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{t.name}</span>
              <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>
                {t.options.map(o => o.label).join(" / ")}
                {" · "}מתוך: {t.item.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={addGroup} style={{ flex: 1, border: "1px solid rgba(217,119,6,0.4)", background: "rgba(217,119,6,0.08)", color: "#F59E0B", borderRadius: 12, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + קבוצת אפשרויות
        </button>
        <button type="button" onClick={openTemplates} style={{ flex: 1, border: "1px solid rgba(217,119,6,0.4)", background: "rgba(217,119,6,0.08)", color: "#F59E0B", borderRadius: 12, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          📋 העתק מתבנית
        </button>
        {dirty && (
          <button type="button" onClick={save} disabled={saving} className="disabled:opacity-50" style={{ background: T.gold, color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)", borderRadius: 12, padding: "6px 16px", fontSize: 13, fontWeight: 600 }}>
            {saving ? "שומר..." : saved ? "✓ נשמר" : "שמור תגיות"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MenusClient({ restaurants, stations = [], canEdit }: { restaurants: Restaurant[]; stations?: Station[]; canEdit: boolean }) {
  const router = useRouter();
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(restaurants[0] ?? null);
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(restaurants[0]?.menus[0] ?? null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const [showMenuForm, setShowMenuForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [scheduleMenu, setScheduleMenu] = useState<Menu | null>(null);
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);

  const [menuForm, setMenuForm] = useState({ name: "", description: "" });
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [tagInput, setTagInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [seedingAllergens, setSeedingAllergens] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  async function handleSeedAllergens() {
    if (!selectedRestaurant) return;
    setSeedingAllergens(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/admin/menu/seed-allergens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: selectedRestaurant.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSeedResult(`שגיאה: ${data.error ?? res.status}`);
        return;
      }
      setSeedResult(`עודכנו ${data.updated} מנות`);
      if (data.updated > 0) {
        // Update open form if the current item was among the updated ones
        if (editItem) {
          const updated = (data.results as { name: string; allergens: string[] }[])
            .find(r => r.name === editItem.name);
          if (updated) {
            setItemForm(prev => ({ ...prev, allergens: updated.allergens }));
          }
        }
        router.refresh();
      }
    } catch (e) {
      setSeedResult(`שגיאה: ${e instanceof Error ? e.message : "לא ידוע"}`);
    } finally {
      setSeedingAllergens(false);
    }
  }

  // Import / Export state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<ImportFile | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState<number | null>(null);
  const [exportDropdown, setExportDropdown] = useState(false);
  const [sampleDropdown, setSampleDropdown] = useState(false);
  // #8 — inline destructive confirmation (no browser confirm())
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "menu" | "category" | "item"; id: string; extra?: string; label: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // #7 — Escape closes top-most open modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (showItemForm) { setShowItemForm(false); setEditItem(null); setTagInput(""); return; }
      if (scheduleMenu) { setScheduleMenu(null); return; }
      if (showCategoryForm) { setShowCategoryForm(false); return; }
      if (showMenuForm) { setShowMenuForm(false); return; }
      if (showImportModal && !importing) { closeImportModal(); return; }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showItemForm, scheduleMenu, showCategoryForm, showMenuForm, showImportModal, importing]);

  // ── helpers ──────────────────────────────────────────────────────────────
  function updateMenu(updater: (m: Menu) => Menu) {
    if (!selectedMenu) return;
    const updated = updater(selectedMenu);
    setSelectedMenu(updated);
    if (selectedRestaurant) {
      setSelectedRestaurant({
        ...selectedRestaurant,
        menus: selectedRestaurant.menus.map(m => m.id === updated.id ? updated : m),
      });
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !itemForm.tags.includes(t)) {
      setItemForm({ ...itemForm, tags: [...itemForm.tags, t] });
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setItemForm({ ...itemForm, tags: itemForm.tags.filter(t => t !== tag) });
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function buildExportData(): ImportFile | null {
    if (!selectedRestaurant) return null;
    return {
      version: 1,
      restaurantName: selectedRestaurant.name,
      exportedAt: new Date().toISOString(),
      menus: selectedRestaurant.menus.map(menu => ({
        name: menu.name,
        isPrimary: menu.isPrimary,
        scheduleDays: menu.scheduleDays ?? [],
        scheduleFrom: menu.scheduleFrom ?? null,
        scheduleTo: menu.scheduleTo ?? null,
        categories: menu.categories.map(cat => ({
          name: cat.name,
          sortOrder: cat.sortOrder,
          items: cat.items.map(item => ({
            name: item.name,
            description: item.description ?? "",
            price: item.price,
            isVegetarian: item.isVegetarian,
            isVegan: item.isVegan,
            isGlutenFree: item.isGlutenFree,
            tags: item.tags ?? [],
            allergens: item.allergens ?? [],
            prepTime: item.prepTime ?? null,
            sortOrder: item.sortOrder,
          })),
        })),
      })),
    };
  }

  function safeName() {
    return (selectedRestaurant?.name ?? "menu").replace(/[^a-zA-Z0-9א-ת\s-]/g, "").trim().replace(/\s+/g, "-");
  }

  function handleExportJson() {
    const data = buildExportData();
    if (!data) return;
    downloadJson(data, `${safeName()}-menu.json`);
    setExportDropdown(false);
  }

  async function handleExportXlsx() {
    const data = buildExportData();
    if (!data) return;
    setExportDropdown(false);
    await downloadXlsx(data, `${safeName()}-menu.xlsx`);
  }

  // ── Sample file download ──────────────────────────────────────────────────
  function handleSampleJson() {
    downloadJson(SAMPLE_DATA, "menu4u-sample.json");
    setSampleDropdown(false);
  }

  async function handleSampleXlsx() {
    setSampleDropdown(false);
    await downloadXlsx(SAMPLE_DATA, "menu4u-sample.xlsx");
  }

  // ── Import file picker ────────────────────────────────────────────────────
  function handleImportClick() {
    setImportData(null);
    setImportError(null);
    setImportProgress(null);
    setImportDone(null);
    setImporting(false);
    setShowImportModal(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (isXlsx) {
      try {
        const parsed = await parseXlsxToImportFile(file);
        if (parsed.menus.length === 0) {
          setImportError("הגיליון ריק — ודא שיש שורות עם תפריט, קטגוריה ושם פריט");
          return;
        }
        setImportError(null);
        setImportData(parsed);
      } catch {
        setImportError("שגיאה בקריאת קובץ Excel — ודא שהוא תקין");
      }
      return;
    }

    // JSON
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed || !Array.isArray(parsed.menus)) {
          setImportError("קובץ לא תקין: חסר מפתח menus");
          return;
        }
        for (const menu of parsed.menus) {
          if (!menu.name || !Array.isArray(menu.categories)) {
            setImportError("קובץ לא תקין: לכל תפריט חייב להיות name ו-categories");
            return;
          }
        }
        setImportError(null);
        setImportData(parsed as ImportFile);
      } catch {
        setImportError("שגיאה בפענוח הקובץ — ודא שהוא קובץ JSON תקין");
      }
    };
    reader.readAsText(file);
  }

  function getImportCounts(data: ImportFile) {
    const menuCount = data.menus.length;
    const categoryCount = data.menus.reduce((s, m) => s + m.categories.length, 0);
    const itemCount = data.menus.reduce((s, m) => s + m.categories.reduce((cs, c) => cs + c.items.length, 0), 0);
    return { menuCount, categoryCount, itemCount };
  }

  async function handleImport() {
    if (!importData || !selectedRestaurant) return;
    setImporting(true);
    setImportError(null);

    const { itemCount } = getImportCounts(importData);
    let doneItems = 0;
    setImportProgress({ current: 0, total: itemCount });

    const createdMenus: Menu[] = [];

    try {
      for (const importMenu of importData.menus) {
        // Create menu
        const menuRes = await fetch("/api/admin/menus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: importMenu.name, restaurantId: selectedRestaurant.id }),
        });
        if (!menuRes.ok) throw new Error(`שגיאה ביצירת תפריט "${importMenu.name}"`);
        const newMenuData = await menuRes.json();
        const newMenu: Menu = { ...newMenuData, categories: [] };

        const createdCategories: Category[] = [];

        for (const importCat of importMenu.categories) {
          // Create category
          const catRes = await fetch("/api/admin/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: importCat.name, menuId: newMenu.id, sortOrder: importCat.sortOrder ?? 0 }),
          });
          if (!catRes.ok) throw new Error(`שגיאה ביצירת קטגוריה "${importCat.name}"`);
          const newCatData = await catRes.json();
          const newCat: Category = { ...newCatData, items: [] };

          const createdItems: Item[] = [];

          for (const importItem of importCat.items) {
            // Create item
            const itemRes = await fetch("/api/admin/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: importItem.name,
                description: importItem.description ?? "",
                price: importItem.price,
                categoryId: newCat.id,
                isVegetarian: importItem.isVegetarian ?? false,
                isVegan: importItem.isVegan ?? false,
                isGlutenFree: importItem.isGlutenFree ?? false,
                tags: importItem.tags ?? [],
                allergens: importItem.allergens ?? [],
                prepTime: importItem.prepTime ?? null,
                sortOrder: importItem.sortOrder ?? 0,
              }),
            });
            if (!itemRes.ok) throw new Error(`שגיאה ביצירת פריט "${importItem.name}"`);
            const newItem: Item = await itemRes.json();
            createdItems.push(newItem);
            doneItems++;
            setImportProgress({ current: doneItems, total: itemCount });
          }

          createdCategories.push({ ...newCat, items: createdItems });
        }

        createdMenus.push({ ...newMenu, categories: createdCategories });
      }

      // Update state with new menus
      const updatedRestaurant: Restaurant = {
        ...selectedRestaurant,
        menus: [...selectedRestaurant.menus, ...createdMenus],
      };
      setSelectedRestaurant(updatedRestaurant);
      if (createdMenus.length > 0) {
        setSelectedMenu(createdMenus[0]);
      }

      setImportDone(doneItems);
      setImporting(false);
      setImportProgress(null);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : "שגיאה לא ידועה");
      setImporting(false);
      setImportProgress(null);
    }
  }

  function closeImportModal() {
    if (importing) return;
    setShowImportModal(false);
    setImportData(null);
    setImportError(null);
    setImportProgress(null);
    setImportDone(null);
    setImporting(false);
  }

  // ── Menu CRUD ─────────────────────────────────────────────────────────────
  async function createMenu(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRestaurant) return;
    setLoading(true);
    const res = await fetch("/api/admin/menus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...menuForm, restaurantId: selectedRestaurant.id }),
    });
    if (res.ok) {
      const newMenu: Menu = { ...(await res.json()), categories: [] };
      const updated = { ...selectedRestaurant, menus: [...selectedRestaurant.menus, newMenu] };
      setSelectedRestaurant(updated);
      setSelectedMenu(newMenu);
      setShowMenuForm(false);
      setMenuForm({ name: "", description: "" });
    }
    setLoading(false);
  }

  async function deleteMenu(menuId: string) {
    const menu = selectedRestaurant?.menus.find(m => m.id === menuId);
    setDeleteConfirm({ type: "menu", id: menuId, label: menu?.name ?? "תפריט" });
  }

  async function _doDeleteMenu(menuId: string) {
    await fetch(`/api/admin/menus/${menuId}`, { method: "DELETE" });
    if (selectedRestaurant) {
      const updated = { ...selectedRestaurant, menus: selectedRestaurant.menus.filter(m => m.id !== menuId) };
      setSelectedRestaurant(updated);
      setSelectedMenu(updated.menus[0] ?? null);
    }
    setDeleteConfirm(null);
  }

  // ── Menu schedule / primary ───────────────────────────────────────────────
  function openSchedule(menu: Menu) {
    setScheduleMenu(menu);
    setScheduleForm({
      isPrimary: menu.isPrimary,
      scheduleDays: menu.scheduleDays ?? [],
      scheduleFrom: menu.scheduleFrom ?? "",
      scheduleTo: menu.scheduleTo ?? "",
    });
  }

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleMenu) return;
    setLoading(true);
    const body = {
      isPrimary: scheduleForm.isPrimary,
      scheduleDays: scheduleForm.scheduleDays,
      scheduleFrom: scheduleForm.scheduleFrom || null,
      scheduleTo: scheduleForm.scheduleTo || null,
    };
    const res = await fetch(`/api/admin/menus/${scheduleMenu.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok && selectedRestaurant) {
      const updated = await res.json();
      const updatedMenus = selectedRestaurant.menus.map(m =>
        m.id === scheduleMenu.id
          ? { ...m, ...updated }
          : scheduleForm.isPrimary ? { ...m, isPrimary: false } : m
      );
      const updatedRestaurant = { ...selectedRestaurant, menus: updatedMenus };
      setSelectedRestaurant(updatedRestaurant);
      if (selectedMenu?.id === scheduleMenu.id) setSelectedMenu({ ...selectedMenu, ...updated });
      setScheduleMenu(null);
    }
    setLoading(false);
  }

  // ── Category CRUD ─────────────────────────────────────────────────────────
  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMenu) return;
    setLoading(true);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...categoryForm, menuId: selectedMenu.id, sortOrder: selectedMenu.categories.length }),
    });
    if (res.ok) {
      const newCat: Category = { ...(await res.json()), items: [] };
      updateMenu(m => ({ ...m, categories: [...m.categories, newCat] }));
      setShowCategoryForm(false);
      setCategoryForm(emptyCategoryForm);
    }
    setLoading(false);
  }

  function deleteCategory(catId: string) {
    const cat = selectedMenu?.categories.find(c => c.id === catId);
    setDeleteConfirm({ type: "category", id: catId, label: cat?.name ?? "קטגוריה" });
  }

  async function _doDeleteCategory(catId: string) {
    await fetch(`/api/admin/categories/${catId}`, { method: "DELETE" });
    updateMenu(m => ({ ...m, categories: m.categories.filter(c => c.id !== catId) }));
    setDeleteConfirm(null);
  }

  async function moveCategoryOrder(catId: string, direction: "up" | "down") {
    if (!selectedMenu) return;
    const cats = [...selectedMenu.categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = cats.findIndex(c => c.id === catId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cats.length) return;

    // assign new sequential sort orders based on array positions
    const reordered = [...cats];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const newOrder = reordered.map((c, i) => ({ ...c, sortOrder: i }));

    await Promise.all([
      fetch(`/api/admin/categories/${newOrder[idx].id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: newOrder[idx].sortOrder }) }),
      fetch(`/api/admin/categories/${newOrder[swapIdx].id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: newOrder[swapIdx].sortOrder }) }),
    ]);
    updateMenu(m => ({ ...m, categories: newOrder }));
  }

  // ── Item CRUD ─────────────────────────────────────────────────────────────

  function deleteItem(catId: string, itemId: string) {
    const item = selectedMenu?.categories.find(c => c.id === catId)?.items.find(i => i.id === itemId);
    setDeleteConfirm({ type: "item", id: itemId, extra: catId, label: item?.name ?? "פריט" });
  }

  async function _doDeleteItem(itemId: string, catId: string) {
    await fetch(`/api/admin/items/${itemId}`, { method: "DELETE" });
    updateMenu(m => ({
      ...m,
      categories: m.categories.map(c =>
        c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c
      ),
    }));
    setDeleteConfirm(null);
  }

  // תחנות המטבח של המסעדה הנבחרת (לבורר השיוך על כל קטגוריה)
  const restaurantStations = stations.filter(s => s.restaurantId === selectedRestaurant?.id);

  async function setCategoryStation(catId: string, stationId: string) {
    const prev = selectedMenu?.categories.find(c => c.id === catId);
    const station = restaurantStations.find(s => s.id === stationId);
    const nextAutoReady = station?.skipKitchen ?? false;
    // Optimistic update
    updateMenu(m => ({
      ...m,
      categories: m.categories.map(c => c.id === catId ? { ...c, kitchenStationId: stationId, autoReady: nextAutoReady } : c),
    }));
    try {
      const res = await fetch(`/api/admin/categories/${catId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitchenStationId: stationId }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      // Revert on failure
      updateMenu(m => ({
        ...m,
        categories: m.categories.map(c => c.id === catId ? { ...c, kitchenStationId: prev?.kitchenStationId ?? null, autoReady: prev?.autoReady ?? false } : c),
      }));
    }
  }

  async function toggleItem(catId: string, itemId: string, isActive: boolean) {
    await fetch(`/api/admin/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    updateMenu(m => ({
      ...m,
      categories: m.categories.map(c =>
        c.id === catId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, isActive: !isActive } : i) } : c
      ),
    }));
  }

  function openEditItem(cat: Category, item: Item) {
    setSelectedCategory(cat);
    setEditItem(item);
    const existingTr = item.translations ?? {};
    setItemForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      image: item.image ?? "",
      isVegetarian: item.isVegetarian,
      isVegan: item.isVegan,
      isGlutenFree: item.isGlutenFree,
      tags: item.tags ?? [],
      allergens: item.allergens ?? [],
      prepTime: item.prepTime != null ? String(item.prepTime) : "",
      translations: {
        en: { name: existingTr.en?.name ?? "", description: existingTr.en?.description ?? "" },
        ru: { name: existingTr.ru?.name ?? "", description: existingTr.ru?.description ?? "" },
        fr: { name: existingTr.fr?.name ?? "", description: existingTr.fr?.description ?? "" },
      },
    });
    setTagInput("");
    setShowItemForm(true);
  }

  async function handleItemSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory) return;
    setLoading(true);
    const body = { ...itemForm, price: parseFloat(itemForm.price), prepTime: itemForm.prepTime ? parseInt(itemForm.prepTime) : null };

    if (editItem) {
      const res = await fetch(`/api/admin/items/${editItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        updateMenu(m => ({
          ...m,
          categories: m.categories.map(c =>
            c.id === selectedCategory.id
              ? { ...c, items: c.items.map(i => i.id === editItem.id ? { ...i, ...updated } : i) }
              : c
          ),
        }));
      }
    } else {
      const res = await fetch("/api/admin/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, categoryId: selectedCategory.id }),
      });
      if (res.ok) {
        const newItem = await res.json();
        updateMenu(m => ({
          ...m,
          categories: m.categories.map(c =>
            c.id === selectedCategory.id ? { ...c, items: [...c.items, newItem] } : c
          ),
        }));
        // Stay in edit mode so user can add modifier groups
        setEditItem(newItem);
        setLoading(false);
        return;
      }
    }

    setShowItemForm(false);
    setEditItem(null);
    setItemForm(emptyItemForm);
    setTagInput("");
    setLoading(false);
  }

  const sortedCategories = selectedMenu
    ? [...selectedMenu.categories].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  // Collapsed categories — all start collapsed; stores IDs of *expanded* ones
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  function toggleCat(id: string) {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  // Reset when menu changes
  useEffect(() => { setExpandedCats(new Set()); }, [selectedMenu?.id]);

  // #3 — hide menu selector when restaurant has only 1 menu (reduces complexity)
  const isSingleMenu = (selectedRestaurant?.menus.length ?? 0) <= 1;

  // Item kebab portal state
  const [itemKebab, setItemKebab] = useState<{ catId: string; itemId: string; top: number; left: number } | null>(null);

  // Glass design constants
  const G_CARD = "rgba(255,255,255,0.07)";
  const G_CARD_HOVER = "rgba(255,255,255,0.14)";
  const G_BORDER = "rgba(255,255,255,0.15)";
  const G_HEADER = "rgba(255,255,255,0.04)";
  const G_ACCENT = "#D97706";
  const G_ACCENT_GRAD = "linear-gradient(135deg, #D97706, #F59E0B)";
  const G_TEXT = "#FFFFFF";
  const G_MUTED = "rgba(255,255,255,0.6)";

  return (
    <PageShell>
      {/* Close dropdowns on outside click */}
      {(exportDropdown || sampleDropdown) && (
        <div className="fixed inset-0 z-20" onClick={() => { setExportDropdown(false); setSampleDropdown(false); }} />
      )}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, direction: "rtl", alignItems: "start" }}>

        {/* ─── Glass Action Header (full width) ─── */}
        <div style={{
          gridColumn: "1 / -1",
          background: G_HEADER,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${G_BORDER}`,
          borderRadius: 20,
          padding: "15px 25px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          direction: "rtl",
          position: "relative",
          zIndex: 100,
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: G_TEXT, lineHeight: 1.2 }}>
              ניהול תפריטים
              {selectedRestaurant && selectedMenu && (
                <span style={{ fontSize: 13, fontWeight: 400, color: G_MUTED, marginRight: 10 }}>
                  {selectedRestaurant.name} · {selectedMenu.name}
                </span>
              )}
            </div>
            {selectedRestaurant && (
              <div style={{ fontSize: 12, color: G_MUTED, marginTop: 2 }}>{selectedRestaurant.name}</div>
            )}
          </div>

          {selectedRestaurant && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", direction: "ltr" }}>
              {seedResult && <span style={{ fontSize: 12, color: G_ACCENT, fontWeight: 600 }}>{seedResult}</span>}

              {/* Allergen auto-fill */}
              <button
                onClick={handleSeedAllergens}
                disabled={seedingAllergens || !selectedRestaurant}
                style={{
                  background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER}`,
                  color: "#F59E0B", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: seedingAllergens ? 0.5 : 1,
                }}
              >
                ✨ {seedingAllergens ? "מעדכן..." : "אלרגנים אוטו׳"}
              </button>

              {/* Sample dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => { setSampleDropdown(v => !v); setExportDropdown(false); }}
                  disabled={importing}
                  style={{
                    background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER}`,
                    color: G_TEXT, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  📋 קובץ דוגמה ▾
                </button>
                {sampleDropdown && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, minWidth: 150, background: "rgba(20,20,28,0.95)", border: `1px solid ${G_BORDER}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                    <button onClick={handleSampleJson} style={{ width: "100%", textAlign: "right", padding: "10px 16px", fontSize: 13, color: G_TEXT, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      📄 JSON
                    </button>
                    <button onClick={handleSampleXlsx} style={{ width: "100%", textAlign: "right", padding: "10px 16px", fontSize: 13, color: G_TEXT, background: "transparent", border: "none", borderTop: `1px solid ${G_BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      📊 Excel (.xlsx)
                    </button>
                  </div>
                )}
              </div>

              {/* Import button */}
              <button
                onClick={handleImportClick}
                disabled={importing}
                style={{
                  background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER}`,
                  color: G_TEXT, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                📥 ייבא
              </button>

              {/* Export dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => { setExportDropdown(v => !v); setSampleDropdown(false); }}
                  disabled={importing}
                  style={{
                    background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER}`,
                    color: G_TEXT, borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  📤 ייצא ▾
                </button>
                {exportDropdown && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 30, minWidth: 150, background: "rgba(20,20,28,0.95)", border: `1px solid ${G_BORDER}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                    <button onClick={handleExportJson} style={{ width: "100%", textAlign: "right", padding: "10px 16px", fontSize: 13, color: G_TEXT, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      📄 JSON
                    </button>
                    <button onClick={handleExportXlsx} style={{ width: "100%", textAlign: "right", padding: "10px 16px", fontSize: 13, color: G_TEXT, background: "transparent", border: "none", borderTop: `1px solid ${G_BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      📊 Excel (.xlsx)
                    </button>
                  </div>
                )}
              </div>

              {/* New category button */}
              {selectedMenu && canEdit && (
                <button
                  onClick={() => setShowCategoryForm(true)}
                  style={{
                    background: G_ACCENT_GRAD, border: "none",
                    color: G_TEXT, borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    boxShadow: "0 4px 15px rgba(217,119,6,0.3)",
                  }}
                >
                  + קטגוריה חדשה
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── Main grid ─── */}
        <div>
          {restaurants.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", background: G_CARD, border: `1px solid ${G_BORDER}`, borderRadius: 20, color: G_MUTED }}>אין מסעדות זמינות</div>
          ) : !selectedMenu ? (
            <div style={{ padding: 48, textAlign: "center", background: G_CARD, border: `1px solid ${G_BORDER}`, borderRadius: 20, color: G_MUTED }}>בחר תפריט או צור חדש</div>
          ) : sortedCategories.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", background: G_CARD, border: `1px solid ${G_BORDER}`, borderRadius: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🗂️</div>
              <div style={{ fontWeight: 600, color: G_TEXT, marginBottom: 6 }}>אין קטגוריות עדיין</div>
              <div style={{ fontSize: 13, color: G_MUTED, marginBottom: 16 }}>הוסף קטגוריה ראשונה כדי להתחיל לבנות את התפריט</div>
              {canEdit && (
                <button onClick={() => setShowCategoryForm(true)}
                  style={{ background: G_ACCENT_GRAD, border: "none", color: G_TEXT, borderRadius: 10, padding: "10px 22px", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 15px rgba(217,119,6,0.3)" }}>
                  + קטגוריה חדשה
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Back button — collapses all expanded categories */}
              {expandedCats.size > 0 && (
                <button
                  onClick={() => setExpandedCats(new Set())}
                  style={{ marginBottom: 16, background: "none", border: "none", color: G_ACCENT, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                >
                  ← חזרה לקטגוריות
                </button>
              )}

              {/* Item kebab portal */}
              {itemKebab && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setItemKebab(null)} />
                  <div style={{
                    position: "fixed", zIndex: 50,
                    top: itemKebab.top, left: itemKebab.left,
                    background: "rgba(15,14,22,0.97)",
                    border: `1px solid ${G_BORDER}`,
                    borderRadius: 14, boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
                    minWidth: 170, overflow: "hidden",
                  }}>
                    {(() => {
                      const kCat = sortedCategories.find(c => c.id === itemKebab.catId);
                      const kItem = kCat?.items.find(i => i.id === itemKebab.itemId);
                      if (!kCat || !kItem) return null;
                      const btnStyle: React.CSSProperties = { width: "100%", textAlign: "right", padding: "11px 16px", fontSize: 13, color: G_TEXT, background: "transparent", border: "none", borderBottom: `1px solid rgba(255,255,255,0.06)`, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 };
                      return (<>
                        <button style={btnStyle} onClick={() => { openEditItem(kCat, kItem); setItemKebab(null); }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          ✏️ ערוך פריט
                        </button>
                        <button style={btnStyle} onClick={() => { toggleItem(kCat.id, kItem.id, kItem.isActive); setItemKebab(null); }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          {kItem.isActive ? "🔴 השבת" : "🟢 הפעל"}
                        </button>
                        <button style={{ ...btnStyle, color: "#f87171", borderBottom: "none" }} onClick={() => { deleteItem(kCat.id, kItem.id); setItemKebab(null); }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.12)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          🗑 מחק פריט
                        </button>
                      </>);
                    })()}
                  </div>
                </>
              )}

              {/* Category grid — 4 equal-height cards */}
              {(() => {
                const expandedCatId = expandedCats.size > 0 ? [...expandedCats][0] : null;
                const expandedCat = expandedCatId ? sortedCategories.find(c => c.id === expandedCatId) : null;
                const chipStyle: React.CSSProperties = { borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)" };

                const handleToggleCat = (id: string) => {
                  if (expandedCats.has(id)) setExpandedCats(new Set());
                  else setExpandedCats(new Set([id]));
                };

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                    {sortedCategories.map((cat, idx) => {
                      const isActive = cat.id === expandedCatId;
                      return (
                        <div key={cat.id}
                          style={{
                            background: isActive ? G_CARD_HOVER : G_CARD,
                            backdropFilter: "blur(15px)",
                            WebkitBackdropFilter: "blur(15px)",
                            border: `1px solid ${isActive ? G_ACCENT : G_BORDER}`,
                            borderRadius: 24,
                            padding: 22,
                            height: 160,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            boxShadow: isActive ? `0 0 0 1px ${G_ACCENT}, 0 10px 30px rgba(0,0,0,0.25)` : "0 10px 30px rgba(0,0,0,0.15)",
                            transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
                            cursor: "pointer",
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-5px)";
                              (e.currentTarget as HTMLDivElement).style.background = G_CARD_HOVER;
                              (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.25)";
                              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 15px 35px rgba(0,0,0,0.3)";
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                              (e.currentTarget as HTMLDivElement).style.background = G_CARD;
                              (e.currentTarget as HTMLDivElement).style.borderColor = G_BORDER;
                              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 30px rgba(0,0,0,0.15)";
                            }
                          }}
                          onClick={() => handleToggleCat(cat.id)}
                        >
                          {/* Top row */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {cat.image && <img src={cat.image} alt={cat.name} style={{ width: 24, height: 24, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                                <span style={{ fontSize: 17, fontWeight: 700, color: G_TEXT }}>{cat.name}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: G_MUTED, opacity: 0.7 }}>[{idx + 1}]</span>
                                {(() => {
                                  const st = restaurantStations.find(s => s.id === cat.kitchenStationId);
                                  return st ? (
                                    <span title={st.skipKitchen ? "מדלג על המטבח" : "תחנת מטבח"} style={{ background: "rgba(245,158,11,0.15)", color: "#FBBF24", border: "1px solid rgba(245,158,11,0.3)", padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700 }}>
                                      {st.code} · {st.label}
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                              <div style={{ fontSize: 12, color: G_MUTED, display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="9" y="3" width="6" height="6" rx="1"/><rect x="16" y="3" width="6" height="6" rx="1"/><rect x="2" y="11" width="6" height="6" rx="1"/><rect x="9" y="11" width="6" height="6" rx="1"/><rect x="16" y="11" width="6" height="6" rx="1"/></svg>
                                {cat.items.length} פריטים
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                              <button onClick={() => moveCategoryOrder(cat.id, "up")} disabled={idx === 0} title="הזז למעלה"
                                style={{ background: "none", border: "none", color: idx === 0 ? "rgba(255,255,255,0.15)" : G_MUTED, cursor: idx === 0 ? "default" : "pointer", padding: "2px 4px", lineHeight: 1, fontSize: 14 }}>▲</button>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill={G_MUTED} style={{ opacity: 0.4 }}>
                                <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
                                <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                                <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
                              </svg>
                              <button onClick={() => moveCategoryOrder(cat.id, "down")} disabled={idx === sortedCategories.length - 1} title="הזז למטה"
                                style={{ background: "none", border: "none", color: idx === sortedCategories.length - 1 ? "rgba(255,255,255,0.15)" : G_MUTED, cursor: idx === sortedCategories.length - 1 ? "default" : "pointer", padding: "2px 4px", lineHeight: 1, fontSize: 14 }}>▼</button>
                            </div>
                          </div>
                          {canEdit && (
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}
                              onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setSelectedCategory(cat); setEditItem(null); setItemForm(emptyItemForm); setTagInput(""); setShowItemForm(true); }}
                                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${G_BORDER}`, color: G_TEXT, padding: 8, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", transition: "0.2s" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                                title="הוסף פריט">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                              </button>
                              <select
                                value={cat.kitchenStationId ?? ""}
                                onChange={e => setCategoryStation(cat.id, e.target.value)}
                                title="שיוך מנות — תחנת מטבח"
                                style={{ background: "#1a1a24", border: `1px solid ${G_BORDER}`, color: G_TEXT, padding: "8px 10px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontFamily: "inherit", outline: "none" }}
                              >
                                {!cat.kitchenStationId && <option value="" style={{ background: "#1a1a24", color: G_TEXT }}>ללא שיוך</option>}
                                {restaurantStations.map(s => (
                                  <option key={s.id} value={s.id} style={{ background: "#1a1a24", color: G_TEXT }}>{s.code} · {s.label}</option>
                                ))}
                              </select>
                              <button onClick={() => deleteCategory(cat.id)}
                                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${G_BORDER}`, color: G_TEXT, padding: 8, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", transition: "0.2s" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.borderColor = "#EF4444"; e.currentTarget.style.color = "#FCA5A5"; }}
                                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = G_BORDER; e.currentTarget.style.color = G_TEXT; }}
                                title="מחק">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {expandedCat && (
                      <div style={{ gridColumn: "1 / -1", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)", border: `1px solid ${G_ACCENT}`, borderRadius: 24, overflow: "hidden" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: G_TEXT }}>{expandedCat.name}</span>
                            <span style={{ fontSize: 12, color: G_MUTED }}>[{sortedCategories.findIndex(c => c.id === expandedCat.id) + 1}]</span>
                            <span style={{ fontSize: 12, color: G_MUTED }}>{expandedCat.items.length} פריטים</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {canEdit && (
                              <button onClick={() => { setSelectedCategory(expandedCat); setEditItem(null); setItemForm(emptyItemForm); setTagInput(""); setShowItemForm(true); }}
                                style={{ background: G_ACCENT_GRAD, border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1, width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(217,119,6,0.35)" }}>
                                +
                              </button>
                            )}
                            <button onClick={() => setExpandedCats(new Set())}
                              style={{ background: "none", border: "none", color: G_MUTED, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "4px 8px", borderRadius: 8 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = G_TEXT; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = G_MUTED; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
                              ✕
                            </button>
                          </div>
                        </div>
                        {expandedCat.items.length === 0 ? (
                          <div style={{ padding: 24, textAlign: "center" }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>🍽️</div>
                            <p style={{ fontSize: 12, color: G_MUTED, marginBottom: 12 }}>אין פריטים בקטגוריה זו</p>
                            {canEdit && (
                              <button onClick={() => { setSelectedCategory(expandedCat); setEditItem(null); setItemForm(emptyItemForm); setTagInput(""); setShowItemForm(true); }}
                                style={{ fontSize: 12, color: G_ACCENT, border: "1px solid rgba(217,119,6,0.3)", background: "rgba(217,119,6,0.08)", borderRadius: 8, padding: "6px 12px", fontWeight: 500, cursor: "pointer" }}>
                                + הוסף פריט ראשון
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {expandedCat.items.map((item, itemIdx) => {
                              const chips: React.ReactNode[] = [];
                              if (item.isGlutenFree) chips.push(<span key="gf" style={chipStyle}>GF</span>);
                              if (item.isVegetarian && !item.isVegan) chips.push(<span key="veg" style={chipStyle}>🌿 צמחוני</span>);
                              if (item.isVegan) chips.push(<span key="vegan" style={chipStyle}>🌱 טבעוני</span>);
                              item.allergens?.forEach((a: string) => chips.push(<span key={`al-${a}`} style={chipStyle}>{a}</span>));
                              item.tags?.forEach((t: string) => chips.push(<span key={`tag-${t}`} style={chipStyle}>{t}</span>));
                              if (item.prepTime != null) chips.push(<span key="prep" style={chipStyle}>⏱ {item.prepTime}&apos;</span>);
                              return (
                                <div key={item.id}
                                  style={{ padding: "3px 20px", display: "flex", alignItems: "center", gap: 12, borderTop: itemIdx === 0 ? "none" : "1px solid rgba(255,255,255,0.05)", minHeight: 46, transition: "background 0.15s" }}
                                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                >
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: item.isActive ? "#34d399" : "rgba(255,255,255,0.2)" }} />
                                  {item.image
                                    ? <img src={item.image} alt={item.name} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                                    : <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />}
                                  <div style={{ width: 220, flexShrink: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: item.isActive ? G_TEXT : G_MUTED, textDecoration: item.isActive ? undefined : "line-through" }}>{item.name}</div>
                                    {item.description && <div style={{ fontSize: 11, color: G_MUTED, marginTop: 1 }}>{item.description}</div>}
                                  </div>
                                  <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
                                  <div style={{ flex: 1, display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", padding: "0 12px" }}>
                                    {chips}
                                  </div>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: G_ACCENT, flexShrink: 0, minWidth: 50, textAlign: "left" }}>{formatPrice(item.price)}</span>
                                  {canEdit && (
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                        setItemKebab(prev => prev?.itemId === item.id ? null : { catId: expandedCat.id, itemId: item.id, top: rect.bottom + 6, left: rect.left });
                                      }}
                                      style={{ background: "none", border: "none", color: G_MUTED, fontSize: 18, fontWeight: 700, padding: "4px 8px", borderRadius: 8, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = G_TEXT; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = G_MUTED; }}
                                    >⋮</button>
                                  )}
                                </div>
                              );
                            })}
                            {canEdit && (
                              <div
                                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", cursor: "pointer", color: G_ACCENT, fontSize: 13, fontWeight: 600, background: "rgba(217,119,6,0.04)", borderTop: "1px solid rgba(217,119,6,0.15)", transition: "background 0.15s" }}
                                onClick={() => { setSelectedCategory(expandedCat); setEditItem(null); setItemForm(emptyItemForm); setTagInput(""); setShowItemForm(true); }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(217,119,6,0.09)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "rgba(217,119,6,0.04)")}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                                הוסף פריט חדש
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        {/* ─── Sidebar (right side in RTL = first in visual order, second in DOM) ─── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Restaurants panel */}
          <div style={{ background: G_HEADER, backdropFilter: "blur(25px)", WebkitBackdropFilter: "blur(25px)", border: `1px solid ${G_BORDER}`, borderRadius: 22, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: G_MUTED, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              🏪 מסעדות פתוחות
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {restaurants.map(rest => (
                <button key={rest.id}
                  onClick={() => { setSelectedRestaurant(rest); setSelectedMenu(rest.menus[0] ?? null); }}
                  style={{
                    padding: "11px 16px", borderRadius: 12, border: "none", textAlign: "right",
                    fontSize: 14, fontWeight: selectedRestaurant?.id === rest.id ? 700 : 500,
                    cursor: "pointer", transition: "0.2s", width: "100%",
                    background: selectedRestaurant?.id === rest.id ? "rgba(255,255,255,0.1)" : "transparent",
                    color: selectedRestaurant?.id === rest.id ? G_TEXT : G_MUTED,
                    boxShadow: selectedRestaurant?.id === rest.id ? `inset 0 0 0 1px ${G_BORDER}` : "none",
                  }}
                  onMouseEnter={e => { if (selectedRestaurant?.id !== rest.id) { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = G_TEXT; } }}
                  onMouseLeave={e => { if (selectedRestaurant?.id !== rest.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = G_MUTED; } }}
                >
                  {rest.name}
                </button>
              ))}
            </div>
          </div>

          {/* Menus panel */}
          {selectedRestaurant && (
            <div style={{ background: G_HEADER, backdropFilter: "blur(25px)", WebkitBackdropFilter: "blur(25px)", border: `1px solid ${G_BORDER}`, borderRadius: 22, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: G_MUTED, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                📖 סוג תפריט
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedRestaurant.menus.map(menu => (
                  <div key={menu.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <button
                      onClick={() => setSelectedMenu(menu)}
                      style={{
                        flex: 1, padding: "11px 16px", borderRadius: 12, border: "none", textAlign: "right",
                        fontSize: 14, fontWeight: selectedMenu?.id === menu.id ? 700 : 500,
                        cursor: "pointer", transition: "0.2s",
                        background: selectedMenu?.id === menu.id ? "rgba(255,255,255,0.1)" : "transparent",
                        color: selectedMenu?.id === menu.id ? G_TEXT : G_MUTED,
                        boxShadow: selectedMenu?.id === menu.id ? `inset 0 0 0 1px ${G_BORDER}` : "none",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      {menu.isPrimary && <span style={{ color: G_ACCENT, fontSize: 12 }}>★</span>}
                      {menu.scheduleDays?.length > 0 && <span style={{ color: "#60a5fa", fontSize: 12 }}>⏰</span>}
                      {menu.name}
                    </button>
                    {canEdit && (
                      <div style={{ display: "flex", gap: 2, marginRight: 4 }}>
                        <button onClick={() => openSchedule(menu)} style={{ color: G_MUTED, fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: "0 4px" }} title="הגדרות תזמון">⚙️</button>
                        <button onClick={() => deleteMenu(menu.id)} style={{ color: G_MUTED, fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>✕</button>
                      </div>
                    )}
                  </div>
                ))}
                {selectedRestaurant.menus.length === 0 && (
                  <div style={{ padding: "16px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                    <p style={{ fontSize: 12, color: G_MUTED, marginBottom: 12 }}>אין תפריטים עדיין</p>
                    {canEdit && (
                      <button onClick={() => setShowMenuForm(true)}
                        style={{ fontSize: 12, color: G_TEXT, border: "none", background: G_ACCENT_GRAD, borderRadius: 8, padding: "6px 14px", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(217,119,6,0.35)" }}>
                        + צור תפריט ראשון
                      </button>
                    )}
                  </div>
                )}
              </div>
              {canEdit && (
                <button
                  onClick={() => setShowMenuForm(true)}
                  style={{ width: "100%", marginTop: 12, padding: "9px 0", borderRadius: 10, border: `1px dashed ${G_BORDER}`, background: "none", color: G_MUTED, fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  onMouseEnter={e => { e.currentTarget.style.color = G_TEXT; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = G_MUTED; e.currentTarget.style.borderColor = G_BORDER; }}
                >
                  + תפריט נוסף
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Menu Form Modal */}
      {showMenuForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md p-6" style={{ background: T.panel, border: "1px solid #2d3239", borderRadius: 16 }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: T.text }}>תפריט חדש</h2>
            <form onSubmit={createMenu} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: T.sub }}>שם התפריט *</label>
                <input required value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })}
                  style={darkInput} />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg font-medium disabled:opacity-50" style={{ background: T.gold, color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}>
                  {loading ? "יוצר..." : "צור"}
                </button>
                <button type="button" onClick={() => setShowMenuForm(false)} className="flex-1 py-2.5 rounded-lg font-medium" style={{ background: T.raised, color: T.sub }}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md p-6" style={{ background: T.panel, border: "1px solid #2d3239", borderRadius: 16 }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: T.text }}>קטגוריה חדשה</h2>
            <form onSubmit={createCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: T.sub }}>שם הקטגוריה *</label>
                <input required value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  style={darkInput} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: T.sub }}>קורס</label>
                <select value={categoryForm.course} onChange={e => setCategoryForm({ ...categoryForm, course: Number(e.target.value) })} style={darkInput}>
                  <option value={1}>ראשונות</option>
                  <option value={2}>עיקריות</option>
                  <option value={3}>קינוח</option>
                </select>
              </div>
              <ImageUpload
                label="תמונת קטגוריה"
                value={categoryForm.image}
                onChange={url => setCategoryForm({ ...categoryForm, image: url })}
              />
              {/* Category translations */}
              <details style={{ border: "1px solid #2d3239", borderRadius: 12, overflow: "hidden" }}>
                <summary className="px-4 py-3 text-sm font-semibold cursor-pointer select-none" style={{ background: T.surface, color: T.sub }}>
                  🌐 תרגומים (EN · RU · FR)
                </summary>
                <div className="p-4 space-y-3">
                  {(["en", "ru", "fr"] as const).map(lang => (
                    <div key={lang} className="flex items-center gap-3">
                      <span className="text-xs font-bold w-6 shrink-0" style={{ color: T.muted }}>{lang.toUpperCase()}</span>
                      <input
                        value={categoryForm.translations?.[lang]?.name ?? ""}
                        onChange={e => setCategoryForm({ ...categoryForm, translations: { ...categoryForm.translations, [lang]: { name: e.target.value } } })}
                        placeholder={lang === "en" ? "Category name..." : lang === "ru" ? "Название категории..." : "Nom de la catégorie..."}
                        dir="ltr"
                        style={darkInput}
                      />
                    </div>
                  ))}
                </div>
              </details>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg font-medium disabled:opacity-50" style={{ background: T.gold, color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}>
                  {loading ? "יוצר..." : "צור"}
                </button>
                <button type="button" onClick={() => setShowCategoryForm(false)} className="flex-1 py-2.5 rounded-lg font-medium" style={{ background: T.raised, color: T.sub }}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "rgba(15,14,22,0.97)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)", border: `1px solid ${G_BORDER}`, borderRadius: 22, padding: 28 }}>
            <form onSubmit={handleItemSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: G_TEXT }}>
                {editItem ? `ערוך פריט — ${editItem.name}` : `פריט חדש — ${selectedCategory?.name}`}
              </h2>
              <button type="button" onClick={() => { setShowItemForm(false); setEditItem(null); setTagInput(""); }}
                style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${G_BORDER}`, color: G_MUTED, borderRadius: 10, width: 32, height: 32, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
              {/* Name + Price in one row */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: G_MUTED, marginBottom: 6 }}>שם הפריט *</label>
                  <input required value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} style={darkInput} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: G_MUTED, marginBottom: 6 }}>מחיר (₪) *</label>
                  <input required type="number" min="0" step="0.5" value={itemForm.price}
                    onChange={e => setItemForm({ ...itemForm, price: e.target.value })} style={darkInput} dir="ltr" />
                </div>
              </div>
              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: G_MUTED, marginBottom: 6 }}>תיאור</label>
                <textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2} style={{ ...darkInput, resize: "vertical" }} />
              </div>
              {/* Image */}
              <ImageUpload label="תמונת פריט" value={itemForm.image} onChange={url => setItemForm({ ...itemForm, image: url })} />
              {/* Diet flags */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[{ key: "isVegetarian", label: "צמחוני 🌿" }, { key: "isVegan", label: "טבעוני 🌱" }, { key: "isGlutenFree", label: "ללא גלוטן" }].map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: G_MUTED, cursor: "pointer" }}>
                    <input type="checkbox" checked={itemForm[key as keyof typeof itemForm] as boolean}
                      onChange={e => setItemForm({ ...itemForm, [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
              {/* Allergens */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: G_MUTED, marginBottom: 8 }}>אלרגנים ⚠️</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
                  {ALLERGEN_LIST.map(({ key, label }) => {
                    const checked = itemForm.allergens.includes(key);
                    return (
                      <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: checked ? "#f87171" : G_MUTED }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setItemForm({ ...itemForm, allergens: checked ? itemForm.allergens.filter(a => a !== key) : [...itemForm.allergens, key] })} />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
              {/* Tags */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: G_MUTED, marginBottom: 6 }}>תגיות נוספות</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="הוסף תגית..." style={{ ...darkInput, flex: 1 }} />
                  <button type="button" onClick={addTag}
                    style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${G_BORDER}`, color: G_MUTED, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>הוסף</button>
                </div>
                {itemForm.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {itemForm.tags.map(tag => (
                      <span key={tag} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(217,119,6,0.15)", color: G_ACCENT, borderRadius: 999, padding: "3px 10px", fontSize: 11 }}>
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} style={{ color: "#f87171", background: "none", border: "none", cursor: "pointer", fontWeight: 700, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Prep time */}
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: G_MUTED, marginBottom: 8 }}>⏱ זמן הכנה ממוצע</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {[5, 10, 15, 20, 30, 45].map(m => (
                    <button key={m} type="button"
                      onClick={() => setItemForm({ ...itemForm, prepTime: itemForm.prepTime === String(m) ? "" : String(m) })}
                      style={itemForm.prepTime === String(m)
                        ? { background: "rgba(217,119,6,0.2)", border: `1px solid ${G_ACCENT}`, color: G_ACCENT, borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }
                        : { background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.1)`, color: G_MUTED, borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
                      {m}&apos;
                    </button>
                  ))}
                  <input type="number" min="1" max="180" value={itemForm.prepTime}
                    onChange={e => setItemForm({ ...itemForm, prepTime: e.target.value })}
                    placeholder="דק'" style={{ ...darkInput, width: 80 }} dir="ltr" />
                </div>
              </div>

              {editItem && selectedRestaurant && (
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: G_MUTED, marginBottom: 8 }}>תגיות / אפשרויות</label>
                  <ModifierGroupsEditor itemId={editItem.id} restaurantId={selectedRestaurant.id} />
                </div>
              )}

              {/* Translations */}
              <details style={{ border: `1px solid ${G_BORDER}`, borderRadius: 14, overflow: "hidden" }}>
                <summary style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,0.04)", color: G_MUTED, display: "flex", alignItems: "center", gap: 8 }}>
                  🌐 תרגומים (EN · RU · FR)
                </summary>
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                  {(["en", "ru", "fr"] as const).map(lang => (
                    <div key={lang} style={{ border: `1px solid ${G_BORDER}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: G_MUTED }}>{lang === "en" ? "🇬🇧 English" : lang === "ru" ? "🇷🇺 Русский" : "🇫🇷 Français"}</div>
                      <input value={itemForm.translations?.[lang]?.name ?? ""}
                        onChange={e => setItemForm({ ...itemForm, translations: { ...itemForm.translations, [lang]: { ...itemForm.translations?.[lang], name: e.target.value } } })}
                        placeholder="Item name..." dir="ltr" style={darkInput} />
                      <textarea value={itemForm.translations?.[lang]?.description ?? ""}
                        onChange={e => setItemForm({ ...itemForm, translations: { ...itemForm.translations, [lang]: { ...itemForm.translations?.[lang], description: e.target.value } } })}
                        placeholder="Description..." dir="ltr" rows={2} style={{ ...darkInput, resize: "vertical" }} />
                    </div>
                  ))}
                </div>
              </details>

              {/* Submit */}
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <button type="submit" disabled={loading}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: G_ACCENT_GRAD, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.6 : 1, boxShadow: "0 4px 15px rgba(217,119,6,0.3)" }}>
                  {loading ? "שומר..." : editItem ? "שמור שינויים" : "הוסף פריט"}
                </button>
                <button type="button" onClick={() => { setShowItemForm(false); setEditItem(null); setTagInput(""); }}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${G_BORDER}`, background: "rgba(255,255,255,0.06)", color: G_MUTED, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule / Primary Modal */}
      {scheduleMenu && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md p-6" style={{ background: T.panel, border: "1px solid #2d3239", borderRadius: 16 }}>
            <h2 className="text-xl font-bold mb-5" style={{ color: T.text }}>הגדרות תפריט — {scheduleMenu.name}</h2>
            <form onSubmit={saveSchedule} className="space-y-5">

              {/* Primary toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={scheduleForm.isPrimary}
                    onChange={e => setScheduleForm({ ...scheduleForm, isPrimary: e.target.checked })} />
                  <div style={{ width: 44, height: 24, borderRadius: 999, background: scheduleForm.isPrimary ? T.gold : T.overlay, transition: "background 0.2s" }} />
                  <div style={{
                    position: "absolute", top: 2, width: 20, height: 20,
                    background: "#fff", borderRadius: "50%",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    transition: "right 0.2s",
                    right: scheduleForm.isPrimary ? 2 : 22,
                  }} />
                </div>
                <div>
                  <div className="font-medium" style={{ color: T.text }}>תפריט ראשי ★</div>
                  <div className="text-xs" style={{ color: T.muted }}>רק תפריט ראשי מוצג בדף הציבורי</div>
                </div>
              </label>

              {/* Days */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: T.sub }}>
                  ימי הצגה <span style={{ color: T.muted, fontWeight: 400 }}>(ריק = כל הימים)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_HE.map((day, i) => {
                    const val = String(i);
                    const checked = scheduleForm.scheduleDays.includes(val);
                    return (
                      <button key={i} type="button"
                        onClick={() => setScheduleForm({
                          ...scheduleForm,
                          scheduleDays: checked
                            ? scheduleForm.scheduleDays.filter(d => d !== val)
                            : [...scheduleForm.scheduleDays, val],
                        })}
                        style={checked
                          ? { border: "1px solid #fcc419", background: "rgba(252,196,25,0.12)", color: T.gold, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600 }
                          : { border: "1px solid #2d3239", color: T.sub, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time range */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: T.sub }}>
                  שעות הצגה <span style={{ color: T.muted, fontWeight: 400 }}>(ריק = כל שעות)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs mb-1 block" style={{ color: T.muted }}>משעה</label>
                    <input type="time" value={scheduleForm.scheduleFrom}
                      onChange={e => setScheduleForm({ ...scheduleForm, scheduleFrom: e.target.value })}
                      style={darkInput} dir="ltr" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs mb-1 block" style={{ color: T.muted }}>עד שעה</label>
                    <input type="time" value={scheduleForm.scheduleTo}
                      onChange={e => setScheduleForm({ ...scheduleForm, scheduleTo: e.target.value })}
                      style={darkInput} dir="ltr" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 rounded-lg font-medium disabled:opacity-50"
                  style={{ background: T.gold, color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}>
                  {loading ? "שומר..." : "שמור"}
                </button>
                <button type="button" onClick={() => setScheduleMenu(null)}
                  className="flex-1 py-2.5 rounded-lg font-medium"
                  style={{ background: T.raised, color: T.sub }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* #8 — Destructive Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-sm p-6" style={{ background: T.panel, border: "1px solid #2d3239", borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-3 text-center">🗑️</div>
            <h3 className="text-lg font-bold text-center mb-1" style={{ color: T.text }}>אישור מחיקה</h3>
            <p className="text-sm text-center mb-1" style={{ color: T.muted }}>
              {deleteConfirm.type === "menu" && "כל הקטגוריות והפריטים של התפריט יימחקו."}
              {deleteConfirm.type === "category" && "כל הפריטים בקטגוריה יימחקו."}
              {deleteConfirm.type === "item" && ""}
            </p>
            <p className="text-sm font-semibold text-center mb-5" style={{ color: T.text }}>
              &ldquo;{deleteConfirm.label}&rdquo;
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (deleteConfirm.type === "menu") _doDeleteMenu(deleteConfirm.id);
                  else if (deleteConfirm.type === "category") _doDeleteCategory(deleteConfirm.id);
                  else if (deleteConfirm.type === "item") _doDeleteItem(deleteConfirm.id, deleteConfirm.extra!);
                }}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm"
                style={{ background: T.red, color: "#fff" }}
              >
                מחק
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-lg font-medium text-sm"
                style={{ background: T.raised, color: T.sub }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-lg p-6" style={{ background: T.panel, border: "1px solid #2d3239", borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold" style={{ color: T.text }}>ייבא תפריט</h2>
              {!importing && (
                <button onClick={closeImportModal} style={{ color: T.muted, fontSize: 18, lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>✕</button>
              )}
            </div>

            {/* Error */}
            {importError && (
              <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: T.red, borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                {importError}
              </div>
            )}

            {/* Done state */}
            {importDone !== null && !importing && (
              <div style={{ background: "rgba(81,207,102,0.1)", border: "1px solid rgba(81,207,102,0.3)", borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 16 }}>
                <div className="text-2xl mb-1">✓</div>
                <div className="font-semibold" style={{ color: T.green }}>יובאו בהצלחה {importDone} פריטים</div>
              </div>
            )}

            {/* Progress */}
            {importProgress && importing && (
              <div className="mb-4 space-y-2">
                <div className="text-sm text-center" style={{ color: T.sub }}>
                  מייבא פריטים... ({importProgress.current}/{importProgress.total})
                </div>
                <div style={{ background: T.raised, borderRadius: 999, height: 8, overflow: "hidden" }}>
                  <div
                    className="transition-all duration-300"
                    style={{
                      height: 8,
                      borderRadius: 999,
                      width: importProgress.total > 0 ? `${(importProgress.current / importProgress.total) * 100}%` : "0%",
                      background: T.gold,
                    }}
                  />
                </div>
              </div>
            )}

            {/* No data yet — file picker UI */}
            {!importData && importDone === null && !importing && (
              <div
                className="mb-5 text-center cursor-pointer"
                style={{ border: "2px dashed #3a3f47", borderRadius: 12, padding: 32 }}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.gold; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = T.overlay; }}
              >
                <div className="text-3xl mb-2">📂</div>
                <div className="text-sm font-medium mb-1" style={{ color: T.sub }}>לחץ לבחירת קובץ JSON או Excel</div>
                <div className="flex items-center justify-center gap-3 mt-2">
                  <span style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, color: T.muted }}>JSON</span>
                  <span style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, color: T.muted }}>XLSX</span>
                  <span style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 10px", fontSize: 11, color: T.muted }}>XLS</span>
                </div>
                <div className="text-xs mt-2" style={{ color: T.muted }}>קובץ ייצוא תואם בפורמט Menu4U</div>
              </div>
            )}

            {/* Preview */}
            {importData && importDone === null && (
              <div className="mb-5 space-y-3">
                {(() => {
                  const { menuCount, categoryCount, itemCount } = getImportCounts(importData);
                  return (
                    <div style={{ background: "rgba(252,196,25,0.08)", border: "1px solid rgba(252,196,25,0.25)", borderRadius: 12, padding: 16 }}>
                      <div className="font-semibold mb-2" style={{ color: T.gold }}>
                        {importData.restaurantName ? `מקור: ${importData.restaurantName}` : "תצוגה מקדימה"}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div style={{ background: T.panel, border: "1px solid #2d3239", borderRadius: 8, padding: "8px 4px" }}>
                          <div className="text-xl font-bold" style={{ color: T.gold }}>{menuCount}</div>
                          <div className="text-xs" style={{ color: T.muted }}>תפריטים</div>
                        </div>
                        <div style={{ background: T.panel, border: "1px solid #2d3239", borderRadius: 8, padding: "8px 4px" }}>
                          <div className="text-xl font-bold" style={{ color: T.gold }}>{categoryCount}</div>
                          <div className="text-xs" style={{ color: T.muted }}>קטגוריות</div>
                        </div>
                        <div style={{ background: T.panel, border: "1px solid #2d3239", borderRadius: 8, padding: "8px 4px" }}>
                          <div className="text-xl font-bold" style={{ color: T.gold }}>{itemCount}</div>
                          <div className="text-xs" style={{ color: T.muted }}>פריטים</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {importData.menus.map((menu, mi) => (
                    <div key={mi} style={{ background: T.surface, border: "1px solid #2d3239", borderRadius: 8, padding: "10px 14px", marginBottom: 6 }}>
                      <div className="font-medium" style={{ color: T.text }}>{menu.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: T.muted }}>
                        {menu.categories.map(c => `${c.name} (${c.items.length})`).join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              {importDone !== null ? (
                <button
                  onClick={closeImportModal}
                  className="flex-1 py-2.5 rounded-lg font-medium"
                  style={{ background: T.gold, color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}
                >
                  סגור
                </button>
              ) : importData && !importing ? (
                <>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex-1 py-2.5 rounded-lg font-medium disabled:opacity-50"
                    style={{ background: T.gold, color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}
                  >
                    ייבא עכשיו
                  </button>
                  <button
                    onClick={closeImportModal}
                    className="flex-1 py-2.5 rounded-lg font-medium"
                    style={{ background: T.raised, color: T.sub }}
                  >
                    ביטול
                  </button>
                </>
              ) : !importing ? (
                <button
                  onClick={closeImportModal}
                  className="flex-1 py-2.5 rounded-lg font-medium"
                  style={{ background: T.raised, color: T.sub }}
                >
                  ביטול
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <AssistantWidget page="menus" />
    </PageShell>
  );
}
