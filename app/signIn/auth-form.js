"use client";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { signup, login } from "@/actions/auth-actions";
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
export default function AuthForm({ mode }) {
  const [state, action] = useActionState(mode === "login" ? login : signup, {});
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
            <input
              type="password"
              name="password"
              required
              minLength={8}
              maxLength={256}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
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
