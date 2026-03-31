import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasCredentials =
  !!process.env.UPSTASH_REDIS_URL && !!process.env.UPSTASH_REDIS_TOKEN;

const redis = hasCredentials
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    })
  : null;

export const LIMITS = {
  messages: 20,
  transcribe: 10,
  upload: 5,
} as const;

function makeLimiter(max: number, prefix: string) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, "1 m"),
    prefix,
  });
}

export const messageLimiter = makeLimiter(LIMITS.messages, "rl:messages");
export const transcribeLimiter = makeLimiter(LIMITS.transcribe, "rl:transcribe");
export const uploadLimiter = makeLimiter(LIMITS.upload, "rl:upload");

export function getIdentifier(request: Request): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
  const sessionId = request.headers.get("x-session-id") ?? "";
  // Combine IP + session for more accurate per-user limiting
  return [ip, sessionId].filter(Boolean).join(":") || "anonymous";
}
