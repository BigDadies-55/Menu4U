import { prisma } from "@/lib/prisma";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Read the configurable background image + brightness + brand directly from the DB.
  let loginImage: string | null = null;
  let brightness = 100;
  let logo: string | null = null;
  let siteName = "Menu4U";
  try {
    const rows = await prisma.$queryRawUnsafe<{ loginImage: string | null; loginImageBrightness: number | null; logo: string | null; siteName: string | null }[]>(
      `SELECT "loginImage","loginImageBrightness","logo","siteName" FROM "SiteConfig" WHERE id = 'default' LIMIT 1`
    );
    loginImage = rows[0]?.loginImage ?? null;
    if (typeof rows[0]?.loginImageBrightness === "number") brightness = rows[0].loginImageBrightness;
    logo = rows[0]?.logo ?? null;
    if (rows[0]?.siteName) siteName = rows[0].siteName;
  } catch { /* columns may not exist yet */ }

  return <LoginForm loginImage={loginImage} brightness={brightness} logo={logo} siteName={siteName} />;
}
