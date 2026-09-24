"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function Eye({ open }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={
          open
            ? "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z"
            : "M3 12s3.5-6 9-6c2.1 0 3.9.9 5.3 2M21 12s-3.5 6-9 6c-2.1 0-3.9-.9-5.3-2M4 4l16 16"
        }
      />
      {open && <circle cx="12" cy="12" r="2.8" />}
    </svg>
  );
}

export default function ResetPasswordForm({ token }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password") || "");
    const confirmation = String(values.get("confirmation") || "");
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Password reset failed.");
      router.push("/signIn?mode=login&reset=success");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <Link className="brand" href="/">
        r<span>Revision Club.</span>
      </Link>
      <div className="auth-card">
        <div className="eyebrow">A FRESH PASSWORD</div>
        <h1>Choose a new password.</h1>
        {!token ? (
          <>
            <div className="notice error">This reset link is incomplete.</div>
            <Link className="text-link" href="/signIn?mode=login">
              Return to sign in →
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <label>
              New password
              <span className="password-field">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={256}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-eye"
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                  onClick={() => setShow((value) => !value)}
                >
                  <Eye open={show} />
                </button>
              </span>
            </label>
            <label>
              Confirm password
              <input
                name="confirmation"
                type={show ? "text" : "password"}
                required
                minLength={8}
                maxLength={256}
                autoComplete="new-password"
              />
            </label>
            {error && <div className="notice error">{error}</div>}
            <button disabled={pending}>
              {pending ? "Changing password…" : "Change password →"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
