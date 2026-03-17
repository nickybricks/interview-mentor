"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

export type Locale = "de" | "en";

const translations = {
  de: {
    // Sidebar
    "sidebar.newProject": "Neue Bewerbung",
    "sidebar.noProjects": "Noch keine Projekte.",
    "sidebar.createFirst": "Erstelle dein erstes!",
    "sidebar.deleteProject": "Projekt löschen",
    "sidebar.deleteChat": "Chat löschen",
    "sidebar.noChats": "Keine Chats",

    // Chat types
    "chatType.preparation": "Vorbereitung",
    "chatType.gap_analysis": "Gap-Analyse",
    "chatType.mock_interview": "Mock-Interview",

    // New Project Dialog
    "newProject.title": "Neue Bewerbung",
    "newProject.description":
      "Erstelle ein neues Bewerbungsprojekt. Du kannst danach deinen Lebenslauf und die Stellenanzeige hochladen.",
    "newProject.nameLabel": "Projektname *",
    "newProject.namePlaceholder": 'z.B. "E-Commerce Manager @ Zalando"',
    "newProject.companyLabel": "Unternehmen",
    "newProject.companyPlaceholder": "z.B. Zalando",
    "newProject.positionLabel": "Position",
    "newProject.positionPlaceholder": "z.B. E-Commerce Manager",
    "newProject.nameRequired": "Projektname ist erforderlich",
    "newProject.createError": "Projekt konnte nicht erstellt werden",
    "newProject.genericError": "Ein Fehler ist aufgetreten",
    "newProject.cancel": "Abbrechen",
    "newProject.creating": "Erstelle...",
    "newProject.create": "Projekt erstellen",

    // AI Settings
    "aiSettings.title": "AI-Einstellungen",
    "aiSettings.featureLabel": "Einstellungen für",
    "aiSettings.systemPrompt": "System Prompt",
    "aiSettings.settings": "Settings",
    "aiSettings.sampling": "Sampling",
    "aiSettings.model": "Modell",
    "aiSettings.temperature": "Temperature",
    "aiSettings.maxTokens": "Max. Antwortlänge (Tokens)",
    "aiSettings.unlimited": "Unbegrenzt",
    "aiSettings.default": "Standard",
    "aiSettings.resetDefault": "Standard zurücksetzen",
    "aiSettings.expandPrompt": "Prompt vergrößern",
    "aiSettings.topP": "Top P Sampling",
    "aiSettings.repeatPenalty": "Repeat Penalty",
    "aiSettings.topK": "Top K Sampling",
    "aiSettings.minP": "Min P Sampling",
    "aiSettings.notSupported": "Wird von der OpenAI API nicht unterstützt.",
    "aiSettings.saving": "Speichert...",
    "aiSettings.saved": "Gespeichert!",
    "aiSettings.save": "Einstellungen speichern",

    // Feature labels
    "feature.gap_analysis": "Gap-Analyse",
    "feature.preparation": "Vorbereitung",
    "feature.mock_interview": "Mock-Interview",

    // Profile Menu
    "profile.settings": "Einstellungen",
    "profile.language": "Sprache",
    "profile.help": "Hilfe",
    "profile.about": "Über",
    "profile.logout": "Abmelden",

    // Chat Window
    "chat.placeholder": "Nachricht eingeben...",
    "chat.send": "Senden",
    "chat.stop": "Stopp",
    "chat.thinking": "Denke nach...",
    "chat.notFound": "Chat nicht gefunden.",
    "chat.autoStartFailed": "Auto-Start fehlgeschlagen",
    "chat.startError": "Fehler beim Starten:",
    "chat.unknownError": "Unbekannter Fehler",
    "chat.sendError": "Nachricht konnte nicht gesendet werden",
    "chat.error": "Fehler:",
    "chat.transcriptionFailed": "Transkription fehlgeschlagen",
    "chat.speechFailed": "Spracherkennung fehlgeschlagen",
    "chat.micDenied": "Mikrofonzugriff verweigert. Bitte erlaube den Zugriff in deinen Browsereinstellungen.",
    "chat.starting": "Wird gestartet...",
    "chat.writeFirst": "Schreibe deine erste Nachricht, um zu beginnen.",
    "chat.writeExample": 'Schreibe z.B. "Analysiere meinen Lebenslauf"',
    "chat.stopRecording": "Aufnahme stoppen",
    "chat.voiceInput": "Spracheingabe",
    "chat.recordingActive": "Aufnahme läuft... Klicke zum Stoppen",
    "chat.inputHint": "Enter = Senden \u00b7 Shift+Enter = Neue Zeile",

    // Project Page
    "project.loading": "Laden...",
    "project.notFound": "Projekt nicht gefunden.",
    "project.documents": "Dokumente",
    "project.documentsDesc": "Lade deinen Lebenslauf und die Stellenanzeige hoch, damit der Coach dich gezielt vorbereiten kann.",
    "project.cvLabel": "Lebenslauf (CV)",
    "project.jobLabel": "Stellenanzeige",
    "project.gapTitle": "Gap-Analyse",
    "project.gapAutoDesc": "Automatischer Vergleich deines CVs mit der Stellenanzeige",
    "project.regenerate": "Neu generieren",
    "project.gapGenerating": "Gap-Analyse wird generiert...",
    "project.progress": "Fortschritt",
    "project.overallScore": "Gesamt-Score",
    "project.categories": "Kategorien",
    "project.coaching": "Coaching starten",
    "project.coachingDesc": "Wähle eine Session-Art, um mit deiner Vorbereitung zu beginnen.",
    "project.cvRequired": "CV + Stellenanzeige erforderlich",
    "project.gapCompare": "CV vs. Stellenanzeige vergleichen",
    "project.prepQuestions": "Übungsfragen mit Feedback",
    "project.mockSimulation": "Realistische Simulation",
    "project.mockLocked": "Ab Score 7.0 (aktuell: {score})",
    "project.locked": "Gesperrt",
    "project.export": "Export als Markdown",
    "project.empty.title": "Willkommen bei Interview Mentor",
    "project.empty.description": "Erstelle ein Bewerbungsprojekt in der Sidebar, um mit deiner Interviewvorbereitung zu starten.",

    // Documents Manager
    "docs.attachedFiles": "Angehängte Dateien",
    "docs.noFiles": "Noch keine Dateien hochgeladen",
    "docs.manageTitle": "Dokumente verwalten",
    "docs.manageDesc": "Füge Dateien hinzu oder entferne sie. CV und Stellenanzeige sind für die Gap-Analyse erforderlich.",
    "docs.notUploaded": "Noch nicht hochgeladen",
    "docs.replace": "Ersetzen",
    "docs.upload": "Hochladen",
    "docs.attach": "Datei hinzufügen",
    "docs.attachHint": "z.B. Arbeitszeugnisse, Zertifikate, Schulzeugnisse (PDF, max. 5 MB)",
    "docs.startGapAnalysis": "Gap-Analyse starten",

    // File Upload
    "fileUpload.pdfOnly": "Nur PDF-Dateien sind erlaubt",
    "fileUpload.tooLarge": "Datei ist zu groß (max. 5 MB)",
    "fileUpload.failed": "Upload fehlgeschlagen",
    "fileUpload.uploading": "Wird hochgeladen...",
    "fileUpload.uploaded": "Hochgeladen — klicke zum Ersetzen",
    "fileUpload.dragDrop": "PDF hierher ziehen oder klicken",
  },
  en: {
    // Sidebar
    "sidebar.newProject": "New Application",
    "sidebar.noProjects": "No projects yet.",
    "sidebar.createFirst": "Create your first one!",
    "sidebar.deleteProject": "Delete project",
    "sidebar.deleteChat": "Delete chat",
    "sidebar.noChats": "No chats",

    // Chat types
    "chatType.preparation": "Preparation",
    "chatType.gap_analysis": "Gap Analysis",
    "chatType.mock_interview": "Mock Interview",

    // New Project Dialog
    "newProject.title": "New Application",
    "newProject.description":
      "Create a new application project. You can then upload your CV and job posting.",
    "newProject.nameLabel": "Project name *",
    "newProject.namePlaceholder": 'e.g. "E-Commerce Manager @ Zalando"',
    "newProject.companyLabel": "Company",
    "newProject.companyPlaceholder": "e.g. Zalando",
    "newProject.positionLabel": "Position",
    "newProject.positionPlaceholder": "e.g. E-Commerce Manager",
    "newProject.nameRequired": "Project name is required",
    "newProject.createError": "Could not create project",
    "newProject.genericError": "An error occurred",
    "newProject.cancel": "Cancel",
    "newProject.creating": "Creating...",
    "newProject.create": "Create project",

    // AI Settings
    "aiSettings.title": "AI Settings",
    "aiSettings.featureLabel": "Settings for",
    "aiSettings.systemPrompt": "System Prompt",
    "aiSettings.settings": "Settings",
    "aiSettings.sampling": "Sampling",
    "aiSettings.model": "Model",
    "aiSettings.temperature": "Temperature",
    "aiSettings.maxTokens": "Max response length (tokens)",
    "aiSettings.unlimited": "Unlimited",
    "aiSettings.default": "Default",
    "aiSettings.resetDefault": "Reset to default",
    "aiSettings.expandPrompt": "Expand prompt",
    "aiSettings.topP": "Top P Sampling",
    "aiSettings.repeatPenalty": "Repeat Penalty",
    "aiSettings.topK": "Top K Sampling",
    "aiSettings.minP": "Min P Sampling",
    "aiSettings.notSupported": "Not supported by OpenAI API.",
    "aiSettings.saving": "Saving...",
    "aiSettings.saved": "Saved!",
    "aiSettings.save": "Save settings",

    // Feature labels
    "feature.gap_analysis": "Gap Analysis",
    "feature.preparation": "Preparation",
    "feature.mock_interview": "Mock Interview",

    // Profile Menu
    "profile.settings": "Settings",
    "profile.language": "Language",
    "profile.help": "Help",
    "profile.about": "About",
    "profile.logout": "Log out",

    // Chat Window
    "chat.placeholder": "Type a message...",
    "chat.send": "Send",
    "chat.stop": "Stop",
    "chat.thinking": "Thinking...",
    "chat.notFound": "Chat not found.",
    "chat.autoStartFailed": "Auto-start failed",
    "chat.startError": "Error starting:",
    "chat.unknownError": "Unknown error",
    "chat.sendError": "Message could not be sent",
    "chat.error": "Error:",
    "chat.transcriptionFailed": "Transcription failed",
    "chat.speechFailed": "Speech recognition failed",
    "chat.micDenied": "Microphone access denied. Please allow access in your browser settings.",
    "chat.starting": "Starting...",
    "chat.writeFirst": "Write your first message to get started.",
    "chat.writeExample": 'e.g. "Analyze my CV"',
    "chat.stopRecording": "Stop recording",
    "chat.voiceInput": "Voice input",
    "chat.recordingActive": "Recording... Click to stop",
    "chat.inputHint": "Enter = Send \u00b7 Shift+Enter = New line",

    // Project Page
    "project.loading": "Loading...",
    "project.notFound": "Project not found.",
    "project.documents": "Documents",
    "project.documentsDesc": "Upload your CV and job posting so the coach can prepare you effectively.",
    "project.cvLabel": "CV / Resume",
    "project.jobLabel": "Job posting",
    "project.gapTitle": "Gap Analysis",
    "project.gapAutoDesc": "Automatic comparison of your CV with the job posting",
    "project.regenerate": "Regenerate",
    "project.gapGenerating": "Generating gap analysis...",
    "project.progress": "Progress",
    "project.overallScore": "Overall Score",
    "project.categories": "Categories",
    "project.coaching": "Start Coaching",
    "project.coachingDesc": "Choose a session type to start your preparation.",
    "project.cvRequired": "CV + job posting required",
    "project.gapCompare": "Compare CV vs. job posting",
    "project.prepQuestions": "Practice questions with feedback",
    "project.mockSimulation": "Realistic simulation",
    "project.mockLocked": "Requires score 7.0 (current: {score})",
    "project.locked": "Locked",
    "project.export": "Export as Markdown",
    "project.empty.title": "Welcome to Interview Mentor",
    "project.empty.description": "Create a project in the sidebar to start your interview preparation.",

    // Documents Manager
    "docs.attachedFiles": "Attached files",
    "docs.noFiles": "No files uploaded yet",
    "docs.manageTitle": "Manage documents",
    "docs.manageDesc": "Add or remove files. CV and job posting are required for gap analysis.",
    "docs.notUploaded": "Not uploaded yet",
    "docs.replace": "Replace",
    "docs.upload": "Upload",
    "docs.attach": "Attach file",
    "docs.attachHint": "e.g. boss reviews, course certificates, school certificates (PDF, max. 5 MB)",
    "docs.startGapAnalysis": "Start Gap Analysis",

    // File Upload
    "fileUpload.pdfOnly": "Only PDF files are allowed",
    "fileUpload.tooLarge": "File is too large (max. 5 MB)",
    "fileUpload.failed": "Upload failed",
    "fileUpload.uploading": "Uploading...",
    "fileUpload.uploaded": "Uploaded — click to replace",
    "fileUpload.dragDrop": "Drag PDF here or click to upload",
  },
} as const;

type TranslationKey = keyof typeof translations.de;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = "interview-mentor-locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("de");

  // Load saved locale on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && (saved === "de" || saved === "en")) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[locale][key] ?? key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
