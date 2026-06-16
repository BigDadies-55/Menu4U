import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logAudit, getIp } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const {
    name, email, phone, phone2, orderPhone, address, locationUrl,
    isActive, ordersEnabled, menuTheme, menuPalette, menuPaletteData,
    kdsView, tableLayoutJson, groupId,
    subscriptionFrom, subscriptionTo,
    logo, description, website, language, welcomeText, splashImage, waiterBg, waiterBgOpacity, waiterScreen,
    instagram, facebook, whatsapp, tripadvisor, googleReview,
    showPhonePublic, showAddressPublic, openingHours,
  } = body;
  // waiterBg / waiterBgOpacity / waiterScreen / openingHours are extra columns — save via raw SQL
  if (waiterScreen !== undefined) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterScreen" INTEGER`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `UPDATE "Restaurant" SET "waiterScreen" = $1 WHERE id = $2`,
      waiterScreen ?? null, id
    );
  }
  if (waiterBg !== undefined) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterBg" TEXT`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `UPDATE "Restaurant" SET "waiterBg" = $1 WHERE id = $2`,
      waiterBg ?? null, id
    );
  }
  if (waiterBgOpacity !== undefined) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "waiterBgOpacity" DOUBLE PRECISION`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `UPDATE "Restaurant" SET "waiterBgOpacity" = $1 WHERE id = $2`,
      waiterBgOpacity ?? null, id
    );
  }
  if (openingHours !== undefined) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "openingHours" TEXT`
    ).catch(() => {});
    await prisma.$executeRawUnsafe(
      `UPDATE "Restaurant" SET "openingHours" = $1 WHERE id = $2`,
      openingHours ?? null, id
    );
  }
  const data = Object.fromEntries(
    Object.entries({ name, email, phone, phone2, orderPhone, address, locationUrl,
      isActive, ordersEnabled, menuTheme, menuPalette, menuPaletteData,
      kdsView, tableLayoutJson, groupId, subscriptionFrom, subscriptionTo,
      logo, description, website, language, welcomeText, splashImage,
      instagram, facebook, whatsapp, tripadvisor, googleReview,
      showPhonePublic, showAddressPublic })
    .filter(([, v]) => v !== undefined)
  );
  const restaurant = await prisma.restaurant.update({ where: { id }, data });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "UPDATE_RESTAURANT", entity: "restaurant", entityId: id, entityName: restaurant.name, meta: { changed: Object.keys(body) }, ip: getIp(req) });
  return NextResponse.json(restaurant);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { id }, select: { name: true } });
  await prisma.restaurant.delete({ where: { id } });
  await logAudit({ userId: session.user.id, userEmail: session.user.email, action: "DELETE_RESTAURANT", entity: "restaurant", entityId: id, entityName: restaurant?.name, ip: getIp(req) });
  return NextResponse.json({ success: true });
}
