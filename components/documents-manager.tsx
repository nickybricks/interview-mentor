"use client";

import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  FileText,
  Plus,
  X,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle,
  Search,
  MoreHorizontal,
} from "lucide-react";

interface DocumentInfo {
  id: string;
  name: string;
  label: string | null;
  createdAt: string;
}

interface DocumentsManagerProps {
  projectId: string;
  hasCv: boolean;
  hasJd: boolean;
  documents: DocumentInfo[];
  gapLoading: boolean;
  onFileUploaded: () => void;
  onStartGapAnalysis: () => void;
}

export function DocumentsManager({
  projectId,
  hasCv,
  hasJd,
  documents,
  gapLoading,
  onFileUploaded,
  onStartGapAnalysis,
}: DocumentsManagerProps) {
  const { t } = useI18n();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const jdInputRef = useRef<HTMLInputElement>(null);
  const additionalInputRef = useRef<HTMLInputElement>(null);

  const totalFiles =
    (hasCv ? 1 : 0) + (hasJd ? 1 : 0) + documents.length;

  const uploadFile = async (file: File, type: "cv" | "jobDescription" | "additional") => {
      if (file.type !== "application/pdf") {
        setError(t("fileUpload.pdfOnly"));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(t("fileUpload.tooLarge"));
        return;
      }

      setUploading(true);
      setUploadingType(type);
      setError("");

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);
        formData.append("type", type);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || t("fileUpload.failed"));
        }

        onFileUploaded();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("fileUpload.failed")
        );
      } finally {
        setUploading(false);
        setUploadingType(null);
      }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm(t("docs.confirmDelete"))) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onFileUploaded();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleFileChange =
    (type: "cv" | "jobDescription" | "additional") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file, type);
      e.target.value = "";
    };

  const canStartGap = hasCv && hasJd;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="size-5" />
          {t("project.documents")}
        </CardTitle>
        <CardDescription>{t("project.documentsDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Attached files summary + dialog trigger */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <button className="flex w-full items-center gap-3 rounded-lg border border-dashed p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
            }
          >
            <FileText className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {t("docs.attachedFiles")}{" "}
                <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {totalFiles}
                </span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  hasCv && t("project.cvLabel"),
                  hasJd && t("project.jobLabel"),
                  ...documents.map((d) => d.name),
                ]
                  .filter(Boolean)
                  .join(", ") || t("docs.noFiles")}
              </p>
            </div>
            <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" />
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("docs.manageTitle")}</DialogTitle>
              <DialogDescription>
                {t("docs.manageDesc")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {/* CV */}
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <FileText className="size-5 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t("project.cvLabel")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasCv
                      ? t("fileUpload.uploaded").split("—")[0].trim()
                      : t("docs.notUploaded")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cvInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploadingType === "cv" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : hasCv ? (
                    t("docs.replace")
                  ) : (
                    t("docs.upload")
                  )}
                </Button>
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange("cv")}
                  className="hidden"
                />
              </div>

              {/* Job Description */}
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <FileText className="size-5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t("project.jobLabel")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasJd
                      ? t("fileUpload.uploaded").split("—")[0].trim()
                      : t("docs.notUploaded")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => jdInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploadingType === "jobDescription" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : hasJd ? (
                    t("docs.replace")
                  ) : (
                    t("docs.upload")
                  )}
                </Button>
                <input
                  ref={jdInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange("jobDescription")}
                  className="hidden"
                />
              </div>

              {/* Additional documents */}
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.name}</p>
                    {doc.label && (
                      <p className="text-xs text-muted-foreground">
                        {doc.label}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    aria-label={`Remove ${doc.name}`}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3.5" />
                {error}
              </div>
            )}

            {/* Attach button */}
            <button
              type="button"
              onClick={() => additionalInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50 hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {uploadingType === "additional" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {t("docs.attach")}
            </button>
            <input
              ref={additionalInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileChange("additional")}
              className="hidden"
            />

            <p className="text-xs text-muted-foreground">
              {t("docs.attachHint")}
            </p>
          </DialogContent>
        </Dialog>

        {/* Start Gap Analysis button — hidden: gap analysis card is disabled */}
        {false && (
          <>
            <Button
              onClick={onStartGapAnalysis}
              disabled={!canStartGap || gapLoading}
              className="w-full"
            >
              {gapLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t("project.gapGenerating")}
                </>
              ) : (
                <>
                  <Search className="mr-2 size-4" />
                  {t("docs.startGapAnalysis")}
                </>
              )}
            </Button>
            {!canStartGap && (
              <p className="text-center text-xs text-muted-foreground">
                {t("project.cvRequired")}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
