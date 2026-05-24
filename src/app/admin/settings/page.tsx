import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role   = session.user.role;
  const userId = session.user.id;

  // Fetch restaurants — fallback gracefully if new columns don't exist yet
  let restaurants: {
    id: string; name: string; logo: string | null; menuTheme: string;
    menuPalette: string; customDomain: string | null; copyright: string | null;
  }[] = [];

  let needsMigration = false;

  try {
    const where = role === "SUPER_ADMIN"
      ? {}
      : {
          id: {
            in: (await prisma.restaurantUser.findMany({
              where: { userId },
              select: { restaurantId: true },
            })).map(l => l.restaurantId),
          },
        };

    restaurants = await prisma.restaurant.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, logo: true, menuTheme: true,
        menuPalette: true, customDomain: true, copyright: true,
      },
    });
  } catch {
    // New columns don't exist yet — fetch without them
    needsMigration = true;
    try {
      const where = role === "SUPER_ADMIN"
        ? {}
        : {
            id: {
              in: (await prisma.restaurantUser.findMany({
                where: { userId },
                select: { restaurantId: true },
              })).map(l => l.restaurantId),
            },
          };

      const rows = await prisma.restaurant.findMany({
        where,
        orderBy: { name: "asc" },
        select: { id: true, name: true, logo: true, menuTheme: true, menuPalette: true },
      });
      restaurants = rows.map(r => ({ ...r, customDomain: null, copyright: null }));
    } catch {
      restaurants = [];
    }
  }

  if (restaurants.length === 0) {
    return <div className="p-8 text-center text-gray-500">אין מסעדות לניהול</div>;
  }

  return (
    <>
      {needsMigration && (
        <div className="mx-4 mt-4 md:mx-8 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <span>⚠️</span>
          <span className="text-sm text-amber-800">
            שדות חדשים עדיין לא נוצרו במסד הנתונים.{" "}
            <a href="/api/migrate" className="font-semibold underline hover:no-underline">
              לחץ כאן להרצת המיגרציה
            </a>
            {" "}ולאחר מכן רענן את הדף.
          </span>
        </div>
      )}
      <SettingsClient restaurants={restaurants} isSuperAdmin={role === "SUPER_ADMIN"} />
    </>
  );
}
