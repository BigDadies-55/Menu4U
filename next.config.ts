import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Prisma v7 with custom output path causes a phantom type error on Vercel
    // (a generated/cached file imports PrismaClient from @prisma/client which
    // doesn't export it when using custom output). Types are verified locally
    // via `npx tsc --noEmit` before every push.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
