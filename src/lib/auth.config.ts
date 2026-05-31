import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: () => null,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        token.idleTimeoutMinutes = (user as { idleTimeoutMinutes?: number }).idleTimeoutMinutes ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        session.user.role = token.role as any;
        session.user.mustChangePassword = token.mustChangePassword as boolean ?? false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).idleTimeoutMinutes = token.idleTimeoutMinutes as number ?? 0;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  trustHost: true,
};
