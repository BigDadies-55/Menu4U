import { prisma } from "@/lib/prisma";
import { ROLE_HIERARCHY } from "@/lib/permissions";
import type { Role } from "@/generated/prisma/client";

/**
 * Loyalty chain-scoping helpers.
 *
 * A loyalty member is anchored to the restaurant where they joined
 * (`LoyaltyMember.restaurantId`) and, if that restaurant belongs to a chain,
 * to the chain (`LoyaltyMember.groupId`). The points wallet is a single row,
 * so a chain member who joined at branch A can earn/redeem at branch B as long
 * as both branches share the same `groupId`.
 *
 * These helpers resolve the chain and build the "member belongs to this
 * restaurant OR its chain" predicate used across the earn/redeem/admin flows.
 */

/** Returns the chain (group) id for a restaurant, or null if it is standalone. */
export async function getGroupId(restaurantId: string): Promise<string | null> {
  const r = await prisma.restaurant
    .findUnique({ where: { id: restaurantId }, select: { groupId: true } })
    .catch(() => null);
  return r?.groupId ?? null;
}

/** All restaurant ids that share a member pool with the given restaurant. */
export async function getScopeRestaurantIds(restaurantId: string, groupId?: string | null): Promise<string[]> {
  const gid = groupId === undefined ? await getGroupId(restaurantId) : groupId;
  if (!gid) return [restaurantId];
  const rows = await prisma.restaurant
    .findMany({ where: { groupId: gid }, select: { id: true } })
    .catch(() => [] as { id: string }[]);
  const ids = rows.map(r => r.id);
  return ids.length > 0 ? ids : [restaurantId];
}

/**
 * Prisma `where` fragment matching a member within a restaurant OR its chain.
 * Combine with other fields, e.g. `{ phone, ...scopeWhere(rid, gid) }`.
 */
export function scopeWhere(restaurantId: string, groupId: string | null) {
  return groupId ? { OR: [{ restaurantId }, { groupId }] } : { restaurantId };
}

export type LoyaltyAction =
  | "adjustPoints"
  | "issueCoupon"
  | "redeemCoupon"
  | "updateMember"
  | "createMember"
  | "sendSms";

type PermResult = { allowed: true } | { allowed: false; reason: string };

/** Map action → LoyaltySettings column name for minRole */
const ACTION_MIN_ROLE_FIELD: Record<LoyaltyAction, string> = {
  adjustPoints:  "minRoleAdjustPoints",
  issueCoupon:   "minRoleIssueCoupon",
  redeemCoupon:  "minRoleRedeemCoupon",
  updateMember:  "minRoleUpdateMember",
  createMember:  "minRoleAdjustPoints", // same threshold as adjustPoints
  sendSms:       "minRoleSendSms",
};

/** Default minRole values when no LoyaltySettings row exists */
const ACTION_DEFAULT_ROLE: Record<LoyaltyAction, Role> = {
  adjustPoints:  "SHIFT_MANAGER",
  issueCoupon:   "OWNER",
  redeemCoupon:  "SHIFT_MANAGER",
  updateMember:  "SHIFT_MANAGER",
  createMember:  "SHIFT_MANAGER",
  sendSms:       "OWNER",
};

/**
 * Idempotent bootstrap: ensures the new permission columns exist on
 * LoyaltySettings. Called once per request in the admin loyalty route.
 */
export async function ensureLoyaltyPermissionColumns(): Promise<void> {
  await Promise.allSettled([
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltySettings" ADD COLUMN IF NOT EXISTS "minRoleAdjustPoints"  TEXT NOT NULL DEFAULT 'SHIFT_MANAGER'`),
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltySettings" ADD COLUMN IF NOT EXISTS "minRoleIssueCoupon"   TEXT NOT NULL DEFAULT 'OWNER'`),
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltySettings" ADD COLUMN IF NOT EXISTS "minRoleRedeemCoupon"  TEXT NOT NULL DEFAULT 'SHIFT_MANAGER'`),
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltySettings" ADD COLUMN IF NOT EXISTS "minRoleUpdateMember"  TEXT NOT NULL DEFAULT 'SHIFT_MANAGER'`),
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltySettings" ADD COLUMN IF NOT EXISTS "minRoleSendSms"       TEXT NOT NULL DEFAULT 'OWNER'`),
    prisma.$executeRawUnsafe(`ALTER TABLE "LoyaltySettings" ADD COLUMN IF NOT EXISTS "maxDailyPointsAdjust" INTEGER NOT NULL DEFAULT 0`),
  ]);
}

/**
 * Full loyalty permission check:
 * 1. SUPER_ADMIN always passes.
 * 2. Finds the user's RestaurantUser.role for the restaurant (or any chain branch).
 * 3. Compares that role against the minRole configured in LoyaltySettings.
 * 4. For adjustPoints, also checks the daily cap per operator.
 */
export async function checkLoyaltyPermission(
  userId: string,
  globalRole: string,
  memberRestaurantId: string,
  action: LoyaltyAction,
  pointsDelta?: number, // only needed for adjustPoints
): Promise<PermResult> {
  // SUPER_ADMIN bypasses everything
  if (globalRole === "SUPER_ADMIN") return { allowed: true };

  // Find user's per-restaurant role (any branch in the chain qualifies)
  const gid = await getGroupId(memberRestaurantId);
  const scopeIds = await getScopeRestaurantIds(memberRestaurantId, gid);
  const ru = await prisma.restaurantUser
    .findFirst({ where: { userId, restaurantId: { in: scopeIds } }, select: { role: true, restaurantId: true } })
    .catch(() => null);

  if (!ru) return { allowed: false, reason: "אין לך גישה למסעדה זו" };

  // Load LoyaltySettings for the minRole config (use raw to handle missing columns gracefully)
  type SettingsRow = {
    minRoleAdjustPoints: string;
    minRoleIssueCoupon: string;
    minRoleRedeemCoupon: string;
    minRoleUpdateMember: string;
    minRoleSendSms: string;
    maxDailyPointsAdjust: number;
  };
  const rows = await prisma.$queryRawUnsafe<SettingsRow[]>(
    `SELECT "minRoleAdjustPoints","minRoleIssueCoupon","minRoleRedeemCoupon",
            "minRoleUpdateMember","minRoleSendSms","maxDailyPointsAdjust"
       FROM "LoyaltySettings" WHERE "restaurantId" = $1 LIMIT 1`,
    memberRestaurantId
  ).catch(() => [] as SettingsRow[]);
  const cfg = rows[0];

  const fieldName = ACTION_MIN_ROLE_FIELD[action];
  const defaultRole = ACTION_DEFAULT_ROLE[action];
  const minRoleStr: string = cfg ? (cfg as Record<string, unknown>)[fieldName] as string ?? defaultRole : defaultRole;
  const minRole = minRoleStr as Role;

  const userRoleLevel = ROLE_HIERARCHY[ru.role as Role] ?? -1;
  const minRoleLevel = ROLE_HIERARCHY[minRole] ?? 0;

  if (userRoleLevel < minRoleLevel) {
    return {
      allowed: false,
      reason: `נדרש תפקיד "${minRole}" לפעולה זו. התפקיד שלך: "${ru.role}"`,
    };
  }

  // Daily cap check for adjustPoints
  if (action === "adjustPoints" && cfg?.maxDailyPointsAdjust && cfg.maxDailyPointsAdjust > 0 && pointsDelta) {
    const absPoints = Math.abs(pointsDelta);
    // Sum absolute manual adjustments today by this user across all members of this restaurant scope
    type SumRow = { total: number };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sumRows = await prisma.$queryRawUnsafe<SumRow[]>(
      `SELECT COALESCE(SUM(ABS(lt.points)), 0)::int AS total
         FROM "LoyaltyTransaction" lt
         JOIN "LoyaltyMember" lm ON lm.id = lt."memberId"
        WHERE lt.type = 'MANUAL'
          AND lt."createdAt" >= $1
          AND lt.note LIKE $2
          AND lm."restaurantId" = ANY($3::text[])`,
      today, `%[uid:${userId}]%`, scopeIds
    ).catch(() => [] as SumRow[]);
    const usedToday = Number(sumRows[0]?.total ?? 0);
    if (usedToday + absPoints > cfg.maxDailyPointsAdjust) {
      return {
        allowed: false,
        reason: `חרגת מהמגבלה היומית של ${cfg.maxDailyPointsAdjust} נקודות (כבר השתמשת ב-${usedToday})`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Does the user have access to a member's restaurant, or to any branch of the
 * member's chain? Used by admin actions on chain-shared members.
 * @deprecated Use checkLoyaltyPermission for new code.
 */
export async function canManageMemberScope(userId: string, memberRestaurantId: string): Promise<boolean> {
  const groupId = await getGroupId(memberRestaurantId);
  const scopeIds = await getScopeRestaurantIds(memberRestaurantId, groupId);
  const access = await prisma.restaurantUser
    .findFirst({ where: { userId, restaurantId: { in: scopeIds } } })
    .catch(() => null);
  return !!access;
}
