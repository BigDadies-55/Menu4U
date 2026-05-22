import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MenuPublicClient from "./MenuPublicClient";
import MenuExpired from "./MenuExpired";

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
  { params, searchParams }: {
    params: Promise<{ restaurantId: string }>;
    searchParams: Promise<Record<string, string>>;
  }
) {
  const { restaurantId } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true },
    select: {
      id: true, name: true, logo: true, address: true,
      phone: true, orderPhone: true, website: true, locationUrl: true, menuTheme: true, menuPalette: true, menuPaletteData: true, ordersEnabled: true,
      subscriptionFrom: true, subscriptionTo: true,
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
                  isVegetarian: true, isVegan: true, isGlutenFree: true, tags: true, prepTime: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!restaurant) notFound();

  // Subscription check
  const now = new Date();
  if (restaurant.subscriptionFrom && now < restaurant.subscriptionFrom) {
    return <MenuExpired name={restaurant.name} logo={restaurant.logo} reason="not_started" />;
  }
  if (restaurant.subscriptionTo && now > restaurant.subscriptionTo) {
    return <MenuExpired name={restaurant.name} logo={restaurant.logo} reason="expired" />;
  }

  // 1. If any menu is marked primary → show only primary menus
  const hasPrimary = restaurant.menus.some(m => m.isPrimary);
  let visibleMenus = hasPrimary ? restaurant.menus.filter(m => m.isPrimary) : restaurant.menus;

  // 2. Filter by current day/time schedule
  visibleMenus = visibleMenus.filter(isMenuScheduledNow);

  const sp = await searchParams;
  const previewTheme = sp.previewTheme;
  const previewPalette = sp.previewPalette;
  const previewAc = sp.previewAc;
  const previewBg = sp.previewBg;

  const effectiveTheme = previewTheme || restaurant.menuTheme;
  const effectivePalette = previewPalette || restaurant.menuPalette || '0';
  const effectivePaletteData = (previewPalette === 'custom' && previewAc && previewBg)
    ? JSON.stringify({ ac: previewAc, bg: previewBg })
    : restaurant.menuPaletteData;

  return <MenuPublicClient
    restaurant={{
      ...restaurant,
      menus: visibleMenus,
      menuTheme: effectiveTheme,
      menuPalette: effectivePalette,
      menuPaletteData: effectivePaletteData ?? null,
    }}
    tableNumber={sp.table || null}
  />;
}
