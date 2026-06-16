import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/permissions";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { page, question, answer, tags, isDefault } = await req.json();
  if (!question?.trim() || !answer?.trim())
    return NextResponse.json({ error: "question and answer required" }, { status: 400 });

  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AssistantEntry" (id, page, question, answer, tags, "isDefault")
     VALUES ($1,$2,$3,$4,$5,$6)`,
    id, page ?? "general", question.trim(), answer.trim(),
    `{${(tags ?? []).map((t: string) => `"${t}"`).join(",")}}`, isDefault ?? false
  );
  const [row] = await prisma.$queryRawUnsafe<object[]>(
    `SELECT * FROM "AssistantEntry" WHERE id=$1`, id
  );
  return NextResponse.json(row);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Resolve unanswered
  if (body.resolveUnanswered) {
    await prisma.$executeRawUnsafe(
      `UPDATE "AssistantUnanswered" SET resolved=true, "updatedAt"=NOW() WHERE id=$1`,
      body.resolveUnanswered
    );
    return NextResponse.json({ ok: true });
  }

  const { id, page, question, answer, tags, isDefault } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.$executeRawUnsafe(
    `UPDATE "AssistantEntry" SET page=$1, question=$2, answer=$3, tags=$4, "isDefault"=$5, "updatedAt"=NOW() WHERE id=$6`,
    page, question.trim(), answer.trim(),
    `{${(tags ?? []).map((t: string) => `"${t}"`).join(",")}}`, isDefault ?? false, id
  );
  const [row] = await prisma.$queryRawUnsafe<object[]>(
    `SELECT * FROM "AssistantEntry" WHERE id=$1`, id
  );
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.$executeRawUnsafe(`DELETE FROM "AssistantEntry" WHERE id=$1`, id);
  return NextResponse.json({ ok: true });
}
