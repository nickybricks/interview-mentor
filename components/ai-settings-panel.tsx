"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  Save,
  RotateCcw,
  Settings2,
  X,
  Loader2,
  Check,
  Maximize2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

type AIFeatureKey = "gap_analysis" | "preparation" | "mock_interview";

interface AIFeatureSettings {
  systemPrompt: string | null;
  model: string;
  temperature: number | null;
  maxTokens: number | null;
  topP: number;
  topK: number | null;
  frequencyPenalty: number;
  minP: number | null;
}

interface AISettings {
  gap_analysis: AIFeatureSettings;
  preparation: AIFeatureSettings;
  mock_interview: AIFeatureSettings;
}

const FEATURE_LABEL_KEYS: Record<AIFeatureKey, "feature.gap_analysis" | "feature.preparation" | "feature.mock_interview"> = {
  gap_analysis: "feature.gap_analysis",
  preparation: "feature.preparation",
  mock_interview: "feature.mock_interview",
};

const FEATURE_COLORS: Record<AIFeatureKey, string> = {
  gap_analysis: "bg-amber-500",
  preparation: "bg-blue-500",
  mock_interview: "bg-emerald-500",
};

const MODELS = [
  { value: "gpt-5-mini", label: "GPT-5 mini" },
  { value: "gpt-5-nano", label: "GPT-5 nano" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 nano" },
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
  { value: "codex-mini-latest", label: "Codex mini" },
];

// Models that only accept default values for temperature / frequency_penalty
const UNSUPPORTED_TEMPERATURE = new Set(["gpt-5-mini", "gpt-5-nano"]);
const UNSUPPORTED_FREQ_PENALTY = new Set(["gpt-5-mini", "gpt-5-nano"]);
const UNSUPPORTED_TOP_P = new Set(["gpt-5-mini", "gpt-5-nano"]);

interface AISettingsPanelProps {
  onClose: () => void;
  defaultFeature?: AIFeatureKey;
}

export function AISettingsPanel({ onClose, defaultFeature }: AISettingsPanelProps) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [defaultPrompts, setDefaultPrompts] = useState<
    Record<AIFeatureKey, string>
  >({} as Record<AIFeatureKey, string>);
  const [selectedFeature, setSelectedFeature] =
    useState<AIFeatureKey>(defaultFeature ?? "gap_analysis");
  const [draft, setDraft] = useState<AIFeatureSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);

  // Sync selectedFeature when defaultFeature prop changes (render-time adjustment)
  const [prevDefaultFeature, setPrevDefaultFeature] = useState(defaultFeature);
  if (defaultFeature && defaultFeature !== prevDefaultFeature) {
    setPrevDefaultFeature(defaultFeature);
    setSelectedFeature(defaultFeature);
    if (settings) {
      setDraft(settings[defaultFeature]);
      setDirty(false);
      setSaved(false);
    }
  }

  // Fetch settings + default prompts on mount (cache-busted)
  useEffect(() => {
    const feature = defaultFeature ?? "gap_analysis";
    Promise.all([
      fetch("/api/ai-settings", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/ai-settings/defaults", { cache: "no-store" }).then((r) =>
        r.json()
      ),
    ]).then(([s, d]) => {
      setSettings(s);
      setDefaultPrompts(d);
      setDraft(s[feature]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDraft = (patch: Partial<AIFeatureSettings>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!settings || !draft) return;
    setSaving(true);
    const updated = { ...settings, [selectedFeature]: draft };
    const res = await fetch("/api/ai-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const result = await res.json();
      setSettings(result);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const handleResetPrompt = () => {
    updateDraft({ systemPrompt: null });
  };

  if (!draft) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const effectivePrompt =
    draft.systemPrompt ?? defaultPrompts[selectedFeature] ?? "";

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Settings2 className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{t("aiSettings.title")}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close settings"
          onClick={onClose}
          className="size-7"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Feature Selector */}
      <div className="px-4 py-3 space-y-2">
        <Label className="text-xs text-muted-foreground">{t("aiSettings.featureLabel")}</Label>
        <Select
          value={selectedFeature}
          onValueChange={(val) => {
            if (val) {
              const key = val as AIFeatureKey;
              setSelectedFeature(key);
              if (settings) {
                setDraft(settings[key]);
                setDirty(false);
                setSaved(false);
              }
            }
          }}
        >
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full shrink-0 ${FEATURE_COLORS[selectedFeature]}`} />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FEATURE_LABEL_KEYS) as AIFeatureKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full shrink-0 ${FEATURE_COLORS[key]}`} />
                  {t(FEATURE_LABEL_KEYS[key])}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Scrollable sections */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-4">
          {/* System Prompt */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-foreground/80">
              <span>System Prompt</span>
              <ChevronDown className="size-4 transition-transform [[data-panel-open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <div className="space-y-2 pb-3">
                {/* Fixed-height textarea with scroll */}
                <div className="relative">
                  <Textarea
                    name="systemPrompt"
                    autoComplete="off"
                    spellCheck={false}
                    value={effectivePrompt}
                    onChange={(e) =>
                      updateDraft({ systemPrompt: e.target.value })
                    }
                    className="h-[150px] resize-none overflow-y-auto text-xs font-mono leading-relaxed"
                  />
                  {/* Expand button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1.5 bottom-1.5 size-6 opacity-60 hover:opacity-100"
                    onClick={() => setPromptDialogOpen(true)}
                    aria-label={t("aiSettings.expandPrompt")}
                  >
                    <Maximize2 className="size-3.5" />
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetPrompt}
                    disabled={draft.systemPrompt === null}
                    className="h-7 text-xs"
                  >
                    <RotateCcw className="mr-1 size-3" />
                    {t("aiSettings.default")}
                  </Button>
                </div>
              </div>
            </CollapsiblePanel>
          </Collapsible>

          <Separator />

          {/* Settings */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-foreground/80">
              <span>Settings</span>
              <ChevronDown className="size-4 transition-transform [[data-panel-open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <div className="space-y-4 pb-3">
                {/* Model */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("aiSettings.model")}</Label>
                  <Select
                    value={draft.model}
                    onValueChange={(val) => {
                      if (val) updateDraft({ model: val });
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
                <div className={`space-y-1.5 ${UNSUPPORTED_TEMPERATURE.has(draft.model) ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Temperature</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {UNSUPPORTED_TEMPERATURE.has(draft.model)
                        ? "n/a"
                        : (draft.temperature ?? 0.7).toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[draft.temperature ?? 0.7]}
                    onValueChange={(val) => {
                      const t = Array.isArray(val) ? val[0] : val;
                      updateDraft({ temperature: t });
                    }}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={UNSUPPORTED_TEMPERATURE.has(draft.model)}
                  />
                  {UNSUPPORTED_TEMPERATURE.has(draft.model) && (
                    <p className="text-[10px] text-muted-foreground">Not supported by this model</p>
                  )}
                </div>

                {/* Max Tokens */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("aiSettings.maxTokens")}</Label>
                  <Input
                    type="number"
                    name="maxTokens"
                    autoComplete="off"
                    value={draft.maxTokens ?? ""}
                    placeholder={t("aiSettings.unlimited")}
                    onChange={(e) =>
                      updateDraft({
                        maxTokens: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      })
                    }
                    className="h-8 text-xs"
                    min={1}
                    max={128000}
                  />
                </div>
              </div>
            </CollapsiblePanel>
          </Collapsible>

          <Separator />

          {/* Sampling */}
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium hover:text-foreground/80">
              <span>Sampling</span>
              <ChevronDown className="size-4 transition-transform [[data-panel-open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsiblePanel>
              <div className="space-y-4 pb-3">
                {/* Top P */}
                <div className={`space-y-1.5 ${UNSUPPORTED_TOP_P.has(draft.model) ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Top P Sampling</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {UNSUPPORTED_TOP_P.has(draft.model)
                        ? "n/a"
                        : draft.topP.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[draft.topP]}
                    onValueChange={(val) => {
                      const p = Array.isArray(val) ? val[0] : val;
                      updateDraft({ topP: p });
                    }}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={UNSUPPORTED_TOP_P.has(draft.model)}
                  />
                  {UNSUPPORTED_TOP_P.has(draft.model) && (
                    <p className="text-[10px] text-muted-foreground">Not supported by this model</p>
                  )}
                </div>

                {/* Repeat Penalty (frequency_penalty) */}
                <div className={`space-y-1.5 ${UNSUPPORTED_FREQ_PENALTY.has(draft.model) ? "opacity-40 pointer-events-none" : ""}`}>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Repeat Penalty</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {UNSUPPORTED_FREQ_PENALTY.has(draft.model)
                        ? "n/a"
                        : draft.frequencyPenalty.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[draft.frequencyPenalty]}
                    onValueChange={(val) => {
                      const fp = Array.isArray(val) ? val[0] : val;
                      updateDraft({ frequencyPenalty: fp });
                    }}
                    min={0}
                    max={2}
                    step={0.01}
                    disabled={UNSUPPORTED_FREQ_PENALTY.has(draft.model)}
                  />
                  {UNSUPPORTED_FREQ_PENALTY.has(draft.model) && (
                    <p className="text-[10px] text-muted-foreground">Not supported by this model</p>
                  )}
                </div>

                {/* Top K */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Top K Sampling</Label>
                  <Input
                    type="number"
                    value={draft.topK ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      updateDraft({
                        topK: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      })
                    }
                    className="h-8 text-xs"
                    min={1}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t("aiSettings.notSupported")}
                  </p>
                </div>

                {/* Min P */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Min P Sampling</Label>
                  <Input
                    type="number"
                    value={draft.minP ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      updateDraft({
                        minP: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    className="h-8 text-xs"
                    step={0.01}
                    min={0}
                    max={1}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t("aiSettings.notSupported")}
                  </p>
                </div>
              </div>
            </CollapsiblePanel>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Save Button */}
      <div className="border-t px-4 py-3">
        <Button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="w-full"
        >
          {saving ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 size-4" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          {saving
            ? t("aiSettings.saving")
            : saved
              ? t("aiSettings.saved")
              : t("aiSettings.save")}
        </Button>
      </div>

      {/* Prompt Expand Dialog */}
      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              System Prompt — {t(FEATURE_LABEL_KEYS[selectedFeature])}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={effectivePrompt}
            onChange={(e) => updateDraft({ systemPrompt: e.target.value })}
            className="h-[50vh] resize-none overflow-y-auto text-xs font-mono leading-relaxed"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetPrompt}
              disabled={draft.systemPrompt === null}
            >
              <RotateCcw className="mr-1 size-3" />
              {t("aiSettings.resetDefault")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
