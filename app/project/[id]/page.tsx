"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DocumentsManager } from "@/components/documents-manager";
import { useI18n } from "@/lib/i18n";
import dynamic from "next/dynamic";

// Lazy-load ReactMarkdown (~50KB) — only needed when gap analysis is open (bundle-dynamic-imports)
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });
import remarkGfm from "remark-gfm";
import {
  GraduationCap,
  Search,
  Mic,
  Briefcase,
  MapPin,
  Trophy,
  Download,
  Loader2,
  ChevronDown,
  Bot,
} from "lucide-react";

interface ProjectDetail {
  id: string;
  name: string;
  company: string | null;
  position: string | null;
  hasCv: boolean;
  hasJd: boolean;
  gapAnalysis: string | null;
  overallScore: number | null;
  createdAt: string;
  documents: {
    id: string;
    name: string;
    label: string | null;
    createdAt: string;
  }[];
  chats: {
    id: string;
    type: string;
    createdAt: string;
    messages: { content: string; createdAt: string }[];
  }[];
  categoryScores?: { name: string; avg: number; count: number }[];
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [gapLoading, setGapLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [gapOpen, setGapOpen] = useState(false);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      if (res.ok) {
        setProject(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch project:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProject();
  }, [params.id]);

  // Poll for gap analysis result when it's being generated
  useEffect(() => {
    if (!gapLoading) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/projects/${params.id}`);
      if (res.ok) {
        const updated = await res.json();
        if (updated.gapAnalysis) {
          setProject(updated);
          setGapLoading(false);
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [gapLoading, params.id]);

  const handleFileUploaded = async () => {
    const res = await fetch(`/api/projects/${params.id}`);
    if (res.ok) {
      const updated = await res.json();
      setProject(updated);
    }
  };

  const handleStartGapAnalysis = async () => {
    if (!project?.hasCv || !project?.hasJd) return;
    setGapLoading(true);
    try {
      await fetch(`/api/projects/${params.id}/gap-analysis`, {
        method: "POST",
        headers: { "x-locale": locale },
      });
    } catch (err) {
      console.error("Failed to start gap analysis:", err);
      setGapLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/projects/${params.id}/export?locale=${locale}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project?.name ?? "project"}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const startChat = async (type: string) => {
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: params.id, type }),
      });
      if (res.ok) {
        const chat = await res.json();
        window.dispatchEvent(new Event("projects-changed"));
        router.push(`/project/${params.id}/chat/${chat.id}`);
      }
    } catch (err) {
      console.error("Failed to create chat:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t("project.loading")}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{t("project.notFound")}</p>
      </div>
    );
  }

  const score = project.overallScore ?? 0;
  const mockUnlocked = score >= 7;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6 pt-14 md:pt-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            {project.company && (
              <span className="flex items-center gap-1">
                <Briefcase className="size-3.5" />
                {project.company}
              </span>
            )}
            {project.position && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {project.position}
              </span>
            )}
          </div>
        </div>

        <Separator />

        {/* Documents */}
        <DocumentsManager
          projectId={project.id}
          hasCv={project.hasCv}
          hasJd={project.hasJd}
          documents={project.documents}
          gapLoading={gapLoading}
          onFileUploaded={handleFileUploaded}
          onStartGapAnalysis={handleStartGapAnalysis}
        />

        {/* Start Chat Buttons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("project.coaching")}</CardTitle>
            <CardDescription>
              {t("project.coachingDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Kickoff */}
              <button
                type="button"
                onClick={() => {
                  const existing = project.chats.find((c) => c.type === "kickoff");
                  if (existing) {
                    router.push(`/project/${params.id}/chat/${existing.id}`);
                  } else {
                    startChat("kickoff");
                  }
                }}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Bot className="size-8 text-purple-600" />
                <span className="font-medium">{t("chatType.kickoff")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("project.kickoffDesc")}
                </span>
              </button>

              {/* Gap Analysis — hidden: not useful yet */}
              {false && (
              <button
                type="button"
                onClick={() => startChat("gap_analysis")}
                disabled={!project!.hasCv || !project!.hasJd}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Search className="size-8 text-amber-600" />
                <span className="font-medium">{t("chatType.gap_analysis")}</span>
                <span className="text-xs text-muted-foreground">
                  {!project!.hasCv || !project!.hasJd
                    ? t("project.cvRequired")
                    : t("project.gapCompare")}
                </span>
              </button>
              )}

              {/* Preparation */}
              <button
                type="button"
                onClick={() => startChat("preparation")}
                className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <GraduationCap className="size-8 text-blue-600" />
                <span className="font-medium">{t("chatType.preparation")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("project.prepQuestions")}
                </span>
              </button>

              {/* Mock Interview */}
              <button
                type="button"
                onClick={() => startChat("mock_interview")}
                disabled={!mockUnlocked}
                className="group relative flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Mic className="size-8 text-emerald-600" />
                <span className="font-medium">{t("chatType.mock_interview")}</span>
                <span className="text-xs text-muted-foreground">
                  {mockUnlocked
                    ? t("project.mockSimulation")
                    : t("project.mockLocked").replace("{score}", score.toFixed(1))}
                </span>
                {!mockUnlocked && (
                  <Badge variant="outline" className="absolute -top-2 -right-2 text-[10px]">
                    {t("project.locked")}
                  </Badge>
                )}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Gap Analysis Result — hidden: not useful yet */}
        {false && project!.gapAnalysis && !gapLoading && (
          <Card>
            <CardHeader className="p-0">
              <button
                type="button"
                onClick={() => setGapOpen((o) => !o)}
                aria-expanded={gapOpen}
                className="flex w-full cursor-pointer select-none flex-col gap-1.5 p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-t-lg"
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="size-5 text-amber-600" aria-hidden="true" />
                    {t("project.gapTitle")}
                  </CardTitle>
                  <ChevronDown
                    aria-hidden="true"
                    className={`size-5 text-muted-foreground transition-transform duration-300 ${
                      gapOpen ? "rotate-180" : ""
                    }`}
                  />
                </div>
                <CardDescription className="mt-0">
                  {t("project.gapAutoDesc")}
                </CardDescription>
              </button>
            </CardHeader>
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-in-out"
              style={{ gridTemplateRows: gapOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {project!.gapAnalysis}
                    </ReactMarkdown>
                  </div>
                </CardContent>
              </div>
            </div>
          </Card>
        )}

        {/* Score Overview */}
        {score > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="size-5" />
                {t("project.progress")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">
                  {score.toFixed(1)}
                  <span className="text-lg text-muted-foreground">/10</span>
                </div>
                <div className="flex-1">
                  <div className="mb-1 text-sm font-medium">{t("project.overallScore")}</div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={`h-2 rounded-full transition-[width] duration-300 ${
                        score >= 7
                          ? "bg-emerald-500"
                          : score >= 5
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${(score / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              {project.categoryScores && project.categoryScores.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium">{t("project.categories")}</div>
                  {project.categoryScores.map((cat) => (
                    <div key={cat.name} className="flex items-center gap-3 text-sm">
                      <span className="w-40 truncate">{cat.name}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-muted">
                        <div
                          className={`h-1.5 rounded-full transition-[width] duration-300 ${
                            cat.avg >= 7
                              ? "bg-emerald-500"
                              : cat.avg >= 5
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${(cat.avg / 10) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-muted-foreground">
                        {cat.avg}/10
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Export */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Download className="mr-2 size-4" />
            )}
            {t("project.export")}
          </Button>
        </div>
      </div>
    </div>
  );
}
