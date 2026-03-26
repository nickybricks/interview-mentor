"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: NewProjectDialogProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("newProject.nameRequired"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company: company.trim() || undefined,
          position: position.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("newProject.createError"));
      }

      const project = await res.json();
      setName("");
      setCompany("");
      setPosition("");
      onOpenChange(false);
      onCreated();
      // Redirect to the auto-created kickoff chat
      if (project.kickoffChatId) {
        router.push(`/project/${project.id}/chat/${project.kickoffChatId}`);
      } else {
        router.push(`/project/${project.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("newProject.genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newProject.title")}</DialogTitle>
          <DialogDescription>
            {t("newProject.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("newProject.nameLabel")}</Label>
            <Input
              id="name"
              name="projectName"
              autoComplete="off"
              placeholder={t("newProject.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">{t("newProject.companyLabel")}</Label>
            <Input
              id="company"
              name="company"
              autoComplete="organization"
              placeholder={t("newProject.companyPlaceholder")}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">{t("newProject.positionLabel")}</Label>
            <Input
              id="position"
              name="position"
              autoComplete="organization-title"
              placeholder={t("newProject.positionPlaceholder")}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("newProject.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("newProject.creating") : t("newProject.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
