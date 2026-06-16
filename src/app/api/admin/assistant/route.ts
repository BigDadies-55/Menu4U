import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "OWNER", "SHIFT_MANAGER"];
const MIN_SCORE = 0.2; // minimum relevance score to return answer

type Entry = { id: string; question: string; answer: string; tags: string[]; score: number; isDefault: boolean };

// Simple TF-IDF-like relevance score
function relevance(query: string, entry: Entry): number {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(w => w.length > 1);
  const text = (entry.question + " " + entry.tags.join(" ")).toLowerCase();

  if (text.includes(q)) return 1.0; // exact match

  let score = 0;
  for (const w of words) {
    if (text.includes(w)) score += 1 / words.length;
  }
  // boost by DB score (thumbs up history)
  score += Math.min(entry.score * 0.02, 0.3);
  return score;
}

// GET — search or list defaults
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page  = searchParams.get("page") ?? "general";
  const query = searchParams.get("q")?.trim() ?? "";

  let rows: Entry[] = [];
  try {
    rows = await prisma.$queryRawUnsafe<Entry[]>(
      `SELECT id, question, answer, tags, score, "isDefault"
       FROM "AssistantEntry"
       WHERE page = $1 OR page = 'general'
       ORDER BY score DESC, "isDefault" DESC
       LIMIT 100`,
      page
    );
  } catch { return NextResponse.json({ results: [], defaults: [] }); }

  if (!query) {
    // Return default suggestions for this page
    const defaults = rows.filter(r => r.isDefault && r.page === page).slice(0, 5);
    return NextResponse.json({ results: [], defaults });
  }

  // Score + filter
  const scored = rows
    .map(r => ({ ...r, rel: relevance(query, r) }))
    .filter(r => r.rel >= MIN_SCORE)
    .sort((a, b) => b.rel - a.rel)
    .slice(0, 3);

  // If no results found — log to unanswered
  if (scored.length === 0 && query.length > 3) {
    try {
      const existing = await prisma.$queryRawUnsafe<{ id: string; count: number }[]>(
        `SELECT id, count FROM "AssistantUnanswered" WHERE page=$1 AND question ILIKE $2 AND resolved=false LIMIT 1`,
        page, `%${query}%`
      );
      if (existing.length > 0) {
        await prisma.$executeRawUnsafe(
          `UPDATE "AssistantUnanswered" SET count=count+1, "updatedAt"=NOW() WHERE id=$1`,
          existing[0].id
        );
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "AssistantUnanswered" (id, page, question) VALUES ($1,$2,$3)`,
          crypto.randomUUID(), page, query
        );
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({ results: scored, defaults: [] });
}

// POST — feedback (thumbs up/down)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { entryId, page, question, rating } = await req.json() as {
    entryId?: string; page: string; question: string; rating: 1 | -1;
  };

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AssistantFeedback" (id, "entryId", page, question, rating) VALUES ($1,$2,$3,$4,$5)`,
      crypto.randomUUID(), entryId ?? null, page, question, rating
    );
    if (entryId) {
      await prisma.$executeRawUnsafe(
        `UPDATE "AssistantEntry" SET score=score+$1, "updatedAt"=NOW() WHERE id=$2`,
        rating, entryId
      );
    }
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true });
}
