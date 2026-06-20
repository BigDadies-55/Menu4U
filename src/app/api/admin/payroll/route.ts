import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ensureEmployeeNumbers } from "@/lib/employeeNumber";
import { logAudit, getIp } from "@/lib/audit";

// ── Payroll export configuration ─────────────────────────────────────────────
// Per-employee payroll identity (employee number / national-ID / department /
// project) plus the wage-component codes mapped to each overtime tier. This is
// what the "מחוללים" tab needs to build a movement file the Israeli payroll
// bureaus (Hilan / Malam / Synel / Michpal …) can ingest.

const VIEW_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];
const EDIT_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER"];

// employeeNo lives on User (auto-assigned, immutable) — not editable here.
type Profile = { userId: string; idNumber: string; department: string; project: string };
type Settings = { regularCode: string; ot125Code: string; ot150Code: string };
const DEFAULT_SETTINGS: Settings = { regularCode: "1", ot125Code: "2", ot150Code: "3" };

async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PayrollProfile" (
      "restaurantId" TEXT NOT NULL,
      "userId"       TEXT NOT NULL,
      "employeeNo"   TEXT NOT NULL DEFAULT '',
      "idNumber"     TEXT NOT NULL DEFAULT '',
      "department"   TEXT NOT NULL DEFAULT '',
      "project"      TEXT NOT NULL DEFAULT '',
      CONSTRAINT "PayrollProfile_pkey" PRIMARY KEY ("restaurantId","userId")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PayrollSettings" (
      "restaurantId" TEXT NOT NULL,
      "settingsJson" TEXT,
      CONSTRAINT "PayrollSettings_pkey" PRIMARY KEY ("restaurantId")
    )
  `);
}

async function getSettings(restaurantId: string): Promise<Settings> {
  const rows = await prisma.$queryRawUnsafe<{ settingsJson: string | null }[]>(
    `SELECT "settingsJson" FROM "PayrollSettings" WHERE "restaurantId"=$1`, restaurantId
  );
  if (rows.length === 0 || !rows[0].settingsJson) return DEFAULT_SETTINGS;
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(rows[0].settingsJson) }; } catch { return DEFAULT_SETTINGS; }
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!VIEW_ROLES.includes(session.user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  await ensureTables();
  const profiles = await prisma.$queryRawUnsafe<Profile[]>(
    `SELECT "userId","idNumber","department","project" FROM "PayrollProfile" WHERE "restaurantId"=$1`,
    restaurantId
  );
  const settings = await getSettings(restaurantId);
  // Auto-assign immutable employee numbers (first digit = restaurant, 6 digits).
  const employeeNos = await ensureEmployeeNumbers(restaurantId);
  return NextResponse.json({ profiles, settings, employeeNos, canEdit: EDIT_ROLES.includes(session.user.role ?? "") });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!EDIT_ROLES.includes(session.user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { restaurantId, profiles, settings } = body as { restaurantId: string; profiles?: Profile[]; settings?: Settings };
  if (!restaurantId) return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });

  await ensureTables();

  if (Array.isArray(profiles)) {
    for (const p of profiles) {
      if (!p.userId) continue;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "PayrollProfile"("restaurantId","userId","idNumber","department","project")
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT ("restaurantId","userId") DO UPDATE SET
           "idNumber"=EXCLUDED."idNumber",
           "department"=EXCLUDED."department", "project"=EXCLUDED."project"`,
        restaurantId, p.userId, p.idNumber ?? "", p.department ?? "", p.project ?? ""
      );
    }
  }

  if (settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PayrollSettings"("restaurantId","settingsJson") VALUES($1,$2)
       ON CONFLICT ("restaurantId") DO UPDATE SET "settingsJson"=EXCLUDED."settingsJson"`,
      restaurantId, JSON.stringify(merged)
    );
  }

  await logAudit({
    userId: session.user.id, userEmail: session.user.email,
    action: "PAYROLL_CONFIG_UPDATE", entity: "payroll", entityId: restaurantId,
    meta: { restaurantId, profiles: Array.isArray(profiles) ? profiles.length : 0, settings: settings ?? null },
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
