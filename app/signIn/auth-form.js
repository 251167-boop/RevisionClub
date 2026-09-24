"use client";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useActionState, useState } from "react";
import { signup, login } from "@/actions/auth-actions";

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.5-6 9-6c2.1 0 3.9.9 5.3 2M21 12s-3.5 6-9 6c-2.1 0-3.9-.9-5.3-2M4 4l16 16" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"
      />
      <path
        fill="#34a853"
        d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#fbbc05"
        d="M6.5 14a6 6 0 0 1 0-4V7.4H3.2a10 10 0 0 0 0 9.2L6.5 14Z"
      />
      <path
        fill="#ea4335"
        d="M12 6c1.5 0 2.9.5 4 1.6L18.8 5A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.8 5.4L6.5 10A5.8 5.8 0 0 1 12 6Z"
      />
    </svg>
  );
}
function Submit({ mode }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending}>
      {pending
        ? "Please wait…"
        : mode === "login"
          ? "Sign in →"
          : "Create account →"}
    </button>
  );
}
export default function AuthForm({ mode, authError, resetComplete }) {
  const [state, action] = useActionState(mode === "login" ? login : signup, {});
  const [showPassword, setShowPassword] = useState(false);
  const [forgotState, setForgotState] = useState({
    pending: false,
    message: "",
    error: "",
  });
  const oauthMessage = {
    "google-config": "Google sign-in is not configured yet.",
    "google-state": "That Google sign-in request expired. Please try again.",
    "google-failed": "Google sign-in could not be completed. Please try again.",
  }[authError];

  async function requestReset(event) {
    const form = event.currentTarget.form;
    const email = String(new FormData(form).get("email") || "").trim();
    if (!email) {
      setForgotState({
        pending: false,
        message: "",
        error: "Enter your email first.",
      });
      return;
    }
    setForgotState({ pending: true, message: "", error: "" });
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not send the reset email.");
      setForgotState({ pending: false, message: data.message, error: "" });
    } catch (error) {
      setForgotState({ pending: false, message: "", error: error.message });
    }
  }

  return (
    <main className="auth-page">
      <Link className="brand" href="/">
        r<span>Revision Club.</span>
      </Link>
      <div className="auth-card">
        <div className="eyebrow">YOUR NEXT CHAPTER</div>
        <h1>{mode === "login" ? "Welcome back." : "A fresh start."}</h1>
        <p className="muted">
          A little revision today. A little more confidence tomorrow.
        </p>
        {oauthMessage && <div className="notice error">{oauthMessage}</div>}
        {resetComplete && (
          <div className="notice success">
            Your password was changed. You can sign in now.
          </div>
        )}
        <form
          className="google-auth-form"
          action="/api/auth/google/start"
          method="get"
        >
          <button className="google-auth-button" type="submit">
            <GoogleIcon /> Continue with Google
          </button>
        </form>
        <div className="auth-divider">
          <span>or continue with email</span>
        </div>
        <form action={action}>
          {mode !== "login" && (
            <label>
              Username
              <input
                name="username"
                required
                minLength={3}
                maxLength={40}
                autoComplete="username"
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              name="email"
              required
              maxLength={200}
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <span className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                minLength={8}
                maxLength={256}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
              <button
                type="button"
                className="password-eye"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                <EyeIcon open={showPassword} />
              </button>
            </span>
          </label>
          {mode === "login" && (
            <button
              type="button"
              className="forgot-password"
              disabled={forgotState.pending}
              onClick={requestReset}
            >
              {forgotState.pending ? "Sending reset link…" : "Forgot password?"}
            </button>
          )}
          {forgotState.message && (
            <div className="notice success">{forgotState.message}</div>
          )}
          {forgotState.error && (
            <div className="notice error">{forgotState.error}</div>
          )}
          {state.errors && (
            <div role="alert" className="notice error">
              {Object.values(state.errors).join(" ")}
            </div>
          )}
          <Submit mode={mode} />
        </form>
        <p>
          {mode === "login" ? "New here?" : "Already a member?"}{" "}
          <Link
            className="text-link"
            href={
              mode === "login" ? "/signIn?mode=signup" : "/signIn?mode=login"
            }
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </Link>
        </p>
      </div>
    </main>
  );
}
