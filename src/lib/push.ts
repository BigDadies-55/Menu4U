import webpush from "web-push";

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@menu4u.app";

let vapidReady = false;
function initVapid() {
  if (vapidReady || !VAPID_PUBLIC || !VAPID_PRIVATE) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidReady = true;
}

export type PushEventType = "ORDER_CREATED" | "COURSE_DONE" | "TABLE_PAYMENT" | "ITEM_VOID";

type Sub = { endpoint: string; p256dh: string; auth: string };
type PushPayload = { title: string; body: string; url?: string; tag?: string };

async function sendToSubs(subs: Sub[], payload: PushPayload) {
  initVapid();
  if (!vapidReady || subs.length === 0) return;
  await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      ).catch(() => { /* ignore individual failures */ })
    )
  );
}

export async function notifyRestaurant(
  restaurantId: string,
  event: PushEventType,
  payload: PushPayload
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try {
    const { prisma } = await import("@/lib/prisma");
    const subs = await prisma.$queryRawUnsafe<Sub[]>(
      `SELECT ps.endpoint, ps.p256dh, ps.auth
       FROM "PushSubscription" ps
       JOIN "RestaurantUser" ru ON ru."userId" = ps."userId"
       WHERE ru."restaurantId" = $1
         AND $2 = ANY(ps.events)`,
      restaurantId, event
    );
    await sendToSubs(subs, payload);
  } catch { /* table may not exist yet */ }
}
