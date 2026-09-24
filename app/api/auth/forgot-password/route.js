import { NextResponse } from "next/server";
import {
  createPasswordReset,
  discardPasswordReset,
} from "@/lib/password-reset";

const GENERIC_MESSAGE =
  "If that email is registered, a reset link is on its way.";

function resetEmail(username, resetUrl) {
  const safeName = String(username || "there").replace(/[<>&"']/g, "");
  return `<!doctype html><html><body style="margin:0;background:#eff1e7;font-family:Arial,sans-serif;color:#163f32"><div style="max-width:560px;margin:40px auto;background:#fff;padding:36px;border:1px solid #d7dccd;border-radius:14px"><p style="letter-spacing:.15em;font-size:12px">REVISION CLUB</p><h1 style="font-family:Georgia,serif">Reset your password.</h1><p>Hello ${safeName},</p><p>Use the button below to choose a new password. This link expires in 30 minutes and can only be used once.</p><p style="margin:30px 0"><a href="${resetUrl}" style="background:#17533f;color:#fff;text-decoration:none;padding:13px 20px;border-radius:8px;display:inline-block">Choose a new password</a></p><p style="font-size:13px;color:#66736c">If you did not request this, you can safely ignore this email.</p></div></body></html>`;
}

export async function POST(request) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    return NextResponse.json(
      { error: "Password reset email is not configured yet." },
      { status: 503 },
    );

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );

  try {
    const reset = await createPasswordReset(email);
    if (reset?.token) {
      const origin = process.env.APP_ORIGIN || request.nextUrl.origin;
      const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(reset.token)}`;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [reset.user.email],
          subject: "Reset your Revision Club password",
          html: resetEmail(reset.user.username, resetUrl),
        }),
        cache: "no-store",
      });
      if (!response.ok) {
        await discardPasswordReset(reset.token);
        console.error("[auth] reset email failed", { status: response.status });
        return NextResponse.json(
          {
            error:
              "The email service is temporarily unavailable. Try again shortly.",
          },
          { status: 503 },
        );
      }
    }
    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("[auth] password reset request failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json(
      { error: "The reset request could not be completed. Try again shortly." },
      { status: 503 },
    );
  }
}
