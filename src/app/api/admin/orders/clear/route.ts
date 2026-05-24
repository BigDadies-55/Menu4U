import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function DELETE() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Delete in dependency order (CASCADE handles children but let's be explicit)
    const modifiers = await prisma.orderItemModifier.deleteMany({});
    const items     = await prisma.orderItem.deleteMany({});
    const logs      = await prisma.orderStatusLog.deleteMany({});
    const orders    = await prisma.order.deleteMany({});
    const views     = await prisma.menuView.deleteMany({});

    await logAudit({ action: "CLEAR_ALL_ORDERS", entity: "Order" });

    return NextResponse.json({
      success: true,
      deleted: {
        orders:    orders.count,
        items:     items.count,
        modifiers: modifiers.count,
        logs:      logs.count,
        menuViews: views.count,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
