"use client";

import { useEffect, useState } from "react";
import { Badge, ErrorBox, Heading } from "./ui";

const MODE_SLOTS = [1, 2, 3];

function Progress({ phase }) {
  const current = phase;
  const steps = [
    [1, "Upload material"],
    [2, "Choose a minigame"],
    [3, "Build your game"],
  ];
  return (
    <ol className="minigame-progress" aria-label="Minigame creation progress">
      {steps.map(([number, label]) => (
        <li
          key={number}
          className={
            number === current
              ? "current"
              : number < current
                ? "complete"
                : ""
          }
          aria-current={number === current ? "step" : undefined}
        >
          <span>{number < current ? "✓" : number}</span>
          <small>{label}</small>
        </li>
      ))}
    </ol>
  );
}

function MaterialUpload({ files, setFiles }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(selectedFiles) {
    const incoming = Array.from(selectedFiles || []);
    if (!incoming.length) return;
    if (files.length + incoming.length > 8) {
      setError("Use up to eight revision materials for one minigame.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const uploaded = [];
      for (const file of incoming) {
        const form = new FormData();
        form.set("file", file);
        form.set("purpose", "Revision Material");
        const response = await fetch("/api/club/upload", {
          method: "POST",
          body: form,
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.error || "The material could not be uploaded.",
          );
        uploaded.push(result);
      }
      setFiles((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label
        className="upload-zone minigame-upload"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          upload(event.dataTransfer.files);
        }}
      >
        <span className="upload-icon">↥</span>
        <b>
          {busy ? "Uploading your material…" : "Drop revision material here"}
        </b>
        <span>
          or click to browse · PDF, DOCX, PPTX, TXT or images · 10 MB each
        </span>
        <input
          aria-label="Minigame revision material"
          type="file"
          multiple
          disabled={busy}
          accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.webp"
          onChange={(event) => {
            upload(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <ErrorBox error={error} />
      {files.length > 0 && (
        <div className="minigame-files" aria-label="Uploaded materials">
          {files.map((file) => (
            <div key={file.id}>
              <span>
                <b>{file.name}</b>
                <small>{file.status}</small>
              </span>
              <button
                type="button"
                className="secondary"
                aria-label={`Remove ${file.name}`}
                onClick={() =>
                  setFiles((current) =>
                    current.filter((item) => item.id !== file.id),
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function Games() {
  const [phase, setPhase] = useState(1);
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState(null);

  useEffect(() => {
    if (phase !== 3) return;
    const timer = window.setTimeout(() => setPhase(4), 1800);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function reset() {
    setPhase(1);
    setFiles([]);
    setMode(null);
  }

  return (
    <>
      <Heading
        eyebrow="PRACTICE / MINIGAME GENERATOR"
        title="Turn revision into play."
        description="Bring the material. Choose a game. We’ll shape the practice around what you need to learn."
      />
      <Progress phase={phase} />

      {phase === 1 && (
        <section className="card minigame-generator-card">
          <div className="minigame-step-heading">
            <span className="step-number">1</span>
            <div>
              <Badge>YOUR MATERIAL</Badge>
              <h2>What do you want to practise?</h2>
              <p className="muted">
                Upload the notes, worksheet or sample paper you want the future
                minigame to use.
              </p>
            </div>
          </div>
          <MaterialUpload files={files} setFiles={setFiles} />
          <div className="minigame-actions">
            <span className="muted small">
              {files.length
                ? `${files.length} material${files.length === 1 ? "" : "s"} ready`
                : "Add at least one material to continue"}
            </span>
            <button disabled={!files.length} onClick={() => setPhase(2)}>
              Choose a minigame →
            </button>
          </div>
        </section>
      )}

      {phase === 2 && (
        <section className="card minigame-generator-card">
          <div className="minigame-step-heading">
            <span className="step-number">2</span>
            <div>
              <Badge>GAME MODE</Badge>
              <h2>How should this revision feel?</h2>
              <p className="muted">
                The game catalogue is being rebuilt. These slots reserve the
                selection flow for the first modes.
              </p>
            </div>
          </div>
          <div
            className="mode-bubbles"
            role="radiogroup"
            aria-label="Game mode"
          >
            {MODE_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                role="radio"
                aria-checked={mode === slot}
                aria-label={`Placeholder game mode ${slot}`}
                className="mode-bubble"
                onClick={() => setMode(slot)}
              >
                <span aria-hidden="true" />
                <small>Mode {String(slot).padStart(2, "0")}</small>
                <b>Coming soon</b>
              </button>
            ))}
          </div>
          <div className="minigame-actions">
            <button className="secondary" onClick={() => setPhase(1)}>
              ← Back
            </button>
            <button disabled={!mode} onClick={() => setPhase(3)}>
              Generate minigame →
            </button>
          </div>
        </section>
      )}

      {phase === 3 && (
        <section className="generation-screen minigame-loading" role="status">
          <div className="minigame-orbit" aria-hidden="true">
            <span />
          </div>
          <Badge>BUILDING YOUR PRACTICE</Badge>
          <h2>Turning revision into a game…</h2>
          <p className="muted">
            Reading {files.length} material{files.length === 1 ? "" : "s"} and
            preparing the play space.
          </p>
        </section>
      )}

      {phase === 4 && (
        <section className="card minigame-play-placeholder">
          <div>
            <Badge>PLAY SPACE</Badge>
            <h2>Your minigame will live here.</h2>
            <p className="muted">
              The generator flow is ready. Game controls, questions, scoring and
              rewards will be added with the first game mode.
            </p>
          </div>
          <div className="minigame-stage" aria-label="Future minigame area">
            <span>GAME AREA</span>
          </div>
          <div className="minigame-actions">
            <span className="muted small">
              {files.length} source material{files.length === 1 ? "" : "s"} ·
              Mode {String(mode).padStart(2, "0")}
            </span>
            <button className="secondary" onClick={reset}>
              Create another →
            </button>
          </div>
        </section>
      )}
    </>
  );
}
