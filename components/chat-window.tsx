"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Bot,
  Paperclip,
  FileText,
  AlertCircle,
  X,
} from "lucide-react";
import { ToolCallCard, type ToolCallDisplay } from "@/components/tool-call-card";
import { KickoffCompleteOverlay } from "@/components/kickoff-complete-overlay";

interface RAGSourceDisplay {
  source: string;
  similarity: number;
  preview: string;
}

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
  sources?: RAGSourceDisplay[];
  toolCalls?: ToolCallDisplay[];
  attachment?: { name: string; type: string };
}

interface ChatData {
  id: string;
  type: string;
  persona: string;
  status: string;
  project: {
    id: string;
    name: string;
    company: string | null;
    position: string | null;
  };
  messages: Message[];
}

const CHAT_TYPE_ICONS: Record<string, React.ElementType> = {
  kickoff: Bot,
  preparation: GraduationCap,
  gap_analysis: Search,
  mock_interview: Mic,
};

interface ChatWindowProps {
  chatId: string;
}

// Chat types that should auto-start with a bot intro message
const AUTO_START_TYPES = ["preparation", "mock_interview", "kickoff"];

// Staged file waiting to be sent with the next message
interface StagedFile {
  file: File;
  uploadType: "cv" | "jobDescription" | "additional";
  label: string;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [chat, setChat] = useState<ChatData | null>(null);
  const [kickoffComplete, setKickoffComplete] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallDisplay[]>([]);

  // File upload state
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [stagedFile, setStagedFile] = useState<StagedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const kickoffSignalReceivedRef = useRef(false);
  const autoStartTriggered = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTypeRef = useRef<"cv" | "jobDescription" | "additional">("cv");
  const uploadMenuRef = useRef<HTMLDivElement>(null);

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
          // Restore kickoff completion state for returning users
          if (data.type === "kickoff" && data.status === "completed") {
            setKickoffComplete(true);
          }
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
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

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
    sources?: RAGSourceDisplay[];
    toolCalls?: ToolCallDisplay[];
  }

  const streamResponse = async (res: Response): Promise<{ content: string; meta: StreamMeta }> => {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let meta: StreamMeta = {};
      const collectedToolCalls: ToolCallDisplay[] = [];

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
              if (data.toolCall) {
                const tc = data.toolCall as ToolCallDisplay;
                const existingIdx = collectedToolCalls.findIndex(
                  (t) => t.name === tc.name
                );
                if (existingIdx >= 0) {
                  collectedToolCalls[existingIdx] = tc;
                } else {
                  collectedToolCalls.push(tc);
                }
                setActiveToolCalls([...collectedToolCalls]);
                continue;
              }
              if (data.kickoff_complete) {
                kickoffSignalReceivedRef.current = true;
                continue;
              }
              if (data.sources) {
                meta.sources = data.sources;
                continue;
              }
              if (data.done) {
                meta = {
                  ...meta,
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
                continue;
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

      if (collectedToolCalls.length > 0) {
        meta.toolCalls = collectedToolCalls;
      }

      return { content: fullContent, meta };
  };

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
              sources: meta.sources,
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
        if (kickoffSignalReceivedRef.current) {
          setTimeout(() => {
            setKickoffComplete(true);
            kickoffSignalReceivedRef.current = false;
          }, 3000);
        }
      }
    };

    triggerIntro();
  }, [chat, loading, streaming, messages.length, chatId, t]);

  // ─── File upload: stage → send ───────────────────────────────────────────

  // Close upload menu on click outside
  useEffect(() => {
    if (!uploadMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(e.target as Node)) {
        setUploadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [uploadMenuOpen]);

  const typeLabels: Record<string, string> = {
    cv: t("project.cvLabel"),
    jobDescription: t("project.jobLabel"),
    additional: t("chat.additionalDoc"),
  };

  // Open file picker for a specific type
  const triggerFilePicker = (type: "cv" | "jobDescription" | "additional") => {
    uploadTypeRef.current = type;
    setUploadMenuOpen(false);
    fileInputRef.current?.click();
  };

  // Stage the selected file (don't upload yet)
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError(t("fileUpload.pdfOnly"));
      setTimeout(() => setUploadError(null), 5000);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(t("fileUpload.tooLarge"));
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    setUploadError(null);
    setStagedFile({
      file,
      uploadType: uploadTypeRef.current,
      label: typeLabels[uploadTypeRef.current] || file.name,
    });
    textareaRef.current?.focus();
  };

  const removeStagedFile = () => {
    setStagedFile(null);
  };

  // Upload the staged file to the server — returns true on success
  const uploadStagedFile = async (): Promise<boolean> => {
    if (!stagedFile || !chat) return true; // nothing to upload

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", stagedFile.file);
      formData.append("projectId", chat.project.id);
      formData.append("type", stagedFile.uploadType);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("fileUpload.failed"));
      }

      return true;
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t("fileUpload.failed"));
      setTimeout(() => setUploadError(null), 5000);
      return false;
    } finally {
      setUploading(false);
    }
  };

  // ─── Send message ────────────────────────────────────────────────────────

  const sendMessage = async () => {
    // Allow sending with just a file (no text) or just text (no file)
    const text = input.trim();
    if (!text && !stagedFile) return;
    if (streaming || uploading) return;

    // If there's a staged file, upload it first
    const currentStaged = stagedFile;
    if (currentStaged) {
      const ok = await uploadStagedFile();
      if (!ok) return; // upload failed, don't send
      setStagedFile(null);
    }

    // Build the message content — no emoji suffix since attachment renders visually
    const messageContent = text
      ? text
      : `Uploaded ${currentStaged!.label}: ${currentStaged!.file.name}`;

    // Optimistic update — add user message immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageContent,
      score: null,
      category: null,
      createdAt: new Date().toISOString(),
      tokens: Math.ceil(messageContent.length / 4),
      ...(currentStaged && {
        attachment: {
          name: currentStaged.file.name,
          type: currentStaged.uploadType,
        },
      }),
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
          content: messageContent,
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
          sources: meta.sources,
          toolCalls: meta.toolCalls,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error("Send failed:", err);
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
      setActiveToolCalls([]);
      textareaRef.current?.focus();
      if (kickoffSignalReceivedRef.current) {
        setTimeout(() => {
          setKickoffComplete(true);
          kickoffSignalReceivedRef.current = false;
        }, 3000);
      }
    }
  };

  // Regenerate the last assistant answer
  const regenerateLastAnswer = async () => {
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
          sources: meta.sources,
          toolCalls: meta.toolCalls,
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
      setActiveToolCalls([]);
      if (kickoffSignalReceivedRef.current) {
        setTimeout(() => {
          setKickoffComplete(true);
          kickoffSignalReceivedRef.current = false;
        }, 3000);
      }
    }
  };

  // Switch version of a message (prev/next)
  const switchVersion = async (
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
  };

  // Handle Enter to send
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Voice recording: toggle start/stop
  const toggleRecording = async () => {
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

          const res = await fetch(`/api/transcribe?locale=${locale}`, {
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
  };

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

  const chatTypeKey = `chatType.${chat.type}` as "chatType.kickoff" | "chatType.preparation" | "chatType.gap_analysis" | "chatType.mock_interview";
  const chatLabel = t(chatTypeKey) || chat.type;
  const TypeIcon = CHAT_TYPE_ICONS[chat.type] || GraduationCap;

  const canSend = (input.trim() || stagedFile) && !streaming && !uploading;

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
                sources={msg.sources}
                toolCalls={msg.toolCalls}
                attachment={msg.attachment}
              />
            );
          })}

          {/* Active tool calls during streaming */}
          {streaming && activeToolCalls.length > 0 && (
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Bot className="size-4" />
              </div>
              <div className="min-w-0 max-w-[85%] space-y-1.5">
                {activeToolCalls.map((tc) => (
                  <ToolCallCard key={tc.name} toolCall={tc} />
                ))}
              </div>
            </div>
          )}

          {/* Streaming message */}
          {streaming && streamingContent && (
            <MessageBubble
              role="assistant"
              content={streamingContent}
              isStreaming
            />
          )}

          {/* Loading indicator */}
          {streaming && !streamingContent && activeToolCalls.length === 0 && (
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileSelected}
        className="hidden"
      />

      {/* Bottom area: Kickoff overlay OR floating input */}
      {kickoffComplete ? (
        <KickoffCompleteOverlay
          locale={locale as "de" | "en"}
          onMoreQuestions={async () => {
            await fetch(`/api/chats/${chatId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "active" }),
            });
            setKickoffComplete(false);
            kickoffSignalReceivedRef.current = false;
          }}
          onStartPrep={async () => {
            const projectId = chat.project.id;
            const res = await fetch(`/api/chats?projectId=${projectId}`);
            if (res.ok) {
              const chats = await res.json();
              const existing = chats.find(
                (c: { type: string; status: string }) =>
                  c.type === "preparation" && c.status === "active"
              );
              if (existing) {
                router.push(`/project/${projectId}/chat/${existing.id}`);
                return;
              }
            }
            const createRes = await fetch("/api/chats", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId, type: "preparation" }),
            });
            if (createRes.ok) {
              const newChat = await createRes.json();
              router.push(`/project/${projectId}/chat/${newChat.id}`);
            }
          }}
          onGoToDashboard={() => router.push(`/project/${chat.project.id}`)}
        />
      ) : (
        <>
          {/* Floating Input Island — fixed at bottom */}
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-2 bg-gradient-to-t from-background from-80% to-transparent">
            <div className="mx-auto max-w-3xl">
              <div className="rounded-2xl border bg-background shadow-lg">
                {/* Staged file preview — above the input row */}
                {stagedFile && (
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm">
                      <FileText className="size-4 shrink-0 text-red-600" />
                      <span className="max-w-[200px] truncate font-medium">
                        {stagedFile.file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({stagedFile.label})
                      </span>
                      <button
                        onClick={removeStagedFile}
                        className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        aria-label={`Remove ${stagedFile.file.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Upload error */}
                {uploadError && (
                  <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{uploadError}</span>
                    <button
                      onClick={() => setUploadError(null)}
                      className="ml-auto rounded p-0.5 hover:bg-destructive/10"
                      aria-label="Dismiss"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )}

                {/* Input row */}
                <div className="flex items-end gap-2 p-2">
                  {/* Upload button with menu */}
                  <div className="relative" ref={uploadMenuRef}>
                    <Button
                      onClick={() => setUploadMenuOpen((o) => !o)}
                      disabled={streaming || uploading}
                      variant="ghost"
                      size="icon"
                      className="shrink-0 rounded-xl"
                      aria-label={t("chat.uploadFile")}
                      aria-expanded={uploadMenuOpen}
                    >
                      {uploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Paperclip className="size-4" />
                      )}
                    </Button>

                    {/* Upload type menu */}
                    {uploadMenuOpen && (
                      <div className="absolute bottom-full left-0 mb-2 w-52 rounded-lg border bg-background p-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => triggerFilePicker("cv")}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                        >
                          <FileText className="size-4 text-blue-600" />
                          {t("project.cvLabel")}
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerFilePicker("jobDescription")}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                        >
                          <FileText className="size-4 text-amber-600" />
                          {t("project.jobLabel")}
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerFilePicker("additional")}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                        >
                          <FileText className="size-4 text-muted-foreground" />
                          {t("chat.additionalDoc")}
                        </button>
                      </div>
                    )}
                  </div>

                  <Textarea
                    ref={textareaRef}
                    name="message"
                    autoComplete="off"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      stagedFile
                        ? t("chat.placeholderWithFile")
                        : t("chat.placeholder")
                    }
                    disabled={streaming || recording}
                    className="min-h-[44px] max-h-[200px] resize-none border-0 shadow-none focus-visible:ring-0 focus-visible:border-primary"
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
                    aria-label={recording ? t("chat.stopRecording") : t("chat.voiceInput")}
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
                    disabled={!canSend}
                    size="icon"
                    aria-label="Send message"
                    className="shrink-0 rounded-xl"
                  >
                    {streaming || uploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-center text-[10px] text-muted-foreground" aria-live="polite">
                {micError ? (
                  <span className="text-destructive" role="alert">{micError}</span>
                ) : recording ? (
                  <span className="text-destructive">{t("chat.recordingActive")}</span>
                ) : (
                  t("chat.inputHint")
                )}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
