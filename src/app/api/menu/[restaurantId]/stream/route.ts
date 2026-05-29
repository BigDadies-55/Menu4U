import { prisma } from "@/lib/prisma";
import { sseSubscribe } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const { restaurantId } = await params;

  // Verify restaurant exists and orders are enabled
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId, isActive: true },
    select: { id: true },
  });
  if (!restaurant) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = sseSubscribe(restaurantId, () => {
        try {
          controller.enqueue(encoder.encode("data: update\n\n"));
        } catch {}
      });

      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 25000);

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
      "X-Accel-Buffering": "no",
    },
  });
}
