import { randomUUID } from "node:crypto";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { getLanguageModel } from "../src/lib/agent/model";
import { buildSystemPrompt } from "../src/lib/agent/prompt";
import { createAgentTools } from "../src/lib/agent/tools";
import { ensureConversation } from "../src/lib/domain/conversation-service";
import { schedulingService } from "../src/lib/domain/scheduling-service";
import {
  addDaysToDateString,
  formatPracticeDateTime,
  practiceDateString,
} from "../src/lib/domain/time";

function summarizeSteps(steps: Awaited<ReturnType<typeof generateText>>["steps"]) {
  return steps.flatMap((step) =>
    step.toolCalls.map((call) => `${call.toolName}(${JSON.stringify(call.input)})`),
  );
}

async function main() {
  const conversationId = `conv_live_${randomUUID()}`;
  ensureConversation(conversationId);
  const tools = createAgentTools(conversationId);

  let messages: ModelMessage[] = [
    {
      role: "user",
      content:
        "Hi, I'm a new patient and I'd like to book a cleaning next week. My name is Alex Rivera, my phone is 617-555-0199, my date of birth is 1992-02-14, and I don't have insurance.",
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

  console.log("--- turn 1 tools ---");
  console.log(summarizeSteps(first.steps).join("\n") || "(none)");
  console.log("--- turn 1 reply ---");
  console.log(first.text);

  messages = [...messages, ...first.response.messages, {
    role: "user",
    content:
      "Yes, the first option you listed works for me. Please book that exact appointment.",
  }];

  const second = await generateText({
    model: getLanguageModel(),
    system: buildSystemPrompt(),
    messages,
    tools,
    stopWhen: stepCountIs(8),
    maxRetries: 1,
  });

  console.log("--- turn 2 tools ---");
  console.log(summarizeSteps(second.steps).join("\n") || "(none)");
  console.log("--- turn 2 reply ---");
  console.log(second.text);

  const nextWeekStart = addDaysToDateString(practiceDateString(), 7);
  const slots = await schedulingService.getAvailability({
    appointmentType: "cleaning",
    preferredStartDate: nextWeekStart,
    preferredEndDate: addDaysToDateString(nextWeekStart, 6),
    limit: 1,
  });
  const slot = slots[0];
  if (!slot) throw new Error("No live slot available for the final turn");

  messages = [
    ...messages,
    ...second.response.messages,
    {
      role: "user",
      content: `Yes, ${formatPracticeDateTime(slot.startsAt)} with ${slot.providerName} works. Please book that exact appointment.`,
    },
  ];

  const third = await generateText({
    model: getLanguageModel(),
    system: buildSystemPrompt(),
    messages,
    tools,
    stopWhen: stepCountIs(8),
    maxRetries: 1,
  });

  console.log("--- turn 3 tools ---");
  console.log(summarizeSteps(third.steps).join("\n") || "(none)");
  console.log("--- turn 3 reply ---");
  console.log(third.text);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
