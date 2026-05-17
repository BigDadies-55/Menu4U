import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/permissions";
import LogsClient from "./LogsClient";

export default async function LogsPage() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) redirect("/admin");
  return <LogsClient />;
}
