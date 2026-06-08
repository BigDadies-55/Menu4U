import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TotpSetupClient from "./TotpSetupClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "🔐 אימות דו-שלבי | Menu4U" };

export default async function TotpSetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") redirect("/admin");

  return <TotpSetupClient />;
}
