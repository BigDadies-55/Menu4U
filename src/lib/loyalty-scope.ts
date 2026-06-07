import { prisma } from "@/lib/prisma";

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

/**
 * Does the user have access to a member's restaurant, or to any branch of the
 * member's chain? Used by admin actions on chain-shared members.
 */
export async function canManageMemberScope(userId: string, memberRestaurantId: string): Promise<boolean> {
  const groupId = await getGroupId(memberRestaurantId);
  const scopeIds = await getScopeRestaurantIds(memberRestaurantId, groupId);
  const access = await prisma.restaurantUser
    .findFirst({ where: { userId, restaurantId: { in: scopeIds } } })
    .catch(() => null);
  return !!access;
}
