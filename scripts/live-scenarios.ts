import { randomUUID } from "node:crypto";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { getLanguageModel } from "../src/lib/agent/model";
import { buildSystemPrompt } from "../src/lib/agent/prompt";
import { createAgentTools } from "../src/lib/agent/tools";
import { ensureConversation } from "../src/lib/domain/conversation-service";

const scenarios = [
  {
    name: "existing patient reschedule (subjective date)",
    message:
      "I'm an existing patient. My name is Maria Lopez, phone 617-555-0102, DOB 1990-11-30. I need to move my appointment to later next week, preferably a morning.",
  },
  {
    name: "emergency triage",
    message:
      "I'm David Johnson, phone 617-555-0101, DOB 1985-04-12. I have severe tooth pain and my face is swelling. What can you do?",
  },
  {
    name: "family booking",
    message:
      "I'd like to book cleanings for my family next week: David Johnson (617-555-0101, 1985-04-12) and Sarah Johnson (same phone, 1987-09-03).",
  },
  {
    name: "insurance and no-insurance questions",
    message:
      "Do you accept Delta Dental, and what are my options if I don't have insurance?",
  },
  {
    name: "new patient with a subjective date",
    message:
      "Can I book a cleaning for later next week? I'm new: Alex Casey, 617-555-0155, DOB 1993-05-05, no insurance.",
  },
];

async function runScenario(name: string, userMessage: string) {
  const conversationId = `conv_live_${randomUUID()}`;
  ensureConversation(conversationId);
  const tools = createAgentTools(conversationId);
  const messages: ModelMessage[] = [{ role: "user", content: userMessage }];

  const result = await generateText({
    model: getLanguageModel(),
    system: buildSystemPrompt(),
    messages,
    tools,
    stopWhen: stepCountIs(8),
    maxRetries: 1,
  });

  const toolCalls = result.steps.flatMap((step) =>
    step.toolCalls.map((call) => call.toolName),
  );

  console.log(`\n=== ${name} ===`);
  console.log(`tools: ${toolCalls.length ? toolCalls.join(", ") : "(none)"}`);
  console.log(result.text.replace(/\n{3,}/g, "\n\n"));
}

async function main() {
  for (const scenario of scenarios) {
    await runScenario(scenario.name, scenario.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
