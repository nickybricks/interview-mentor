"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { User, Bot, Info, RefreshCw, ChevronLeft, ChevronRight, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ToolCallCard, type ToolCallDisplay } from "@/components/tool-call-card";

interface RAGSourceDisplay {
  source: string;
  similarity: number;
  preview: string;
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  score?: number | null;
  category?: string | null;
  createdAt?: string;
  isStreaming?: boolean;
  outputTokens?: number | null;
  inputTokens?: number | null;
  model?: string | null;
  totalCost?: number | null;
  inputCost?: number;
  outputCost?: number;
  tokensPerSec?: number;
  durationMs?: number;
  onRegenerate?: () => void;
  versionIndex?: number;
  versionTotal?: number;
  onVersionChange?: (direction: "prev" | "next") => void;
  sources?: RAGSourceDisplay[];
  toolCalls?: ToolCallDisplay[];
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export const MessageBubble = memo(function MessageBubble({
  role,
  content,
  score,
  category,
  createdAt,
  isStreaming,
  outputTokens,
  inputTokens,
  model,
  totalCost,
  inputCost,
  outputCost,
  tokensPerSec,
  durationMs,
  onRegenerate,
  versionIndex,
  versionTotal,
  onVersionChange,
  sources,
  toolCalls,
}: MessageBubbleProps) {
  const { t } = useI18n();
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const isUser = role === "user";
  const hasOutputTokens = outputTokens != null && outputTokens > 0;
  const hasInputTokens = inputTokens != null && inputTokens > 0;
  const totalTokens =
    (inputTokens ?? 0) + (outputTokens ?? 0);
  const hasTokenInfo = hasOutputTokens || hasInputTokens;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      {/* Message */}
      <div
        className={`min-w-0 max-w-[85%] space-y-1 ${isUser ? "items-end" : ""}`}
      >
        {/* Metadata badges */}
        {!isUser && (category || score != null) && (
          <div className="flex items-center gap-1.5">
            {category && (
              <Badge variant="secondary" className="text-[10px]">
                {category}
              </Badge>
            )}
            {score != null && (
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  score >= 7
                    ? "border-emerald-300 text-emerald-700 dark:text-emerald-400"
                    : score >= 5
                      ? "border-amber-300 text-amber-700 dark:text-amber-400"
                      : "border-red-300 text-red-700 dark:text-red-400"
                }`}
              >
                {score}/10
              </Badge>
            )}
          </div>
        )}

        {/* Content bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
              {isStreaming && (
                <span className="ml-0.5 inline-block size-2 animate-pulse rounded-full bg-foreground/60" />
              )}
            </div>
          )}
        </div>

        {/* Tool call result cards */}
        {!isUser && toolCalls && toolCalls.length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            {toolCalls.map((tc) => (
              <ToolCallCard key={tc.name} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Collapsible sources section */}
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-1">
            <button
              onClick={() => setSourcesExpanded((prev) => !prev)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted-foreground/10"
            >
              <FileText className="size-3" />
              <span>{t("sources.label")} ({sources.length})</span>
              {sourcesExpanded ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>
            {sourcesExpanded && (
              <div className="mt-1 space-y-1.5 pl-1">
                {sources.map((src, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-background p-2 text-[11px]"
                  >
                    <div className="flex items-center gap-1.5">
                      <FileText className="size-3 shrink-0 text-muted-foreground" />
                      <span className="font-medium truncate">{src.source}</span>
                      <Badge variant="outline" className="ml-auto shrink-0 text-[9px] px-1 py-0">
                        {Math.round(src.similarity * 100)}%
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-muted-foreground line-clamp-2">
                      {src.preview}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer: timestamp + compact token info with tooltip */}
        <div
          className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground ${
            isUser ? "justify-end" : ""
          }`}
        >
          {createdAt && (
            <span>
              {new Date(createdAt).toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}

          {/* User messages: just show estimated tokens */}
          {isUser && hasOutputTokens && (
            <span>~{fmtNum(outputTokens!)} tokens</span>
          )}

          {/* Regenerate button for last assistant message */}
          {onRegenerate && (
            <Button
              variant="ghost"
              size="icon"
              className="size-5 rounded"
              onClick={onRegenerate}
              title="Regenerate"
            >
              <RefreshCw className="size-2.5" />
            </Button>
          )}

          {/* Version navigation */}
          {versionTotal != null && versionTotal > 1 && onVersionChange && (
            <span className="inline-flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-5 rounded"
                onClick={() => onVersionChange("prev")}
                disabled={versionIndex === 0}
              >
                <ChevronLeft className="size-2.5" />
              </Button>
              <span className="text-[10px] tabular-nums">
                {(versionIndex ?? 0) + 1}/{versionTotal}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-5 rounded"
                onClick={() => onVersionChange("next")}
                disabled={versionIndex === versionTotal - 1}
              >
                <ChevronRight className="size-2.5" />
              </Button>
            </span>
          )}

          {/* Assistant messages: compact summary + detail tooltip */}
          {!isUser && hasTokenInfo && (
            <Tooltip>
              <TooltipTrigger
                className="inline-flex cursor-default items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-muted-foreground/10"
              >
                <span>{fmtNum(totalTokens)} tokens</span>
                <span className="mx-0.5">·</span>
                <span>{fmtCost(totalCost ?? 0)}</span>
                <Info className="ml-0.5 size-2.5 opacity-50" />
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="start"
                className="max-w-xs p-0"
              >
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 p-2.5 text-[11px]">
                  {/* Model */}
                  {model && (
                    <>
                      <span className="text-background/60">Model</span>
                      <span className="font-medium">{model}</span>
                    </>
                  )}
                  {/* Tokens breakdown */}
                  {hasInputTokens && (
                    <>
                      <span className="text-background/60">Input</span>
                      <span>
                        {fmtNum(inputTokens!)} tokens
                        {inputCost != null && (
                          <span className="ml-1 text-background/60">
                            ({fmtCost(inputCost)})
                          </span>
                        )}
                      </span>
                    </>
                  )}
                  {hasOutputTokens && (
                    <>
                      <span className="text-background/60">Output</span>
                      <span>
                        {fmtNum(outputTokens!)} tokens
                        {outputCost != null && (
                          <span className="ml-1 text-background/60">
                            ({fmtCost(outputCost)})
                          </span>
                        )}
                      </span>
                    </>
                  )}
                  {/* Totals */}
                  <>
                    <span className="text-background/60">Total</span>
                    <span className="font-medium">
                      {fmtNum(totalTokens)} tokens · {fmtCost(totalCost ?? 0)}
                    </span>
                  </>
                  {/* Speed */}
                  {tokensPerSec != null && tokensPerSec > 0 && (
                    <>
                      <span className="text-background/60">Speed</span>
                      <span>{tokensPerSec} tok/s</span>
                    </>
                  )}
                  {/* Duration */}
                  {durationMs != null && durationMs > 0 && (
                    <>
                      <span className="text-background/60">Duration</span>
                      <span>{fmtDuration(durationMs)}</span>
                    </>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
});
