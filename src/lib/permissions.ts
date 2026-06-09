import type { Role } from "@/generated/prisma/client";

export const ROLE_HIERARCHY: Record<Role, number> = {
  SUPER_ADMIN: 4,
  ADMIN: 3,
  OWNER: 2,
  SHIFT_MANAGER: 2,
  EDITOR: 1,
  VIEWER: 0,
  WAITER: 0,
  DISPLAY: 0,
};

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isSuperAdmin(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function isAdmin(role: Role): boolean {
  return hasPermission(role, "ADMIN");
}

export function isOwner(role: Role): boolean {
  return hasPermission(role, "OWNER");
}

// isEditor: can edit menu content (items, categories, menus, modifiers)
// but NOT restaurant settings, users, financials, or layout
export function isEditor(role: Role): boolean {
  return hasPermission(role, "OWNER") || role === "EDITOR";
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "מנהל",
  OWNER: "בעל מסעדה",
  SHIFT_MANAGER: "מנהל משמרת",
  EDITOR: "עורך",
  VIEWER: "צופה",
  WAITER: "מלצר",
  DISPLAY: "תצוגת מטבח",
};

export const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-800",
  ADMIN: "bg-purple-100 text-purple-800",
  OWNER: "bg-amber-100 text-amber-800",
  SHIFT_MANAGER: "bg-orange-100 text-orange-800",
  EDITOR: "bg-blue-100 text-blue-800",
  VIEWER: "bg-gray-100 text-gray-800",
  WAITER: "bg-green-100 text-green-800",
  DISPLAY: "bg-cyan-100 text-cyan-800",
};
