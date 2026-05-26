import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // 1. Validate Authorization header
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Check BACKUP_SCHEDULE env var (strip quotes/whitespace in case user added them)
  const scheduleRaw = (process.env.BACKUP_SCHEDULE ?? "")
    .toLowerCase().trim()
    .replace(/^["'​ ]+|["'​ ]+$/g, "").trim();
  const schedule = ["daily", "weekly"].includes(scheduleRaw) ? scheduleRaw : "off";

  if (schedule === "off") {
    console.log("[cron/backup] Skipping — BACKUP_SCHEDULE is off or not set");
    return NextResponse.json({ skipped: true });
  }

  if (schedule === "weekly") {
    const day = new Date().getDay();
    if (day !== 0) {
      console.log(`[cron/backup] Skipping — not Sunday (day=${day})`);
      return NextResponse.json({ skipped: "not sunday" });
    }
  }

  // 3. Fetch all restaurants
  const allRestaurants = await prisma.restaurant.findMany({ select: { id: true } });
  const allowedIds = allRestaurants.map((r) => r.id);

  // 4. Fetch all backup data
  const [
    restaurants,
    restaurantUsers,
    users,
    menus,
    categories,
    items,
    modifierGroups,
    modifiers,
    orders,
    orderItems,
    orderItemModifiers,
    orderStatusLogs,
    customers,
    tableSessions,
    auditLogs,
    menuViews,
  ] = await Promise.all([
    prisma.restaurant.findMany({ where: { id: { in: allowedIds } } }),

    prisma.restaurantUser.findMany({ where: { restaurantId: { in: allowedIds } } }),

    prisma.user.findMany({
      where: {
        restaurantUsers: { some: { restaurantId: { in: allowedIds } } },
      },
      select: {
        id: true, email: true, name: true, role: true,
        emailVerified: true, termsAccepted: true, createdAt: true,
      },
    }),

    prisma.menu.findMany({ where: { restaurantId: { in: allowedIds } } }),

    prisma.category.findMany({
      where: { menu: { restaurantId: { in: allowedIds } } },
    }),

    prisma.item.findMany({
      where: { category: { menu: { restaurantId: { in: allowedIds } } } },
    }),

    prisma.itemModifierGroup.findMany({
      where: { item: { category: { menu: { restaurantId: { in: allowedIds } } } } },
    }),

    prisma.itemModifier.findMany({
      where: { group: { item: { category: { menu: { restaurantId: { in: allowedIds } } } } } },
    }),

    prisma.order.findMany({ where: { restaurantId: { in: allowedIds } }, orderBy: { createdAt: "asc" } }),

    prisma.orderItem.findMany({
      where: { order: { restaurantId: { in: allowedIds } } },
    }),

    prisma.orderItemModifier.findMany({
      where: { orderItem: { order: { restaurantId: { in: allowedIds } } } },
    }),

    prisma.orderStatusLog.findMany({
      where: { order: { restaurantId: { in: allowedIds } } },
      orderBy: { changedAt: "asc" },
    }),

    prisma.customer.findMany({ where: { restaurantId: { in: allowedIds } } }),

    prisma.tableSession.findMany({
      where: { restaurantId: { in: allowedIds } },
      orderBy: { closedAt: "asc" },
    }),

    prisma.auditLog.findMany({
      orderBy: { createdAt: "asc" },
      take: 10000,
    }).catch(() => []),

    prisma.menuView.findMany({ where: { restaurantId: { in: allowedIds } } }).catch(() => []),
  ]);

  // 5. Build backup object
  const counts = {
    restaurants: restaurants.length,
    users: users.length,
    menus: menus.length,
    categories: categories.length,
    items: items.length,
    modifierGroups: modifierGroups.length,
    modifiers: modifiers.length,
    orders: orders.length,
    orderItems: orderItems.length,
    customers: customers.length,
    auditLogs: auditLogs.length,
    tableSessions: tableSessions.length,
    menuViews: menuViews.length,
  };

  const backup = {
    _meta: {
      version: 2,
      exportedAt: new Date().toISOString(),
      exportedBy: "cron",
      restaurantIds: allowedIds,
      counts,
    },
    restaurants,
    restaurantUsers,
    users,
    menus,
    categories,
    items,
    modifierGroups,
    modifiers,
    orders,
    orderItems,
    orderItemModifiers,
    orderStatusLogs,
    customers,
    tableSessions,
    auditLogs,
    menuViews,
  };

  // 6. Serialize
  const json = JSON.stringify(backup, null, 2);

  // 7. Send email to all SUPER_ADMIN users
  const dateStr = new Date().toISOString().slice(0, 10);
  try {
    const superAdmins = await prisma.user.findMany({
      where: { role: "SUPER_ADMIN" },
      select: { email: true },
    });

    if (superAdmins.length > 0) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: `"Menu4U" <${process.env.GMAIL_USER}>`,
        to: superAdmins.map((u) => u.email).join(", "),
        subject: `גיבוי אוטומטי Menu4U — ${dateStr}`,
        html: `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1208,#3d2b00);padding:32px;text-align:center;">
            <div style="font-size:28px;font-weight:900;color:#C9A84C;letter-spacing:2px;">Menu4U</div>
            <div style="font-size:13px;color:#a08040;margin-top:4px;">גיבוי אוטומטי</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="font-size:20px;font-weight:700;color:#1a1208;margin:0 0 16px;">גיבוי אוטומטי בוצע בהצלחה ✓</h2>
            <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 16px;">
              גיבוי אוטומטי של מערכת Menu4U בוצע בתאריך <strong>${dateStr}</strong>.
            </p>
            <p style="font-size:15px;color:#555;line-height:1.7;margin:0 0 24px;">
              ראה קובץ מצורף להורדת הגיבוי המלא.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5e4;border:1px solid #e8d99a;border-radius:12px;">
              <tr>
                <td style="padding:16px 20px;">
                  <div style="font-size:13px;font-weight:700;color:#8B6914;margin-bottom:8px;">סטטיסטיקות גיבוי</div>
                  <div style="font-size:13px;color:#555;">מסעדות: ${counts.restaurants} | תפריטים: ${counts.menus} | הזמנות: ${counts.orders}</div>
                  <div style="font-size:13px;color:#555;margin-top:4px;">פריטים: ${counts.items} | לקוחות: ${counts.customers}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:20px 32px;text-align:center;border-top:1px solid #eee;">
            <p style="font-size:12px;color:#aaa;margin:0;">© 2026 Menu4U · גיבוי אוטומטי (${schedule})</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        attachments: [
          {
            filename: `menu4u-backup-${dateStr}.json`,
            content: json,
            contentType: "application/json",
          },
        ],
      });
    }
  } catch (emailErr) {
    console.error("[cron/backup] Failed to send email:", emailErr);
  }

  // 8. Log to auditLog
  await logAudit({
    action: "EXPORT_BACKUP",
    entity: "backup",
    entityName: "גיבוי אוטומטי",
    meta: {
      trigger: "cron",
      schedule: process.env.BACKUP_SCHEDULE,
      restaurantCount: allowedIds.length,
      counts,
    },
  });

  // 9. Return success
  return NextResponse.json({ ok: true, restaurantCount: allowedIds.length });
}
