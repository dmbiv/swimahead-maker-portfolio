import { NextResponse, type NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/sign-in?error=google-only", request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
