"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
export async function api(path, body) {
  const r = await fetch(
    "/api/club/" + path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const data = await r.json();
  if (!r.ok) {
    const error = new Error(
      (data.error || "Something went wrong. Please retry.") +
        (data.reference ? ` Reference: ${data.reference}.` : ""),
    );
    error.code = data.code;
    error.retryable = Boolean(data.retryable);
    error.reference = data.reference;
    throw error;
  }
  return data;
}
export function useData(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const currentPath = useRef(path);
  currentPath.current = path;
  const reload = useCallback(() => {
    if (!path) return;
    return api(path)
      .then((d) => {
        if (currentPath.current !== path) return;
        setData(d);
        setError("");
      })
      .catch((e) => {
        if (currentPath.current === path) setError(e.message);
      });
  }, [path]);
  useEffect(() => {
    setData(null);
    reload();
  }, [path, reload]);
  return { data, error, reload, setData };
}
export function Loading({ error } = {}) {
  if (error)
    return (
      <section className="card" role="alert">
        <h2>This page couldn’t load.</h2>
        <p>{error}</p>
        <div className="actions">
          <button onClick={() => window.location.reload()}>Try again</button>
          <Link className="button secondary" href="/dashboard">
            Open dashboard
          </Link>
        </div>
      </section>
    );
  return (
    <div className="loading" role="status">
      <span className="pulse" />
      Opening your study space…
    </div>
  );
}
export function Empty({ title = "Nothing here yet.", children, href, label }) {
  return (
    <div className="empty">
      <span className="empty-icon">▤</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {href && (
        <Link className="button secondary" href={href}>
          {label || "Get started"} →
        </Link>
      )}
    </div>
  );
}
export function Heading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow || "YOUR STUDY SPACE"}</div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function Badge({ children }) {
  return <span className="badge">{children}</span>;
}
export function Level({ level = 0, league = "Rookie" }) {
  return (
    <span
      className={"level " + league.toLowerCase()}
      title={`${league} · Level ${level}`}
    >
      {level}
    </span>
  );
}
export function ErrorBox({ error }) {
  return error ? (
    <div className="notice error" role="alert">
      {error}
    </div>
  ) : null;
}
export function PaperCard({ paper }) {
  return (
    <Link href={"/papers/" + paper.id} className="paper-card">
      <div className="mini-page">
        <small>REVISION CLUB / {paper.subject.toUpperCase()}</small>
        <b>{paper.title}</b>
        <span />
        <span />
        <span className="short" />
        <div className="mini-answer" />
        <span />
        <span className="short" />
      </div>
      <div className="paper-card-info">
        <Badge>{paper.subject}</Badge>
        <h3>{paper.title}</h3>
        <p>
          {paper.state} · {paper.versions} version
          {paper.versions === 1 ? "" : "s"}{" "}
          {paper.rating ? `· ★ ${paper.rating}` : ""}
        </p>
        <p>
          {[paper.grade, paper.difficulty, paper.language]
            .filter(Boolean)
            .join(" · ")}
          <br />
          {paper.attempts || 0} attempts · {paper.duration || 30} min
        </p>
        <span className="text-link">Open paper ↗</span>
      </div>
    </Link>
  );
}
export function DateText({ value }) {
  return value ? (
    <>
      {new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </>
  ) : (
    <>No deadline</>
  );
}
export function ActionForm({ onSubmit, children, className = "" }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError("");
        try {
          await onSubmit(Object.fromEntries(new FormData(form)), form);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>{children}</fieldset>
      <ErrorBox error={error} />
      {busy && (
        <span role="status" className="muted">
          Saving…
        </span>
      )}
    </form>
  );
}
