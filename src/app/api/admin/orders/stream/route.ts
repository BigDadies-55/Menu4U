import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sseSubscribe } from "@/lib/sse";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  const { searchParams } = new URL(req.url);
  const requestedRestaurantId = searchParams.get("restaurantId");

  // Determine which restaurantId to subscribe to
  let subscribeKey: string;

  if (role === "SUPER_ADMIN") {
    subscribeKey = requestedRestaurantId ?? "ALL";
  } else {
    // Verify the user belongs to the requested restaurant
    if (!requestedRestaurantId) {
      return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
    }
    const link = await prisma.restaurantUser.findFirst({
      where: { userId: session.user.id, restaurantId: requestedRestaurantId },
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    subscribeKey = requestedRestaurantId;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection confirmation
      controller.enqueue(encoder.encode(": connected\n\n"));

      // Subscribe to order updates
      const unsubscribe = sseSubscribe(subscribeKey, () => {
        try {
          controller.enqueue(encoder.encode("data: update\n\n"));
        } catch {
          // Controller may be closed
        }
      });

      // Keepalive every 25 seconds to prevent proxy timeouts
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 25000);

      // Cleanup when client disconnects
      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(keepalive);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Prevent nginx buffering
    },
  });
}
