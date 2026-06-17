import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import type { Role } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { verifyTotpCode } from "@/lib/totp";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES   = 30;

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "TOTP",     type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user || !user.password) {
          await logAudit({ action: "LOGIN_FAILED", meta: { username: credentials.username } });
          return null;
        }

        // Account lockout check
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await logAudit({ action: "LOGIN_FAILED", userId: user.id, userEmail: user.email ?? undefined, meta: { reason: "account_locked" } });
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          const attempts = user.failedLoginAttempts + 1;
          const lockedUntil = attempts >= LOCKOUT_THRESHOLD
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null;
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: attempts, ...(lockedUntil ? { lockedUntil } : {}) },
          });
          await logAudit({ action: "LOGIN_FAILED", userId: user.id, userEmail: user.email ?? undefined, meta: { reason: "bad_password", attempts } });
          return null;
        }

        // Reset lockout on success
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null, lastActivityAt: new Date(), lastLoginAt: new Date() },
        });

        const policy = await prisma.passwordPolicy.findUnique({ where: { id: "default" } });

        // Password expiry enforcement
        let mustChangePassword = user.mustChangePassword;
        if (!mustChangePassword && policy?.maxAgeDays && policy.maxAgeDays > 0 && user.passwordChangedAt) {
          const ageMs = Date.now() - user.passwordChangedAt.getTime();
          if (ageMs > policy.maxAgeDays * 86_400_000) {
            mustChangePassword = true;
            await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
          }
        }

        // 2FA required for SUPER_ADMIN and ADMIN (if enabled)
        const needs2fa = user.totpEnabled && (user.role === "SUPER_ADMIN" || user.role === "ADMIN");

        if (needs2fa) {
          const totpCode = credentials.totpCode as string | undefined;
          if (!totpCode) {
            // First step: password ok, 2FA still needed — signal to client
            return {
              id: user.id,
              email: user.email ?? "",
              name: user.name,
              image: user.image,
              role: user.role,
              mustChangePassword,
              idleTimeoutMinutes: policy?.idleTimeoutMinutes ?? 0,
              requires2fa: true,
            };
          }
          if (!verifyTotpCode(user.totpSecret!, totpCode)) {
            await logAudit({ action: "LOGIN_FAILED", userId: user.id, userEmail: user.email ?? undefined, meta: { reason: "bad_totp" } });
            return null;
          }
        }

        return {
          id: user.id,
          email: user.email ?? "",
          name: user.name,
          image: user.image,
          role: user.role,
          mustChangePassword,
          idleTimeoutMinutes: policy?.idleTimeoutMinutes ?? 0,
          requires2fa: false,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.id   = user.id;
        token.mustChangePassword  = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        token.idleTimeoutMinutes  = (user as { idleTimeoutMinutes?: number }).idleTimeoutMinutes ?? 0;
        token.requires2fa         = (user as { requires2fa?: boolean }).requires2fa ?? false;
      }
      if (trigger === "update" && session?.requires2fa !== undefined) {
        token.requires2fa = session.requires2fa;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id as string;
        session.user.role = token.role as Role;
        (session.user as { mustChangePassword?: boolean }).mustChangePassword  = token.mustChangePassword as boolean;
        (session.user as { idleTimeoutMinutes?: number }).idleTimeoutMinutes   = (token.idleTimeoutMinutes as number) ?? 0;
        (session.user as { requires2fa?: boolean }).requires2fa                = (token.requires2fa as boolean) ?? false;
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
        userId:    token?.id as string | undefined,
        userEmail: token?.email as string | undefined,
      });
    },
  },
});
