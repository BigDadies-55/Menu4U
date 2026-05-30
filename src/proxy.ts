import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

const { auth } = NextAuth(authConfig);

const ACTIVITY_COOKIE = "last-activity";
const IS_PROD = process.env.NODE_ENV === "production";

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const isLoggedIn = !!session;

  // ── /change-password route (outside admin, no sidebar) ───────────────
  if (pathname === "/change-password") {
    if (!isLoggedIn) return NextResponse.redirect(new URL("/login", req.url));
    if (!session?.user?.mustChangePassword) return NextResponse.redirect(new URL("/admin", req.url));
    return NextResponse.next();
  }

  // ── /api/admin/* — auth + mustChangePassword enforcement ─────────────
  if (pathname.startsWith("/api/admin/")) {
    if (!isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session?.user?.mustChangePassword) return NextResponse.json({ error: "Password change required" }, { status: 403 });
    return NextResponse.next();
  }

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

  // ── Idle session timeout (value from JWT, not client cookie) ─────────
  const idleMinutes = (session?.user as { idleTimeoutMinutes?: number })?.idleTimeoutMinutes ?? 0;
  if (idleMinutes > 0) {
    const lastActivity = req.cookies.get(ACTIVITY_COOKIE)?.value;
    if (lastActivity) {
      const elapsedMinutes = (Date.now() - parseInt(lastActivity, 10)) / 60000;
      if (elapsedMinutes > idleMinutes) {
        const res = NextResponse.redirect(new URL("/login?reason=timeout", req.url));
        res.cookies.delete(ACTIVITY_COOKIE);
        return res;
      }
    }
  }

  // ── Force password change ─────────────────────────────────────────────
  if (session?.user?.mustChangePassword) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  // Update last-activity timestamp on every admin request
  const res = NextResponse.next();
  res.cookies.set(ACTIVITY_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    path: "/",
  });
  return res;
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/login", "/change-password"],
};
