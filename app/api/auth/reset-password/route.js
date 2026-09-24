import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/password-reset";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const token = String(body.token || "");
  const password = String(body.password || "");
  if (!token || password.length < 8 || password.length > 256)
    return NextResponse.json(
      { error: "Use a password containing at least 8 characters." },
      { status: 400 },
    );

  try {
    const changed = await resetPassword(token, password);
    if (!changed)
      return NextResponse.json(
        { error: "This reset link is invalid or has expired." },
        { status: 400 },
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[auth] password reset failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "Your password could not be changed. Try again shortly." },
      { status: 503 },
    );
  }
}
