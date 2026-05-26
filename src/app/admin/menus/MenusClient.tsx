"use client";

import { useState, useEffect, useRef } from "react";
import { formatPrice } from "@/lib/utils";
import ImageUpload from "@/components/admin/ImageUpload";

type ItemTranslationsMap = { en?: { name?: string; description?: string }; ru?: { name?: string; description?: string }; fr?: { name?: string; description?: string } };
type CatTranslationsMap  = { en?: { name?: string }; ru?: { name?: string }; fr?: { name?: string } };

type Item = {
  id: string; name: string; description: string | null; price: number;
  image: string | null; isActive: boolean; isVegetarian: boolean;
  isVegan: boolean; isGlutenFree: boolean; tags: string[]; prepTime: number | null; sortOrder: number;
  translations?: ItemTranslationsMap | null;
};

type Category = {
  id: string; name: string; image: string | null;
  items: Item[]; isActive: boolean; autoReady: boolean; sortOrder: number;
  translations?: CatTranslationsMap | null;
};

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
  tags?: string[]; prepTime?: number | null; sortOrder?: number;
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
const emptyItemForm = { name: "", description: "", price: "", image: "", isVegetarian: false, isVegan: false, isGlutenFree: false, tags: [] as string[], prepTime: "", translations: emptyItemTr() };
const emptyCategoryForm = { name: "", description: "", image: "", translations: emptyCatTr() };

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
            { "name": "סלט ים תיכוני", "description": "עגבניות, מלפפון, זיתים ופטה", "price": 42, "isVegetarian": true, "isVegan": false, "isGlutenFree": true, "tags": [], "prepTime": 5, "sortOrder": 0 },
            { "name": "ברוסקטה קלאסית", "description": "לחם קלוי עם עגבניות ובזיליקום", "price": 38, "isVegetarian": true, "isVegan": true, "isGlutenFree": false, "tags": [], "prepTime": 8, "sortOrder": 1 },
            { "name": "מרק עגבניות", "description": "מרק עגבניות טרי עם שמנת ובזיליקום", "price": 36, "isVegetarian": true, "isVegan": false, "isGlutenFree": true, "tags": ["חם"], "prepTime": 10, "sortOrder": 2 }
          ]
        },
        {
          "name": "מנות עיקריות",
          "sortOrder": 1,
          "items": [
            { "name": "סטייק אנטריקוט 300 גר'", "description": "סטייק בבישול לבחירה עם ירקות קלויים", "price": 148, "isVegetarian": false, "isVegan": false, "isGlutenFree": true, "tags": ["בשר", "ללא גלוטן"], "prepTime": 20, "sortOrder": 0 },
            { "name": "פילה סלמון", "description": "פילה סלמון צלוי עם אורז ולימון", "price": 118, "isVegetarian": false, "isVegan": false, "isGlutenFree": true, "tags": ["דגים"], "prepTime": 18, "sortOrder": 1 },
            { "name": "פסטה ארביאטה", "description": "פנה ברוטב עגבניות חריף עם שום", "price": 68, "isVegetarian": true, "isVegan": true, "isGlutenFree": false, "tags": ["חריף"], "prepTime": 15, "sortOrder": 2 },
            { "name": "המבורגר ביתי", "description": "המבורגר 200 גר' עם חסה, עגבנייה ורוטב", "price": 88, "isVegetarian": false, "isVegan": false, "isGlutenFree": false, "tags": ["פופולרי"], "prepTime": 15, "sortOrder": 3 }
          ]
        },
        {
          "name": "קינוחים",
          "sortOrder": 2,
          "items": [
            { "name": "קרם ברולה", "description": "קרם צרפתי קלאסי עם ציפוי סוכר", "price": 42, "isVegetarian": true, "isVegan": false, "isGlutenFree": true, "tags": [], "prepTime": 5, "sortOrder": 0 },
            { "name": "פונדנט שוקולד", "description": "עוגת שוקולד חמה עם גלידת וניל", "price": 48, "isVegetarian": true, "isVegan": false, "isGlutenFree": false, "tags": ["שוקולד", "חם"], "prepTime": 12, "sortOrder": 1 },
            { "name": "טירמיסו", "description": "קינוח איטלקי קלאסי עם קפה ומסקרפונה", "price": 44, "isVegetarian": true, "isVegan": false, "isGlutenFree": false, "tags": [], "prepTime": 3, "sortOrder": 2 }
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
            { "name": "אספרסו", "description": "קפה איטלקי קלאסי", "price": 12, "isVegetarian": true, "isVegan": true, "isGlutenFree": true, "tags": ["קפה"], "prepTime": 3, "sortOrder": 0 },
            { "name": "קפה לאטה", "description": "אספרסו עם חלב מוקצף", "price": 18, "isVegetarian": true, "isVegan": false, "isGlutenFree": true, "tags": ["קפה"], "prepTime": 4, "sortOrder": 1 },
            { "name": "תה נענע", "description": "תה נענע טרי", "price": 14, "isVegetarian": true, "isVegan": true, "isGlutenFree": true, "tags": [], "prepTime": 3, "sortOrder": 2 }
          ]
        },
        {
          "name": "משקאות קרים",
          "sortOrder": 1,
          "items": [
            { "name": "לימונדה טרייה", "description": "לימון, מנטה וסוכר", "price": 22, "isVegetarian": true, "isVegan": true, "isGlutenFree": true, "tags": ["טרי"], "prepTime": 5, "sortOrder": 0 },
            { "name": "מיץ תפוזים סחוט", "description": "מיץ תפוזים טרי", "price": 26, "isVegetarian": true, "isVegan": true, "isGlutenFree": true, "tags": ["טרי", "בריא"], "prepTime": 3, "sortOrder": 1 }
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
          "זמן הכנה (דק')": item.prepTime != null ? String(item.prepTime) : "",
        });
      }
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  // Set RTL direction + column widths
  ws["!cols"] = [
    { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 32 },
    { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 20 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "תפריט");

  // Instructions sheet
  const instrRows = [
    { "הוראות": "מלא/י את גיליון 'תפריט' בהתאם לעמודות." },
    { "הוראות": "עמודות חובה: תפריט, קטגוריה, שם פריט, מחיר (₪)" },
    { "הוראות": "צמחוני / טבעוני / ללא גלוטן: כתוב כן או לא" },
    { "הוראות": "תגיות: הפרד בפסיקים (לדוגמא: חריף, פופולרי)" },
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
    const tagsRaw = String(row["תגיות"] ?? "").trim();
    const prepRaw = String(row["זמן הכנה (דק')"] ?? row["זמן הכנה"] ?? "").trim();

    cats.get(catName)!.push({
      name: itemName,
      description: String(row["תיאור"] ?? "").trim(),
      price,
      isVegetarian: String(row["צמחוני"] ?? "").trim() === "כן",
      isVegan:      String(row["טבעוני"] ?? "").trim() === "כן",
      isGlutenFree: String(row["ללא גלוטן"] ?? "").trim() === "כן",
      tags: tagsRaw ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean) : [],
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
  background: "#2d3239",
  border: "1px solid #3a3f47",
  color: "#e9ecef",
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
  const [templates, setTemplates] = useState<TemplatePick[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/items/${itemId}/modifiers`)
      .then(r => r.json())
      .then(data => { setGroups(data); setLoading(false); })
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
    // Don't copy if a group with same name already exists
    setGroups(g => {
      if (g.some(grp => grp.name === t.name)) return g;
      return [...g, {
        name: t.name,
        required: t.required,
        maxSelect: t.maxSelect,
        order: g.length,
        options: t.options.map((o, i) => ({ label: o.label, priceAdd: o.priceAdd, order: i })),
      }];
    });
    setShowTemplates(false);
  }

  function addGroup() {
    setGroups(g => [...g, { name: "", required: false, maxSelect: 1, order: g.length, options: [] }]);
  }

  function removeGroup(gi: number) {
    setGroups(g => g.filter((_, i) => i !== gi));
  }

  function updateGroup(gi: number, patch: Partial<ModGroup>) {
    setGroups(g => g.map((grp, i) => i === gi ? { ...grp, ...patch } : grp));
  }

  function addOption(gi: number) {
    setGroups(g => g.map((grp, i) => i === gi
      ? { ...grp, options: [...grp.options, { label: "", priceAdd: 0, order: grp.options.length }] }
      : grp));
  }

  function removeOption(gi: number, oi: number) {
    setGroups(g => g.map((grp, i) => i === gi
      ? { ...grp, options: grp.options.filter((_, j) => j !== oi) }
      : grp));
  }

  function updateOption(gi: number, oi: number, patch: Partial<ModOption>) {
    setGroups(g => g.map((grp, i) => i === gi
      ? { ...grp, options: grp.options.map((opt, j) => j === oi ? { ...opt, ...patch } : opt) }
      : grp));
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/admin/items/${itemId}/modifiers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(groups),
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div style={{ fontSize: 13, color: "#6c757d", padding: "8px 0" }}>טוען...</div>;

  return (
    <div className="space-y-3">
      {groups.map((grp, gi) => (
        <div key={gi} style={{ border: "1px solid #2d3239", borderRadius: 12, padding: 12, background: "#1a1d23" }} className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={grp.name}
              onChange={e => updateGroup(gi, { name: e.target.value })}
              placeholder="שם קבוצה (לדוגמא: עשייה)"
              style={{ ...darkInput, flex: 1, fontSize: 13, padding: "6px 10px" }}
            />
            <button type="button" onClick={() => removeGroup(gi)} style={{ color: "#ff6b6b", fontSize: 13, padding: "0 8px" }}>✕</button>
          </div>
          <div className="flex gap-3 items-center flex-wrap" style={{ fontSize: 12 }}>
            <label className="flex items-center gap-1 cursor-pointer" style={{ color: "#adb5bd" }}>
              <input type="checkbox" checked={grp.required} onChange={e => updateGroup(gi, { required: e.target.checked })} className="rounded"/>
              חובה
            </label>
            <label className="flex items-center gap-1.5" style={{ color: "#adb5bd" }}>
              בחירה מקסימלית:
              <input
                type="number" min={1} max={10} value={grp.maxSelect}
                onChange={e => updateGroup(gi, { maxSelect: parseInt(e.target.value) || 1 })}
                style={{ width: 48, textAlign: "center", padding: "2px 4px", background: "#2d3239", border: "1px solid #3a3f47", color: "#e9ecef", borderRadius: 6, fontSize: 12 }}
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
                  style={{ width: 64, textAlign: "center", fontSize: 13, padding: "5px 4px", background: "#2d3239", border: "1px solid #3a3f47", color: "#e9ecef", borderRadius: 8 }}
                  title="תוספת מחיר"
                />
                <button type="button" onClick={() => removeOption(gi, oi)} style={{ color: "#ff6b6b", fontSize: 12 }}>✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => addOption(gi)} style={{ color: "#fcc419", fontSize: 12, fontWeight: 500 }}>+ הוסף אפשרות</button>
        </div>
      ))}
      {/* Template picker */}
      {showTemplates && (
        <div style={{ border: "1px solid rgba(252,196,25,0.3)", background: "rgba(252,196,25,0.08)", borderRadius: 12, padding: 12 }} className="space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <span style={{ fontSize: 12, fontWeight: 600, color: "#fcc419" }}>בחר קבוצה להעתיק</span>
            <button type="button" onClick={() => setShowTemplates(false)} style={{ color: "#6c757d", fontSize: 12 }}>✕</button>
          </div>
          {templatesLoading && <div style={{ fontSize: 12, color: "#6c757d", padding: "4px 0" }}>טוען...</div>}
          {!templatesLoading && templates.length === 0 && (
            <div style={{ fontSize: 12, color: "#6c757d", padding: "4px 0" }}>אין קבוצות מוגדרות בפריטים אחרים</div>
          )}
          {!templatesLoading && templates.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => copyTemplate(t)}
              style={{ width: "100%", textAlign: "right", padding: "6px 12px", borderRadius: 8, background: "#212529", border: "1px solid #2d3239", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: "#e9ecef" }}>{t.name}</span>
              <span style={{ fontSize: 11, color: "#6c757d", flexShrink: 0 }}>
                {t.options.map(o => o.label).join(" / ")}
                {" · "}מתוך: {t.item.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={addGroup} style={{ border: "1px solid rgba(252,196,25,0.4)", background: "rgba(252,196,25,0.08)", color: "#fcc419", borderRadius: 12, padding: "6px 12px", fontSize: 13 }}>
          + קבוצת אפשרויות
        </button>
        <button type="button" onClick={openTemplates} style={{ border: "1px solid rgba(51,154,240,0.4)", background: "rgba(51,154,240,0.08)", color: "#339af0", borderRadius: 12, padding: "6px 12px", fontSize: 13 }}>
          📋 העתק מתבנית
        </button>
        {groups.length > 0 && (
          <button type="button" onClick={save} disabled={saving} className="disabled:opacity-50" style={{ background: "#c9a84c", color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)", borderRadius: 12, padding: "6px 16px", fontSize: 13, fontWeight: 600 }}>
            {saving ? "שומר..." : saved ? "✓ נשמר" : "שמור תגיות"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MenusClient({ restaurants, canEdit }: { restaurants: Restaurant[]; canEdit: boolean }) {
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

  async function toggleCategoryAutoReady(catId: string, current: boolean) {
    // Optimistic update first
    updateMenu(m => ({
      ...m,
      categories: m.categories.map(c => c.id === catId ? { ...c, autoReady: !current } : c),
    }));
    try {
      const res = await fetch(`/api/admin/categories/${catId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoReady: !current }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      // Revert on failure
      updateMenu(m => ({
        ...m,
        categories: m.categories.map(c => c.id === catId ? { ...c, autoReady: current } : c),
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

  return (
    <div className="p-4 md:p-8" style={{ background: "#1a1d23", minHeight: "100vh", color: "#e9ecef" }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#e9ecef" }}>ניהול תפריטים</h1>
        {selectedRestaurant && (
          <div className="flex items-center gap-2 flex-wrap">

            {/* Export dropdown */}
            <div className="relative">
              <button
                onClick={() => { setExportDropdown(v => !v); setSampleDropdown(false); }}
                disabled={importing}
                className="flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: "#2d3239", border: "1px solid #fcc419", color: "#fcc419", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600 }}
              >
                📤 ייצא ▾
              </button>
              {exportDropdown && (
                <div className="absolute left-0 top-full mt-1 z-30 overflow-hidden min-w-[140px]" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                  <button onClick={handleExportJson} className="w-full text-right flex items-center gap-2" style={{ padding: "10px 16px", fontSize: 13, color: "#e9ecef" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#2d3239")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span className="text-base">📄</span> JSON
                  </button>
                  <button onClick={handleExportXlsx} className="w-full text-right flex items-center gap-2" style={{ padding: "10px 16px", fontSize: 13, color: "#e9ecef", borderTop: "1px solid #2d3239" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#2d3239")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span className="text-base">📊</span> Excel (.xlsx)
                  </button>
                </div>
              )}
            </div>

            {/* Import button */}
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: "#2d3239", border: "1px solid #51cf66", color: "#51cf66", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600 }}
            >
              📥 ייבא תפריט
            </button>

            {/* Sample dropdown */}
            <div className="relative">
              <button
                onClick={() => { setSampleDropdown(v => !v); setExportDropdown(false); }}
                disabled={importing}
                className="flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: "#2d3239", border: "1px solid #3a3f47", color: "#adb5bd", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600 }}
              >
                📋 קובץ דוגמא ▾
              </button>
              {sampleDropdown && (
                <div className="absolute left-0 top-full mt-1 z-30 overflow-hidden min-w-[140px]" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                  <button onClick={handleSampleJson} className="w-full text-right flex items-center gap-2" style={{ padding: "10px 16px", fontSize: 13, color: "#e9ecef" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#2d3239")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span className="text-base">📄</span> JSON
                  </button>
                  <button onClick={handleSampleXlsx} className="w-full text-right flex items-center gap-2" style={{ padding: "10px 16px", fontSize: 13, color: "#e9ecef", borderTop: "1px solid #2d3239" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#2d3239")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <span className="text-base">📊</span> Excel (.xlsx)
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Close dropdowns on outside click */}
      {(exportDropdown || sampleDropdown) && (
        <div className="fixed inset-0 z-20" onClick={() => { setExportDropdown(false); setSampleDropdown(false); }} />
      )}

      {/* Hidden file input for import — accepts JSON and Excel */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      {restaurants.length === 0 ? (
        <div className="p-12 text-center" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 12, color: "#6c757d" }}>אין מסעדות זמינות</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-64 md:shrink-0 space-y-4">
            <div style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ borderBottom: "1px solid #2d3239", color: "#adb5bd", padding: "12px 16px", fontWeight: 600, fontSize: 14 }}>מסעדות</div>
              {restaurants.map(rest => (
                <button key={rest.id} onClick={() => { setSelectedRestaurant(rest); setSelectedMenu(rest.menus[0] ?? null); }}
                  className="w-full text-right px-4 py-3 text-sm transition-colors"
                  style={selectedRestaurant?.id === rest.id
                    ? { background: "rgba(252,196,25,0.12)", color: "#fcc419", fontWeight: 600 }
                    : { color: "#adb5bd" }}
                  onMouseEnter={e => { if (selectedRestaurant?.id !== rest.id) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (selectedRestaurant?.id !== rest.id) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}>
                  {rest.name}
                </button>
              ))}
            </div>

            {selectedRestaurant && !isSingleMenu && (
              <div style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ borderBottom: "1px solid #2d3239", padding: "12px 16px" }} className="flex items-center justify-between">
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#adb5bd" }}>תפריטים</span>
                  {canEdit && (
                    <button onClick={() => setShowMenuForm(true)} style={{ fontSize: 12, color: "#fcc419", fontWeight: 500 }}>+ חדש</button>
                  )}
                </div>
                {selectedRestaurant.menus.map(menu => (
                  <div key={menu.id} className="flex items-center justify-between pr-4 pl-2 py-2.5 transition-colors"
                    style={selectedMenu?.id === menu.id ? { background: "rgba(252,196,25,0.12)" } : {}}>
                    <button onClick={() => setSelectedMenu(menu)} className="flex-1 text-right text-sm"
                      style={selectedMenu?.id === menu.id ? { color: "#fcc419" } : { color: "#adb5bd" }}>
                      <span className="flex items-center gap-1.5">
                        {menu.isPrimary && <span title="תפריט ראשי" style={{ color: "#fcc419", fontSize: 12 }}>★</span>}
                        {menu.scheduleDays?.length > 0 && <span title="עם תזמון" style={{ color: "#339af0", fontSize: 12 }}>⏰</span>}
                        {menu.name}
                      </span>
                    </button>
                    {canEdit && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openSchedule(menu)} style={{ color: "#6c757d", fontSize: 12, padding: "0 4px" }} title="הגדרות תזמון">🕐</button>
                        <button onClick={() => deleteMenu(menu.id)} style={{ color: "#6c757d", fontSize: 12, padding: "0 4px" }}>✕</button>
                      </div>
                    )}
                  </div>
                ))}
                {selectedRestaurant.menus.length === 0 && (
                  <div className="p-6 text-center">
                    <div className="text-2xl mb-2">📋</div>
                    <p style={{ fontSize: 12, color: "#6c757d", marginBottom: 12 }}>אין תפריטים עדיין</p>
                    {canEdit && <button onClick={() => setShowMenuForm(true)} className="text-xs text-white px-3 py-1.5 rounded-lg font-medium" style={{ background: "#c9a84c", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}>+ צור תפריט ראשון</button>}
                  </div>
                )}
              </div>
            )}
            {/* #3 — single-menu: show settings icon inline */}
            {selectedRestaurant && isSingleMenu && selectedMenu && canEdit && (
              <div style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 12, overflow: "hidden" }}>
                <div className="p-3 flex items-center justify-between">
                  <span style={{ fontSize: 12, color: "#adb5bd", fontWeight: 500 }}>{selectedMenu.name}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openSchedule(selectedMenu)} style={{ color: "#6c757d", fontSize: 12, padding: "4px 6px", borderRadius: 6 }} title="הגדרות תפריט">⚙️</button>
                    <button onClick={() => setShowMenuForm(true)} style={{ fontSize: 12, color: "#fcc419", fontWeight: 500, padding: "4px 6px", borderRadius: 6 }}>+ תפריט נוסף</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main */}
          <div className="flex-1">
            {!selectedMenu ? (
              <div className="p-12 text-center" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 12, color: "#6c757d" }}>בחר תפריט או צור חדש</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold" style={{ color: "#e9ecef" }}>{selectedMenu.name}</h2>
                  {canEdit && (
                    <button onClick={() => setShowCategoryForm(true)}
                      className="text-white px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: "#c9a84c", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}>
                      + קטגוריה חדשה
                    </button>
                  )}
                </div>

                {sortedCategories.length === 0 ? (
                  <div className="p-12 text-center" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 12 }}>
                    <div className="text-4xl mb-3">🗂️</div>
                    <div className="font-medium mb-1" style={{ color: "#adb5bd" }}>אין קטגוריות עדיין</div>
                    <div className="text-sm mb-4" style={{ color: "#6c757d" }}>הוסף קטגוריה ראשונה כדי להתחיל לבנות את התפריט</div>
                    {canEdit && (
                      <button onClick={() => setShowCategoryForm(true)}
                        className="inline-flex items-center gap-1.5 text-white px-5 py-2.5 rounded-lg text-sm font-medium"
                        style={{ background: "#c9a84c", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}>
                        + קטגוריה חדשה
                      </button>
                    )}
                  </div>
                ) : (
                  sortedCategories.map((cat, idx) => {
                    const isExpanded = expandedCats.has(cat.id);
                    return (
                    <div key={cat.id} style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 12, overflow: "hidden" }}>
                      {/* Category header — always visible, click to expand */}
                      <div
                        className="p-4 flex items-center gap-3 cursor-pointer select-none transition-colors"
                        style={{ borderBottom: isExpanded ? "1px solid #2d3239" : undefined }}
                        onClick={() => toggleCat(cat.id)}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {cat.image && <img src={cat.image} alt={cat.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />}
                        <h3 className="font-semibold flex-1" style={{ color: "#e9ecef" }}>{cat.name}</h3>
                        {/* Item count badge */}
                        <span className="shrink-0" style={{ background: "#2d3239", color: "#6c757d", borderRadius: 999, padding: "2px 8px", fontSize: 12 }}>
                          {cat.items.length} פריטים
                        </span>
                        {canEdit && (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            {/* autoReady toggle — drinks/bar bypass kitchen */}
                            <button
                              onClick={() => toggleCategoryAutoReady(cat.id, cat.autoReady ?? false)}
                              title={cat.autoReady ? "ביטול auto-ready — פריטים יישלחו למטבח" : "הפעל auto-ready — פריטים יסומנו כמוכנים מיידית (שתיה/בר)"}
                              style={{
                                fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                                border: `1px solid ${cat.autoReady ? "rgba(81,207,102,.4)" : "rgba(108,117,125,.3)"}`,
                                background: cat.autoReady ? "rgba(81,207,102,.15)" : "rgba(108,117,125,.1)",
                                color: cat.autoReady ? "#51cf66" : "#6c757d",
                                cursor: "pointer",
                              }}>
                              {cat.autoReady ? "🍹 ללא מטבח" : "🍹"}
                            </button>
                            <div className="flex flex-col gap-0.5">
                              <button onClick={() => moveCategoryOrder(cat.id, "up")} disabled={idx === 0}
                                className="disabled:opacity-30 leading-none" style={{ fontSize: 12, color: "#6c757d" }}>▲</button>
                              <button onClick={() => moveCategoryOrder(cat.id, "down")} disabled={idx === sortedCategories.length - 1}
                                className="disabled:opacity-30 leading-none" style={{ fontSize: 12, color: "#6c757d" }}>▼</button>
                            </div>
                            <button onClick={() => { setSelectedCategory(cat); setEditItem(null); setItemForm(emptyItemForm); setTagInput(""); setShowItemForm(true); }}
                              className="text-sm font-medium" style={{ color: "#fcc419" }}>+ פריט</button>
                            <button onClick={() => deleteCategory(cat.id)} className="text-sm" style={{ color: "#ff6b6b" }}>מחק</button>
                          </div>
                        )}
                        {/* Chevron */}
                        <svg
                          className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                          style={{ color: "#6c757d" }}
                          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Items — only when expanded */}
                      {isExpanded && (
                        <div>
                          {cat.items.length === 0 ? (
                            <div className="p-6 text-center">
                              <div className="text-2xl mb-1">🍽️</div>
                              <p className="text-sm mb-2" style={{ color: "#6c757d" }}>אין פריטים בקטגוריה זו</p>
                              {canEdit && (
                                <button onClick={() => { setSelectedCategory(cat); setEditItem(null); setItemForm(emptyItemForm); setTagInput(""); setShowItemForm(true); }}
                                  style={{ fontSize: 12, color: "#fcc419", border: "1px solid rgba(252,196,25,0.3)", background: "rgba(252,196,25,0.08)", borderRadius: 8, padding: "6px 12px", fontWeight: 500 }}>
                                  + הוסף פריט ראשון
                                </button>
                              )}
                            </div>
                          ) : (
                            cat.items.map((item, itemIdx) => (
                              <div key={item.id} className="p-3 md:p-4 flex items-start md:items-center gap-3 md:gap-4 flex-wrap md:flex-nowrap"
                                style={{ borderTop: itemIdx === 0 ? undefined : "1px solid #2d3239" }}>
                                {item.image && <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium" style={!item.isActive ? { color: "#6c757d", textDecoration: "line-through" } : { color: "#e9ecef" }}>{item.name}</span>
                                    {item.isVegetarian && <span title="צמחוני" className="text-xs">🌿</span>}
                                    {item.isVegan && <span title="טבעוני" className="text-xs">🌱</span>}
                                    {item.isGlutenFree && <span title="ללא גלוטן" style={{ color: "#fcc419", fontWeight: 700, fontSize: 11 }}>GF</span>}
                                    {item.prepTime != null && (
                                      <span style={{ background: "rgba(51,154,240,0.15)", color: "#339af0", borderRadius: 999, padding: "2px 6px", fontSize: 11, fontWeight: 600 }}>⏱ {item.prepTime}&apos;</span>
                                    )}
                                    {item.tags?.map(tag => (
                                      <span key={tag} style={{ background: "#2d3239", color: "#adb5bd", borderRadius: 999, padding: "2px 6px", fontSize: 11 }}>{tag}</span>
                                    ))}
                                  </div>
                                  {item.description && <p className="text-xs mt-0.5" style={{ color: "#6c757d" }}>{item.description}</p>}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span style={{ color: "#51cf66", fontWeight: 700 }}>{formatPrice(item.price)}</span>
                                  {canEdit && (
                                    <>
                                      <button onClick={() => openEditItem(cat, item)} style={{ color: "#339af0", fontSize: 12 }}>ערוך</button>
                                      <button onClick={() => toggleItem(cat.id, item.id, item.isActive)}
                                        style={{ color: item.isActive ? "#6c757d" : "#51cf66", fontSize: 12 }}>
                                        {item.isActive ? "השבת" : "הפעל"}
                                      </button>
                                      <button onClick={() => deleteItem(cat.id, item.id)} style={{ color: "#ff6b6b", fontSize: 12 }}>מחק</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Menu Form Modal */}
      {showMenuForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md p-6" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 16 }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: "#e9ecef" }}>תפריט חדש</h2>
            <form onSubmit={createMenu} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#adb5bd" }}>שם התפריט *</label>
                <input required value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })}
                  style={darkInput} />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg font-medium disabled:opacity-50" style={{ background: "#c9a84c", color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}>
                  {loading ? "יוצר..." : "צור"}
                </button>
                <button type="button" onClick={() => setShowMenuForm(false)} className="flex-1 py-2.5 rounded-lg font-medium" style={{ background: "#2d3239", color: "#adb5bd" }}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Form Modal */}
      {showCategoryForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md p-6" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 16 }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: "#e9ecef" }}>קטגוריה חדשה</h2>
            <form onSubmit={createCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#adb5bd" }}>שם הקטגוריה *</label>
                <input required value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  style={darkInput} />
              </div>
              <ImageUpload
                label="תמונת קטגוריה"
                value={categoryForm.image}
                onChange={url => setCategoryForm({ ...categoryForm, image: url })}
              />
              {/* Category translations */}
              <details style={{ border: "1px solid #2d3239", borderRadius: 12, overflow: "hidden" }}>
                <summary className="px-4 py-3 text-sm font-semibold cursor-pointer select-none" style={{ background: "#1a1d23", color: "#adb5bd" }}>
                  🌐 תרגומים (EN · RU · FR)
                </summary>
                <div className="p-4 space-y-3">
                  {(["en", "ru", "fr"] as const).map(lang => (
                    <div key={lang} className="flex items-center gap-3">
                      <span className="text-xs font-bold w-6 shrink-0" style={{ color: "#6c757d" }}>{lang.toUpperCase()}</span>
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
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg font-medium disabled:opacity-50" style={{ background: "#c9a84c", color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}>
                  {loading ? "יוצר..." : "צור"}
                </button>
                <button type="button" onClick={() => setShowCategoryForm(false)} className="flex-1 py-2.5 rounded-lg font-medium" style={{ background: "#2d3239", color: "#adb5bd" }}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 16 }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: "#e9ecef" }}>{editItem ? `ערוך פריט — ${editItem.name}` : `פריט חדש — ${selectedCategory?.name}`}</h2>
            <form onSubmit={handleItemSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#adb5bd" }}>שם הפריט *</label>
                <input required value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  style={darkInput} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#adb5bd" }}>תיאור</label>
                <textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })}
                  rows={2} style={{ ...darkInput, resize: "vertical" }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#adb5bd" }}>מחיר (₪) *</label>
                <input required type="number" min="0" step="0.5" value={itemForm.price}
                  onChange={e => setItemForm({ ...itemForm, price: e.target.value })}
                  style={darkInput} dir="ltr" />
              </div>
              <ImageUpload
                label="תמונת פריט"
                value={itemForm.image}
                onChange={url => setItemForm({ ...itemForm, image: url })}
              />
              <div className="flex gap-4 flex-wrap">
                {[{ key: "isVegetarian", label: "צמחוני 🌿" }, { key: "isVegan", label: "טבעוני 🌱" }, { key: "isGlutenFree", label: "ללא גלוטן" }].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#adb5bd" }}>
                    <input type="checkbox" checked={itemForm[key as keyof typeof itemForm] as boolean}
                      onChange={e => setItemForm({ ...itemForm, [key]: e.target.checked })} className="rounded" />
                    {label}
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#adb5bd" }}>תגיות נוספות</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                    placeholder="הוסף תגית..."
                    style={{ ...darkInput, flex: 1 }}
                  />
                  <button type="button" onClick={addTag}
                    style={{ background: "#2d3239", color: "#adb5bd", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>הוסף</button>
                </div>
                {itemForm.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {itemForm.tags.map(tag => (
                      <span key={tag} className="flex items-center gap-1" style={{ background: "rgba(252,196,25,0.15)", color: "#fcc419", borderRadius: 999, padding: "3px 8px", fontSize: 11 }}>
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="font-bold leading-none" style={{ color: "#ff6b6b" }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Prep time */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#adb5bd" }}>⏱ זמן הכנה ממוצע</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[5, 10, 15, 20, 30, 45].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setItemForm({ ...itemForm, prepTime: itemForm.prepTime === String(m) ? "" : String(m) })}
                      style={itemForm.prepTime === String(m)
                        ? { background: "#2d1f00", border: "1px solid #fcc419", color: "#fcc419", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600 }
                        : { background: "#2d3239", border: "1px solid #3a3f47", color: "#adb5bd", borderRadius: 8, padding: "6px 12px", fontSize: 13 }}
                    >
                      {m}&apos;
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={itemForm.prepTime}
                    onChange={e => setItemForm({ ...itemForm, prepTime: e.target.value })}
                    placeholder="דק'"
                    style={{ ...darkInput, width: 80 }}
                    dir="ltr"
                  />
                </div>
              </div>

              {editItem && selectedRestaurant && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "#adb5bd" }}>תגיות / אפשרויות</label>
                  <ModifierGroupsEditor itemId={editItem.id} restaurantId={selectedRestaurant.id} />
                </div>
              )}

              {/* ── Translations ── */}
              <details style={{ border: "1px solid #2d3239", borderRadius: 12, overflow: "hidden" }}>
                <summary className="px-4 py-3 text-sm font-semibold cursor-pointer select-none flex items-center gap-2" style={{ background: "#1a1d23", color: "#adb5bd" }}>
                  🌐 תרגומים (EN · RU · FR)
                </summary>
                <div className="p-4 space-y-4">
                  {(["en", "ru", "fr"] as const).map(lang => (
                    <div key={lang} style={{ border: "1px solid #2d3239", borderRadius: 8, padding: 12 }} className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#6c757d" }}>{lang === "en" ? "🇬🇧 English" : lang === "ru" ? "🇷🇺 Русский" : "🇫🇷 Français"}</div>
                      <input
                        value={itemForm.translations?.[lang]?.name ?? ""}
                        onChange={e => setItemForm({ ...itemForm, translations: { ...itemForm.translations, [lang]: { ...itemForm.translations?.[lang], name: e.target.value } } })}
                        placeholder="Item name..."
                        dir="ltr"
                        style={darkInput}
                      />
                      <textarea
                        value={itemForm.translations?.[lang]?.description ?? ""}
                        onChange={e => setItemForm({ ...itemForm, translations: { ...itemForm.translations, [lang]: { ...itemForm.translations?.[lang], description: e.target.value } } })}
                        placeholder="Description..."
                        dir="ltr" rows={2}
                        style={{ ...darkInput, resize: "vertical" }}
                      />
                    </div>
                  ))}
                </div>
              </details>

              <div className="flex gap-3">
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg font-medium disabled:opacity-50" style={{ background: "#c9a84c", color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}>
                  {loading ? "שומר..." : editItem ? "שמור שינויים" : "הוסף פריט"}
                </button>
                <button type="button" onClick={() => { setShowItemForm(false); setEditItem(null); setTagInput(""); }} className="flex-1 py-2.5 rounded-lg font-medium" style={{ background: "#2d3239", color: "#adb5bd" }}>ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule / Primary Modal */}
      {scheduleMenu && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md p-6" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 16 }}>
            <h2 className="text-xl font-bold mb-5" style={{ color: "#e9ecef" }}>הגדרות תפריט — {scheduleMenu.name}</h2>
            <form onSubmit={saveSchedule} className="space-y-5">

              {/* Primary toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={scheduleForm.isPrimary}
                    onChange={e => setScheduleForm({ ...scheduleForm, isPrimary: e.target.checked })} />
                  <div style={{ width: 44, height: 24, borderRadius: 999, background: scheduleForm.isPrimary ? "#fcc419" : "#3a3f47", transition: "background 0.2s" }} />
                  <div style={{
                    position: "absolute", top: 2, width: 20, height: 20,
                    background: "#fff", borderRadius: "50%",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    transition: "right 0.2s",
                    right: scheduleForm.isPrimary ? 2 : 22,
                  }} />
                </div>
                <div>
                  <div className="font-medium" style={{ color: "#e9ecef" }}>תפריט ראשי ★</div>
                  <div className="text-xs" style={{ color: "#6c757d" }}>רק תפריט ראשי מוצג בדף הציבורי</div>
                </div>
              </label>

              {/* Days */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#adb5bd" }}>
                  ימי הצגה <span style={{ color: "#6c757d", fontWeight: 400 }}>(ריק = כל הימים)</span>
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
                          ? { border: "1px solid #fcc419", background: "rgba(252,196,25,0.12)", color: "#fcc419", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600 }
                          : { border: "1px solid #2d3239", color: "#adb5bd", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time range */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#adb5bd" }}>
                  שעות הצגה <span style={{ color: "#6c757d", fontWeight: 400 }}>(ריק = כל שעות)</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs mb-1 block" style={{ color: "#6c757d" }}>משעה</label>
                    <input type="time" value={scheduleForm.scheduleFrom}
                      onChange={e => setScheduleForm({ ...scheduleForm, scheduleFrom: e.target.value })}
                      style={darkInput} dir="ltr" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs mb-1 block" style={{ color: "#6c757d" }}>עד שעה</label>
                    <input type="time" value={scheduleForm.scheduleTo}
                      onChange={e => setScheduleForm({ ...scheduleForm, scheduleTo: e.target.value })}
                      style={darkInput} dir="ltr" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 rounded-lg font-medium disabled:opacity-50"
                  style={{ background: "#c9a84c", color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}>
                  {loading ? "שומר..." : "שמור"}
                </button>
                <button type="button" onClick={() => setScheduleMenu(null)}
                  className="flex-1 py-2.5 rounded-lg font-medium"
                  style={{ background: "#2d3239", color: "#adb5bd" }}>
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
          <div className="w-full max-w-sm p-6" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 16 }} onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-3 text-center">🗑️</div>
            <h3 className="text-lg font-bold text-center mb-1" style={{ color: "#e9ecef" }}>אישור מחיקה</h3>
            <p className="text-sm text-center mb-1" style={{ color: "#6c757d" }}>
              {deleteConfirm.type === "menu" && "כל הקטגוריות והפריטים של התפריט יימחקו."}
              {deleteConfirm.type === "category" && "כל הפריטים בקטגוריה יימחקו."}
              {deleteConfirm.type === "item" && ""}
            </p>
            <p className="text-sm font-semibold text-center mb-5" style={{ color: "#e9ecef" }}>
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
                style={{ background: "#ff6b6b", color: "#fff" }}
              >
                מחק
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-lg font-medium text-sm"
                style={{ background: "#2d3239", color: "#adb5bd" }}
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
          <div className="w-full max-w-lg p-6" style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold" style={{ color: "#e9ecef" }}>ייבא תפריט</h2>
              {!importing && (
                <button onClick={closeImportModal} style={{ color: "#6c757d", fontSize: 18, lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#e9ecef")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#6c757d")}>✕</button>
              )}
            </div>

            {/* Error */}
            {importError && (
              <div style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.3)", color: "#ff6b6b", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
                {importError}
              </div>
            )}

            {/* Done state */}
            {importDone !== null && !importing && (
              <div style={{ background: "rgba(81,207,102,0.1)", border: "1px solid rgba(81,207,102,0.3)", borderRadius: 12, padding: 16, textAlign: "center", marginBottom: 16 }}>
                <div className="text-2xl mb-1">✓</div>
                <div className="font-semibold" style={{ color: "#51cf66" }}>יובאו בהצלחה {importDone} פריטים</div>
              </div>
            )}

            {/* Progress */}
            {importProgress && importing && (
              <div className="mb-4 space-y-2">
                <div className="text-sm text-center" style={{ color: "#adb5bd" }}>
                  מייבא פריטים... ({importProgress.current}/{importProgress.total})
                </div>
                <div style={{ background: "#2d3239", borderRadius: 999, height: 8, overflow: "hidden" }}>
                  <div
                    className="transition-all duration-300"
                    style={{
                      height: 8,
                      borderRadius: 999,
                      width: importProgress.total > 0 ? `${(importProgress.current / importProgress.total) * 100}%` : "0%",
                      background: "#fcc419",
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
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#fcc419"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#3a3f47"; }}
              >
                <div className="text-3xl mb-2">📂</div>
                <div className="text-sm font-medium mb-1" style={{ color: "#adb5bd" }}>לחץ לבחירת קובץ JSON</div>
                <div className="text-xs" style={{ color: "#6c757d" }}>קובץ ייצוא תואם בפורמט Menu4U</div>
              </div>
            )}

            {/* Preview */}
            {importData && importDone === null && (
              <div className="mb-5 space-y-3">
                {(() => {
                  const { menuCount, categoryCount, itemCount } = getImportCounts(importData);
                  return (
                    <div style={{ background: "rgba(252,196,25,0.08)", border: "1px solid rgba(252,196,25,0.25)", borderRadius: 12, padding: 16 }}>
                      <div className="font-semibold mb-2" style={{ color: "#fcc419" }}>
                        {importData.restaurantName ? `מקור: ${importData.restaurantName}` : "תצוגה מקדימה"}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 8, padding: "8px 4px" }}>
                          <div className="text-xl font-bold" style={{ color: "#fcc419" }}>{menuCount}</div>
                          <div className="text-xs" style={{ color: "#6c757d" }}>תפריטים</div>
                        </div>
                        <div style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 8, padding: "8px 4px" }}>
                          <div className="text-xl font-bold" style={{ color: "#fcc419" }}>{categoryCount}</div>
                          <div className="text-xs" style={{ color: "#6c757d" }}>קטגוריות</div>
                        </div>
                        <div style={{ background: "#212529", border: "1px solid #2d3239", borderRadius: 8, padding: "8px 4px" }}>
                          <div className="text-xl font-bold" style={{ color: "#fcc419" }}>{itemCount}</div>
                          <div className="text-xs" style={{ color: "#6c757d" }}>פריטים</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {importData.menus.map((menu, mi) => (
                    <div key={mi} style={{ background: "#1a1d23", border: "1px solid #2d3239", borderRadius: 8, padding: "10px 14px", marginBottom: 6 }}>
                      <div className="font-medium" style={{ color: "#e9ecef" }}>{menu.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#6c757d" }}>
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
                  style={{ background: "#c9a84c", color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}
                >
                  סגור
                </button>
              ) : importData && !importing ? (
                <>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex-1 py-2.5 rounded-lg font-medium disabled:opacity-50"
                    style={{ background: "#c9a84c", color: "#fff", boxShadow: "0 2px 8px rgba(201,168,76,0.35)" }}
                  >
                    ייבא עכשיו
                  </button>
                  <button
                    onClick={closeImportModal}
                    className="flex-1 py-2.5 rounded-lg font-medium"
                    style={{ background: "#2d3239", color: "#adb5bd" }}
                  >
                    ביטול
                  </button>
                </>
              ) : !importing ? (
                <button
                  onClick={closeImportModal}
                  className="flex-1 py-2.5 rounded-lg font-medium"
                  style={{ background: "#2d3239", color: "#adb5bd" }}
                >
                  ביטול
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
