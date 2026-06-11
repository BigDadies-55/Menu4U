import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Allergen keys: GLUTEN MILK EGGS FISH PEANUTS SOYBEANS NUTS SESAME CRUSTACEANS MOLLUSCS CELERY MUSTARD SULPHITES LUPIN

const RULES: Array<{ match: RegExp; allergens: string[] }> = [
  // ── Gluten (wheat/pasta/bread/flour) ──
  { match: /פסט|ספגט|פטוצ|לזנ|ריזוט|רביול|ניוק|פנה|פרפל|קנלוני|מקרוני|גנוצ|טורטל|פקטון|קפלט|פנות|פנצ|אורזו|פאפרד|טליאטל|אינ?גלנ|פיצ|ברוסק|לחם|פיתה|קרקר|בצק|עוגיות|עוגה|תרד|פנקייק|וופל|שטרודל|קנאפה|בסבוס|קטאיף|חלה|באגל|ציאבטה|פוקצ'ה|גריסיני|קרוטון|פנקו|קמח|סמולינה|שניצל|קוביה|בירה|חצות|קרמבו|קרואסון|מאפ|פאי|טארט|קיש|בלינצ|סופגניה|רוגל|בורקס|סמבוסק|פינג׳ן|לפה|עראיס|קובה|מוצרלה בלחם|פוקצ/i, allergens: ["GLUTEN"] },

  // ── Milk (dairy) ──
  { match: /גבינ|גרנה|פרמז|מוצרל|ריקוט|מסקרפ|ברי|ממנצ'ג|רוקפור|קממבר|גורגונזול|ב?שמל|ב?שמ?ל|קרם|חמאה|שמנת|מחית גבינ|רביול|ניוק|אלפרד|קרבונר|ארבע גבינ|ארבעה גבינ|פיצ|לזנ|פטוצ|ריזוט|גראטן|פונד|עוגה|גלידה|טירמיסו|פנה קוטה|קרם ברולה|קפוצ'ינו|לאטה|מוקה|שוקולד חלב|בצק עלים|קרואסון|מאפינס|עוגיות|טארט|קיש|יוגורט|לאבנה|בולגרית|קוטג|צ'לסי|קפרז|סלט קפרז/i, allergens: ["MILK"] },

  // ── Eggs ──
  { match: /ביצ|מיונז|אמולזי|קרבונר|אייולי|קרם פטיסייר|קרמבו|עוגה|מאפינס|עוגיות|קיש|טארט|בלינצ|פנקייק|שניצל|פנקו|רביול|לזנ|פסטה ביתית|מקרון|ספוג|מרנג|קרמל|קלאפוטי|פרנץ טוסט|אגוצי|אמלט|חביתה|חביתית|שקשוקה|ביצה עלומה|ביצה קשה|ביצה רכה|ביצה מקושקשת/i, allergens: ["EGGS"] },

  // ── Fish ──
  { match: /סלמון|טונה|בס|לברק|דניס|מוסר|בורי|קרפיון|הליבוט|דג|פילה|אנשובי|סרדינ|מרלוז|ברנזינ|גלט|אמנון|מוסר ים|פסקדו/i, allergens: ["FISH"] },

  // ── Crustaceans ──
  { match: /שרימפס|שרימפ|לובסטר|סרטן|קרב|קרבטים|אצבעות ים|פירות ים|מאכלי ים/i, allergens: ["CRUSTACEANS"] },

  // ── Molluscs ──
  { match: /תמנון|קלמרי|דיונון|שבלול|צדפה|מולים|ציפורי ים|פירות ים|מאכלי ים|לינגוויני ים|לינגוויני פירות/i, allergens: ["MOLLUSCS"] },

  // ── Sesame ──
  { match: /טחינ|חומוס|פלאפל|שומשום|בגל|ברגר|שוארמה|סביח|ג'חנון|מלאווח|קוסקוס|סמבוסק/i, allergens: ["SESAME"] },

  // ── Nuts ──
  { match: /אגוז|אגוזי|פקאן|שקד|קשיו|פיסטוק|מקדמיה|ברזיל|פרלינה|נוגט|מרציפן|טחינ|בקלווה|קנאפה|קטאיף|פסטו|גרמולטה|חלבה|רוקה ואגוז|טרטופו/i, allergens: ["NUTS"] },

  // ── Peanuts ──
  { match: /בוטנ|ממרח בוטנ|סטי|סאטה|פאד תאי|ווק|אסיאתי|תאילנד/i, allergens: ["PEANUTS"] },

  // ── Celery ──
  { match: /סלרי|מרק ירקות|מרק עוף|בולונז|סטאקו|מינסטרונה|ראגו/i, allergens: ["CELERY"] },

  // ── Mustard ──
  { match: /מוסטרד|חרדל|ביף בורגיניון|ויניגרט|דיז'ון|מרינד/i, allergens: ["MUSTARD"] },

  // ── Sulphites ──
  { match: /יין|צימוקים|חומץ יין|גסטריק|ברי יין|קוניאק|ברנדי|מרסלה|בורגון|שמפניה/i, allergens: ["SULPHITES"] },

  // ── Soy ──
  { match: /סויה|טופו|טמפה|מיסו|אדממה|טריאקי|טרי?אקי|סויה|מוקפץ|ווק/i, allergens: ["SOYBEANS"] },

  // ── Lupin ──
  { match: /לופין|קמח לופין/i, allergens: ["LUPIN"] },
];

function inferAllergens(name: string, existing: string[]): string[] {
  if (existing.length > 0) return existing; // already set — don't overwrite
  const set = new Set<string>();
  for (const rule of RULES) {
    if (rule.match.test(name)) {
      rule.allergens.forEach(a => set.add(a));
    }
  }
  return Array.from(set);
}

// Combo fixes — specific dish names with known allergen combinations
const EXACT: Record<string, string[]> = {
  // Pastas
  "ספגטי בולונז":     ["GLUTEN", "MILK", "EGGS", "CELERY"],
  "לזניה בולונז":     ["GLUTEN", "MILK", "EGGS", "CELERY"],
  "פסטה קרבונרה":     ["GLUTEN", "MILK", "EGGS"],
  "פטוצ'יני אלפרדו":  ["GLUTEN", "MILK", "EGGS"],
  "רביולי ריקוטה":    ["GLUTEN", "MILK", "EGGS"],
  "ניוקי ברוטב":      ["GLUTEN", "MILK", "EGGS"],
  "ניוקי ברוטב גורגונזולה": ["GLUTEN", "MILK", "EGGS"],
  "לינגוויני פירות ים": ["GLUTEN", "MOLLUSCS", "CRUSTACEANS"],
  "ריזוטו פטריות":    ["MILK"],
  "ריזוטו":           ["MILK"],
  // Pizzas
  "פיצה מרגריטה":    ["GLUTEN", "MILK"],
  "פיצה דיאבולו":    ["GLUTEN", "MILK"],
  "פיצה קוורטרו פורמאג'": ["GLUTEN", "MILK"],
  // Mains
  "סקלופיני מרסלה":  ["GLUTEN", "MILK", "EGGS", "SULPHITES"],
  "סלמון אל פורנו":  ["FISH", "MILK"],
  "סטייק פיורנטינה": ["SULPHITES"],
  "אוסובוקו":        ["GLUTEN", "MILK", "CELERY", "SULPHITES"],
  "פרמיג'אנה חצילים": ["GLUTEN", "MILK", "EGGS"],
  // Starters
  "ברוסקטה":         ["GLUTEN"],
  "קפרז":            ["MILK"],
  "סלט קפרז":        ["MILK"],
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId } = await req.json();

  const items = await prisma.item.findMany({
    where: restaurantId ? { category: { menu: { restaurantId } } } : {},
    select: { id: true, name: true, allergens: true },
  });

  let updated = 0;
  const results: { name: string; allergens: string[] }[] = [];

  for (const item of items) {
    // Exact match first, then regex inference
    const exactKey = Object.keys(EXACT).find(k =>
      item.name.includes(k) || k.includes(item.name)
    );
    const newAllergens = exactKey
      ? EXACT[exactKey]
      : inferAllergens(item.name, item.allergens);

    if (newAllergens.length > 0 &&
        JSON.stringify([...newAllergens].sort()) !== JSON.stringify([...item.allergens].sort())) {
      await prisma.item.update({ where: { id: item.id }, data: { allergens: newAllergens } });
      results.push({ name: item.name, allergens: newAllergens });
      updated++;
    }
  }

  return NextResponse.json({ updated, results });
}
