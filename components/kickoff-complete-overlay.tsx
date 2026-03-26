"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface KickoffCompleteOverlayProps {
  onMoreQuestions: () => void;
  onStartPrep: () => void;
  onGoToDashboard: () => void;
  locale: "de" | "en";
}

export function KickoffCompleteOverlay({
  onMoreQuestions,
  onStartPrep,
  onGoToDashboard,
  locale,
}: KickoffCompleteOverlayProps) {
  return (
    <div className="border-t bg-muted/30 p-6 text-center space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <h3 className="font-semibold text-lg">
          {locale === "de" ? "Kickoff abgeschlossen!" : "Kickoff Complete!"}
        </h3>
      </div>

      <p className="text-muted-foreground text-sm">
        {locale === "de"
          ? "Dein Coaching-Profil wurde gespeichert. Du kannst jetzt mit der Interviewvorbereitung starten."
          : "Your coaching profile has been saved. You can now start interview preparation."}
      </p>

      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={onMoreQuestions}>
          {locale === "de" ? "Weitere Fragen" : "More Questions"}
        </Button>
        <Button onClick={onStartPrep}>
          {locale === "de" ? "Interviewvorbereitung starten \u2192" : "Start Interview Prep \u2192"}
        </Button>
      </div>

      <button
        onClick={onGoToDashboard}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        {locale === "de" ? "Zum Dashboard \u2192" : "Go to Dashboard \u2192"}
      </button>
    </div>
  );
}
