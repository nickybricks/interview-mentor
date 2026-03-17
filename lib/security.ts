// Security Guards for Interview Mentor

const MAX_MESSAGE_LENGTH = 10000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ── Prompt injection detection ──────────────────────────────────────────

// Direct instruction override attempts
const INJECTION_PATTERNS: RegExp[] = [
  // "Ignore/forget/disregard previous instructions/rules/prompts"
  /ignore\s+(all\s+)?(previous|above|prior|earlier|original|preceding|system)\s+(instructions|prompts|rules|guidelines|directives|context)/i,
  /forget\s+(all\s+)?(previous|your|the|every)\s+(instructions|rules|prompts|guidelines|context|persona)/i,
  /disregard\s+(all\s+)?(previous|above|prior|your)\s+(instructions|prompts|rules)/i,

  // Role hijacking: "You are now / act as / pretend to be"
  /you\s+are\s+now\s/i,
  /from\s+now\s+on[,.]?\s+(you\s+are|act\s+as|behave\s+as|respond\s+as|pretend)/i,
  /act\s+as\s+(if\s+you\s+(are|were)\s+)?(a|an|DAN|the|my)\b/i,
  /pretend\s+(you\s+are|to\s+be|we'?re\s+in)/i,
  /roleplay\s+as/i,
  /you\s+have\s+been\s+freed/i,

  // System prompt extraction
  /system\s*prompt/i,
  /initial\s+instructions/i,
  /repeat\s+(the|your|all)?\s*instructions/i,
  /show\s+(me\s+)?(the|your)\s*(system|initial|original)?\s*(prompt|instructions|rules)/i,
  /output\s+(your|the)\s*(system|initial)?\s*(prompt|instructions|rules)/i,
  /translate\s+(your|the)\s*(initial\s+)?instructions/i,
  /what\s+(are|is|were)\s+(your|the)\s*(system|initial|original)?\s*(prompt|instructions|rules)/i,
  /reveal\s+(your|the)\s*(system|initial)?\s*(prompt|instructions)/i,

  // Prompt formatting markers
  /\[INST\]/i,
  /<<SYS>>/i,
  /\[SYSTEM\]/i,
  /###\s*(SYSTEM|INSTRUCTION|HUMAN|ASSISTANT)\s*:/i,
  /<\|im_start\|>/i,
  /<\|system\|>/i,

  // Override / new instructions
  /new\s+instructions/i,
  /override\s+(system|safety|your|the|all)/i,
  /updated?\s+(instructions|rules|prompt)/i,

  // DAN / jailbreak
  /\bDAN\b/,
  /\bjailbreak/i,
  /do\s+anything\s+now/i,
  /no\s+restrictions/i,
  /without\s+(any\s+)?restrictions/i,
  /freed?\s+from\s+(your|all|its)\s*(constraints|rules|limitations)/i,

  // Developer/admin impersonation
  /i'?m\s+(the|a)\s+(developer|admin|creator|owner|engineer|operator)/i,
  /for\s+(QA|testing|debug|maintenance)\s+purposes/i,
  /maintenance\s+mode/i,
  /admin\s+(mode|access|override)/i,

  // Emotional manipulation to extract prompt
  /grandmother\s+.*(prompt|instructions|bedtime)/i,
  /emergency.*system\s*(prompt|message|instructions)/i,
  /student'?s?\s+grade\s+depends/i,

  // Off-topic task requests (non-interview)
  /write\s+(me\s+)?(a\s+)?(python|javascript|code|script|program)/i,
  /help\s+(me\s+)?with\s+(my\s+)?(math|physics|chemistry|homework|assignment)\b/i,
  /investment\s+advice/i,
  /\bcrypto\b.*\b(advice|invest|buy|sell)\b/i,
  /scrape\s+(linkedin|website|profiles)/i,
  /\b(integral|derivative|equation)\s+of\b/i,

  // Encoding-based evasion
  /base64\s+(encoded|decode|instruction)/i,
  /respond\s+to\s+(the\s+)?following\s+(base64|encoded|hex)/i,

  // Game/roleplay-based manipulation
  /let'?s?\s+play\s+a\s+game/i,
  /pretend\s+we'?re\s+in\s+a\s+movie/i,
  /opposite\s+.*stay\s+in\s+character/i,

  // Unethical interview coaching
  /how\s+(do|can|to)\s+(i|you)?\s*lie\s+(convincingly|in\s+(an\s+)?interview)/i,
  /fake\s+(my|your)\s+way/i,
  /cheat\s+(in|on|during)\s+(an\s+)?interview/i,
];

/**
 * Normalize text to defeat simple obfuscation:
 * - Strip dots/dashes/spaces inserted between every letter ("i.g.n.o.r.e")
 * - Collapse repeated whitespace
 * - Decode common unicode look-alikes (basic Latin homoglyphs)
 */
function deobfuscate(text: string): string {
  // Detect "letter separator letter separator …" pattern (e.g. "I.g.n.o.r.e")
  // where separator is . - _ or whitespace, and each segment is 1-2 chars
  let cleaned = text.replace(
    /\b([a-zA-Z]{1,2})[.\-_\s]([a-zA-Z]{1,2}(?:[.\-_\s][a-zA-Z]{1,2}){2,})\b/g,
    (match) => match.replace(/[.\-_\s]/g, "")
  );

  // Collapse multi-spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ");

  // Replace zero-width and invisible unicode chars
  cleaned = cleaned.replace(/[\u200B-\u200F\u2060\uFEFF]/g, "");

  return cleaned;
}

/**
 * Detect base64-encoded payloads that might contain hidden instructions.
 * Looks for strings that are valid base64 and ≥20 chars (likely meaningful).
 */
function containsSuspiciousBase64(text: string): boolean {
  const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g;
  const matches = text.match(base64Pattern);
  if (!matches) return false;

  for (const match of matches) {
    try {
      const decoded = atob(match);
      // Check if decoded text contains injection-like content
      const lowerDecoded = decoded.toLowerCase();
      if (
        lowerDecoded.includes("ignore") ||
        lowerDecoded.includes("instruction") ||
        lowerDecoded.includes("system") ||
        lowerDecoded.includes("prompt") ||
        lowerDecoded.includes("forget") ||
        lowerDecoded.includes("pretend") ||
        lowerDecoded.includes("you are")
      ) {
        return true;
      }
    } catch {
      // Not valid base64 — ignore
    }
  }
  return false;
}

export function validateMessageLength(content: string): {
  valid: boolean;
  error?: string;
} {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: "Message cannot be empty" };
  }
  if (content.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
    };
  }
  return { valid: true };
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}

export function checkPromptInjection(content: string): {
  safe: boolean;
  warning?: string;
} {
  const WARNING_MSG =
    "This doesn't seem related to interview preparation. Let's stay focused — what interview topic would you like to work on?";

  // Check original text
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      return { safe: false, warning: WARNING_MSG };
    }
  }

  // Check deobfuscated text (catches "i.g.n.o.r.e a.l.l p.r.e.v.i.o.u.s" etc.)
  const cleaned = deobfuscate(content);
  if (cleaned !== content) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(cleaned)) {
        return { safe: false, warning: WARNING_MSG };
      }
    }
  }

  // Check for base64-encoded injection payloads
  if (containsSuspiciousBase64(content)) {
    return { safe: false, warning: WARNING_MSG };
  }

  return { safe: true };
}

export function validateFileUpload(
  file: File
): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "File too large (max 5MB)" };
  }
  if (file.type !== "application/pdf") {
    return { valid: false, error: "Only PDF files are allowed" };
  }
  return { valid: true };
}

export function validateFileBuffer(
  buffer: Buffer,
  filename: string
): { valid: boolean; error?: string } {
  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: "File too large (max 5MB)" };
  }
  if (!filename.toLowerCase().endsWith(".pdf")) {
    return { valid: false, error: "Only PDF files are allowed" };
  }
  return { valid: true };
}
