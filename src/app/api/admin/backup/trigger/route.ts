import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { runBackupAndEmail } from "@/lib/backupEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await runBackupAndEmail("manual", session.user.email ?? undefined);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[backup/trigger]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
