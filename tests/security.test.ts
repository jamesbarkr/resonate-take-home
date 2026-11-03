import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as chatPost } from "@/app/api/chat/route";
import { DomainError, toSafeToolError } from "@/lib/domain/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { useTestDatabase } from "./helpers/db";

useTestDatabase();

function chatRequest(body: unknown, ip: string) {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

function withLlmKey<T>(fn: () => Promise<T>): Promise<T> {
  const saved = process.env.LLM_API_KEY;
  process.env.LLM_API_KEY = "test-key";
  return fn().finally(() => {
    if (saved === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = saved;
  });
}

function withNoLlmKey<T>(fn: () => Promise<T>): Promise<T> {
  const saved = {
    LLM_API_KEY: process.env.LLM_API_KEY,
    SYNTHETIC_API_KEY: process.env.SYNTHETIC_API_KEY,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  };

  delete process.env.LLM_API_KEY;
  delete process.env.SYNTHETIC_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;

  return fn().finally(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

describe("guardrails", () => {
  it("rate limits repeated requests", () => {
    const first = checkRateLimit("rate-test", 2, 10_000);
    const second = checkRateLimit("rate-test", 2, 10_000);
    const third = checkRateLimit("rate-test", 2, 10_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("converts domain errors into safe tool errors", () => {
    const safe = toSafeToolError(
      new DomainError("SLOT_UNAVAILABLE", "That time was just taken."),
    );
    expect(safe).toEqual({
      ok: false,
      code: "SLOT_UNAVAILABLE",
      message: "That time was just taken.",
    });

    const unknown = toSafeToolError(new Error("database exploded"));
    expect(unknown.code).toBe("INTERNAL_ERROR");
    expect(unknown.message).not.toContain("database exploded");
  });

  it("returns a clear 503 when the LLM key is missing", async () => {
    const response = await withNoLlmKey(() =>
      chatPost(
        chatRequest(
          {
            messages: [
              { id: "m1", role: "user", parts: [{ type: "text", text: "hi" }] },
            ],
          },
          "10.0.0.1",
        ),
      ),
    );

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("LLM_API_KEY");
  });

  it("rejects empty message lists", async () => {
    const response = await withLlmKey(() =>
      chatPost(chatRequest({ messages: [] }, "10.0.0.2")),
    );
    expect(response.status).toBe(400);
  });

  it("rejects oversized messages", async () => {
    const response = await withLlmKey(() =>
      chatPost(
        chatRequest(
          {
            messages: [
              {
                id: "m1",
                role: "user",
                parts: [{ type: "text", text: "x".repeat(4_001) }],
              },
            ],
          },
          "10.0.0.3",
        ),
      ),
    );
    expect(response.status).toBe(413);
  });

  it("returns 429 after the per-IP chat limit is exceeded", async () => {
    let lastStatus = 0;
    for (let index = 0; index < 31; index += 1) {
      const response = await withNoLlmKey(() =>
        chatPost(chatRequest({ messages: [] }, "10.0.0.4")),
      );
      lastStatus = response.status;
    }
    expect(lastStatus).toBe(429);
  });
});
