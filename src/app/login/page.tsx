import { prisma } from "@/lib/prisma";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Read the configurable split-screen image directly from the DB (always fresh).
  let loginImage: string | null = null;
  try {
    const rows = await prisma.$queryRawUnsafe<{ loginImage: string | null }[]>(
      `SELECT "loginImage" FROM "SiteConfig" WHERE id = 'default' LIMIT 1`
    );
    loginImage = rows[0]?.loginImage ?? null;
  } catch { /* column may not exist yet */ }

  return <LoginForm loginImage={loginImage} />;
}
