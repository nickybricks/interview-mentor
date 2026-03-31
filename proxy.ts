import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  messageLimiter,
  transcribeLimiter,
  uploadLimiter,
  LIMITS,
  getIdentifier,
} from "@/lib/rate-limit";

const limiters: Record<string, { limiter: typeof messageLimiter; limit: number }> = {
  "/api/messages":  { limiter: messageLimiter,   limit: LIMITS.messages },
  "/api/transcribe": { limiter: transcribeLimiter, limit: LIMITS.transcribe },
  "/api/upload":    { limiter: uploadLimiter,     limit: LIMITS.upload },
};

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const entry = limiters[path];

  if (entry) {
    // Skip if Upstash credentials are not configured (local dev without Redis)
    if (!entry.limiter) return NextResponse.next();

    const id = getIdentifier(request);
    const { success, remaining, reset } = await entry.limiter.limit(id);
    const resetSecs = String(Math.ceil(reset / 1000)); // Unix seconds per RFC convention

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(entry.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": resetSecs,
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(entry.limit));
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-RateLimit-Reset", resetSecs);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/messages", "/api/transcribe", "/api/upload"],
};
