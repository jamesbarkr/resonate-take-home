import type { Metadata } from "next";
import { ChatShell } from "@/components/chat/chat-shell";

export const metadata: Metadata = {
  title: "Patient chat | Lakeside Family Dental",
};

export default function ChatPage() {
  return <ChatShell />;
}
