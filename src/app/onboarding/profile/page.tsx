import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OnboardingProfileForm from "./OnboardingProfileForm";

export const dynamic = "force-dynamic";

export default async function OnboardingProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, firstName: true, lastName: true, phone: true },
  });

  // city/address are raw columns (not in the Prisma schema) — read if present.
  let city = "", address = "";
  try {
    const rows = await prisma.$queryRawUnsafe<{ city: string | null; address: string | null }[]>(
      `SELECT "city","address" FROM "User" WHERE id=$1`, session.user.id
    );
    city = rows[0]?.city ?? "";
    address = rows[0]?.address ?? "";
  } catch { /* columns may not exist before migration */ }

  const initialName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "";

  return (
    <OnboardingProfileForm
      initialName={initialName}
      initialPhone={user?.phone ?? ""}
      initialCity={city}
      initialAddress={address}
    />
  );
}
