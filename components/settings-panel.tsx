"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";

const MODELS = [
  { value: "gpt-5-mini", label: "GPT-5 mini" },
  { value: "gpt-5-nano", label: "GPT-5 nano" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 nano" },
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
  { value: "codex-mini-latest", label: "Codex mini" },
];

const RESTRICTED_MODELS = new Set(["gpt-5-mini", "gpt-5-nano"]);

const PERSONAS = [
  { value: "structured", label: "E: Structured Output (Standard)" },
  { value: "A_minimal", label: "A: Minimal / Concise" },
  { value: "B_detailed", label: "B: Detailed Coach" },
  { value: "C_socratic", label: "C: Socratic Method" },
  { value: "D_strict", label: "D: Strict Interviewer" },
];

interface ChatSettings {
  model: string;
  temperature: number | null;
  persona: string;
}

interface SettingsPanelProps {
  settings: ChatSettings;
  onChange: (settings: ChatSettings) => void;
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  return (
    <div className="border-b bg-muted/30 px-4 py-3">
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
        {/* Model */}
        <div className="space-y-1.5">
          <Label className="text-xs">Modell</Label>
          <Select
            value={settings.model}
            onValueChange={(model) => {
              if (model) onChange({ ...settings, model });
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Temperature */}
        <div className={`space-y-1.5 ${RESTRICTED_MODELS.has(settings.model) ? "opacity-40 pointer-events-none" : ""}`}>
          <Label className="text-xs">
            Temperature: {RESTRICTED_MODELS.has(settings.model) ? "n/a" : (settings.temperature ?? 0.7).toFixed(1)}
          </Label>
          <Slider
            value={[settings.temperature ?? 0.7]}
            onValueChange={(val) => {
              const temp = Array.isArray(val) ? val[0] : val;
              onChange({ ...settings, temperature: temp });
            }}
            min={0}
            max={1}
            step={0.1}
            disabled={RESTRICTED_MODELS.has(settings.model)}
            className="mt-2"
          />
        </div>

        {/* Persona */}
        <div className="space-y-1.5">
          <Label className="text-xs">Persona</Label>
          <Select
            value={settings.persona}
            onValueChange={(persona) => {
              if (persona) onChange({ ...settings, persona });
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERSONAS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
