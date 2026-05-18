/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: 'tsconfig.build.json',
  },
  serverExternalPackages: ["nodemailer"],
};

module.exports = nextConfig;
