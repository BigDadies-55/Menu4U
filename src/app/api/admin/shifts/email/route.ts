import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sendShiftsEmail } from "@/lib/email";

const DAYS_HE = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
const MONTHS_HE = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

type ShiftCfg = { key: string; label: string; startTime: string; endTime: string };

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role ?? "";
  const isManager = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"].includes(role);
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    restaurantId: string;
    from: string;   // ISO date
    to: string;     // ISO date
    periodLabel: string;
    mode: "all" | "single";
    userId?: string;
    overrideEmail?: string;
  };

  const { restaurantId, from, to, periodLabel, mode, userId, overrideEmail } = body;
  if (!restaurantId || !from || !to) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  // Load restaurant name + shift config
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } });
  const restaurantName = restaurant?.name ?? "";

  const cfgRow = await prisma.$queryRawUnsafe<{ config: string | null }[]>(
    `SELECT config FROM "ShiftConfig" WHERE "restaurantId"=$1 LIMIT 1`, restaurantId
  ).catch(() => [] as { config: string | null }[]);
  let shiftCfg: ShiftCfg[] = [];
  try { shiftCfg = cfgRow[0]?.config ? JSON.parse(cfgRow[0].config) : []; } catch { shiftCfg = []; }
  const cfgMap: Record<string, ShiftCfg> = Object.fromEntries(shiftCfg.map(c => [c.key, c]));

  // Load shifts in range
  type ShiftRow = { id: string; userId: string; date: string; shiftType: string; startTime: string; endTime: string };
  const shifts = await prisma.$queryRawUnsafe<ShiftRow[]>(
    `SELECT id, "userId", date, "shiftType", "startTime", "endTime" FROM "Shift"
     WHERE "restaurantId"=$1 AND date>=$2 AND date<=$3 ORDER BY date ASC`,
    restaurantId, from, to
  );

  // Build target list
  type Target = { userId: string; email: string; name: string };
  let targets: Target[] = [];

  if (mode === "single" && overrideEmail) {
    // Manual email override
    const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } }) : null;
    targets = [{ userId: userId ?? "", email: overrideEmail, name: user?.name ?? overrideEmail }];
  } else if (mode === "single" && userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
    if (!user?.email) return NextResponse.json({ error: "No email for user" }, { status: 400 });
    targets = [{ userId: user.id, email: user.email, name: user.name ?? user.email }];
  } else {
    // All users with shifts in range
    const userIds = [...new Set(shifts.map(s => s.userId))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
    targets = users.filter(u => u.email).map(u => ({ userId: u.id, email: u.email!, name: u.name ?? u.email! }));
  }

  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const target of targets) {
    const userShifts = shifts.filter(s => s.userId === target.userId);
    const shiftRows = userShifts.map(s => {
      const d = new Date(s.date);
      const cfg = cfgMap[s.shiftType];
      return {
        date: s.date.slice(5).replace("-", "/"),
        dayName: DAYS_HE[d.getDay()],
        shiftLabel: cfg?.label ?? s.shiftType,
        startTime: cfg?.startTime ?? s.startTime,
        endTime: cfg?.endTime ?? s.endTime,
      };
    });

    try {
      await sendShiftsEmail(target.email, target.name, restaurantName, periodLabel, shiftRows);
      results.push({ email: target.email, ok: true });
    } catch (err) {
      results.push({ email: target.email, ok: false, error: String(err) });
    }
  }

  const sent = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  return NextResponse.json({ sent, failed, results });
}
