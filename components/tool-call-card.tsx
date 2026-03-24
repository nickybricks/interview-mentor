"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import {
  Target,
  TrendingDown,
  BookOpen,
  Loader2,
  CheckCircle,
} from "lucide-react";

interface ScoreDimensions {
  substance: number;
  structure: number;
  relevance: number;
  credibility: number;
  differentiation: number;
}

interface ScoreAnswerResult {
  overallScore: number;
  dimensions: ScoreDimensions;
  strengths: string[];
  weaknesses: string[];
  suggestion: string;
  rootCause: string | null;
}

interface WeakArea {
  category: string;
  avgScore: number;
  count: number;
  sampleQuestions: string[];
}

interface WeakAreasResult {
  weakAreas: WeakArea[];
}

interface KnowledgeResult {
  results: { text: string; source: string; score: number }[];
}

export interface ToolCallDisplay {
  name: string;
  status: "running" | "done";
  result?: unknown;
}

const TOOL_ICONS: Record<string, React.ElementType> = {
  score_answer: Target,
  get_weak_areas: TrendingDown,
  search_knowledge_base: BookOpen,
};

function DimensionBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const pct = (value / 5) * 100;
  const color =
    value >= 4
      ? "bg-emerald-500"
      : value >= 3
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div
          className={`h-1.5 rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-4 text-right font-medium">{value}</span>
    </div>
  );
}

function ScoreCard({ result }: { result: ScoreAnswerResult }) {
  const { t } = useI18n();
  const d = result.dimensions;
  const scoreColor =
    result.overallScore >= 7
      ? "border-emerald-300 text-emerald-700 dark:text-emerald-400"
      : result.overallScore >= 5
        ? "border-amber-300 text-amber-700 dark:text-amber-400"
        : "border-red-300 text-red-700 dark:text-red-400";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`text-sm font-bold ${scoreColor}`}>
          {result.overallScore}/10
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {t("tool.overallScore")}
        </span>
      </div>

      <div className="space-y-1">
        <DimensionBar label={t("tool.substance")} value={d.substance} />
        <DimensionBar label={t("tool.structure")} value={d.structure} />
        <DimensionBar label={t("tool.relevance")} value={d.relevance} />
        <DimensionBar label={t("tool.credibility")} value={d.credibility} />
        <DimensionBar label={t("tool.differentiation")} value={d.differentiation} />
      </div>

      {result.strengths.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            {t("tool.strengths")}
          </p>
          <ul className="mt-0.5 space-y-0.5 text-[11px] text-muted-foreground">
            {result.strengths.map((s, i) => (
              <li key={i}>+ {s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.weaknesses.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
            {t("tool.weaknesses")}
          </p>
          <ul className="mt-0.5 space-y-0.5 text-[11px] text-muted-foreground">
            {result.weaknesses.map((w, i) => (
              <li key={i}>- {w}</li>
            ))}
          </ul>
        </div>
      )}

      {result.suggestion && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium">{t("tool.suggestion")}:</span>{" "}
          {result.suggestion}
        </p>
      )}

      {result.rootCause && (
        <p className="text-[11px] text-muted-foreground italic">
          {t("tool.rootCause")}: {result.rootCause}
        </p>
      )}
    </div>
  );
}

function WeakAreasCard({ result }: { result: WeakAreasResult }) {
  const { t } = useI18n();

  if (result.weakAreas.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {t("tool.noWeakAreas")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {result.weakAreas.map((area) => (
        <div key={area.category} className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium">{area.category}</span>
            <Badge
              variant="outline"
              className={`text-[9px] ${
                area.avgScore >= 7
                  ? "border-emerald-300 text-emerald-700"
                  : area.avgScore >= 5
                    ? "border-amber-300 text-amber-700"
                    : "border-red-300 text-red-700"
              }`}
            >
              {area.avgScore}/10
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              ({area.count} {t("tool.answers")})
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function KnowledgeCard({ result }: { result: KnowledgeResult }) {
  const { t } = useI18n();

  if (result.results.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {t("tool.noResults")}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {result.results.slice(0, 3).map((r, i) => (
        <div key={i} className="rounded border bg-background p-1.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <BookOpen className="size-3 shrink-0 text-muted-foreground" />
            <span className="font-medium truncate">{r.source}</span>
            <Badge
              variant="outline"
              className="ml-auto shrink-0 text-[9px] px-1 py-0"
            >
              {Math.round(r.score * 100)}%
            </Badge>
          </div>
          <p className="mt-0.5 text-muted-foreground line-clamp-2">{r.text}</p>
        </div>
      ))}
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  score_answer: "tool.scoreAnswer",
  get_weak_areas: "tool.getWeakAreas",
  search_knowledge_base: "tool.searchKnowledge",
};

export function ToolCallCard({ toolCall }: { toolCall: ToolCallDisplay }) {
  const { t } = useI18n();
  const Icon = TOOL_ICONS[toolCall.name] ?? Target;
  const labelKey = TOOL_LABELS[toolCall.name] ?? toolCall.name;

  return (
    <div className="rounded-lg border bg-muted/50 p-2.5 text-sm">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium">{t(labelKey as Parameters<typeof t>[0])}</span>
        {toolCall.status === "running" ? (
          <Loader2 className="ml-auto size-3 animate-spin text-muted-foreground" />
        ) : (
          <CheckCircle className="ml-auto size-3 text-emerald-500" />
        )}
      </div>

      {toolCall.status === "done" && toolCall.result != null && (
        <div className="mt-1">
          {toolCall.name === "score_answer" ? (
            <ScoreCard result={toolCall.result as ScoreAnswerResult} />
          ) : toolCall.name === "get_weak_areas" ? (
            <WeakAreasCard result={toolCall.result as WeakAreasResult} />
          ) : toolCall.name === "search_knowledge_base" ? (
            <KnowledgeCard result={toolCall.result as KnowledgeResult} />
          ) : null}
        </div>
      )}
    </div>
  );
}
