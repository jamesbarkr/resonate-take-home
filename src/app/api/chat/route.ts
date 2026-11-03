import { randomUUID } from "node:crypto";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isTextUIPart,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import type { NextRequest } from "next/server";
import {
  getLanguageModel,
  isLlmConfigured,
} from "@/lib/agent/model";
import { buildSystemPrompt } from "@/lib/agent/prompt";
import { createAgentTools } from "@/lib/agent/tools";
import {
  ensureConversation,
  persistUiMessages,
} from "@/lib/domain/conversation-service";
import { checkRateLimit } from "@/lib/security/rate-limit";

const COOKIE_NAME = "dental_conversation_id";
const CONVERSATION_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;

function resolveConversationId(request: NextRequest): string {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  if (existing && CONVERSATION_PATTERN.test(existing)) {
    return existing;
  }
  return `conv_${randomUUID()}`;
}

function cookieHeader(conversationId: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${conversationId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

function lastUserText(messages: UIMessage[]): string {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
  if (!lastUser) return "";
  return lastUser.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n");
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  const limit = checkRateLimit(`chat:${ip}`);
  if (!limit.allowed) {
    return Response.json(
      {
        error:
          "Too many messages in a short period. Please wait a moment and try again.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }

  if (!isLlmConfigured()) {
    return Response.json(
      {
        error:
          "The assistant is not configured yet. Add LLM_API_KEY (your Synthetic API key) to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  let body: { messages?: UIMessage[] };
  try {
    body = (await request.json()) as { messages?: UIMessage[] };
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "At least one message is required." },
      { status: 400 },
    );
  }

  const userText = lastUserText(messages);
  if (!userText.trim()) {
    return Response.json(
      { error: "Please send a text message." },
      { status: 400 },
    );
  }
  if (userText.length > 4_000) {
    return Response.json(
      {
        error:
          "That message is too long. Please shorten it and try again, or call the office.",
      },
      { status: 413 },
    );
  }

  const conversationId = resolveConversationId(request);
  ensureConversation(conversationId);
  persistUiMessages(conversationId, messages);

  const tools = createAgentTools(conversationId);

  try {
    const modelMessages = await convertToModelMessages(messages);
    const result = streamText({
      model: getLanguageModel(),
      system: buildSystemPrompt(),
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(8),
      maxRetries: 2,
      timeout: { totalMs: 60_000, stepMs: 30_000 },
      onError: ({ error }) => {
        console.error("[chat] model stream error", {
          conversationId,
          name: error instanceof Error ? error.name : "unknown",
        });
      },
    });

    const uiStream = toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: messages,
      onError: () =>
        "I hit a technical snag on my side. I can pass this to the front desk so nothing gets lost.",
      onEnd: async ({ messages: finalMessages }) => {
        try {
          persistUiMessages(conversationId, finalMessages);
        } catch (error) {
          console.error("[chat] failed to persist transcript", {
            conversationId,
            error: error instanceof Error ? error.message : "unknown",
          });
        }
      },
    });

    return createUIMessageStreamResponse({
      stream: uiStream,
      headers: {
        "Set-Cookie": cookieHeader(conversationId),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[chat] failed to start stream", {
      conversationId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return Response.json(
      {
        error:
          "I could not start the conversation. Please try again, or call the office at 617-555-0142.",
      },
      { status: 500 },
    );
  }
}
