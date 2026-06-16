import { prisma } from "@/lib/prisma";

type ModuleRow = { isEnabled: boolean; enabledFrom: Date | null; enabledTo: Date | null };

export async function isModuleEnabled(restaurantId: string, moduleKey: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<ModuleRow[]>(
    `SELECT "isEnabled", "enabledFrom", "enabledTo" FROM "RestaurantModule"
     WHERE "moduleKey" = $1
       AND ("restaurantId" = $2 OR "restaurantId" IS NULL)
     ORDER BY ("restaurantId" IS NOT NULL) DESC
     LIMIT 1`,
    moduleKey, restaurantId
  ).catch(() => [] as ModuleRow[]);

  if (rows.length === 0) return true; // not configured = enabled by default

  const row = rows[0];
  if (!row.isEnabled) return false;

  const now = new Date();
  if (row.enabledFrom && now < row.enabledFrom) return false;
  if (row.enabledTo   && now > row.enabledTo)   return false;

  return true;
}
