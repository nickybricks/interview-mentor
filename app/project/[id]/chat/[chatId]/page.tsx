"use client";

import { useParams } from "next/navigation";
import { ChatWindow } from "@/components/chat-window";

export default function ChatPage() {
  const params = useParams<{ id: string; chatId: string }>();
  return <ChatWindow chatId={params.chatId} />;
}
