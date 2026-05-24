import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";
export const dynamic = "force-dynamic";

const DEFAULTS = {
  siteName: "Menu4U", logo: null as string | null,
  domain: null as string | null, copyright: null as string | null,
  adminPalette: "dark", adminBg: "#f0ece3", adminBgImage: null as string | null,
  adminSidebarBg: null as string | null, adminSidebarAccent: null as string | null,
  adminSidebarTextColor: "#9ca3af", adminContentTextColor: "#111827",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/admin");

  let config = { ...DEFAULTS };
  let needsMigration = false;

  try {
    const rows = await prisma.$queryRaw<typeof DEFAULTS[]>`
      SELECT * FROM "SiteConfig" WHERE id = 'default' LIMIT 1
    `;
    if (rows[0]) config = { ...DEFAULTS, ...rows[0] };
    else needsMigration = true;
  } catch {
    needsMigration = true;
  }

  return (
    <>
      {needsMigration && (
        <div className="mx-4 mt-4 md:mx-8 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <span>⚠️</span>
          <span className="text-sm text-amber-800">
            טבלת הגדרות האתר עדיין לא נוצרה.{" "}
            <a href="/api/migrate" className="font-semibold underline hover:no-underline">
              לחץ כאן להרצת המיגרציה
            </a>
            {" "}ולאחר מכן רענן את הדף.
          </span>
        </div>
      )}
      <SettingsClient config={config} />
    </>
  );
}
