import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MenuPublicClient from "./MenuPublicClient";

export async function generateMetadata(
  { params }: { params: Promise<{ restaurantId: string }> }
): Promise<Metadata> {
  const { restaurantId } = await params;
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
  return { title: r?.name ?? "תפריט" };
}

function isMenuScheduledNow(menu: {
  scheduleDays: string[];
  scheduleFrom: string | null;
  scheduleTo: string | null;
}): boolean {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
  const day = String(now.getDay()); // 0=Sun … 6=Sat

  if (menu.scheduleDays.length > 0 && !menu.scheduleDays.includes(day)) return false;

  if (menu.scheduleFrom && menu.scheduleTo) {
    const hhmm = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const cur = now.getHours() * 60 + now.getMinutes();
    if (cur < hhmm(menu.scheduleFrom) || cur > hhmm(menu.scheduleTo)) return false;
  }

  return true;
}

export default async function PublicMenuPage(
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true },
    select: {
      id: true, name: true, logo: true, address: true,
      phone: true, orderPhone: true, website: true, locationUrl: true,
      menus: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, isPrimary: true, scheduleDays: true, scheduleFrom: true, scheduleTo: true,
          categories: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true, name: true, image: true,
              items: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: {
                  id: true, name: true, description: true, price: true, image: true,
                  isVegetarian: true, isVegan: true, isGlutenFree: true, tags: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!restaurant) notFound();

  // 1. If any menu is marked primary → show only primary menus
  const hasPrimary = restaurant.menus.some(m => m.isPrimary);
  let visibleMenus = hasPrimary ? restaurant.menus.filter(m => m.isPrimary) : restaurant.menus;

  // 2. Filter by current day/time schedule
  visibleMenus = visibleMenus.filter(isMenuScheduledNow);

  return <MenuPublicClient restaurant={{ ...restaurant, menus: visibleMenus }} />;
}
