import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { feedback } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/security/rate-limit";

const COOKIE_NAME = "dental_conversation_id";

export async function POST(request: NextRequest) {
  const conversationId = request.cookies.get(COOKIE_NAME)?.value;
  if (!conversationId) {
    return Response.json({ error: "No active conversation." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = checkRateLimit(`feedback:${ip}`, 30, 60_000);
  if (!limit.allowed) {
    return Response.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: { messageId?: unknown; rating?: unknown; comment?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const messageId =
    typeof body.messageId === "string" ? body.messageId.slice(0, 120) : null;
  const rating = body.rating === 1 || body.rating === -1 ? body.rating : null;
  const comment =
    typeof body.comment === "string"
      ? body.comment.trim().slice(0, 1000) || null
      : null;

  if (!rating) {
    return Response.json({ error: "Rating must be 1 or -1." }, { status: 400 });
  }

  db.insert(feedback)
    .values({
      id: `fb_${randomUUID()}`,
      conversationId,
      messageId,
      rating,
      comment,
      createdAt: new Date().toISOString(),
    })
    .run();

  return Response.json({ ok: true });
}
