import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/generated/prisma/enums";

/* ─── Types ──────────────────────────────────────────────── */
interface BackupMeta {
  version: number;
  exportedAt: string;
  exportedBy: string;
  restaurantIds: string[];
  counts: Record<string, number>;
}
interface BackupRestaurant     { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null; description?: string | null; [k: string]: unknown }
interface BackupUser           { id: string; email: string; name?: string | null; role?: string; createdAt?: string; [k: string]: unknown }
interface BackupRestaurantUser { id: string; userId: string; restaurantId: string; role?: string; createdAt?: string; [k: string]: unknown }
interface BackupMenu           { id: string; name: string; restaurantId: string; isActive?: boolean; isPrimary?: boolean; sortOrder?: number; [k: string]: unknown }
interface BackupCategory       { id: string; name: string; menuId: string; sortOrder?: number; isActive?: boolean; [k: string]: unknown }
interface BackupItem           { id: string; name: string; categoryId: string; price: number; description?: string | null; isActive?: boolean; prepTime?: number | null; sortOrder?: number; [k: string]: unknown }
interface BackupModifierGroup  { id: string; name: string; itemId: string; minSelect?: number; maxSelect?: number; required?: boolean; isRequired?: boolean; [k: string]: unknown }
interface BackupModifier       { id: string; name?: string; label?: string; groupId: string; price?: number; priceAdd?: number; isDefault?: boolean; isActive?: boolean; [k: string]: unknown }
interface BackupOrder          { id: string; restaurantId: string; tableNumber?: string | null; customerName?: string | null; customerPhone?: string | null; status: string; orderNumber?: number | null; totalAmount?: number; notes?: string | null; coversCount?: number | null; orderSource?: string | null; loyaltyMemberId?: string | null; loyaltyMemberName?: string | null; loyaltyDiscountType?: string | null; loyaltyDiscountAmount?: number | null; loyaltyCouponId?: string | null; createdAt?: string; updatedAt?: string; [k: string]: unknown }
interface BackupOrderItem      { id: string; orderId: string; itemId?: string | null; quantity: number; price: number; notes?: string | null; itemStatus?: string; course?: number | null; [k: string]: unknown }
interface BackupOrderItemMod   { id: string; orderItemId: string; groupName?: string; label?: string; priceAdd?: number; [k: string]: unknown }
interface BackupOrderStatusLog { id: string; orderId: string; fromStatus?: string; toStatus: string; changedAt?: string; changedBy?: string | null; [k: string]: unknown }
interface BackupCustomer       { id: string; restaurantId: string; name: string; phone?: string | null; email?: string | null; notes?: string | null; createdAt?: string; [k: string]: unknown }
interface BackupTableSession   { id: string; restaurantId: string; tableNumber: string; openedAt?: string; closedAt?: string | null; totalAmount?: number; orderCount?: number; [k: string]: unknown }
interface BackupLoyaltySettings { restaurantId: string; pointsPerShekel?: number; shekelPerPoint?: number; minRedeemPoints?: number; welcomeBonus?: number; birthdayBonus?: number; isActive?: boolean; [k: string]: unknown }
interface BackupLoyaltyMember  { id: string; restaurantId: string; phone: string; name: string; email?: string | null; birthDate?: string | null; memberNumber: string; points?: number; totalSpent?: number; groupId?: string | null; createdAt?: string; [k: string]: unknown }
interface BackupLoyaltyTx      { id: string; memberId: string; orderId?: string | null; type: string; points: number; note?: string | null; createdAt?: string; [k: string]: unknown }
interface BackupLoyaltyCoupon  { id: string; memberId: string; restaurantId: string; code: string; type: string; value: number; description?: string | null; usedAt?: string | null; expiresAt?: string | null; validForGroupId?: string | null; usedAtRestaurantId?: string | null; createdAt?: string; [k: string]: unknown }
interface BackupOrderCounter   { restaurantId: string; counter: number; [k: string]: unknown }

interface BackupJSON {
  _meta: BackupMeta;
  restaurants?: BackupRestaurant[];
  users?: BackupUser[];
  restaurantUsers?: BackupRestaurantUser[];
  menus?: BackupMenu[];
  categories?: BackupCategory[];
  items?: BackupItem[];
  modifierGroups?: BackupModifierGroup[];
  modifiers?: BackupModifier[];
  orders?: BackupOrder[];
  orderItems?: BackupOrderItem[];
  orderItemModifiers?: BackupOrderItemMod[];
  orderStatusLogs?: BackupOrderStatusLog[];
  customers?: BackupCustomer[];
  tableSessions?: BackupTableSession[];
  loyaltySettings?: BackupLoyaltySettings[];
  loyaltyMembers?: BackupLoyaltyMember[];
  loyaltyTransactions?: BackupLoyaltyTx[];
  loyaltyCoupons?: BackupLoyaltyCoupon[];
  orderCounters?: BackupOrderCounter[];
  [k: string]: unknown;
}

type FieldChange = { field: string; from: string; to: string };
type DiffEntry   = { type: string; name: string; action: "create" | "update"; changes?: FieldChange[] };

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "כן" : "לא";
  return String(v);
}
function changed(a: unknown, b: unknown) { return fmt(a) !== fmt(b); }

/* ─── Main handler ───────────────────────────────────────── */
export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { backup: BackupJSON; scope: string; mode?: "preview" | "restore" };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const { backup, scope, mode = "restore" } = body;

  if (!backup?._meta?.version) {
    return NextResponse.json({ error: "Invalid backup: missing _meta.version" }, { status: 400 });
  }
  if (scope !== "menus" && scope !== "full") {
    return NextResponse.json({ error: `Unsupported scope: ${scope}` }, { status: 400 });
  }

  /* ══════════════════════════════════════════
     PREVIEW MODE — return diff without writing
  ══════════════════════════════════════════ */
  if (mode === "preview") {
    const entries: DiffEntry[] = [];

    // Restaurants
    for (const r of backup.restaurants ?? []) {
      const ex = await prisma.restaurant.findUnique({ where: { id: r.id }, select: { name: true, email: true, phone: true, address: true } });
      if (!ex) {
        entries.push({ type: "restaurant", name: r.name, action: "create" });
      } else {
        const fc: FieldChange[] = [];
        if (changed(ex.name,    r.name))    fc.push({ field: "שם",     from: fmt(ex.name),    to: fmt(r.name) });
        if (changed(ex.email,   r.email))   fc.push({ field: "אימייל", from: fmt(ex.email),   to: fmt(r.email) });
        if (changed(ex.phone,   r.phone))   fc.push({ field: "טלפון",  from: fmt(ex.phone),   to: fmt(r.phone) });
        if (changed(ex.address, r.address)) fc.push({ field: "כתובת",  from: fmt(ex.address), to: fmt(r.address) });
        if (fc.length) entries.push({ type: "restaurant", name: r.name, action: "update", changes: fc });
      }
    }

    // Menus
    for (const m of backup.menus ?? []) {
      const ex = await prisma.menu.findUnique({ where: { id: m.id }, select: { name: true, isActive: true } });
      if (!ex) {
        entries.push({ type: "menu", name: m.name, action: "create" });
      } else {
        const fc: FieldChange[] = [];
        if (changed(ex.name,     m.name))     fc.push({ field: "שם",   from: fmt(ex.name),     to: fmt(m.name) });
        if (changed(ex.isActive, m.isActive)) fc.push({ field: "פעיל", from: fmt(ex.isActive), to: fmt(m.isActive) });
        if (fc.length) entries.push({ type: "menu", name: m.name, action: "update", changes: fc });
      }
    }

    // Categories
    for (const c of backup.categories ?? []) {
      const ex = await prisma.category.findUnique({ where: { id: c.id }, select: { name: true, isActive: true, sortOrder: true } });
      if (!ex) {
        entries.push({ type: "category", name: c.name, action: "create" });
      } else {
        const fc: FieldChange[] = [];
        if (changed(ex.name,      c.name))      fc.push({ field: "שם",   from: fmt(ex.name),      to: fmt(c.name) });
        if (changed(ex.isActive,  c.isActive))  fc.push({ field: "פעיל", from: fmt(ex.isActive),  to: fmt(c.isActive) });
        if (changed(ex.sortOrder, c.sortOrder)) fc.push({ field: "סדר",  from: fmt(ex.sortOrder), to: fmt(c.sortOrder) });
        if (fc.length) entries.push({ type: "category", name: c.name, action: "update", changes: fc });
      }
    }

    // Items
    for (const item of backup.items ?? []) {
      const ex = await prisma.item.findUnique({ where: { id: item.id }, select: { name: true, price: true, isActive: true, prepTime: true } });
      if (!ex) {
        entries.push({ type: "item", name: item.name, action: "create" });
      } else {
        const fc: FieldChange[] = [];
        if (changed(ex.name,     item.name))     fc.push({ field: "שם",       from: fmt(ex.name),     to: fmt(item.name) });
        if (changed(ex.price,    item.price))    fc.push({ field: "מחיר",     from: `₪${ex.price}`,   to: `₪${item.price}` });
        if (changed(ex.isActive, item.isActive)) fc.push({ field: "פעיל",     from: fmt(ex.isActive), to: fmt(item.isActive) });
        if (changed(ex.prepTime, item.prepTime)) fc.push({ field: "זמן הכנה", from: fmt(ex.prepTime), to: fmt(item.prepTime) });
        if (fc.length) entries.push({ type: "item", name: item.name, action: "update", changes: fc });
      }
    }

    // ModifierGroups
    for (const g of backup.modifierGroups ?? []) {
      const ex = await prisma.itemModifierGroup.findUnique({ where: { id: g.id }, select: { name: true, maxSelect: true, required: true } });
      if (!ex) {
        entries.push({ type: "modifierGroup", name: g.name, action: "create" });
      } else {
        const isRequired = g.isRequired ?? g.required ?? false;
        const fc: FieldChange[] = [];
        if (changed(ex.name,      g.name))      fc.push({ field: "שם",      from: fmt(ex.name),      to: fmt(g.name) });
        if (changed(ex.maxSelect, g.maxSelect)) fc.push({ field: "מקסימום", from: fmt(ex.maxSelect), to: fmt(g.maxSelect) });
        if (changed(ex.required,  isRequired))  fc.push({ field: "חובה",    from: fmt(ex.required),  to: fmt(isRequired) });
        if (fc.length) entries.push({ type: "modifierGroup", name: g.name, action: "update", changes: fc });
      }
    }

    // Modifiers
    for (const mod of backup.modifiers ?? []) {
      const label    = mod.label ?? mod.name ?? "";
      const priceAdd = mod.priceAdd ?? mod.price ?? 0;
      const ex = await prisma.itemModifier.findUnique({ where: { id: mod.id }, select: { label: true, priceAdd: true } });
      if (!ex) {
        entries.push({ type: "modifier", name: label, action: "create" });
      } else {
        const fc: FieldChange[] = [];
        if (changed(ex.label,    label))    fc.push({ field: "שם",    from: fmt(ex.label),     to: fmt(label) });
        if (changed(ex.priceAdd, priceAdd)) fc.push({ field: "תוספת", from: `₪${ex.priceAdd}`, to: `₪${priceAdd}` });
        if (fc.length) entries.push({ type: "modifier", name: label, action: "update", changes: fc });
      }
    }

    if (scope === "full") {
      // Customers
      const existingCustomers = await prisma.customer.count({ where: { restaurantId: { in: backup._meta.restaurantIds } } });
      const bkpCustomers = backup.customers?.length ?? 0;
      if (bkpCustomers > existingCustomers) entries.push({ type: "customers", name: `לקוחות (${bkpCustomers - existingCustomers} חדשים)`, action: "create" });

      // Loyalty
      const existingMembers = await prisma.loyaltyMember.count({ where: { restaurantId: { in: backup._meta.restaurantIds } } });
      const bkpMembers = backup.loyaltyMembers?.length ?? 0;
      if (bkpMembers > existingMembers) entries.push({ type: "loyaltyMembers", name: `חברי נאמנות (${bkpMembers - existingMembers} חדשים)`, action: "create" });

      // Orders
      const existingOrders = await prisma.order.count({ where: { restaurantId: { in: backup._meta.restaurantIds } } });
      const bkpOrders = backup.orders?.length ?? 0;
      if (bkpOrders > existingOrders) entries.push({ type: "orders", name: `הזמנות (${bkpOrders - existingOrders} חדשות)`, action: "create" });
    }

    const toCreate  = entries.filter(e => e.action === "create").length;
    const toUpdate  = entries.filter(e => e.action === "update").length;
    const totalBkp  = (backup.restaurants?.length ?? 0) + (backup.menus?.length ?? 0) +
                      (backup.categories?.length ?? 0) + (backup.items?.length ?? 0) +
                      (backup.modifierGroups?.length ?? 0) + (backup.modifiers?.length ?? 0) +
                      (scope === "full" ? (backup.customers?.length ?? 0) + (backup.loyaltyMembers?.length ?? 0) + (backup.orders?.length ?? 0) : 0);
    const noChange  = Math.max(0, totalBkp - toCreate - toUpdate);

    return NextResponse.json({ mode: "preview", toCreate, toUpdate, noChange, entries });
  }

  /* ══════════════════════════════════════════
     RESTORE MODE — write changes to DB
  ══════════════════════════════════════════ */
  try {
    let created = 0, updated = 0;

    // ── Phase 1: structural data (menus, restaurants, loyalty settings) ──
    await prisma.$transaction(async (tx) => {
      // Restaurants
      for (const r of backup.restaurants ?? []) {
        const ex = await tx.restaurant.findUnique({ where: { id: r.id }, select: { id: true } });
        await tx.restaurant.upsert({
          where:  { id: r.id },
          create: { id: r.id, name: r.name, email: r.email ?? null, phone: r.phone ?? null, address: r.address ?? null, description: r.description ?? null },
          update: {            name: r.name, email: r.email ?? null, phone: r.phone ?? null, address: r.address ?? null, description: r.description ?? null },
        });
        ex ? updated++ : created++;
      }
      // Menus
      for (const m of backup.menus ?? []) {
        const ex = await tx.menu.findUnique({ where: { id: m.id }, select: { id: true } });
        await tx.menu.upsert({
          where:  { id: m.id },
          create: { id: m.id, name: m.name, restaurantId: m.restaurantId, isActive: m.isActive ?? true, sortOrder: m.sortOrder ?? 0 },
          update: {            name: m.name, restaurantId: m.restaurantId, isActive: m.isActive ?? true, sortOrder: m.sortOrder ?? 0 },
        });
        ex ? updated++ : created++;
      }
      // Categories
      for (const c of backup.categories ?? []) {
        const ex = await tx.category.findUnique({ where: { id: c.id }, select: { id: true } });
        await tx.category.upsert({
          where:  { id: c.id },
          create: { id: c.id, name: c.name, menuId: c.menuId, sortOrder: c.sortOrder ?? 0, isActive: c.isActive ?? true },
          update: {            name: c.name, menuId: c.menuId, sortOrder: c.sortOrder ?? 0, isActive: c.isActive ?? true },
        });
        ex ? updated++ : created++;
      }
      // Items
      for (const item of backup.items ?? []) {
        const ex = await tx.item.findUnique({ where: { id: item.id }, select: { id: true } });
        await tx.item.upsert({
          where:  { id: item.id },
          create: { id: item.id, name: item.name, categoryId: item.categoryId, price: item.price, description: item.description ?? null, isActive: item.isActive ?? true, prepTime: item.prepTime ?? null, sortOrder: item.sortOrder ?? 0 },
          update: {               name: item.name, categoryId: item.categoryId, price: item.price, description: item.description ?? null, isActive: item.isActive ?? true, prepTime: item.prepTime ?? null, sortOrder: item.sortOrder ?? 0 },
        });
        ex ? updated++ : created++;
      }
      // ItemModifierGroups
      for (const g of backup.modifierGroups ?? []) {
        const ex = await tx.itemModifierGroup.findUnique({ where: { id: g.id }, select: { id: true } });
        const isRequired = g.isRequired ?? g.required ?? false;
        await tx.itemModifierGroup.upsert({
          where:  { id: g.id },
          create: { id: g.id, name: g.name, itemId: g.itemId, maxSelect: g.maxSelect ?? 1, required: isRequired },
          update: {            name: g.name, itemId: g.itemId, maxSelect: g.maxSelect ?? 1, required: isRequired },
        });
        ex ? updated++ : created++;
      }
      // ItemModifiers
      for (const mod of backup.modifiers ?? []) {
        const ex = await tx.itemModifier.findUnique({ where: { id: mod.id }, select: { id: true } });
        const label = mod.label ?? mod.name ?? "";
        const priceAdd = mod.priceAdd ?? mod.price ?? 0;
        await tx.itemModifier.upsert({
          where:  { id: mod.id },
          create: { id: mod.id, label, groupId: mod.groupId, priceAdd },
          update: {              label, groupId: mod.groupId, priceAdd },
        });
        ex ? updated++ : created++;
      }
      // LoyaltySettings
      if (scope === "full") {
        for (const ls of backup.loyaltySettings ?? []) {
          const ex = await tx.loyaltySettings.findUnique({ where: { restaurantId: ls.restaurantId }, select: { restaurantId: true } });
          await tx.loyaltySettings.upsert({
            where:  { restaurantId: ls.restaurantId },
            create: { restaurantId: ls.restaurantId, pointsPerShekel: ls.pointsPerShekel ?? 1, shekelPerPoint: ls.shekelPerPoint ?? 0.1, minRedeemPoints: ls.minRedeemPoints ?? 100, welcomeBonus: ls.welcomeBonus ?? 50, birthdayBonus: ls.birthdayBonus ?? 100, isActive: ls.isActive ?? true },
            update: { pointsPerShekel: ls.pointsPerShekel ?? 1, shekelPerPoint: ls.shekelPerPoint ?? 0.1, minRedeemPoints: ls.minRedeemPoints ?? 100, welcomeBonus: ls.welcomeBonus ?? 50, birthdayBonus: ls.birthdayBonus ?? 100, isActive: ls.isActive ?? true },
          });
          ex ? updated++ : created++;
        }
        // OrderCounters
        for (const oc of backup.orderCounters ?? []) {
          const ex = await tx.orderCounter.findUnique({ where: { restaurantId: oc.restaurantId }, select: { restaurantId: true } });
          await tx.orderCounter.upsert({
            where:  { restaurantId: oc.restaurantId },
            create: { restaurantId: oc.restaurantId, counter: oc.counter },
            update: { counter: oc.counter },
          });
          ex ? updated++ : created++;
        }
      }
    }, { timeout: 60000 });

    // ── Phase 2: customers + loyalty members/transactions/coupons ──
    if (scope === "full") {
      // Customers
      for (const c of backup.customers ?? []) {
        const ex = await prisma.customer.findUnique({ where: { id: c.id }, select: { id: true } });
        await prisma.customer.upsert({
          where:  { id: c.id },
          create: { id: c.id, restaurantId: c.restaurantId, name: c.name, phone: c.phone ?? null, email: c.email ?? null, notes: c.notes ?? null, createdAt: c.createdAt ? new Date(c.createdAt) : undefined },
          update: {            restaurantId: c.restaurantId, name: c.name, phone: c.phone ?? null, email: c.email ?? null, notes: c.notes ?? null },
        });
        ex ? updated++ : created++;
      }

      // LoyaltyMembers
      for (const m of backup.loyaltyMembers ?? []) {
        const ex = await prisma.loyaltyMember.findUnique({ where: { id: m.id }, select: { id: true } });
        await prisma.loyaltyMember.upsert({
          where:  { id: m.id },
          create: { id: m.id, restaurantId: m.restaurantId, phone: m.phone, name: m.name, email: m.email ?? null, birthDate: m.birthDate ? new Date(m.birthDate) : undefined, memberNumber: m.memberNumber, points: m.points ?? 0, totalSpent: m.totalSpent ?? 0, groupId: m.groupId ?? null, ...(m.createdAt ? { createdAt: new Date(m.createdAt) } : {}) },
          update: { phone: m.phone, name: m.name, email: m.email ?? null, birthDate: m.birthDate ? new Date(m.birthDate) : undefined, memberNumber: m.memberNumber, points: m.points ?? 0, totalSpent: m.totalSpent ?? 0 },
        });
        ex ? updated++ : created++;
      }

      // LoyaltyTransactions (skip if member doesn't exist)
      const memberIds = new Set((backup.loyaltyMembers ?? []).map(m => m.id));
      for (const tx of backup.loyaltyTransactions ?? []) {
        if (!memberIds.has(tx.memberId)) continue;
        const ex = await prisma.loyaltyTransaction.findUnique({ where: { id: tx.id }, select: { id: true } });
        if (!ex) {
          await prisma.loyaltyTransaction.create({
            data: { id: tx.id, memberId: tx.memberId, orderId: tx.orderId ?? null, type: tx.type, points: tx.points, note: tx.note ?? null, createdAt: tx.createdAt ? new Date(tx.createdAt) : undefined },
          });
          created++;
        }
      }

      // LoyaltyCoupons
      for (const coupon of backup.loyaltyCoupons ?? []) {
        if (!memberIds.has(coupon.memberId)) continue;
        const ex = await prisma.loyaltyCoupon.findUnique({ where: { id: coupon.id }, select: { id: true } });
        await prisma.loyaltyCoupon.upsert({
          where:  { id: coupon.id },
          create: { id: coupon.id, memberId: coupon.memberId, restaurantId: coupon.restaurantId, code: coupon.code, type: coupon.type, value: coupon.value, description: coupon.description ?? null, usedAt: coupon.usedAt ? new Date(coupon.usedAt) : null, expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt) : null, validForGroupId: coupon.validForGroupId ?? null, usedAtRestaurantId: coupon.usedAtRestaurantId ?? null, createdAt: coupon.createdAt ? new Date(coupon.createdAt) : undefined },
          update: { usedAt: coupon.usedAt ? new Date(coupon.usedAt) : null, expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt) : null },
        });
        ex ? updated++ : created++;
      }
    }

    // ── Phase 3: orders ──
    if (scope === "full") {
      for (const o of backup.orders ?? []) {
        const ex = await prisma.order.findUnique({ where: { id: o.id }, select: { id: true } });
        await prisma.order.upsert({
          where:  { id: o.id },
          create: { id: o.id, restaurantId: o.restaurantId, tableNumber: o.tableNumber ?? null, customerName: o.customerName ?? null, customerPhone: o.customerPhone ?? null, status: (o.status as OrderStatus), orderNumber: o.orderNumber ?? null, totalAmount: o.totalAmount ?? 0, notes: o.notes ?? null, coversCount: o.coversCount ?? undefined, orderSource: o.orderSource ?? undefined, loyaltyMemberId: o.loyaltyMemberId ?? undefined, loyaltyMemberName: o.loyaltyMemberName ?? undefined, loyaltyDiscountType: o.loyaltyDiscountType ?? undefined, loyaltyDiscountAmount: o.loyaltyDiscountAmount ?? undefined, loyaltyCouponId: o.loyaltyCouponId ?? undefined, ...(o.createdAt ? { createdAt: new Date(o.createdAt) } : {}) },
          update: { status: (o.status as OrderStatus), totalAmount: o.totalAmount ?? 0, notes: o.notes ?? null },
        });
        ex ? updated++ : created++;
      }

      // OrderItems (create only new ones)
      const orderIds = new Set((backup.orders ?? []).map(o => o.id));
      for (const oi of backup.orderItems ?? []) {
        if (!orderIds.has(oi.orderId)) continue;
        const ex = await prisma.orderItem.findUnique({ where: { id: oi.id }, select: { id: true } });
        if (!ex) {
          await prisma.orderItem.create({
            data: { id: oi.id, orderId: oi.orderId, itemId: oi.itemId ?? "", quantity: oi.quantity, price: oi.price, notes: oi.notes ?? null, itemStatus: (oi.itemStatus ?? "PENDING") as never, course: oi.course ?? 1 },
          });
          created++;
        }
      }

      // OrderItemModifiers
      const orderItemIds = new Set((backup.orderItems ?? []).map(i => i.id));
      for (const oim of backup.orderItemModifiers ?? []) {
        if (!orderItemIds.has(oim.orderItemId)) continue;
        const ex = await prisma.orderItemModifier.findUnique({ where: { id: oim.id }, select: { id: true } });
        if (!ex) {
          await prisma.orderItemModifier.create({
            data: { id: oim.id, orderItemId: oim.orderItemId, groupName: oim.groupName ?? "", label: oim.label ?? "", priceAdd: oim.priceAdd ?? 0 },
          });
          created++;
        }
      }

      // OrderStatusLogs
      for (const sl of backup.orderStatusLogs ?? []) {
        if (!orderIds.has(sl.orderId)) continue;
        const ex = await prisma.orderStatusLog.findUnique({ where: { id: sl.id }, select: { id: true } });
        if (!ex) {
          await prisma.orderStatusLog.create({
            data: { id: sl.id, orderId: sl.orderId, fromStatus: sl.fromStatus ?? "", toStatus: sl.toStatus, changedAt: sl.changedAt ? new Date(sl.changedAt) : undefined, changedBy: sl.changedBy ?? null },
          });
          created++;
        }
      }

      // TableSessions
      for (const ts of backup.tableSessions ?? []) {
        const ex = await prisma.tableSession.findUnique({ where: { id: ts.id }, select: { id: true } });
        if (!ex) {
          await prisma.tableSession.create({
            data: { id: ts.id, restaurantId: ts.restaurantId, tableNumber: ts.tableNumber, openedAt: ts.openedAt ? new Date(ts.openedAt) : new Date(), closedAt: ts.closedAt ? new Date(ts.closedAt) : undefined, totalAmount: ts.totalAmount ?? 0, orderCount: ts.orderCount ?? 0 },
          });
          created++;
        }
      }
    }

    return NextResponse.json({ scope, created, updated });
  } catch (err) {
    console.error("[restore]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
