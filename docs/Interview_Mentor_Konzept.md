# Interview Mentor – Projektkonzept (Next.js Version)

## 🎯 Vision
Ein persönlicher Interview-Coach als vollwertige Web-App mit Next.js – produktionsreif, deploybar, mit eigenem Backend und Datenbank. Kein Streamlit, sondern eine echte App wie ChatGPT oder Langdock.

---

## 🧠 Kernidee

Die App richtet sich an Bewerber, die sich systematisch auf Vorstellungsgespräche vorbereiten wollen. Statt generischer Tipps bietet sie:

1. **Gap-Analyse** – CV + Stellenanzeige vergleichen → Lücken identifizieren
2. **Gezielte Vorbereitung** – Fragen aus 5 Kategorien mit Spaced Repetition
3. **Mock Interview** – Realistische Simulation ohne Unterbrechungen
4. **Fortschritts-Tracking** – Scores, Kategorien, Schwachstellen

---

## 🔄 Der 3-Phasen-Flow

### Phase 1: Gap-Analyse
```
User lädt CV + Stellenanzeige hoch
→ Bot analysiert automatisch
→ Matching-Punkte ✅ und Lücken ❌ identifizieren
→ Personalisierter Vorbereitungsplan
```

### Phase 2: Vorbereitung (Preparation) ← KERNPHASE
```
Bot stellt Fragen aus 5 Kategorien:
🏆 Experience | 🧠 Problem-Solving | 🏢 Company/Industry | 👥 Personality | 📚 Knowledge

User antwortet → Bot gibt Feedback + Score (1-10) → Nächste Frage

4-Tier Spaced Repetition:
Score 0-4: ❌ Sofort wiederholen
Score 5-6: ⚠️ Nach 2-3 Fragen wiederholen
Score 7-8: ✅ Bestanden → kommt im Mock Interview
Score 9-10: 🏆 Gemeistert → selten wiederholt
```

**Gewählter System-Prompt: E_structured_output** (Structured Output mit Template-Format)

Begründung (aus LLM-as-a-Judge Evaluation v3, 85 Evaluierungen):
- **Höchster Overall-Score: 3.91/5.0** (vs. B: 3.79, C: 3.68, D: 3.61, A: 3.39)
- **Bester Session Drive: 4.76/5.0** – Bot führt die Session am konsequentesten
- **Beste Relevance: 4.59/5.0** – Fragen sind am besten auf Position/Kategorie zugeschnitten
- **Beste Structure: 4.00/5.0** – konsistentes, scanbares Format
- Template-Format erzwingt Vollständigkeit: Score, Feedback, Coach's Note, Next Question

Das Template-Format des Prompts:
```
## 🎤 Interview Question
**Category:** [...]
**Difficulty:** [...]
**What the interviewer really wants to know:** [...]
**Question:** [...]

## 💬 Coach's Note
[Empathischer Kommentar – ehrlich aber warm]

## 📝 Evaluation
**Score:** [X/10]
**Strengths:** [...]
**Improvements:** [...]
**Example Answer:** [...]
**Next Step:** [🔄/⏳/➡️/🏆]

## 🎤 Next Interview Question
[...]
```

### Phase 3: Mock Interview
```
Freigeschaltet ab Gesamt-Score ≥ 7.0
→ 20-30 Minuten simuliertes Interview
→ KEIN Feedback während der Session
→ Umfassender Feedback-Report am Ende
```

---

## 🖥️ UI-Konzept

```
┌─────────────────────┬──────────────────────────────────────────┐
│                     │                                          │
│  SIDEBAR (links)    │         MAIN AREA (rechts)               │
│                     │                                          │
│  ┌───────────────┐  │  ┌──────────────────────────────────┐    │
│  │ + Neue        │  │  │                                  │    │
│  │   Bewerbung   │  │  │   Chat-Bereich                   │    │
│  ├───────────────┤  │  │                                  │    │
│  │               │  │  │   Bot: 🎤 Interview Question     │    │
│  │ Projekt 1     │  │  │   Category: Experience           │    │
│  │  ├─ Chat 1    │  │  │   Question: "Name 3 projects..." │    │
│  │  ├─ Chat 2    │  │  │                                  │    │
│  │  └─ Docs      │  │  │   User: "In my last role..."     │    │
│  │               │  │  │                                  │    │
│  │ Projekt 2     │  │  │   Bot: 📝 Evaluation             │    │
│  │  └─ Chat 1    │  │  │   Score: 8/10                    │    │
│  │               │  │  │   💬 Coach's Note: "Excellent..." │    │
│  └───────────────┘  │  │   🎤 Next Question: ...          │    │
│                     │  │                                  │    │
│  ┌───────────────┐  │  ├──────────────────────────────────┤    │
│  │ ⚙️ Settings   │  │  │  Eingabefeld                     │    │
│  │ Temperature   │  │  │  [Nachricht eingeben...]  [Send] │    │
│  │ Model         │  │  └──────────────────────────────────┘    │
│  │ Persona       │  │                                          │
│  └───────────────┘  │                                          │
└─────────────────────┴──────────────────────────────────────────┘
```

Der Bot führt den User Schritt für Schritt durch alle 3 Phasen. Der User muss nur antworten – der Bot stellt die Fragen, gibt Feedback und treibt die Session voran.

---

## 📝 User Flow

### Schritt 1: Projekt erstellen
```
User klickt "+ Neue Bewerbung"
→ Name eingeben (z.B. "E-Commerce Manager @ Zalando")
→ Lebenslauf hochladen (PDF)
→ Stellenanzeige einfügen (Text oder PDF)
→ [Projekt erstellen]
```

### Schritt 2: Automatische Gap-Analyse
Der Bot startet sofort und analysiert CV vs. Stellenanzeige:
```
🤖 Coach: "Ich habe deinen Lebenslauf und die Stellenanzeige analysiert.

✅ Matching: E-Commerce Erfahrung, Projektmanagement, Team-Führung
❌ Lücken: Datenanalyse (SQL), A/B Testing, Stakeholder Management

Ich empfehle, mit den Lücken zu starten. Bereit?"
```

### Schritt 3: Vorbereitung (Preparation)
```
🤖 Coach: "## 🎤 Interview Question
**Category:** 🏆 Experience
**Difficulty:** Medium
**What the interviewer really wants to know:** Can you lead projects with measurable impact?
**Question:** Name 3 projects you are most proud of and explain why."

👤 User: "I built an online shop and led a team."

🤖 Coach: "## 💬 Coach's Note
I can see you have real experience here – building an online shop is genuinely
impressive. But in an interview, the details make the difference.

## 📝 Evaluation
**Score:** 4/10
**Strengths:** Shows hands-on experience and leadership
**Improvements:** Only 1 project instead of 3, no concrete numbers, no STAR format
**Example Answer:** 'At Company X, online revenue was declining (Situation)...'
**Next Step:** 🔄 Score 0-4: Let's try this one again.

## 🎤 Next Interview Question
**Category:** 🏆 Experience
**Difficulty:** Medium
**Question:** Name 3 projects you are most proud of and explain why."
```

### Schritt 4: Mock Interview (ab Score ≥ 7.0)
```
🤖 Coach: "🎉 Congratulations! Your overall score is 7.5/10.
The Mock Interview is now unlocked!

This will be a 20-30 minute simulated real interview.
I'll ask questions WITHOUT giving feedback during the session.
At the end, you'll receive a comprehensive feedback report.

Ready to start?"
```

---

## 📊 Spaced Repetition System

| Score | Was passiert |
|---|---|
| **0-4/10** | ❌ Frage kommt **sofort nochmal** dran |
| **5-6/10** | ⚠️ Frage kommt **später nochmal** (nach 2-3 anderen Fragen) |
| **7-8/10** | ✅ Frage bestanden, kommt aber im **Mock Interview** nochmal |
| **9-10/10** | 🏆 Frage gemeistert, wird nur noch selten wiederholt |

### Empathy & Tone
- Bot erkennt Stress und Frustration und reagiert empathisch
- Bei Score 0-4: besonders warm – der User weiß schon, dass es nicht gut war
- Kein Toxic Positivity ("Great job!" für schwache Antwort)
- Ehrlicher Score + warmer Ton sind kein Widerspruch

---

## 📊 Projekt-Dashboard

```
## 📊 Aktueller Status
Gesamt-Score: 6.8/10
Mock Interview: 🔒 Noch nicht freigeschaltet (ab 7.0)
Anzahl Übungs-Sessions: 4
Anzahl Mock Interviews: 0

## 📋 Gap-Analyse
✅ Matching: E-Commerce, Projektmanagement, Team-Führung
❌ Lücken: Datenanalyse, SQL, A/B Testing

## 🏆 Erfahrungs-Fragen [8/10] ✅
## 🧠 Problem-Solving [5/10] ⚠️
## 🏢 Company/Industry [6/10] ⚠️
## 👥 Personality [7/10] ✅
## 📚 Knowledge [4/10] ❌
```

---

## 🏗️ Technische Architektur

```
┌─────────────────────────────────────────────┐
│              Next.js App                     │
│                                             │
│  ┌─────────────┐    ┌────────────────────┐  │
│  │  Frontend   │    │  API Routes        │  │
│  │  (React)    │◄──►│  (Backend)         │  │
│  │             │    │                    │  │
│  │  - Chat UI  │    │  - /api/chat       │  │
│  │  - Sidebar  │    │  - /api/projects   │  │
│  │  - Settings │    │  - /api/upload     │  │
│  │  - Dashboard│    │  - /api/messages   │  │
│  └─────────────┘    └────────┬───────────┘  │
│                              │              │
│                    ┌─────────▼──────────┐   │
│                    │  Prisma ORM        │   │
│                    │  (SQLite)          │   │
│                    └─────────┬──────────┘   │
│                              │              │
│                    ┌─────────▼──────────┐   │
│                    │  OpenAI API        │   │
│                    │  (gpt-4.1-mini)    │   │
│                    └────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Tech Stack
| Komponente | Technologie |
|---|---|
| **Framework** | Next.js 14 (App Router) |
| **Frontend** | React + Tailwind CSS + shadcn/ui |
| **Backend** | Next.js API Routes |
| **Datenbank** | SQLite + Prisma ORM |
| **AI** | OpenAI API (gpt-4.1-mini) |
| **File Upload** | PDF-Parsing (pdf-parse) |
| **Deployment** | Vercel |

---

## 📁 Projektstruktur

```
interview-mentor/
├── app/
│   ├── layout.tsx                ← Root Layout (Sidebar + Main)
│   ├── page.tsx                  ← Landing / Dashboard
│   ├── project/
│   │   └── [id]/
│   │       ├── page.tsx          ← Projekt-Übersicht (Tabs)
│   │       └── chat/
│   │           └── [chatId]/
│   │               └── page.tsx  ← Chat-Ansicht
│   └── api/
│       ├── projects/
│       │   └── route.ts          ← CRUD für Projekte
│       ├── chats/
│       │   └── route.ts          ← CRUD für Chats
│       ├── messages/
│       │   └── route.ts          ← Nachrichten senden/empfangen
│       └── upload/
│           └── route.ts          ← File Upload (CV, Stellenanzeige)
├── components/
│   ├── Sidebar.tsx
│   ├── ChatWindow.tsx
│   ├── MessageBubble.tsx
│   ├── SettingsPanel.tsx
│   └── FileUpload.tsx
├── lib/
│   ├── openai.ts                 ← OpenAI Client + API Calls
│   ├── prompts.ts                ← System Prompts (E_structured_output als Default)
│   ├── db.ts                     ← Prisma Client
│   └── security.ts               ← Input Validation, Topic Filter
├── prisma/
│   ├── schema.prisma             ← Datenbank-Schema
│   └── dev.db                    ← SQLite Datenbank
├── evaluation/
│   ├── preparation_prompt_evaluation_v3.py  ← LLM-as-a-Judge Skript
│   ├── preparation_evaluation_results.csv   ← Rohdaten
│   ├── preparation_evaluation_results.png   ← Chart
│   └── prompt_testing.md                    ← Analyse & Entscheidung
├── .env.local                    ← OpenAI API Key (Next.js)
├── .env                          ← OpenAI API Key (Python Evaluation)
├── tailwind.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

### Datenbank-Schema (Prisma + SQLite)

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model Project {
  id             String   @id @default(cuid())
  name           String
  company        String?
  position       String?
  cvText         String?
  jobDescription String?
  gapAnalysis    String?
  overallScore   Float?   @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  chats          Chat[]
}

model Chat {
  id        String    @id @default(cuid())
  projectId String
  project   Project   @relation(fields: [projectId], references: [id])
  type      String    @default("preparation")  // "gap_analysis" | "preparation" | "mock_interview"
  persona   String    @default("structured")    // "structured" (E) als Default
  createdAt DateTime  @default(now())
  messages  Message[]
}

model Message {
  id        String   @id @default(cuid())
  chatId    String
  chat      Chat     @relation(fields: [chatId], references: [id])
  role      String                              // "user" | "assistant" | "system"
  content   String
  score     Float?                              // Score für User-Antworten (1-10)
  category  String?                             // Frage-Kategorie
  flagged   Boolean  @default(false)            // Für Spaced Repetition
  cost      Float?                              // Token-Kosten
  createdAt DateTime @default(now())
}
```

---

## 🔧 Prompt-Evaluation Workflow

```
lib/prompts.ts          ← Prompts entwickeln
        │
        ▼
evaluation/preparation_prompt_evaluation_v3.py  ← Automatisiertes Testing
        │
        ▼
evaluation/preparation_evaluation_results.csv   ← Rohdaten (85 Evaluierungen)
        │
        ▼
evaluation/prompt_testing.md                    ← Analyse & Entscheidung
        │
        ▼
lib/prompts.ts          ← Gewinner-Prompt (E_structured_output) als Default setzen
```

### Evaluation-Methodik

Wir nutzen **LLM-as-a-Judge** statt manueller Bewertung:

| Dimension | Beschreibung | Skala |
|---|---|---|
| Relevance | Passt Frage/Feedback zur Kategorie? | 1–5 |
| Coaching Quality | Ist das Feedback tiefgehend und hilfreich? | 1–5 |
| Scoring Accuracy | Ist der Score fair und begründet? | 1–5 |
| Structure | Ist die Antwort klar organisiert? | 1–5 |
| Session Drive | Führt der Bot die Session aktiv? | 1–5 |
| Empathy | Ist der Ton warm aber ehrlich? | 1–5 |

**Chatbot-Modell:** `gpt-4.1-mini` (generiert Antworten)
**Judge-Modell:** `gpt-4o-mini` (bewertet Antworten – anderes Modell reduziert Self-Evaluation Bias)

---

## ⚙️ LLM Settings

| Setting | Wert | Begründung |
|---|---|---|
| **Temperature** | 0.3 für Analyse, 0.7 für Mock-Interviews | Präzise Analyse vs. natürliche Gesprächsführung |
| **Model** | gpt-4.1-mini | Gutes Preis-Leistungs-Verhältnis, 128k Kontext |

---

## 🔒 Security Guards

| Guard | Beschreibung |
|---|---|
| **Topic Filter** | Nur interview-bezogene Themen erlauben |
| **Input Validierung** | Max. Zeichenlänge, keine Code-Injection, XSS-Schutz |
| **API Key Schutz** | .env.local, nur serverseitig (API Routes), nie im Frontend |
| **Prompt Injection Schutz** | System Prompt gegen Manipulation absichern |
| **Rate Limiting** | Max. Anfragen pro Minute begrenzen |
| **File Validierung** | Nur PDFs erlauben, Max. Dateigröße prüfen |

---

## 📦 Optionale Features (für Bonuspunkte)

### Easy ✅
- [ ] Verschiedene Schwierigkeitsgrade (Junior, Mid, Senior)
- [x] AI-Interviewer-Persönlichkeiten (streng, freundlich, neutral) ← Im Konzept!
- [ ] Bewertungskriterien generieren lassen

### Medium ⚡
- [x] Alle OpenAI Settings als Slider (Temperature, Top-p etc.) ← Im Konzept!
- [x] Strukturierte JSON-Outputs ← Prompt E (Structured Output)
- [ ] Preis-Berechnung pro Prompt anzeigen (cost-Feld im DB-Schema vorbereitet)
- [ ] Deployment auf Vercel
- [ ] Stellenanzeige als Input (RAG-ähnlich)
- [ ] Jailbreak-Experiment dokumentieren (Excel)

### Hard 🔥
- [x] Full Chatbot (ist bereits im Konzept!)
- [ ] LangChain Integration
- [x] LLM-as-a-Judge Bewertung ← preparation_prompt_evaluation_v3.py implementiert!

---

## ⚠️ Wichtige Hinweise für die Umsetzung & Review

### 1. Prompt-Vergleich dokumentieren
Es reicht NICHT, 5 Prompts im Code zu haben. Du musst:
- Alle 5 Prompts **testen** und die Ergebnisse vergleichen (→ `preparation_prompt_evaluation_v3.py` ausführen)
- **Begründen**, warum du dich für E_structured_output entschieden hast (→ `prompt_testing.md`)
- Optional: Dem User in den Settings die Wahl zwischen den Prompts geben
- Dokumentation in der README.md

### 2. React State Management
Da wir einen Full Chatbot bauen (Hard-Task):
- Chat-Verlauf muss im React State + Datenbank gespeichert werden
- `useState` für lokalen State, Datenbank für Persistenz
- Streaming-Antworten richtig handeln (Token für Token anzeigen)
- Optimistic Updates für flüssige UX

### 3. Token-Limitationen & Kontext-Fenster
Der Flow schickt CV + Stellenanzeige + Chat-Verlauf an die API:
- Bei langen PDFs → massiver Token-Verbrauch pro Call
- **Lösung**: Warnung im UI wenn Dokumente zu lang sind
- **Modell-Wahl**: gpt-4.1-mini hat 128k Token Kontext
- Token-Verbrauch im Auge behalten, ggf. Zusammenfassungen statt voller Texte senden

### 4. Korrekte Modell-Namen im API-Call

| Frontend-Label (Dropdown) | API-Identifier (Backend) |
|---|---|
| GPT-4.1 | gpt-4.1 |
| GPT-4.1 mini | gpt-4.1-mini |
| GPT-4.1 nano | gpt-4.1-nano |
| GPT-4o | gpt-4o |
| GPT-4o mini | gpt-4o-mini |

### 5. API Key Sicherheit in Next.js
- API Key **nur** in `.env.local` speichern
- **Nur** in API Routes (serverseitig) verwenden
- **Niemals** im Frontend/Client-Code verwenden
- Next.js Konvention: Variablen OHNE `NEXT_PUBLIC_` Prefix sind automatisch serverseitig

---

## 🔄 Vergleich: Streamlit vs. Next.js

| Aspekt | Streamlit | Next.js |
|---|---|---|
| **Aufwand** | ~200 Zeilen | ~1000+ Zeilen |
| **Sprache** | Python | TypeScript/JavaScript |
| **UI-Qualität** | Standard-Look | Pixel-perfekt, wie echte App |
| **Backend** | Eingebaut | API Routes (eingebaut) |
| **Datenbank** | SQLite direkt | SQLite + Prisma ORM |
| **Deployment** | Streamlit Cloud | Vercel (professioneller) |
| **Lernkurve** | Niedrig | Hoch |
| **Produktionsreif** | Prototyp | Vollwertige App |
| **Portfolio-Wert** | Mittel | Hoch |

---

## 🗓️ Nächste Schritte

### Phase 1: Setup (Tag 1)
1. [ ] Next.js Projekt erstellen (`npx create-next-app@latest`)
2. [ ] Tailwind CSS + shadcn/ui einrichten
3. [ ] Prisma + SQLite aufsetzen
4. [ ] OpenAI SDK installieren
5. [ ] `.env.local` mit API Key (Next.js) + `.env` (Python Evaluation)

### Phase 2: Backend (Tag 1-2)
6. [ ] Prisma Schema definieren & migrieren (inkl. `persona` + `cost` Felder)
7. [ ] API Routes: Projects CRUD
8. [ ] API Routes: Chats CRUD
9. [ ] API Routes: Messages + OpenAI Call
10. [ ] API Routes: File Upload
11. [ ] System Prompts in `lib/prompts.ts` implementieren (E_structured_output als Default)

### Phase 3: Frontend (Tag 2-3)
12. [ ] Layout: Sidebar + Main Area
13. [ ] Sidebar: Projekt-Liste + Chat-Liste
14. [ ] Chat-UI: Nachrichten + Eingabefeld
15. [ ] Projekt-Übersicht: Tabs (Chats/Docs/MD)
16. [ ] Settings-Panel: Slider + Dropdowns
17. [ ] File Upload Komponente

### Phase 4: Features (Tag 3-4)
18. [ ] Streaming-Antworten implementieren
19. [ ] Security Guards einbauen
20. [ ] Projekt.md Export generieren
21. [ ] Gap-Analyse Feature

### Phase 5: Evaluation (Tag 4)
22. [x] `evaluation/preparation_prompt_evaluation_v3.py` ausführen ✅
23. [x] Alle 5 Prompts testen (17 Test Cases × 5 Varianten = 85 Evaluierungen) ✅
24. [x] Ergebnisse in `prompt_testing.md` dokumentieren ✅
25. [x] Besten Prompt (E_structured_output) als Default in `lib/prompts.ts` setzen ✅

### Phase 6: Polish & Deploy (Tag 4-5)
26. [ ] Testen & Bugs fixen
27. [ ] README.md schreiben
28. [ ] Auf Vercel deployen
29. [ ] Code verstehen & Review vorbereiten
