import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import AssistantAdminClient from "./AssistantAdminClient";

export const metadata = { title: "💬 עוזר אישי | Menu4U" };

export default async function AssistantAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isAdmin(session.user.role)) redirect("/admin");

  let entries: unknown[] = [], unanswered: unknown[] = [], stats: unknown = {};
  try {
    entries = await prisma.$queryRawUnsafe(
      `SELECT * FROM "AssistantEntry" ORDER BY page, "isDefault" DESC, score DESC`
    );
    unanswered = await prisma.$queryRawUnsafe(
      `SELECT * FROM "AssistantUnanswered" WHERE resolved=false ORDER BY count DESC, "updatedAt" DESC LIMIT 50`
    );
    const [s] = await prisma.$queryRawUnsafe<{ total: bigint; thumbsUp: bigint; thumbsDown: bigint }[]>(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE rating=1) as "thumbsUp",
              COUNT(*) FILTER (WHERE rating=-1) as "thumbsDown"
       FROM "AssistantFeedback"`
    );
    stats = { total: Number(s?.total ?? 0), thumbsUp: Number(s?.thumbsUp ?? 0), thumbsDown: Number(s?.thumbsDown ?? 0) };
  } catch { /* tables may not exist yet */ }

  return <AssistantAdminClient entries={entries as never} unanswered={unanswered as never} stats={stats as never} />;
}
