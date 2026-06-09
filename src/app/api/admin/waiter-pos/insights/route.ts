import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

async function checkAccess(userId: string, role: string, restaurantId: string): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  const access = await prisma.restaurantUser.findFirst({ where: { userId, restaurantId } });
  return !!access;
}

// POST /api/admin/waiter-pos/insights
// Body: { restaurantId, tables: TableStatus[] }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { restaurantId, tables } = body as {
    restaurantId: string;
    tables: Array<{
      tableNum: string;
      seats: number;
      availStatus: string;
      minutesSitting: number;
      guests: number;
      orderStatus: string | null;
    }>;
  };

  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  if (!(await checkAccess(session.user.id, session.user.role, restaurantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const occupiedTables = tables.filter(t => t.availStatus === "occupied");
  if (occupiedTables.length === 0) {
    return NextResponse.json({ insights: [] });
  }

  const tablesSummary = occupiedTables
    .map(t => `שולחן ${t.tableNum}: ${t.guests} סועדים, ${t.minutesSitting} דקות, סטטוס הזמנה: ${t.orderStatus ?? "לא ידוע"}`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: `אתה עוזר חכם למלצר במסעדה. תפקידך לנתח נתוני שולחנות ולספק תובנות קצרות ופרקטיות בעברית.
כל תובנה צריכה להיות קצרה (עד 15 מילים), שימושית וממוקדת בפעולה.
החזר JSON בלבד בפורמט: [{"tableNum": "מספר", "type": "סוג", "text": "טקסט"}]
סוגים אפשריים: "alert" (דחוף), "tip" (עצה), "info" (מידע).
דוגמה לתובנות: ביקוש לחשבון, המלצה למנה, זמן ישיבה ארוך.`,
    messages: [
      {
        role: "user",
        content: `נתוני השולחנות הפעילים כרגע:\n${tablesSummary}\n\nספק עד 3 תובנות שימושיות למלצר. החזר JSON בלבד, ללא הסברים נוספים.`,
      },
    ],
  });

  let insights: Array<{ tableNum: string; type: string; text: string }> = [];
  try {
    const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    insights = JSON.parse(cleaned);
    if (!Array.isArray(insights)) insights = [];
  } catch {
    insights = [];
  }

  return NextResponse.json({ insights });
}
