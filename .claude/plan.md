# Plan: Model Parameters Panel auf der Projektseite

## Übersicht
Ein aufklappbares Einstellungspanel rechts auf der Projektseite (wie im Screenshot), das KI-Parameter pro Prompt-Typ (Gap, Preparation, Mock Interview) konfigurierbar macht. Änderungen werden erst beim Klick auf "Speichern" in einer JSON-Konfigurationsdatei persistiert und von den API-Routes gelesen.

## Architektur-Entscheidung: Wo werden die Settings gespeichert?

**Option: JSON-Datei (`lib/model-settings.ts` + `data/settings.json`)**
- Einstellungen werden in einer JSON-Datei auf dem Server gespeichert
- API-Route `GET/PUT /api/settings` zum Lesen/Schreiben
- Kein DB-Schema-Änderung nötig, kein Migration erforderlich
- Die API-Routes (`messages`, `upload`) lesen die Settings beim Aufruf

## Zu erstellende/ändernde Dateien

### 1. `lib/model-settings.ts` (NEU)
Settings-Typen und Default-Werte:
```typescript
interface ModelSettings {
  systemPrompt: string;      // Editierbarer System Prompt
  temperature: number;        // 0.0 - 2.0
  maxTokens: number | null;   // Limit Response Length (null = unlimited)
  topP: number;               // Top P Sampling (0.0 - 1.0)
  topK: number;               // Top K Sampling (integer)
  repeatPenalty: number;      // Repeat Penalty / Frequency Penalty (-2.0 - 2.0)
  minP: number;               // Min P Sampling (0.0 - 1.0)
}

interface AllSettings {
  gap_analysis: ModelSettings;
  preparation: ModelSettings;
  mock_interview: ModelSettings;
}
```
- Default-Werte aus den aktuellen Prompts und Parametern
- `loadSettings()` und `saveSettings()` Funktionen
- Hinweis: OpenAI API unterstützt `temperature`, `max_tokens`, `top_p`, `frequency_penalty`. `top_k` und `min_p` sind OpenAI-spezifisch nicht verfügbar aber werden als UI-Felder angezeigt (für zukünftige lokale Modelle).

### 2. `app/api/settings/route.ts` (NEU)
- `GET /api/settings` — Alle Settings laden
- `PUT /api/settings` — Settings für einen Typ speichern

### 3. `components/model-parameters-panel.tsx` (NEU)
Aufklappbares Panel mit:
- **Tab-Auswahl oben**: Gap-Analyse | Vorbereitung | Mock Interview
- **System Prompt** (aufklappbar): Textarea mit dem Prompt-Text
- **Settings** (aufklappbar):
  - Temperature (Slider + Number Input)
  - Maximum Response Length in Tokens (Number Input + Checkbox)
- **Sampling** (aufklappbar):
  - Top K Sampling (Number Input)
  - Repeat Penalty (Number Input + Checkbox)
  - Top P Sampling (Slider + Number Input)
  - Min P Sampling (Slider + Number Input)
- **Speichern-Button** unten (schreibt via PUT /api/settings)

### 4. `app/project/[id]/page.tsx` (ÄNDERN)
- Layout ändern: Hauptinhalt links, Settings-Panel rechts (toggle-bar)
- Settings-Icon-Button in der Header-Zeile zum Ein-/Ausklappen
- Panel-State: offen/geschlossen

### 5. `app/api/messages/route.ts` (ÄNDERN)
- Settings aus `loadSettings()` lesen statt hardcoded
- `systemPrompt` aus Settings verwenden statt aus `lib/prompts.ts`
- `temperature`, `max_tokens`, `top_p`, `frequency_penalty` aus Settings an OpenAI API übergeben

### 6. `app/api/upload/route.ts` (ÄNDERN)
- Gap-Analysis-Settings aus `loadSettings()` lesen für `runGapAnalysis()`

## Implementierungsschritte

1. **`lib/model-settings.ts`** erstellen — Types, Defaults, load/save
2. **`app/api/settings/route.ts`** erstellen — GET/PUT API
3. **`components/model-parameters-panel.tsx`** erstellen — Vollständiges Panel UI
4. **`app/project/[id]/page.tsx`** ändern — Layout mit ein-/ausklappbarem Panel
5. **`app/api/messages/route.ts`** ändern — Settings beim API-Call lesen
6. **`app/api/upload/route.ts`** ändern — Gap-Analysis Settings lesen
7. Verifizieren im Preview
8. DOCUMENTATION.md aktualisieren
