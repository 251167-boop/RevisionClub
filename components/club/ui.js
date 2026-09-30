"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
const UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024;

export async function readApiResponse(response, fallback) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {}
  if (!response.ok) {
    const platformTooLarge =
      response.status === 413 ||
      /request entity too large|function_payload_too_large|payload too large/i.test(
        raw,
      );
    const error = new Error(
      platformTooLarge
        ? "This upload is too large for a single request. Revision Club will split files over 4 MB automatically; please retry."
        : data?.error || fallback || "Something went wrong. Please retry.",
    );
    error.code = data?.code;
    error.retryable = Boolean(data?.retryable);
    error.reference = data?.reference;
    throw error;
  }
  if (!data || typeof data !== "object")
    throw new Error(fallback || "The server returned an invalid response.");
  return data;
}

export async function uploadClubFile(file, purpose) {
  if (!file || !file.size) throw new Error("Choose a non-empty file.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw new Error("Upload a file up to 10 MB.");
  if (file.size <= DIRECT_UPLOAD_BYTES) {
    const form = new FormData();
    form.set("file", file);
    form.set("purpose", purpose);
    const response = await fetch("/api/club/upload", {
      method: "POST",
      body: form,
    });
    return readApiResponse(response, "The material could not be uploaded.");
  }

  const uploadId = crypto.randomUUID();
  const total = Math.ceil(file.size / UPLOAD_CHUNK_BYTES);
  let result = null;
  for (let index = 0; index < total; index++) {
    const start = index * UPLOAD_CHUNK_BYTES;
    const form = new FormData();
    form.set("uploadId", uploadId);
    form.set("index", String(index));
    form.set("total", String(total));
    form.set("originalSize", String(file.size));
    form.set("name", file.name);
    form.set("mime", file.type);
    form.set("purpose", purpose);
    form.set(
      "chunk",
      file.slice(start, Math.min(file.size, start + UPLOAD_CHUNK_BYTES)),
      `${file.name}.part-${index + 1}`,
    );
    const response = await fetch("/api/club/upload/chunk", {
      method: "POST",
      body: form,
    });
    result = await readApiResponse(
      response,
      `Upload stopped at part ${index + 1} of ${total}. Please retry.`,
    );
  }
  if (!result?.complete)
    throw new Error("The upload did not finish. Please retry.");
  return result;
}

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
  try {
    return await readApiResponse(r);
  } catch (error) {
    if (error.reference && !error.message.includes("Reference:"))
      error.message += ` Reference: ${error.reference}.`;
    throw error;
  }
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
