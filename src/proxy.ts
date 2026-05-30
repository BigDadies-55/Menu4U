import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

const { auth } = NextAuth(authConfig);

const ACTIVITY_COOKIE = "last-activity";

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session;

  // Redirect unauthenticated users away from /admin
  if (pathname.startsWith("/admin") && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect logged-in users away from /login
  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  if (!pathname.startsWith("/admin") || !isLoggedIn) {
    return NextResponse.next();
  }

  // ── Idle session timeout ──────────────────────────────────────────────
  const idleMinutes = parseInt(req.cookies.get("idle-timeout")?.value ?? "0", 10);
  if (idleMinutes > 0) {
    const lastActivity = req.cookies.get(ACTIVITY_COOKIE)?.value;
    if (lastActivity) {
      const elapsedMinutes = (Date.now() - parseInt(lastActivity, 10)) / 60000;
      if (elapsedMinutes > idleMinutes) {
        const res = NextResponse.redirect(new URL("/login?reason=timeout", req.url));
        res.cookies.delete(ACTIVITY_COOKIE);
        res.cookies.delete("idle-timeout");
        return res;
      }
    }
  }

  // ── Force password change ─────────────────────────────────────────────
  const mustChange = session?.user?.mustChangePassword;
  const isChangePage = pathname === "/admin/change-password";
  if (mustChange && !isChangePage) {
    return NextResponse.redirect(new URL("/admin/change-password", req.url));
  }

  // Update last-activity timestamp on every admin request
  const res = NextResponse.next();
  res.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
});

export const config = {
  matcher: ["/admin/:path*", "/login"],
};
