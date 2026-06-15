import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/admin/PageShell";
import SitemapClient from "./SitemapClient";

export const dynamic = "force-dynamic";

export default async function SitemapPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <PageShell>
      <SitemapClient />
    </PageShell>
  );
}
