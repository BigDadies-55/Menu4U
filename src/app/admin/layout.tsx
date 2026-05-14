import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50" dir="rtl">
      <Sidebar user={session.user} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
