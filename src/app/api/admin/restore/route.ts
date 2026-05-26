import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/* ─── BackupJSON type (matches the backup export shape) ─── */
interface BackupMeta {
  version: number;
  exportedAt: string;
  exportedBy: string;
  restaurantIds: string[];
  counts: Record<string, number>;
}

interface BackupRestaurant {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  [key: string]: unknown;
}

interface BackupMenu {
  id: string;
  name: string;
  restaurantId: string;
  isActive?: boolean;
  [key: string]: unknown;
}

interface BackupCategory {
  id: string;
  name: string;
  menuId: string;
  sortOrder?: number;
  isActive?: boolean;
  [key: string]: unknown;
}

interface BackupItem {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  description?: string | null;
  isActive?: boolean;
  prepTime?: number | null;
  sortOrder?: number;
  [key: string]: unknown;
}

interface BackupModifierGroup {
  id: string;
  name: string;
  itemId: string;
  minSelect?: number;
  maxSelect?: number;
  required?: boolean;
  isRequired?: boolean;
  [key: string]: unknown;
}

interface BackupModifier {
  id: string;
  name?: string;
  label?: string;
  groupId: string;
  price?: number;
  priceAdd?: number;
  isDefault?: boolean;
  isActive?: boolean;
  [key: string]: unknown;
}

interface BackupJSON {
  _meta: BackupMeta;
  restaurants?: BackupRestaurant[];
  menus?: BackupMenu[];
  categories?: BackupCategory[];
  items?: BackupItem[];
  modifierGroups?: BackupModifierGroup[];
  modifiers?: BackupModifier[];
  [key: string]: unknown;
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { backup: BackupJSON; scope: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { backup, scope } = body;

  if (!backup?._meta?.version) {
    return NextResponse.json({ error: "Invalid backup: missing _meta.version" }, { status: 400 });
  }

  if (scope !== "menus") {
    return NextResponse.json({ error: `Unsupported scope: ${scope}` }, { status: 400 });
  }

  try {
    let created = 0;
    let updated = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Restaurants
      for (const r of backup.restaurants ?? []) {
        const exists = await tx.restaurant.findUnique({ where: { id: r.id }, select: { id: true } });
        await tx.restaurant.upsert({
          where: { id: r.id },
          create: {
            id: r.id,
            name: r.name,
            email: r.email ?? null,
            phone: r.phone ?? null,
            address: r.address ?? null,
            description: r.description ?? null,
          },
          update: {
            name: r.name,
            email: r.email ?? null,
            phone: r.phone ?? null,
            address: r.address ?? null,
            description: r.description ?? null,
          },
        });
        if (exists) updated++; else created++;
      }

      // 2. Menus
      for (const m of backup.menus ?? []) {
        const exists = await tx.menu.findUnique({ where: { id: m.id }, select: { id: true } });
        await tx.menu.upsert({
          where: { id: m.id },
          create: {
            id: m.id,
            name: m.name,
            restaurantId: m.restaurantId,
            isActive: m.isActive ?? true,
          },
          update: {
            name: m.name,
            restaurantId: m.restaurantId,
            isActive: m.isActive ?? true,
          },
        });
        if (exists) updated++; else created++;
      }

      // 3. Categories
      for (const c of backup.categories ?? []) {
        const exists = await tx.category.findUnique({ where: { id: c.id }, select: { id: true } });
        await tx.category.upsert({
          where: { id: c.id },
          create: {
            id: c.id,
            name: c.name,
            menuId: c.menuId,
            sortOrder: c.sortOrder ?? 0,
            isActive: c.isActive ?? true,
          },
          update: {
            name: c.name,
            menuId: c.menuId,
            sortOrder: c.sortOrder ?? 0,
            isActive: c.isActive ?? true,
          },
        });
        if (exists) updated++; else created++;
      }

      // 4. Items
      for (const item of backup.items ?? []) {
        const exists = await tx.item.findUnique({ where: { id: item.id }, select: { id: true } });
        await tx.item.upsert({
          where: { id: item.id },
          create: {
            id: item.id,
            name: item.name,
            categoryId: item.categoryId,
            price: item.price,
            description: item.description ?? null,
            isActive: item.isActive ?? true,
            prepTime: item.prepTime ?? null,
            sortOrder: item.sortOrder ?? 0,
          },
          update: {
            name: item.name,
            categoryId: item.categoryId,
            price: item.price,
            description: item.description ?? null,
            isActive: item.isActive ?? true,
            prepTime: item.prepTime ?? null,
            sortOrder: item.sortOrder ?? 0,
          },
        });
        if (exists) updated++; else created++;
      }

      // 5. ItemModifierGroups
      for (const g of backup.modifierGroups ?? []) {
        const exists = await tx.itemModifierGroup.findUnique({ where: { id: g.id }, select: { id: true } });
        const isRequired = g.isRequired ?? g.required ?? false;
        await tx.itemModifierGroup.upsert({
          where: { id: g.id },
          create: {
            id: g.id,
            name: g.name,
            itemId: g.itemId,
            maxSelect: g.maxSelect ?? 1,
            required: isRequired,
          },
          update: {
            name: g.name,
            itemId: g.itemId,
            maxSelect: g.maxSelect ?? 1,
            required: isRequired,
          },
        });
        if (exists) updated++; else created++;
      }

      // 6. ItemModifiers
      for (const mod of backup.modifiers ?? []) {
        const exists = await tx.itemModifier.findUnique({ where: { id: mod.id }, select: { id: true } });
        const label = mod.label ?? mod.name ?? "";
        const priceAdd = mod.priceAdd ?? mod.price ?? 0;
        await tx.itemModifier.upsert({
          where: { id: mod.id },
          create: {
            id: mod.id,
            label,
            groupId: mod.groupId,
            priceAdd,
          },
          update: {
            label,
            groupId: mod.groupId,
            priceAdd,
          },
        });
        if (exists) updated++; else created++;
      }
    }, { timeout: 30000 });

    return NextResponse.json({ scope: "menus", created, updated });
  } catch (err) {
    console.error("[restore]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
