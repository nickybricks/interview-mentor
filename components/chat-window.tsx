"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "@/components/message-bubble";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Send,
  Loader2,
  GraduationCap,
  Search,
  Mic,
  Square,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  score: number | null;
  category: string | null;
  createdAt: string;
  tokens?: number | null;
  inputTokens?: number | null;
  model?: string | null;
  cost?: number | null;
  inputCost?: number;
  outputCost?: number;
  tokensPerSec?: number;
  durationMs?: number;
  versionGroup?: string | null;
  versionIndex?: number;
  versionTotal?: number;
}

interface ChatData {
  id: string;
  type: string;
  persona: string;
  project: {
    id: string;
    name: string;
    company: string | null;
    position: string | null;
  };
  messages: Message[];
}

const CHAT_TYPE_ICONS: Record<string, React.ElementType> = {
  preparation: GraduationCap,
  gap_analysis: Search,
  mock_interview: Mic,
};

interface ChatWindowProps {
  chatId: string;
}

// Chat types that should auto-start with a bot intro message
const AUTO_START_TYPES = ["preparation", "mock_interview"];

export function ChatWindow({ chatId }: ChatWindowProps) {
  const { t } = useI18n();
  const [chat, setChat] = useState<ChatData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const autoStartTriggered = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch chat data
  useEffect(() => {
    autoStartTriggered.current = false;
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}`);
        if (res.ok) {
          const data: ChatData = await res.json();
          setChat(data);
          setMessages(data.messages.filter((m) => m.role !== "system"));
        }
      } catch (err) {
        console.error("Failed to fetch chat:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchChat();
  }, [chatId]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Shared streaming helper — reads SSE response and updates state
  interface StreamMeta {
    messageId?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    model?: string;
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
    tokensPerSec?: number;
    durationMs?: number;
    version?: { versionGroup: string; versionIndex: number; versionTotal: number };
  }

  const streamResponse = useCallback(
    async (res: Response): Promise<{ content: string; meta: StreamMeta }> => {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let meta: StreamMeta = {};

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.done) {
                meta = {
                  messageId: data.messageId,
                  inputTokens: data.inputTokens,
                  outputTokens: data.outputTokens,
                  totalTokens: data.totalTokens,
                  model: data.model,
                  inputCost: data.inputCost,
                  outputCost: data.outputCost,
                  totalCost: data.totalCost,
                  tokensPerSec: data.tokensPerSec,
                  durationMs: data.durationMs,
                  version: data.version,
                };
                break;
              }
              if (data.error) throw new Error(data.error);
              if (data.text) {
                fullContent += data.text;
                setStreamingContent(fullContent);
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }

      return { content: fullContent, meta };
    },
    []
  );

  // Auto-start: bot sends intro for new empty chats
  useEffect(() => {
    if (
      !chat ||
      loading ||
      streaming ||
      autoStartTriggered.current ||
      messages.length > 0 ||
      !AUTO_START_TYPES.includes(chat.type)
    ) {
      return;
    }

    autoStartTriggered.current = true;

    const triggerIntro = async () => {
      setStreaming(true);
      setStreamingContent("");

      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, autoStart: true }),
        });

        if (!res.ok) {
          throw new Error(t("chat.autoStartFailed"));
        }

        const { content: fullContent, meta } = await streamResponse(res);

        if (fullContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: meta.messageId ?? `assistant-${Date.now()}`,
              role: "assistant",
              content: fullContent,
              score: null,
              category: null,
              createdAt: new Date().toISOString(),
              tokens: meta.outputTokens,
              inputTokens: meta.inputTokens,
              model: meta.model,
              cost: meta.totalCost,
              inputCost: meta.inputCost,
              outputCost: meta.outputCost,
              tokensPerSec: meta.tokensPerSec,
              durationMs: meta.durationMs,
            },
          ]);
        }
      } catch (err) {
        console.error("Auto-start failed:", err);
        setMessages([
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `${t("chat.startError")} ${err instanceof Error ? err.message : t("chat.unknownError")}`,
            score: null,
            category: null,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setStreaming(false);
        setStreamingContent("");
      }
    };

    triggerIntro();
  }, [chat, loading, streaming, messages.length, chatId, streamResponse, t]);

  // Send message with streaming
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    // Optimistic update — add user message immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: text,
      score: null,
      category: null,
      createdAt: new Date().toISOString(),
      tokens: Math.ceil(text.length / 4), // rough estimate
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          content: text,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("chat.sendError"));
      }

      const { content: fullContent, meta } = await streamResponse(res);

      // Add completed assistant message
      if (fullContent) {
        const assistantMessage: Message = {
          id: meta.messageId ?? `assistant-${Date.now()}`,
          role: "assistant",
          content: fullContent,
          score: null,
          category: null,
          createdAt: new Date().toISOString(),
          tokens: meta.outputTokens,
          inputTokens: meta.inputTokens,
          model: meta.model,
          cost: meta.totalCost,
          inputCost: meta.inputCost,
          outputCost: meta.outputCost,
          tokensPerSec: meta.tokensPerSec,
          durationMs: meta.durationMs,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error("Send failed:", err);
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `${t("chat.error")} ${err instanceof Error ? err.message : t("chat.unknownError")}`,
          score: null,
          category: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setStreaming(false);
      setStreamingContent("");
      textareaRef.current?.focus();
    }
  };

  // Regenerate the last assistant answer
  const regenerateLastAnswer = useCallback(async () => {
    if (streaming) return;

    // Remove the last assistant message from UI
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.role === "assistant");
      if (idx === -1) return prev;
      const removeAt = prev.length - 1 - idx;
      return [...prev.slice(0, removeAt), ...prev.slice(removeAt + 1)];
    });

    setStreaming(true);
    setStreamingContent("");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, regenerate: true }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t("chat.sendError"));
      }

      const { content: fullContent, meta } = await streamResponse(res);

      if (fullContent) {
        const assistantMessage: Message = {
          id: meta.messageId ?? `assistant-${Date.now()}`,
          role: "assistant",
          content: fullContent,
          score: null,
          category: null,
          createdAt: new Date().toISOString(),
          tokens: meta.outputTokens,
          inputTokens: meta.inputTokens,
          model: meta.model,
          cost: meta.totalCost,
          inputCost: meta.inputCost,
          outputCost: meta.outputCost,
          tokensPerSec: meta.tokensPerSec,
          durationMs: meta.durationMs,
          versionGroup: meta.version?.versionGroup,
          versionIndex: meta.version?.versionIndex,
          versionTotal: meta.version?.versionTotal,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error("Regenerate failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `${t("chat.error")} ${err instanceof Error ? err.message : t("chat.unknownError")}`,
          score: null,
          category: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setStreaming(false);
      setStreamingContent("");
    }
  }, [streaming, chatId, streamResponse, t]);

  // Switch version of a message (prev/next)
  const switchVersion = useCallback(async (
    messageId: string,
    direction: "prev" | "next"
  ) => {
    try {
      const res = await fetch(`/api/messages/${messageId}/version`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Version switch failed:", err.error);
        return;
      }

      const { message: newVersion } = await res.json();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                id: newVersion.id,
                content: newVersion.content,
                tokens: newVersion.tokens,
                inputTokens: newVersion.inputTokens,
                model: newVersion.model,
                cost: newVersion.cost,
                score: newVersion.score,
                category: newVersion.category,
                createdAt: newVersion.createdAt,
                versionIndex: newVersion.versionIndex,
                versionTotal: newVersion.versionTotal,
              }
            : m
        )
      );
    } catch (err) {
      console.error("Version switch failed:", err);
    }
  }, []);

  // Handle Enter to send
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Voice recording: toggle start/stop
  const toggleRecording = useCallback(async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size === 0) {
          setRecording(false);
          return;
        }

        setRecording(false);
        setTranscribing(true);
        setMicError(null);

        try {
          const ext = mimeType === "audio/webm" ? "webm" : "m4a";
          const file = new File([audioBlob], `recording.${ext}`, {
            type: mimeType,
          });
          const formData = new FormData();
          formData.append("audio", file);

          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || t("chat.transcriptionFailed"));
          }

          const { text } = await res.json();
          if (text) {
            setInput((prev) => (prev ? prev + " " + text : text));
            textareaRef.current?.focus();
          }
        } catch (err) {
          console.error("Transcription failed:", err);
          setMicError(
            err instanceof Error
              ? err.message
              : t("chat.speechFailed")
          );
          setTimeout(() => setMicError(null), 5000);
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start(250);
      setRecording(true);
      setMicError(null);
    } catch {
      setMicError(t("chat.micDenied"));
      setTimeout(() => setMicError(null), 5000);
    }
  }, [recording, t]);

  // Cleanup: release microphone if component unmounts while recording
  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
        recorder.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t("chat.notFound")}</p>
      </div>
    );
  }

  const chatTypeKey = `chatType.${chat.type}` as "chatType.preparation" | "chatType.gap_analysis" | "chatType.mock_interview";
  const chatLabel = t(chatTypeKey) || chat.type;
  const TypeIcon = CHAT_TYPE_ICONS[chat.type] || GraduationCap;

  return (
    <div className="relative flex h-full flex-col">
      {/* Chat Header */}
      <div className="flex items-center border-b px-4 py-2.5 pl-14">
        <div className="flex items-center gap-2">
          <TypeIcon className="size-4 text-muted-foreground" />
          <span className="font-medium">{chatLabel}</span>
          <Badge variant="secondary" className="text-[10px]">
            {chat.project.name}
          </Badge>
        </div>
      </div>

      {/* Messages — scrollable area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pb-36"
      >
        <div className="mx-auto max-w-3xl space-y-4 py-4">
          {messages.length === 0 && !streaming && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <TypeIcon className="mx-auto mb-3 size-10 opacity-30" />
              {AUTO_START_TYPES.includes(chat.type) ? (
                <p>{t("chat.starting")}</p>
              ) : (
                <>
                  <p>{t("chat.writeFirst")}</p>
                  {chat.type === "gap_analysis" && (
                    <p className="mt-1">
                      {t("chat.writeExample")}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {messages.map((msg, idx) => {
            // Show regenerate only on the last assistant message (when not streaming)
            const isLastAssistant =
              !streaming &&
              msg.role === "assistant" &&
              idx === messages.length - 1;

            return (
              <MessageBubble
                key={msg.id}
                role={msg.role as "user" | "assistant"}
                content={msg.content}
                score={msg.score}
                category={msg.category}
                createdAt={msg.createdAt}
                outputTokens={msg.tokens}
                inputTokens={msg.inputTokens}
                model={msg.model}
                totalCost={msg.cost}
                inputCost={msg.inputCost}
                outputCost={msg.outputCost}
                tokensPerSec={msg.tokensPerSec}
                durationMs={msg.durationMs}
                onRegenerate={isLastAssistant ? regenerateLastAnswer : undefined}
                versionIndex={msg.versionIndex}
                versionTotal={msg.versionTotal}
                onVersionChange={
                  msg.versionTotal && msg.versionTotal > 1
                    ? (dir) => switchVersion(msg.id, dir)
                    : undefined
                }
              />
            );
          })}

          {/* Streaming message */}
          {streaming && streamingContent && (
            <MessageBubble
              role="assistant"
              content={streamingContent}
              isStreaming
            />
          )}

          {/* Loading indicator */}
          {streaming && !streamingContent && (
            <div className="flex gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
              <div className="rounded-2xl bg-muted px-4 py-2.5">
                <span className="text-sm text-muted-foreground">
                  {t("chat.thinking")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Input Island — fixed at bottom */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-2 bg-gradient-to-t from-background from-80% to-transparent">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-lg">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.placeholder")}
              disabled={streaming || recording}
              className="min-h-[44px] max-h-[200px] resize-none border-0 shadow-none focus-visible:ring-0"
              rows={1}
            />
            {/* Voice recording button */}
            <Button
              onClick={toggleRecording}
              disabled={streaming || transcribing}
              variant={recording ? "destructive" : "ghost"}
              size="icon"
              className={cn(
                "shrink-0 rounded-xl",
                recording && "animate-pulse"
              )}
              title={recording ? t("chat.stopRecording") : t("chat.voiceInput")}
            >
              {transcribing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : recording ? (
                <Square className="size-3.5" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>
            {/* Send button */}
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              size="icon"
              className="shrink-0 rounded-xl"
            >
              {streaming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            {micError ? (
              <span className="text-destructive">{micError}</span>
            ) : recording ? (
              <span className="text-destructive">{t("chat.recordingActive")}</span>
            ) : (
              t("chat.inputHint")
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
