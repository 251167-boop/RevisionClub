import { NextResponse } from "next/server";
import {
  GOOGLE_STATE_COOKIE,
  createGoogleState,
  googleAuthorizationUrl,
  googleConfigured,
} from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!googleConfigured())
    return NextResponse.redirect(
      new URL("/signIn?mode=login&authError=google-config", request.url),
    );

  const state = createGoogleState();
  const origin = process.env.APP_ORIGIN || request.nextUrl.origin;
  const response = NextResponse.redirect(googleAuthorizationUrl(origin, state));
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return response;
}
