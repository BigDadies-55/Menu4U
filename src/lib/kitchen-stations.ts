import { prisma } from "@/lib/prisma";

/**
 * תחנות מטבח ("שיוך מנות") — ברירות מחדל פר-מסעדה.
 * BAR מדלג על המטבח (skipKitchen=true → autoReady), השאר עוברים דרך ה-KDS.
 */
export const DEFAULT_STATIONS: { code: string; label: string; skipKitchen: boolean }[] = [
  { code: "B", label: "BAR",    skipKitchen: true  },
  { code: "F", label: "FIRST",  skipKitchen: false },
  { code: "M", label: "MAIN",   skipKitchen: false },
  { code: "D", label: "Desert", skipKitchen: false },
];

/** וידוא קיום הטבלה/עמודה ב-runtime (כמו שאר הדפים שמשתמשים ב-ALTER גרייסי). */
export async function ensureKitchenSchema(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "KitchenStation" (
        "id" TEXT NOT NULL,
        "restaurantId" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "label" TEXT NOT NULL,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "skipKitchen" BOOLEAN NOT NULL DEFAULT false,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "KitchenStation_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "KitchenStation_restaurantId_code_key" ON "KitchenStation"("restaurantId", "code")`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "kitchenStationId" TEXT`);
  } catch {
    // table/column already exist — ignore
  }
}

/**
 * מבטיח שלמסעדה יש תחנות: אם אין — יוצר את 4 ברירות המחדל,
 * ומבצע backfill חד-פעמי לקטגוריות חסרות שיוך:
 * autoReady=true → BAR, אחרת → MAIN.
 */
export async function ensureStationsForRestaurant(restaurantId: string): Promise<void> {
  await ensureKitchenSchema();

  const existing = await prisma.kitchenStation.count({ where: { restaurantId } });
  if (existing === 0) {
    await prisma.kitchenStation.createMany({
      data: DEFAULT_STATIONS.map((s, i) => ({
        restaurantId,
        code: s.code,
        label: s.label,
        skipKitchen: s.skipKitchen,
        sortOrder: i,
      })),
      skipDuplicates: true,
    });
  }

  // Backfill: שיוך קטגוריות שעדיין ללא תחנה לפי autoReady הקיים
  const stations = await prisma.kitchenStation.findMany({
    where: { restaurantId },
    select: { id: true, code: true },
  });
  const bar  = stations.find(s => s.code === "B");
  const main = stations.find(s => s.code === "M");
  if (!bar && !main) return;

  // קטגוריות של המסעדה ללא שיוך
  const unassigned = await prisma.category.findMany({
    where: { kitchenStationId: null, menu: { restaurantId } },
    select: { id: true, autoReady: true },
  });
  for (const cat of unassigned) {
    const target = cat.autoReady ? bar : main;
    if (target) {
      await prisma.category.update({ where: { id: cat.id }, data: { kitchenStationId: target.id } });
    }
  }
}
