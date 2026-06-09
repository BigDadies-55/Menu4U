import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AppearanceClient from "./AppearanceClient";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

export default async function AppearancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as string;
  if (!ALLOWED_ROLES.includes(role)) redirect("/admin");

  type RestaurantRow = { id: string; name: string; adminPalette: string };
  let restaurants: RestaurantRow[] = [];

  try {
    if (role === "SUPER_ADMIN" || role === "ADMIN") {
      const rows = await prisma.$queryRaw<{ id: string; name: string; adminPalette: string | null }[]>`
        SELECT id, name, COALESCE("adminPalette", 'dark') AS "adminPalette"
        FROM "Restaurant" ORDER BY name ASC
      `;
      restaurants = rows.map(r => ({ ...r, adminPalette: r.adminPalette ?? "dark" }));
    } else {
      const rows = await prisma.$queryRaw<{ id: string; name: string; adminPalette: string | null }[]>`
        SELECT r.id, r.name, COALESCE(r."adminPalette", 'dark') AS "adminPalette"
        FROM "Restaurant" r
        INNER JOIN "RestaurantUser" ru ON ru."restaurantId" = r.id
        WHERE ru."userId" = ${session.user.id}
        ORDER BY r.name ASC
      `;
      restaurants = rows.map(r => ({ ...r, adminPalette: r.adminPalette ?? "dark" }));
    }
  } catch {
    // Column may not exist yet — load restaurant list without palette
    try {
      if (role === "SUPER_ADMIN" || role === "ADMIN") {
        const rows = await prisma.$queryRaw<{ id: string; name: string }[]>`
          SELECT id, name FROM "Restaurant" ORDER BY name ASC
        `;
        restaurants = rows.map(r => ({ ...r, adminPalette: "dark" }));
      } else {
        const rows = await prisma.$queryRaw<{ id: string; name: string }[]>`
          SELECT r.id, r.name
          FROM "Restaurant" r
          INNER JOIN "RestaurantUser" ru ON ru."restaurantId" = r.id
          WHERE ru."userId" = ${session.user.id}
          ORDER BY r.name ASC
        `;
        restaurants = rows.map(r => ({ ...r, adminPalette: "dark" }));
      }
    } catch {
      // DB completely unavailable
    }
  }

  if (restaurants.length === 0) redirect("/admin");

  return <AppearanceClient restaurants={restaurants} canSave />;
}
