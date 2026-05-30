import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import type { Role } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findFirst({
          where: { email: credentials.email as string },
          orderBy: { createdAt: "asc" },
        });

        if (!user || !user.password) {
          await logAudit({ action: "LOGIN_FAILED", meta: { email: credentials.email } });
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          await logAudit({ action: "LOGIN_FAILED", userEmail: user.email, userId: user.id, meta: { reason: "bad_password" } });
          return null;
        }

        await prisma.user.update({ where: { id: user.id }, data: { lastActivityAt: new Date(), lastLoginAt: new Date() } });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.id = user.id;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        (session.user as { mustChangePassword?: boolean }).mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await logAudit({ action: "LOGIN_SUCCESS", userId: user.id, userEmail: user.email });
    },
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      await logAudit({
        action: "LOGOUT",
        userId: token?.id as string | undefined,
        userEmail: token?.email as string | undefined,
      });
    },
  },
});
