"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getSessionId } from "@/lib/session";

interface FileUploadProps {
  projectId: string;
  type: "cv" | "jobDescription";
  label: string;
  hasFile: boolean;
  onUploaded: () => void;
}

export function FileUpload({
  projectId,
  type,
  label,
  hasFile,
  onUploaded,
}: FileUploadProps) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
      if (file.type !== "application/pdf") {
        setError(t("fileUpload.pdfOnly"));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(t("fileUpload.tooLarge"));
        return;
      }

      setUploading(true);
      setError("");
      setSuccess(false);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);
        formData.append("type", type);

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "x-session-id": getSessionId() },
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || t("fileUpload.failed"));
        }

        setSuccess(true);
        onUploaded();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("fileUpload.failed")
        );
      } finally {
        setUploading(false);
      }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const showSuccess = hasFile || success;

  return (
    <button
      type="button"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
        isDragging
          ? "border-primary bg-primary/5"
          : showSuccess
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        name="fileUpload"
        aria-label={label}
        onChange={handleChange}
        className="hidden"
      />

      {uploading ? (
        <Loader2 className="size-8 animate-spin text-primary" />
      ) : showSuccess ? (
        <CheckCircle className="size-8 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Upload className="size-8 text-muted-foreground" />
      )}

      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">
          {uploading
            ? t("fileUpload.uploading")
            : showSuccess
              ? t("fileUpload.uploaded")
              : t("fileUpload.dragDrop")}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3" />
          {error}
        </div>
      )}
    </button>
  );
}
