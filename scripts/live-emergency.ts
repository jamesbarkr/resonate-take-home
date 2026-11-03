import { randomUUID } from "node:crypto";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { getLanguageModel } from "../src/lib/agent/model";
import { buildSystemPrompt } from "../src/lib/agent/prompt";
import { createAgentTools } from "../src/lib/agent/tools";
import { ensureConversation } from "../src/lib/domain/conversation-service";

function summarize(steps: Awaited<ReturnType<typeof generateText>>["steps"]) {
  return steps
    .flatMap((step) => step.toolCalls.map((call) => call.toolName))
    .join(", ");
}

async function main() {
  const conversationId = `conv_live_emergency_${randomUUID()}`;
  ensureConversation(conversationId);
  const tools = createAgentTools(conversationId);

  let messages: ModelMessage[] = [
    {
      role: "user",
      content:
        "I'm David Johnson, phone 617-555-0101, DOB 1985-04-12. I have severe tooth pain and facial swelling.",
    },
  ];

  const first = await generateText({
    model: getLanguageModel(),
    system: buildSystemPrompt(),
    messages,
    tools,
    stopWhen: stepCountIs(8),
    maxRetries: 1,
  });
  console.log("turn 1 tools:", summarize(first.steps) || "(none)");
  console.log(first.text);

  messages = [
    ...messages,
    ...first.response.messages,
    {
      role: "user",
      content:
        "No trouble breathing or swallowing, and the swelling is not spreading. Please book the earliest emergency slot and let the dental team know about the swelling.",
    },
  ];

  const second = await generateText({
    model: getLanguageModel(),
    system: buildSystemPrompt(),
    messages,
    tools,
    stopWhen: stepCountIs(8),
    maxRetries: 1,
  });
  console.log("\nturn 2 tools:", summarize(second.steps) || "(none)");
  console.log(second.text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
