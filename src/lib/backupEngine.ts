/**
 * Shared backup generation + email logic.
 * Used by both the manual trigger and the Vercel Cron route.
 */
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import nodemailer from "nodemailer";

export async function runBackupAndEmail(trigger: "manual" | "cron", triggeredBy?: string) {
  // 1. Fetch all restaurant IDs
  const allRestaurants = await prisma.restaurant.findMany({ select: { id: true } });
  const allowedIds = allRestaurants.map(r => r.id);

  // 2. Fetch all data
  const [
    restaurants, restaurantUsers, users, menus, categories, items,
    modifierGroups, modifiers, orders, orderItems, orderItemModifiers,
    orderStatusLogs, customers, tableSessions, auditLogs, menuViews,
    loyaltySettings, loyaltyMembers, loyaltyTransactions, loyaltyCoupons,
    orderCounters,
  ] = await Promise.all([
    prisma.restaurant.findMany({ where: { id: { in: allowedIds } } }),
    prisma.restaurantUser.findMany({ where: { restaurantId: { in: allowedIds } } }),
    prisma.user.findMany({
      where: { restaurantUsers: { some: { restaurantId: { in: allowedIds } } } },
      select: { id: true, email: true, name: true, role: true, emailVerified: true, termsAccepted: true, createdAt: true },
    }),
    prisma.menu.findMany({ where: { restaurantId: { in: allowedIds } } }),
    prisma.category.findMany({ where: { menu: { restaurantId: { in: allowedIds } } } }),
    prisma.item.findMany({ where: { category: { menu: { restaurantId: { in: allowedIds } } } } }),
    prisma.itemModifierGroup.findMany({ where: { item: { category: { menu: { restaurantId: { in: allowedIds } } } } } }),
    prisma.itemModifier.findMany({ where: { group: { item: { category: { menu: { restaurantId: { in: allowedIds } } } } } } }),
    prisma.order.findMany({ where: { restaurantId: { in: allowedIds } }, orderBy: { createdAt: "asc" } }),
    prisma.orderItem.findMany({ where: { order: { restaurantId: { in: allowedIds } } } }),
    prisma.orderItemModifier.findMany({ where: { orderItem: { order: { restaurantId: { in: allowedIds } } } } }),
    prisma.orderStatusLog.findMany({ where: { order: { restaurantId: { in: allowedIds } } }, orderBy: { changedAt: "asc" } }),
    prisma.customer.findMany({ where: { restaurantId: { in: allowedIds } } }),
    prisma.tableSession.findMany({ where: { restaurantId: { in: allowedIds } }, orderBy: { closedAt: "asc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "asc" }, take: 10000 }).catch(() => []),
    prisma.menuView.findMany({ where: { restaurantId: { in: allowedIds } } }).catch(() => []),
    prisma.loyaltySettings.findMany({ where: { restaurantId: { in: allowedIds } } }),
    prisma.loyaltyMember.findMany({ where: { restaurantId: { in: allowedIds } }, orderBy: { createdAt: "asc" } }),
    prisma.loyaltyTransaction.findMany({ where: { member: { restaurantId: { in: allowedIds } } }, orderBy: { createdAt: "asc" } }),
    prisma.loyaltyCoupon.findMany({ where: { restaurantId: { in: allowedIds } }, orderBy: { createdAt: "asc" } }),
    prisma.orderCounter.findMany({ where: { restaurantId: { in: allowedIds } } }),
  ]);

  const counts = {
    restaurants: restaurants.length, users: users.length, menus: menus.length,
    categories: categories.length, items: items.length, modifierGroups: modifierGroups.length,
    modifiers: modifiers.length, orders: orders.length, orderItems: orderItems.length,
    customers: customers.length, auditLogs: auditLogs.length,
    tableSessions: tableSessions.length, menuViews: menuViews.length,
    loyaltyMembers: loyaltyMembers.length, loyaltyTransactions: loyaltyTransactions.length,
    loyaltyCoupons: loyaltyCoupons.length,
  };

  const backup = {
    _meta: { version: 3, exportedAt: new Date().toISOString(), exportedBy: triggeredBy ?? trigger, restaurantIds: allowedIds, counts },
    restaurants, restaurantUsers, users, menus, categories, items,
    modifierGroups, modifiers, orders, orderItems, orderItemModifiers,
    orderStatusLogs, customers, tableSessions, auditLogs, menuViews,
    loyaltySettings, loyaltyMembers, loyaltyTransactions, loyaltyCoupons,
    orderCounters,
  };

  const json    = JSON.stringify(backup, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  const label   = trigger === "cron" ? "גיבוי אוטומטי" : "גיבוי ידני (כפתור)";

  // 3. Send email to all SUPER_ADMINs
  let emailSent = false;
  try {
    const superAdmins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { email: true } });
    if (superAdmins.length > 0 && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      await transporter.sendMail({
        from:    `"Menu4U" <${process.env.GMAIL_USER}>`,
        to:      superAdmins.map(u => u.email).join(", "),
        subject: `${label} Menu4U — ${dateStr}`,
        html: `
<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;direction:rtl;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
<tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#1a1208,#3d2b00);padding:32px;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#C9A84C;letter-spacing:2px;">Menu4U</div>
    <div style="font-size:13px;color:#a08040;margin-top:4px;">${label}</div>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="font-size:20px;font-weight:700;color:#1a1208;margin:0 0 16px;">גיבוי בוצע בהצלחה ✓</h2>
    <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 16px;">
      ${label} של מערכת Menu4U בוצע בתאריך <strong>${dateStr}</strong>${triggeredBy ? ` על ידי <strong>${triggeredBy}</strong>` : ""}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5e4;border:1px solid #e8d99a;border-radius:12px;margin-top:8px;">
      <tr><td style="padding:16px 20px;">
        <div style="font-size:13px;font-weight:700;color:#8B6914;margin-bottom:8px;">סטטיסטיקות גיבוי</div>
        <div style="font-size:13px;color:#555;">מסעדות: ${counts.restaurants} | תפריטים: ${counts.menus} | הזמנות: ${counts.orders}</div>
        <div style="font-size:13px;color:#555;margin-top:4px;">פריטים: ${counts.items} | לקוחות: ${counts.customers} | נאמנות: ${counts.loyaltyMembers} חברים</div>
        <div style="font-size:13px;color:#555;margin-top:4px;">לוגים: ${counts.auditLogs}</div>
      </td></tr>
    </table>
    <p style="font-size:13px;color:#999;margin:20px 0 0;">קובץ הגיבוי מצורף למייל זה.</p>
  </td></tr>
  <tr><td style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
    <p style="font-size:12px;color:#aaa;margin:0;">© 2026 Menu4U · ${label}</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`,
        attachments: [{ filename: `menu4u-backup-${dateStr}.json`, content: json, contentType: "application/json" }],
      });
      emailSent = true;
    }
  } catch (e) {
    console.error("[backupEngine] email failed:", e);
  }

  // 4. Audit log
  await logAudit({
    userEmail: triggeredBy,
    action:    "EXPORT_BACKUP",
    entity:    "backup",
    entityName: label,
    meta:      { trigger, restaurantCount: allowedIds.length, counts, emailSent },
  });

  return { ok: true, restaurantCount: allowedIds.length, counts, emailSent, dateStr };
}
