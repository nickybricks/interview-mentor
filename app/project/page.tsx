"use client";

import { GraduationCap } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ProjectEmptyState() {
  const { t } = useI18n();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <GraduationCap className="size-16 text-muted-foreground/30" />
      <div>
        <h2 className="text-lg font-semibold">{t("project.empty.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("project.empty.description")}
        </p>
      </div>
    </div>
  );
}
