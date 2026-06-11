import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const VALID_ALLERGENS = [
  "GLUTEN", "MILK", "EGGS", "FISH", "PEANUTS",
  "SOYBEANS", "NUTS", "SESAME", "CRUSTACEANS",
  "MOLLUSCS", "CELERY", "MUSTARD", "SULPHITES", "LUPIN",
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { restaurantId } = await req.json();

  const items = await prisma.item.findMany({
    where: restaurantId ? { category: { menu: { restaurantId } } } : {},
    select: { id: true, name: true, description: true, allergens: true },
  });

  if (!items.length) return NextResponse.json({ updated: 0, results: [] });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const client = new Anthropic({ apiKey });

  // Build prompt — send all items in one request to save cost
  const itemList = items
    .map(i => `${i.id}|${i.name}${i.description ? ` (${i.description})` : ""}`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a food allergen expert. For each menu item below, list which of the 14 EU allergens it likely contains based on the dish name and description.

Valid allergen keys: GLUTEN MILK EGGS FISH PEANUTS SOYBEANS NUTS SESAME CRUSTACEANS MOLLUSCS CELERY MUSTARD SULPHITES LUPIN

Rules:
- Only include allergens that are standard/expected ingredients for this dish type
- If unsure, omit rather than guess
- Respond with ONLY one line per item in format: <id>|ALLERGEN1,ALLERGEN2
- If no allergens, output: <id>|NONE
- Do not add explanations

Items:
${itemList}`,
      },
    ],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const lines = responseText.trim().split("\n");

  // Parse response into a map
  const allergenMap = new Map<string, string[]>();
  for (const line of lines) {
    const [id, allergenStr] = line.split("|");
    if (!id || !allergenStr) continue;
    const trimmedId = id.trim();
    if (allergenStr.trim() === "NONE") {
      allergenMap.set(trimmedId, []);
    } else {
      const allergens = allergenStr.split(",")
        .map(a => a.trim())
        .filter(a => VALID_ALLERGENS.includes(a));
      allergenMap.set(trimmedId, allergens);
    }
  }

  let updated = 0;
  const results: { name: string; allergens: string[] }[] = [];

  for (const item of items) {
    const newAllergens = allergenMap.get(item.id);
    if (newAllergens === undefined) continue;
    if (newAllergens.length === 0 && item.allergens.length === 0) continue;

    const sorted = (a: string[]) => [...a].sort().join(",");
    if (sorted(newAllergens) === sorted(item.allergens)) continue;

    await prisma.item.update({ where: { id: item.id }, data: { allergens: newAllergens } });
    results.push({ name: item.name, allergens: newAllergens });
    updated++;
  }

  return NextResponse.json({ updated, results });
}
