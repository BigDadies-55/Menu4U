import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PermissionsClient from "./PermissionsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "עץ הרשאות | Menu4U" };

export default async function PermissionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) redirect("/admin");
  return <PermissionsClient />;
}
