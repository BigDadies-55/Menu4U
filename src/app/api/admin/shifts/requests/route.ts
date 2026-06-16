import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];

// GET /api/admin/shifts/requests?restaurantId=...&status=PENDING
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const status = searchParams.get("status"); // optional filter e.g. PENDING

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId is required" }, { status: 400 });
  }

  // Verify user belongs to restaurant (or is SUPER_ADMIN)
  if (session.user.role !== "SUPER_ADMIN") {
    const membership = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "RestaurantUser" WHERE "restaurantId" = $1 AND "userId" = $2 LIMIT 1`,
      restaurantId,
      session.user.id
    );
    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let query: string;
  let queryParams: unknown[];

  if (status) {
    query = `
      SELECT
        sr.*,
        s.date AS "shiftDate",
        s."shiftType",
        s."startTime",
        s."endTime",
        s.status AS "shiftStatus",
        fu.name AS "fromUserName",
        fu.email AS "fromUserEmail",
        tu.name AS "toUserName",
        tu.email AS "toUserEmail"
      FROM "ShiftRequest" sr
      JOIN "Shift" s ON s.id = sr."shiftId"
      LEFT JOIN "User" fu ON fu.id = sr."fromUserId"
      LEFT JOIN "User" tu ON tu.id = sr."toUserId"
      WHERE s."restaurantId" = $1
        AND sr.status = $2
      ORDER BY sr."createdAt" DESC
    `;
    queryParams = [restaurantId, status];
  } else {
    query = `
      SELECT
        sr.*,
        s.date AS "shiftDate",
        s."shiftType",
        s."startTime",
        s."endTime",
        s.status AS "shiftStatus",
        fu.name AS "fromUserName",
        fu.email AS "fromUserEmail",
        tu.name AS "toUserName",
        tu.email AS "toUserEmail"
      FROM "ShiftRequest" sr
      JOIN "Shift" s ON s.id = sr."shiftId"
      LEFT JOIN "User" fu ON fu.id = sr."fromUserId"
      LEFT JOIN "User" tu ON tu.id = sr."toUserId"
      WHERE s."restaurantId" = $1
      ORDER BY sr."createdAt" DESC
    `;
    queryParams = [restaurantId];
  }

  const requests = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    query,
    ...queryParams
  );

  return NextResponse.json({ requests });
}

// POST /api/admin/shifts/requests
// Creates a shift request (any authenticated employee)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { shiftId, type, reason } = body as {
    shiftId?: string;
    type?: "SWAP" | "COVER";
    reason?: string;
  };

  if (!shiftId || !type) {
    return NextResponse.json(
      { error: "shiftId and type are required" },
      { status: 400 }
    );
  }

  if (type !== "SWAP" && type !== "COVER") {
    return NextResponse.json(
      { error: 'type must be "SWAP" or "COVER"' },
      { status: 400 }
    );
  }

  // Fetch the shift
  const shifts = await prisma.$queryRawUnsafe<{ id: string; userId: string; restaurantId: string }[]>(
    `SELECT id, "userId", "restaurantId" FROM "Shift" WHERE id = $1 LIMIT 1`,
    shiftId
  );

  if (!shifts || shifts.length === 0) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  const shift = shifts[0];

  // For SWAP: the requesting user must own the shift
  // For COVER: anyone in the restaurant can offer to cover
  if (type === "SWAP" && shift.userId !== session.user.id) {
    return NextResponse.json(
      { error: "You can only request a SWAP for your own shift" },
      { status: 403 }
    );
  }

  if (type === "COVER") {
    // Verify the user belongs to the same restaurant
    const membership = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "RestaurantUser" WHERE "restaurantId" = $1 AND "userId" = $2 LIMIT 1`,
      shift.restaurantId,
      session.user.id
    );
    if (!membership || membership.length === 0) {
      return NextResponse.json(
        { error: "You do not belong to this restaurant" },
        { status: 403 }
      );
    }
  }

  const id = crypto.randomUUID();

  await prisma.$executeRawUnsafe(
    `INSERT INTO "ShiftRequest" (id, "shiftId", "fromUserId", type, reason, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW(), NOW())`,
    id,
    shiftId,
    session.user.id,
    type,
    reason ?? null
  );

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT sr.*,
            s.date AS "shiftDate",
            s."shiftType",
            s."startTime",
            s."endTime"
     FROM "ShiftRequest" sr
     JOIN "Shift" s ON s.id = sr."shiftId"
     WHERE sr.id = $1`,
    id
  );

  return NextResponse.json(rows[0], { status: 201 });
}

// PATCH /api/admin/shifts/requests
// Approve or reject a request (ADMIN/OWNER/SHIFT_MANAGER only)
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!MANAGER_ROLES.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, action } = body as { id?: string; action?: "APPROVE" | "REJECT" };

  if (!id || !action) {
    return NextResponse.json(
      { error: "id and action are required" },
      { status: 400 }
    );
  }

  if (action !== "APPROVE" && action !== "REJECT") {
    return NextResponse.json(
      { error: 'action must be "APPROVE" or "REJECT"' },
      { status: 400 }
    );
  }

  // Fetch request to verify restaurant membership
  const requests = await prisma.$queryRawUnsafe<{ id: string; restaurantId: string }[]>(
    `SELECT sr.id, s."restaurantId"
     FROM "ShiftRequest" sr
     JOIN "Shift" s ON s.id = sr."shiftId"
     WHERE sr.id = $1
     LIMIT 1`,
    id
  );

  if (!requests || requests.length === 0) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const request = requests[0];

  if (session.user.role !== "SUPER_ADMIN") {
    const membership = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "RestaurantUser" WHERE "restaurantId" = $1 AND "userId" = $2 LIMIT 1`,
      request.restaurantId,
      session.user.id
    );
    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

  await prisma.$executeRawUnsafe(
    `UPDATE "ShiftRequest" SET status = $1, "updatedAt" = NOW() WHERE id = $2`,
    newStatus,
    id
  );

  return NextResponse.json({ ok: true });
}
