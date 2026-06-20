import { prisma } from "@/lib/prisma";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Read the configurable split-screen image + brightness directly from the DB.
  let loginImage: string | null = null;
  let brightness = 100;
  try {
    const rows = await prisma.$queryRawUnsafe<{ loginImage: string | null; loginImageBrightness: number | null }[]>(
      `SELECT "loginImage","loginImageBrightness" FROM "SiteConfig" WHERE id = 'default' LIMIT 1`
    );
    loginImage = rows[0]?.loginImage ?? null;
    if (typeof rows[0]?.loginImageBrightness === "number") brightness = rows[0].loginImageBrightness;
  } catch { /* columns may not exist yet */ }

  return <LoginForm loginImage={loginImage} brightness={brightness} />;
}
