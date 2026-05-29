import { NextResponse } from "next/server";
import { runBackupAndEmail } from "@/lib/backupEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // 1. Validate Authorization header
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Check BACKUP_SCHEDULE (strip quotes/whitespace)
  const scheduleRaw = (process.env.BACKUP_SCHEDULE ?? "")
    .toLowerCase().trim()
    .replace(/^["'​ ]+|["'​ ]+$/g, "").trim();
  const schedule = ["daily", "weekly"].includes(scheduleRaw) ? scheduleRaw : "off";

  if (schedule === "off") {
    return NextResponse.json({ skipped: true });
  }
  if (schedule === "weekly" && new Date().getDay() !== 0) {
    return NextResponse.json({ skipped: "not sunday" });
  }

  try {
    const result = await runBackupAndEmail("cron");
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/backup]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
