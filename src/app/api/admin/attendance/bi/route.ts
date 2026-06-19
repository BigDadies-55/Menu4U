import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { computeDailyHoursByRole, type Punch, type Tier } from "@/lib/hours";

// BI reports cross-reference clock hours with POS sales. Owner-level only.
const OWNER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER"];
const TIER_MULT: Record<Tier, number> = { regular: 1, ot125: 1.25, ot150: 1.5 };

type AttRoleCfg = { code: string; label: string; payCode: string; color: string; hourlyRate?: number };

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
function hmToMin(hm: string): number { const [h, m] = hm.slice(0, 5).split(":").map(Number); return h * 60 + (m || 0); }
function shiftHours(start: string, end: string): number {
  let s = hmToMin(start), e = hmToMin(end);
  if (e <= s) e += 24 * 60;
  return (e - s) / 60;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!OWNER_ROLES.includes(session.user.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") ?? "";
  const from = searchParams.get("from") ?? "";
  const to   = searchParams.get("to") ?? "";
  if (!restaurantId || !from || !to) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  // ── Roles + hourly rates ──────────────────────────────────────────────────
  let roles: AttRoleCfg[] = [];
  try {
    const cfg = await prisma.$queryRawUnsafe<{ rolesJson: string | null }[]>(
      `SELECT "rolesJson" FROM "AttendanceConfig" WHERE "restaurantId"=$1`, restaurantId
    );
    if (cfg[0]?.rolesJson) roles = JSON.parse(cfg[0].rolesJson);
  } catch { /* table may not exist yet */ }
  const rateOf = (code: string | null): number => {
    const r = roles.find(x => x.code === code);
    return r?.hourlyRate ?? 0;
  };
  const rateConfigured = roles.some(r => (r.hourlyRate ?? 0) > 0);

  // ── Sales (POS) ───────────────────────────────────────────────────────────
  const revByDate: Record<string, number> = {};
  const revByHour = Array.from({ length: 24 }, () => 0);
  let totalRevenue = 0;
  try {
    const orders = await prisma.$queryRawUnsafe<{ totalAmount: number; createdAt: Date }[]>(
      `SELECT "totalAmount","createdAt" FROM "Order"
       WHERE "restaurantId"=$1 AND "status" <> 'CANCELLED'
         AND "createdAt" >= $2::timestamp AND "createdAt" < ($3::date + INTERVAL '1 day')`,
      restaurantId, from, to
    );
    for (const o of orders) {
      const amt = Number(o.totalAmount) || 0;
      const d = new Date(o.createdAt);
      revByDate[localDate(d)] = (revByDate[localDate(d)] ?? 0) + amt;
      revByHour[d.getHours()] += amt;
      totalRevenue += amt;
    }
  } catch { /* Order table absent */ }

  // ── Attendance → labor ──────────────────────────────────────────────────--
  type AttRow = { userId: string; type: string; date: string; timestamp: Date; roleCode: string | null };
  let att: AttRow[] = [];
  try {
    att = await prisma.$queryRawUnsafe<AttRow[]>(
      `SELECT "userId","type","date","timestamp","roleCode" FROM "Attendance"
       WHERE "restaurantId"=$1 AND "date">=$2 AND "date"<=$3 AND "type" <> 'DELETED'
       ORDER BY "timestamp" ASC`,
      restaurantId, from, to
    );
  } catch { /* none */ }

  // Group punches by user → date
  const byUserDate: Record<string, Record<string, Punch[]>> = {};
  const firstInByUserDate: Record<string, Record<string, Date>> = {};
  for (const r of att) {
    (byUserDate[r.userId] ??= {})[r.date] ??= [];
    byUserDate[r.userId][r.date].push({ type: r.type, timestamp: r.timestamp, roleCode: r.roleCode });
    if (r.type === "IN") {
      const cur = (firstInByUserDate[r.userId] ??= {})[r.date];
      if (!cur || new Date(r.timestamp) < new Date(cur)) firstInByUserDate[r.userId][r.date] = r.timestamp;
    }
  }

  const laborByDate: Record<string, number> = {};
  const laborHoursByDate: Record<string, number> = {};
  const laborByHour = Array.from({ length: 24 }, () => 0);
  let totalLabor = 0, totalHours = 0;

  type OtAgg = { userId: string; regular: number; ot125: number; ot150: number; laborCost: number; otCost: number; actual: number };
  const otAgg: Record<string, OtAgg> = {};

  for (const userId of Object.keys(byUserDate)) {
    for (const date of Object.keys(byUserDate[userId])) {
      const punches = byUserDate[userId][date];
      const bd = computeDailyHoursByRole(punches);
      let dayCost = 0, dayOtCost = 0;
      for (const a of bd.allocations) {
        const c = a.hours * rateOf(a.roleCode) * TIER_MULT[a.tier];
        dayCost += c;
        if (a.tier !== "regular") dayOtCost += c;
      }
      laborByDate[date] = (laborByDate[date] ?? 0) + dayCost;
      laborHoursByDate[date] = (laborHoursByDate[date] ?? 0) + bd.netHours;
      totalLabor += dayCost; totalHours += bd.netHours;

      const agg = (otAgg[userId] ??= { userId, regular: 0, ot125: 0, ot150: 0, laborCost: 0, otCost: 0, actual: 0 });
      agg.regular += bd.regularHours; agg.ot125 += bd.overtime125Hours; agg.ot150 += bd.overtime150Hours;
      agg.laborCost += dayCost; agg.otCost += dayOtCost; agg.actual += bd.netHours;

      // Distribute gross presence into clock-hour buckets (base rate) for the hourly chart.
      const ins  = punches.filter(p => p.type === "IN").sort((x, y) => +new Date(x.timestamp) - +new Date(y.timestamp));
      const outs = punches.filter(p => p.type === "OUT").sort((x, y) => +new Date(x.timestamp) - +new Date(y.timestamp));
      ins.forEach((inp, i) => {
        const outp = outs[i]; if (!outp) return;
        let cur = +new Date(inp.timestamp); const end = +new Date(outp.timestamp);
        if (!(end > cur) || (end - cur) / 3_600_000 >= 24) return;
        const rate = rateOf(inp.roleCode);
        while (cur < end) {
          const d = new Date(cur); const h = d.getHours();
          const nb = new Date(d); nb.setMinutes(60, 0, 0);
          const segEnd = Math.min(end, nb.getTime());
          const hrs = (segEnd - cur) / 3_600_000;
          laborByHour[h] += hrs * rate;
          cur = segEnd;
        }
      });
    }
  }

  // ── Shifts → planned hours + punctuality ──────────────────────────────────-
  type ShiftRow = { userId: string; date: string; startTime: string; endTime: string };
  let shifts: ShiftRow[] = [];
  try {
    shifts = await prisma.$queryRawUnsafe<ShiftRow[]>(
      `SELECT "userId","date","startTime","endTime" FROM "Shift"
       WHERE "restaurantId"=$1 AND "date">=$2 AND "date"<=$3 AND "status" <> 'CANCELLED'`,
      restaurantId, from, to
    );
  } catch { /* none */ }

  const plannedByUser: Record<string, number> = {};
  type Punct = { userId: string; shifts: number; onTime: number; late: number; early: number; lateMinutes: number; earlyMinutes: number };
  const punctByUser: Record<string, Punct> = {};
  for (const s of shifts) {
    const dateKey = String(s.date).slice(0, 10);
    plannedByUser[s.userId] = (plannedByUser[s.userId] ?? 0) + shiftHours(s.startTime, s.endTime);
    const p = (punctByUser[s.userId] ??= { userId: s.userId, shifts: 0, onTime: 0, late: 0, early: 0, lateMinutes: 0, earlyMinutes: 0 });
    p.shifts += 1;
    const firstIn = firstInByUserDate[s.userId]?.[dateKey];
    if (!firstIn) continue; // no check-in recorded against this scheduled shift
    const diff = minutesOf(new Date(firstIn)) - hmToMin(s.startTime); // +late / −early
    if (diff > 2) { p.late += 1; p.lateMinutes += diff; }
    else if (diff < -2) { p.early += 1; p.earlyMinutes += -diff; }
    else p.onTime += 1;
  }

  // ── Assemble ──────────────────────────────────────────────────────────────-
  const userIds = Array.from(new Set([...Object.keys(otAgg), ...Object.keys(punctByUser)]));
  let nameById: Record<string, string> = {};
  if (userIds.length > 0) {
    try {
      const users = await prisma.$queryRawUnsafe<{ id: string; name: string | null; email: string }[]>(
        `SELECT id, name, email FROM "User" WHERE id = ANY($1::text[])`, userIds
      );
      nameById = Object.fromEntries(users.map(u => [u.id, u.name || u.email]));
    } catch { /* ignore */ }
  }

  const dates = Array.from(new Set([...Object.keys(revByDate), ...Object.keys(laborByDate)])).sort();
  const byDay = dates.map(date => {
    const revenue = revByDate[date] ?? 0;
    const laborCost = laborByDate[date] ?? 0;
    return { date, revenue, laborCost, hours: laborHoursByDate[date] ?? 0, laborPct: revenue > 0 ? (laborCost / revenue) * 100 : null };
  });

  const byHour = Array.from({ length: 24 }, (_, h) => {
    const revenue = revByHour[h]; const laborCost = laborByHour[h];
    return { hour: h, revenue, laborCost, laborPct: revenue > 0 ? (laborCost / revenue) * 100 : null };
  }).filter(b => b.revenue > 0 || b.laborCost > 0);

  const overtime = Object.values(otAgg).map(a => ({
    userId: a.userId, name: nameById[a.userId] ?? a.userId,
    regular: a.regular, ot125: a.ot125, ot150: a.ot150, otHours: a.ot125 + a.ot150,
    laborCost: a.laborCost, otCost: a.otCost,
    planned: plannedByUser[a.userId] ?? 0, actual: a.actual,
    overPlanned: a.actual - (plannedByUser[a.userId] ?? 0),
  })).sort((x, y) => y.otHours - x.otHours);

  const punctuality = Object.values(punctByUser).map(p => ({
    userId: p.userId, name: nameById[p.userId] ?? p.userId,
    shifts: p.shifts, onTime: p.onTime, late: p.late, early: p.early,
    lateMinutes: p.lateMinutes, earlyMinutes: p.earlyMinutes,
  })).sort((x, y) => (y.lateMinutes + y.earlyMinutes) - (x.lateMinutes + x.earlyMinutes));

  return NextResponse.json({
    rateConfigured,
    totals: { revenue: totalRevenue, laborCost: totalLabor, hours: totalHours, laborPct: totalRevenue > 0 ? (totalLabor / totalRevenue) * 100 : null },
    byDay, byHour, overtime, punctuality,
  });
}
