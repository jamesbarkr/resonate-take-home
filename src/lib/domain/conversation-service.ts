import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { isTextUIPart, type UIMessage } from "ai";
import { db } from "@/lib/db/client";
import {
  conversations,
  messages,
  patients,
  staffAlerts,
  toolCalls,
} from "@/lib/db/schema";

export function ensureConversation(conversationId: string) {
  const now = new Date().toISOString();
  db.insert(conversations)
    .values({
      id: conversationId,
      patientId: null,
      channel: "web",
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .run();
}

export function touchConversation(conversationId: string) {
  db.update(conversations)
    .set({ updatedAt: new Date().toISOString() })
    .where(eq(conversations.id, conversationId))
    .run();
}

export function setConversationPatient(
  conversationId: string,
  patientId: string,
) {
  db.update(conversations)
    .set({ patientId, updatedAt: new Date().toISOString() })
    .where(eq(conversations.id, conversationId))
    .run();
}

export function setConversationStatus(
  conversationId: string,
  status: "active" | "escalated" | "closed",
) {
  db.update(conversations)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(conversations.id, conversationId))
    .run();
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function appendMessage(input: {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: unknown;
}) {
  if (!input.content) return;
  db.insert(messages)
    .values({
      id: input.id,
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .run();
  touchConversation(input.conversationId);
}

export function persistUiMessages(
  conversationId: string,
  uiMessages: UIMessage[],
) {
  for (const message of uiMessages) {
    const content = messageText(message);
    if (!content) continue;
    appendMessage({
      id: message.id,
      conversationId,
      role: message.role === "system" ? "system" : message.role,
      content,
      metadata: { parts: message.parts },
    });
  }
}

export function logToolCall(input: {
  conversationId: string;
  toolName: string;
  arguments: unknown;
  result?: unknown;
  status: "pending" | "succeeded" | "failed";
  error?: string;
}) {
  db.insert(toolCalls)
    .values({
      id: `tool_${randomUUID()}`,
      conversationId: input.conversationId,
      toolName: input.toolName,
      argumentsJson: JSON.stringify(input.arguments ?? {}),
      resultJson: input.result === undefined ? null : JSON.stringify(input.result),
      status: input.status,
      error: input.error ?? null,
      createdAt: new Date().toISOString(),
    })
    .run();
}

export function listRecentConversations(limit = 12) {
  const rows = db
    .select({
      conversation: conversations,
      patientName: patients.fullName,
    })
    .from(conversations)
    .leftJoin(patients, eq(conversations.patientId, patients.id))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit)
    .all();

  return rows.map(({ conversation, patientName }) => {
    const lastMessage = db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(1)
      .get();

    return {
      id: conversation.id,
      patientName: patientName ?? null,
      status: conversation.status,
      updatedAt: conversation.updatedAt,
      lastMessage: lastMessage?.content ?? null,
    };
  });
}

export function getConversationDetail(conversationId: string) {
  const conversation = db
    .select({
      conversation: conversations,
      patientName: patients.fullName,
      patientPhone: patients.phone,
      patientDob: patients.dateOfBirth,
    })
    .from(conversations)
    .leftJoin(patients, eq(conversations.patientId, patients.id))
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conversation) return null;

  return {
    conversation: conversation.conversation,
    patientName: conversation.patientName ?? null,
    patientPhone: conversation.patientPhone ?? null,
    patientDob: conversation.patientDob ?? null,
    messages: db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
      .all(),
    toolCalls: db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.conversationId, conversationId))
      .orderBy(asc(toolCalls.createdAt))
      .all(),
    alerts: db
      .select()
      .from(staffAlerts)
      .where(eq(staffAlerts.conversationId, conversationId))
      .orderBy(desc(staffAlerts.createdAt))
      .all(),
  };
}

export function getConversationPatientId(conversationId: string) {
  return db
    .select({ patientId: conversations.patientId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get()?.patientId ?? null;
}

export function findOpenAlert(conversationId: string, kind: string) {
  return db
    .select()
    .from(staffAlerts)
    .where(
      and(
        eq(staffAlerts.conversationId, conversationId),
        eq(staffAlerts.kind, kind as "emergency" | "escalation" | "callback"),
        eq(staffAlerts.status, "open"),
      ),
    )
    .get();
}
