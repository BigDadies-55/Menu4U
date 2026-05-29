import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/* ─── Types ──────────────────────────────────────────────── */
interface BackupMeta {
  version: number;
  exportedAt: string;
  exportedBy: string;
  restaurantIds: string[];
  counts: Record<string, number>;
}
interface BackupRestaurant { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null; description?: string | null; [k: string]: unknown }
interface BackupMenu        { id: string; name: string; restaurantId: string; isActive?: boolean; [k: string]: unknown }
interface BackupCategory    { id: string; name: string; menuId: string; sortOrder?: number; isActive?: boolean; [k: string]: unknown }
interface BackupItem        { id: string; name: string; categoryId: string; price: number; description?: string | null; isActive?: boolean; prepTime?: number | null; sortOrder?: number; [k: string]: unknown }
interface BackupModifierGroup { id: string; name: string; itemId: string; minSelect?: number; maxSelect?: number; required?: boolean; isRequired?: boolean; [k: string]: unknown }
interface BackupModifier    { id: string; name?: string; label?: string; groupId: string; price?: number; priceAdd?: number; isDefault?: boolean; isActive?: boolean; [k: string]: unknown }

interface BackupJSON {
  _meta: BackupMeta;
  restaurants?: BackupRestaurant[];
  menus?: BackupMenu[];
  categories?: BackupCategory[];
  items?: BackupItem[];
  modifierGroups?: BackupModifierGroup[];
  modifiers?: BackupModifier[];
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
  if (scope !== "menus") {
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
        if (changed(ex.name,    r.name))    fc.push({ field: "שם",      from: fmt(ex.name),    to: fmt(r.name) });
        if (changed(ex.email,   r.email))   fc.push({ field: "אימייל",  from: fmt(ex.email),   to: fmt(r.email) });
        if (changed(ex.phone,   r.phone))   fc.push({ field: "טלפון",   from: fmt(ex.phone),   to: fmt(r.phone) });
        if (changed(ex.address, r.address)) fc.push({ field: "כתובת",   from: fmt(ex.address), to: fmt(r.address) });
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
        if (changed(ex.name,     m.name))     fc.push({ field: "שם",     from: fmt(ex.name),     to: fmt(m.name) });
        if (changed(ex.isActive, m.isActive)) fc.push({ field: "פעיל",   from: fmt(ex.isActive), to: fmt(m.isActive) });
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
        if (changed(ex.name,      c.name))      fc.push({ field: "שם",    from: fmt(ex.name),      to: fmt(c.name) });
        if (changed(ex.isActive,  c.isActive))  fc.push({ field: "פעיל",  from: fmt(ex.isActive),  to: fmt(c.isActive) });
        if (changed(ex.sortOrder, c.sortOrder)) fc.push({ field: "סדר",   from: fmt(ex.sortOrder), to: fmt(c.sortOrder) });
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
        if (changed(ex.name,      g.name))      fc.push({ field: "שם",       from: fmt(ex.name),      to: fmt(g.name) });
        if (changed(ex.maxSelect, g.maxSelect)) fc.push({ field: "מקסימום",  from: fmt(ex.maxSelect), to: fmt(g.maxSelect) });
        if (changed(ex.required,  isRequired))  fc.push({ field: "חובה",     from: fmt(ex.required),  to: fmt(isRequired) });
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
        if (changed(ex.label,    label))    fc.push({ field: "שם",    from: fmt(ex.label),    to: fmt(label) });
        if (changed(ex.priceAdd, priceAdd)) fc.push({ field: "תוספת", from: `₪${ex.priceAdd}`, to: `₪${priceAdd}` });
        if (fc.length) entries.push({ type: "modifier", name: label, action: "update", changes: fc });
      }
    }

    const toCreate  = entries.filter(e => e.action === "create").length;
    const toUpdate  = entries.filter(e => e.action === "update").length;
    const totalBkp  = (backup.restaurants?.length ?? 0) + (backup.menus?.length ?? 0) +
                      (backup.categories?.length ?? 0) + (backup.items?.length ?? 0) +
                      (backup.modifierGroups?.length ?? 0) + (backup.modifiers?.length ?? 0);
    const noChange  = totalBkp - toCreate - toUpdate;

    return NextResponse.json({ mode: "preview", toCreate, toUpdate, noChange, entries });
  }

  /* ══════════════════════════════════════════
     RESTORE MODE — write changes to DB
  ══════════════════════════════════════════ */
  try {
    let created = 0, updated = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Restaurants
      for (const r of backup.restaurants ?? []) {
        const ex = await tx.restaurant.findUnique({ where: { id: r.id }, select: { id: true } });
        await tx.restaurant.upsert({
          where: { id: r.id },
          create: { id: r.id, name: r.name, email: r.email ?? null, phone: r.phone ?? null, address: r.address ?? null, description: r.description ?? null },
          update: {            name: r.name, email: r.email ?? null, phone: r.phone ?? null, address: r.address ?? null, description: r.description ?? null },
        });
        ex ? updated++ : created++;
      }
      // 2. Menus
      for (const m of backup.menus ?? []) {
        const ex = await tx.menu.findUnique({ where: { id: m.id }, select: { id: true } });
        await tx.menu.upsert({
          where: { id: m.id },
          create: { id: m.id, name: m.name, restaurantId: m.restaurantId, isActive: m.isActive ?? true },
          update: {            name: m.name, restaurantId: m.restaurantId, isActive: m.isActive ?? true },
        });
        ex ? updated++ : created++;
      }
      // 3. Categories
      for (const c of backup.categories ?? []) {
        const ex = await tx.category.findUnique({ where: { id: c.id }, select: { id: true } });
        await tx.category.upsert({
          where: { id: c.id },
          create: { id: c.id, name: c.name, menuId: c.menuId, sortOrder: c.sortOrder ?? 0, isActive: c.isActive ?? true },
          update: {            name: c.name, menuId: c.menuId, sortOrder: c.sortOrder ?? 0, isActive: c.isActive ?? true },
        });
        ex ? updated++ : created++;
      }
      // 4. Items
      for (const item of backup.items ?? []) {
        const ex = await tx.item.findUnique({ where: { id: item.id }, select: { id: true } });
        await tx.item.upsert({
          where: { id: item.id },
          create: { id: item.id, name: item.name, categoryId: item.categoryId, price: item.price, description: item.description ?? null, isActive: item.isActive ?? true, prepTime: item.prepTime ?? null, sortOrder: item.sortOrder ?? 0 },
          update: {              name: item.name, categoryId: item.categoryId, price: item.price, description: item.description ?? null, isActive: item.isActive ?? true, prepTime: item.prepTime ?? null, sortOrder: item.sortOrder ?? 0 },
        });
        ex ? updated++ : created++;
      }
      // 5. ItemModifierGroups
      for (const g of backup.modifierGroups ?? []) {
        const ex = await tx.itemModifierGroup.findUnique({ where: { id: g.id }, select: { id: true } });
        const isRequired = g.isRequired ?? g.required ?? false;
        await tx.itemModifierGroup.upsert({
          where: { id: g.id },
          create: { id: g.id, name: g.name, itemId: g.itemId, maxSelect: g.maxSelect ?? 1, required: isRequired },
          update: {            name: g.name, itemId: g.itemId, maxSelect: g.maxSelect ?? 1, required: isRequired },
        });
        ex ? updated++ : created++;
      }
      // 6. ItemModifiers
      for (const mod of backup.modifiers ?? []) {
        const ex = await tx.itemModifier.findUnique({ where: { id: mod.id }, select: { id: true } });
        const label = mod.label ?? mod.name ?? "";
        const priceAdd = mod.priceAdd ?? mod.price ?? 0;
        await tx.itemModifier.upsert({
          where: { id: mod.id },
          create: { id: mod.id, label, groupId: mod.groupId, priceAdd },
          update: {              label, groupId: mod.groupId, priceAdd },
        });
        ex ? updated++ : created++;
      }
    }, { timeout: 30000 });

    return NextResponse.json({ scope: "menus", created, updated });
  } catch (err) {
    console.error("[restore]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
