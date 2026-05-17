import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/permissions";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function buildWhere(params: URLSearchParams) {
  const action = params.get("action") ?? "";
  const entity = params.get("entity") ?? "";
  const search = params.get("search") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const hideMigration = params.get("hideMigration") === "1";

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  else if (hideMigration) where.action = { not: "RUN_MIGRATION" };
  if (entity) where.entity = entity;
  if (search) {
    where.OR = [
      { userEmail: { contains: search, mode: "insensitive" } },
      { entityName: { contains: search, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = new Date(from + "T00:00:00.000Z");
    if (to) range.lte = new Date(to + "T23:59:59.999Z");
    where.createdAt = range;
  }
  return where;
}

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Lazy cleanup: delete records older than 1 year (fire-and-forget)
  prisma.auditLog
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - ONE_YEAR_MS) } } })
    .catch(() => {});

  const { searchParams } = new URL(req.url);
  const where = buildWhere(searchParams);

  // CSV export mode
  if (searchParams.get("format") === "csv") {
    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    const header = ["זמן", "פעולה", "משתמש", "ישות", "שם ישות", "מזהה ישות", "פרטים", "IP"].join(",");
    const rows = logs.map((l) =>
      [
        escapeCSV(new Date(l.createdAt).toLocaleString("he-IL")),
        escapeCSV(l.action),
        escapeCSV(l.userEmail),
        escapeCSV(l.entity),
        escapeCSV(l.entityName),
        escapeCSV(l.entityId),
        escapeCSV(l.meta),
        escapeCSV(l.ip),
      ].join(",")
    );

    // UTF-8 BOM so Excel renders Hebrew correctly
    const csv = "﻿" + [header, ...rows].join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
}
