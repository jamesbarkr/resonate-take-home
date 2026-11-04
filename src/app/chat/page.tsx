import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/chat-shell";
import { requirePatientSite } from "@/lib/auth/page-guards";
import { getPatientSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Patient chat | Lakeside Family Dental",
};

export default async function ChatPage() {
  await requirePatientSite();
  const session = await getPatientSession();
  return <ChatShell patientName={session?.name} />;
}
