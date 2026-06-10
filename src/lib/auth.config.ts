import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "TOTP",     type: "text" },
      },
      authorize: () => null,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id   = user.id;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        token.idleTimeoutMinutes = (user as { idleTimeoutMinutes?: number }).idleTimeoutMinutes ?? 0;
        token.requires2fa        = (user as { requires2fa?: boolean }).requires2fa ?? false;
      }
      if (trigger === "update" && session?.requires2fa !== undefined) {
        token.requires2fa = session.requires2fa;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.user.role = token.role as any;
        session.user.mustChangePassword  = token.mustChangePassword as boolean ?? false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).idleTimeoutMinutes = token.idleTimeoutMinutes as number ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).requires2fa = (token.requires2fa as boolean) ?? false;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  trustHost: true,
};
