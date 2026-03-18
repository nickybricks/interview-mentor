// Security Guards for Interview Mentor

const MAX_MESSAGE_LENGTH = 10000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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
