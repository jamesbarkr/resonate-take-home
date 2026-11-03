import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/chat-shell";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Patient chat | Lakeside Family Dental",
};

export default async function ChatPage() {
  const session = await getSession();
  const patientName = session?.role === "patient" ? session.name : undefined;

  return <ChatShell patientName={patientName} />;
}
