import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { messageLimiter, transcribeLimiter, uploadLimiter, getIP } from "@/lib/rate-limit";

const limiters: Record<string, typeof messageLimiter> = {
  "/api/messages": messageLimiter,
  "/api/transcribe": transcribeLimiter,
  "/api/upload": uploadLimiter,
};

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const limiter = limiters[path];

  if (limiter) {
    const ip = getIP(request);
    const { success, remaining, reset } = await limiter.limit(ip);

    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(reset),
            "Retry-After": String(Math.ceil((reset - Date.now()) / 1000)),
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/messages", "/api/transcribe", "/api/upload"],
};
