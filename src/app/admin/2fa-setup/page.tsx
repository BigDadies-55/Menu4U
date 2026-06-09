import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TotpSetupClient from "./TotpSetupClient";

export default async function TwoFASetupPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role as string;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) redirect("/admin");

  return <TotpSetupClient />;
}
