import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET — fetch all modifier groups + options for an item
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const groups = await prisma.itemModifierGroup.findMany({
    where: { itemId: id },           // ← was: { id } (group id, wrong field)
    include: { options: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(groups);
}

// PUT — replace all modifier groups for an item (full sync)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  type OptionIn = { id?: string; label: string; priceAdd?: number; order?: number };
  type GroupIn = { id?: string; name: string; required?: boolean; maxSelect?: number; order?: number; options: OptionIn[] };
  const groups: GroupIn[] = await req.json();

  // Delete groups not in the new list
  const keepGroupIds = groups.filter(g => g.id).map(g => g.id as string);
  await prisma.itemModifierGroup.deleteMany({
    where: { itemId: id, id: { notIn: keepGroupIds } }, // ← was: { id, id: ... } (double id, wrong field)
  });

  for (const [gi, group] of groups.entries()) {
    const groupData = {
      itemId: id,                    // ← was: id (wrong field name)
      name: group.name,
      required: group.required ?? false,
      maxSelect: group.maxSelect ?? 1,
      order: group.order ?? gi,
    };

    let groupId = group.id;
    if (groupId) {
      await prisma.itemModifierGroup.update({ where: { id: groupId }, data: groupData });
    } else {
      const created = await prisma.itemModifierGroup.create({ data: { id: `mg-${Date.now()}-${gi}`, ...groupData } });
      groupId = created.id;
    }

    // Delete options not in new list
    const keepOptionIds = group.options.filter(o => o.id).map(o => o.id as string);
    await prisma.itemModifier.deleteMany({ where: { groupId, id: { notIn: keepOptionIds } } });

    for (const [oi, opt] of group.options.entries()) {
      const optData = { groupId, label: opt.label, priceAdd: opt.priceAdd ?? 0, order: opt.order ?? oi };
      if (opt.id) {
        await prisma.itemModifier.update({ where: { id: opt.id }, data: optData });
      } else {
        await prisma.itemModifier.create({ data: { id: `mo-${Date.now()}-${gi}-${oi}`, ...optData } });
      }
    }
  }

  const result = await prisma.itemModifierGroup.findMany({
    where: { itemId: id },           // ← was: { id } (wrong field)
    include: { options: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(result);
}
