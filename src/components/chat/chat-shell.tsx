"use client";

import {
  DefaultChatTransport,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import {
  memo,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ToolName } from "@/lib/agent/tool-contracts";

const QUICK_REPLIES = [
  "I'd like to book a cleaning",
  "I need to reschedule an appointment",
  "I have a dental emergency",
  "Do you accept my insurance?",
  "I'd like to book for my family",
];

const TOOL_LABELS: Record<ToolName, string> = {
  find_patient: "Checking patient record",
  create_patient: "Registering new patient",
  get_availability: "Checking real availability",
  hold_slot: "Holding the slot",
  book_appointment: "Booking appointment",
  reschedule_appointment: "Rescheduling appointment",
  cancel_appointment: "Cancelling appointment",
  list_appointments: "Looking up appointments",
  get_practice_info: "Checking practice information",
  notify_staff: "Alerting the dental team",
  escalate_to_human: "Escalating to the front desk",
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : null;
}

function messageText(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n")
    .trim();
}

const AssistantMarkdown = memo(function AssistantMarkdown({
  text,
}: {
  text: string;
}) {
  return (
    <div className="text-sm leading-relaxed [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_em]:italic [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-2 [&_p]:whitespace-pre-wrap [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-4">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
});

function AppointmentCard({ value }: { value: JsonRecord }) {
  const startsAtLabel =
    typeof value.startsAtLabel === "string" ? value.startsAtLabel : null;
  const providerName =
    typeof value.providerName === "string" ? value.providerName : null;
  const appointmentTypeName =
    typeof value.appointmentTypeName === "string"
      ? value.appointmentTypeName
      : null;
  const status = typeof value.status === "string" ? value.status : null;

  return (
    <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
        {status === "cancelled" ? "Cancelled appointment" : "Appointment"}
      </p>
      <p className="mt-1 text-sm font-semibold text-brand-900">
        {startsAtLabel ?? "Time confirmed"}
      </p>
      <p className="mt-0.5 text-sm text-slate-600">
        {[appointmentTypeName, providerName].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

function ToolPart({ part }: { part: UIMessage["parts"][number] }) {
  if (!isToolUIPart(part)) return null;

  const toolName = part.type.startsWith("tool-")
    ? part.type.slice("tool-".length)
    : "tool";
  const label =
    toolName in TOOL_LABELS
      ? TOOL_LABELS[toolName as ToolName]
      : "Working on your request";
  const output =
    part.state === "output-available" ? asRecord(part.output) : null;
  const failed = output?.ok === false;
  const safeError =
    output && typeof output.message === "string"
      ? output.message
      : "That step couldn't be completed. Please try again or ask for the front desk.";

  return (
    <div
      className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
        failed
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      <p className="flex items-center gap-2 font-medium">
        <span
          aria-hidden="true"
          className={`inline-block h-2 w-2 rounded-full ${
            failed ? "bg-amber-500" : "bg-brand-500"
          }`}
        />
        {label}
        {part.state !== "output-available" && part.state !== "output-error" ? (
          <span className="text-xs font-normal text-slate-500">in progress…</span>
        ) : null}
        {part.state === "output-available" && !failed ? (
          <span className="text-xs font-normal text-slate-500">done</span>
        ) : null}
      </p>
      {part.state === "output-error" ? (
        <p className="mt-2 text-amber-900">
          That step couldn&apos;t be completed. Please try again or ask for the
          front desk.
        </p>
      ) : null}
      {failed ? <p className="mt-2 text-amber-900">{safeError}</p> : null}
      {output?.appointment ? (
        <AppointmentCard value={asRecord(output.appointment) ?? {}} />
      ) : null}
      {Array.isArray(output?.appointments) ? (
        <div className="mt-2 space-y-2">
          {output.appointments
            .map((appointment) => asRecord(appointment))
            .filter((appointment): appointment is JsonRecord => appointment !== null)
            .slice(0, 4)
            .map((appointment, index) => (
              <AppointmentCard
                key={`${String(appointment.id ?? index)}`}
                value={appointment}
              />
            ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChatShell({ patientName }: { patientName?: string }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat" }),
    [],
  );
  const { messages, sendMessage, status, error, stop } = useChat({ transport });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = status === "submitted" || status === "streaming";
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const frame = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    void sendMessage({ text: trimmed });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage(input);
    }
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-slate-50">
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-brand-700 focus:shadow"
        href="#chat-main"
      >
        Skip to conversation
      </a>

      <header className="shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <a
              aria-label="Back to home"
              className="rounded-full bg-brand-50 px-2.5 py-2 text-sm font-semibold text-brand-700"
              href="/"
            >
              ←
            </a>
            <div>
              <p className="text-sm font-semibold text-brand-900">
                Lakeside Family Dental
              </p>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                />
                Ava, virtual front desk · online
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {patientName ? (
              <>
                <a
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
                  href="/portal"
                >
                  My portal
                </a>
                <form action="/api/auth/logout" method="post">
                  <button
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
                    type="submit"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <a
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
                href="/login"
              >
                Sign in
              </a>
            )}
            <a
              className="hidden rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 sm:block"
              href="tel:6175550142"
            >
              Call 617-555-0142
            </a>
          </div>
        </div>
      </header>

      <main
        className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col px-3 py-4 sm:px-6"
        id="chat-main"
      >
        <div
          aria-live="polite"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4"
          data-testid="chat-scroll"
          ref={scrollRef}
        >
          {messages.length === 0 ? (
            <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <div
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 font-semibold text-white"
                >
                  A
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-brand-900">
                    {patientName
                      ? `Hi, ${patientName.split(" ")[0]}. I'm Ava at Lakeside Family Dental.`
                      : "Hi, I'm Ava at Lakeside Family Dental."}
                  </h1>
                  <p className="mt-2 text-slate-600">
                    I can help you book, move, or cancel an appointment, arrange
                    visits for the whole family, or get urgent help. What can I
                    do for you today?
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    className="rounded-full border border-brand-100 bg-brand-50 px-3 py-2 text-left text-sm text-brand-800 transition hover:border-brand-500"
                    key={reply}
                    onClick={() => submitMessage(reply)}
                    type="button"
                  >
                    {reply}
                  </button>
                ))}
              </div>
              <p className="mt-5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
                For a life-threatening emergency, call 911. For urgent dental
                pain, I can alert the clinical team and find the earliest
                same-day slot.
              </p>
            </section>
          ) : null}

          {messages.map((message) => {
            const text = messageText(message);
            const isUser = message.role === "user";
            const hasToolParts = message.parts.some(isToolUIPart);
            if (!text && !hasToolParts) return null;

            return (
              <div
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                key={message.id}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] ${
                    isUser
                      ? "rounded-3xl rounded-br-md bg-brand-600 px-4 py-3 text-white"
                      : "rounded-3xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 text-slate-800 shadow-sm"
                  }`}
                >
                  {!isUser ? (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
                      Ava
                    </p>
                  ) : null}
                  {text ? (
                    isUser ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {text}
                      </p>
                    ) : (
                      <AssistantMarkdown text={text} />
                    )
                  ) : null}
                  {message.parts.map((part, index) => (
                    <ToolPart
                      key={`${message.id}-${part.type}-${index}`}
                      part={part}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {busy ? (
            <div className="flex justify-start">
              <div className="rounded-3xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="flex gap-1" aria-hidden="true">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500 [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" />
                  </span>
                  Ava is typing…
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
              role="alert"
            >
              <p className="font-semibold">I couldn&apos;t finish that request.</p>
              <p className="mt-1">
                Please try again, or call the office at 617-555-0142 so a staff
                member can help.
              </p>
              <button
                className="mt-3 rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold"
                onClick={() => sendMessage({ text: "I'd like to speak to a staff member" })}
                type="button"
              >
                Ask for a staff member
              </button>
            </div>
          ) : null}
        </div>

        <form
          className="shrink-0 rounded-3xl border border-slate-200 bg-white p-2 shadow-lg"
          onSubmit={handleSubmit}
        >
          <label className="sr-only" htmlFor="chat-input">
            Message the dental assistant
          </label>
          <div className="flex items-end gap-2">
            <textarea
              className="max-h-40 min-h-[2.75rem] flex-1 resize-none rounded-2xl border-0 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-500"
              id="chat-input"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Ava about appointments, insurance, or urgent concerns…"
              ref={inputRef}
              rows={1}
              value={input}
            />
            {busy ? (
              <button
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-slate-300"
                onClick={() => stop()}
                type="button"
              >
                Stop
              </button>
            ) : (
              <button
                className="rounded-full bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-700"
                disabled={!input.trim()}
                type="submit"
              >
                Send
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
