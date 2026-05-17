import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true, termsAccepted: true },
  });

  if (!user?.emailVerified) {
    redirect("/verify-email");
  }

  if (!user?.termsAccepted) {
    redirect("/terms");
  }

  return <AdminShell user={session.user}>{children}</AdminShell>;
}
