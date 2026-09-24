import { NextResponse } from "next/server";
import { lucia } from "@/lib/auth";
import {
  GOOGLE_STATE_COOKIE,
  exchangeGoogleCode,
  findOrCreateGoogleUser,
  googleConfigured,
  safeStateMatch,
} from "@/lib/google-auth";

export const dynamic = "force-dynamic";

function failed(request, reason = "google-failed") {
  const response = NextResponse.redirect(
    new URL(`/signIn?mode=login&authError=${reason}`, request.url),
  );
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request) {
  if (!googleConfigured()) return failed(request, "google-config");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  if (!code || !safeStateMatch(state, storedState))
    return failed(request, "google-state");

  try {
    const origin = process.env.APP_ORIGIN || request.nextUrl.origin;
    const profile = await exchangeGoogleCode(origin, code);
    const userId = await findOrCreateGoogleUser(profile);
    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
    response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("[auth] Google sign-in failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return failed(request);
  }
}
