import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MenuPublicClient from "./MenuPublicClient";
import MenuElegantClient from "./MenuElegantClient";
import MenuExpired from "./MenuExpired";

export async function generateMetadata(
  { params }: { params: Promise<{ restaurantId: string }> }
): Promise<Metadata> {
  const { restaurantId } = await params;
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
  return { title: r?.name ?? "תפריט" };
}

function getOpenStatus(openingHours: string | null | undefined): { open: boolean; label: string } | null {
  if (!openingHours) return null;
  try {
    const data = JSON.parse(openingHours);
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const days = ["sun","mon","tue","wed","thu","fri","sat"];
    const todayKey = days[now.getDay()];
    const todayIso = now.toISOString().slice(0, 10);
    if (data.holidays?.some((h: { date: string }) => h.date === todayIso)) return { open: false, label: "סגור היום" };
    const hours = data[todayKey];
    if (!hours) return { open: false, label: "סגור היום" };
    const [oh, om] = hours.open.split(":").map(Number);
    const [ch, cm] = hours.close.split(":").map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    if (nowMins < oh * 60 + om) return { open: false, label: `נפתח ב-${hours.open}` };
    if (nowMins >= ch * 60 + cm) return { open: false, label: `נסגר ב-${hours.close}` };
    if (ch * 60 + cm - nowMins <= 30) return { open: true, label: `נסגר בעוד ${ch * 60 + cm - nowMins} דק׳` };
    return { open: true, label: `פתוח עד ${hours.close}` };
  } catch { return null; }
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

  // Ensure new columns exist (idempotent — safe to call every time)
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "splashImage" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "autoReady" BOOLEAN NOT NULL DEFAULT false`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "openingHours" TEXT`);
  } catch { /* ignore */ }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true },
    select: {
      id: true, name: true, logo: true, address: true,
      phone: true, orderPhone: true, website: true, locationUrl: true, menuTheme: true, menuPalette: true, menuPaletteData: true, ordersEnabled: true,
      language: true, welcomeText: true, splashImage: true,
      subscriptionFrom: true, subscriptionTo: true,
      instagram: true, facebook: true, whatsapp: true, tripadvisor: true, googleReview: true,
      showPhonePublic: true, showAddressPublic: true,
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

  const openingHours = (restaurant as typeof restaurant & { openingHours?: string | null }).openingHours ?? null;

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

  const effectiveTheme = previewTheme || (restaurant.menuTheme ?? "elegant");
  const effectivePalette = previewPalette || restaurant.menuPalette || '0';
  const effectivePaletteData = (previewPalette === 'custom' && previewAc && previewBg)
    ? JSON.stringify({ ac: previewAc, bg: previewBg })
    : restaurant.menuPaletteData;

  const restaurantData = {
    ...restaurant,
    menus: visibleMenus,
    menuTheme: effectiveTheme,
    menuPalette: effectivePalette,
    menuPaletteData: effectivePaletteData ?? null,
    openingHours: (restaurant as typeof restaurant & { openingHours?: string | null }).openingHours ?? null,
  };

  const openStatus = getOpenStatus(openingHours);

  if (effectiveTheme === "elegant") {
    return <MenuElegantClient restaurant={restaurantData} tableNumber={sp.table || null} openStatus={openStatus} />;
  }

  return <MenuPublicClient restaurant={restaurantData} tableNumber={sp.table || null} openStatus={openStatus} />;
}
