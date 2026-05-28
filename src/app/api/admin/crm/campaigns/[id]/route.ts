import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (body.name !== undefined)           { sets.push(`"name" = $${idx++}`);           vals.push(body.name); }
  if (body.message !== undefined)        { sets.push(`"message" = $${idx++}`);        vals.push(body.message); }
  if (body.isActive !== undefined)       { sets.push(`"isActive" = $${idx++}`);       vals.push(body.isActive); }
  if (body.scheduleConfig !== undefined) { sets.push(`"scheduleConfig" = $${idx++}`); vals.push(JSON.stringify(body.scheduleConfig)); }
  sets.push(`"updatedAt" = NOW()`);
  vals.push(id);

  await prisma.$executeRawUnsafe(
    `UPDATE "SmsCampaign" SET ${sets.join(", ")} WHERE "id" = $${idx}`,
    ...vals
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.$executeRawUnsafe(`DELETE FROM "SmsCampaign" WHERE "id" = $1`, id);
  return NextResponse.json({ ok: true });
}
