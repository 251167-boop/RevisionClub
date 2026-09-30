"use client";

import { useEffect, useState } from "react";
import { api, Badge, ErrorBox, Heading, uploadClubFile } from "./ui";

const MODES = [
  {
    id: "matching-pairs",
    number: "01",
    icon: "↔",
    title: "Matching Pairs",
    description: "Connect each key term with the right meaning.",
  },
  {
    id: "fill-in-the-blanks",
    number: "02",
    icon: "…",
    title: "Fill in the Blanks",
    description: "Complete source-based facts with the missing term.",
  },
  {
    id: "unscramble-words",
    number: "03",
    icon: "Aa",
    title: "Unscramble Words",
    description: "Rebuild important vocabulary from mixed-up letters.",
  },
];

const normalize = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");

function Progress({ phase }) {
  const displayPhase = Math.min(phase, 3);
  const steps = [
    [1, "Upload material"],
    [2, "Choose a minigame"],
    [3, phase === 4 ? "Play your game" : "Build your game"],
  ];
  return (
    <ol className="minigame-progress" aria-label="Minigame creation progress">
      {steps.map(([number, label]) => (
        <li
          key={number}
          className={
            number === displayPhase
              ? "current"
              : number < displayPhase
                ? "complete"
                : ""
          }
          aria-current={number === displayPhase ? "step" : undefined}
        >
          <span>{number < displayPhase ? "✓" : number}</span>
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
        uploaded.push(await uploadClubFile(file, "Revision Material"));
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

function GameResult({ score, total, onReplay, onReset }) {
  const percent = Math.round((score / total) * 100);
  return (
    <div className="minigame-result" role="status">
      <span className="minigame-result-mark">{percent}%</span>
      <Badge>ROUND COMPLETE</Badge>
      <h3>
        {score} of {total} correct
      </h3>
      <p className="muted">
        {percent === 100
          ? "Perfect round. You’ve got these ideas in hand."
          : percent >= 60
            ? "Good progress. Replay once to strengthen the tricky parts."
            : "Keep going. A replay will help the key terms stick."}
      </p>
      <div className="actions">
        <button onClick={onReplay}>Play again</button>
        <button className="secondary" onClick={onReset}>
          New minigame
        </button>
      </div>
    </div>
  );
}

function MatchingPairs({ game, onReplay, onReset }) {
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [matched, setMatched] = useState(() => new Set());
  const [mistakes, setMistakes] = useState(0);
  const [feedback, setFeedback] = useState("");
  const answers = [...game.rounds].reverse();

  useEffect(() => {
    if (!left || !right) return;
    if (left === right) {
      setMatched((current) => new Set([...current, left]));
      setFeedback("match");
    } else {
      setMistakes((count) => count + 1);
      setFeedback("miss");
    }
    const timer = window.setTimeout(() => {
      setLeft(null);
      setRight(null);
      setFeedback("");
    }, 550);
    return () => window.clearTimeout(timer);
  }, [left, right]);

  if (matched.size === game.rounds.length)
    return (
      <GameResult
        score={Math.max(0, game.rounds.length - mistakes)}
        total={game.rounds.length}
        onReplay={onReplay}
        onReset={onReset}
      />
    );

  return (
    <div className="matching-game">
      <div className="minigame-status">
        <b>{matched.size} matched</b>
        <span>{mistakes} incorrect attempts</span>
      </div>
      <p className="game-feedback" aria-live="polite">
        {feedback === "match"
          ? "That’s a match."
          : feedback === "miss"
            ? "Not quite—try another pair."
            : "Choose one card from each column."}
      </p>
      <div className="matching-board">
        <div>
          <small>KEY TERMS</small>
          {game.rounds.map((round) => (
            <button
              key={round.id}
              className={
                "match-card " +
                (left === round.id ? "selected " : "") +
                (matched.has(round.id) ? "matched" : "")
              }
              disabled={matched.has(round.id) || Boolean(feedback)}
              onClick={() => setLeft(round.id)}
            >
              {round.prompt}
            </button>
          ))}
        </div>
        <div>
          <small>MEANINGS</small>
          {answers.map((round) => (
            <button
              key={round.id}
              className={
                "match-card " +
                (right === round.id ? "selected " : "") +
                (matched.has(round.id) ? "matched" : "")
              }
              disabled={matched.has(round.id) || Boolean(feedback)}
              onClick={() => setRight(round.id)}
            >
              {round.answer}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function WrittenRound({ game, onReplay, onReset }) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [finished, setFinished] = useState(false);
  const round = game.rounds[index];
  const unscramble = game.mode === "unscramble-words";

  function check(event) {
    event.preventDefault();
    if (!value.trim() || feedback) return;
    const correct = unscramble
      ? normalize(value).replace(/\s+/g, "") ===
        normalize(round.answer).replace(/\s+/g, "")
      : normalize(value) === normalize(round.answer);
    if (correct) setScore((current) => current + 1);
    setFeedback(correct ? "correct" : "incorrect");
  }

  function next() {
    if (index === game.rounds.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((current) => current + 1);
    setValue("");
    setFeedback(null);
  }

  if (finished)
    return (
      <GameResult
        score={score}
        total={game.rounds.length}
        onReplay={onReplay}
        onReset={onReset}
      />
    );

  return (
    <div className="written-game">
      <div className="minigame-status">
        <b>
          Question {index + 1} of {game.rounds.length}
        </b>
        <span>{score} correct</span>
      </div>
      <div className="round-progress" aria-hidden="true">
        <span
          style={{ width: `${((index + 1) / game.rounds.length) * 100}%` }}
        />
      </div>
      {unscramble && <div className="scrambled-word">{round.scrambled}</div>}
      <h3 className={unscramble ? "game-clue" : "blank-prompt"}>
        {round.prompt}
      </h3>
      {round.hint && <p className="muted game-hint">Hint: {round.hint}</p>}
      <form onSubmit={check} className="game-answer-form">
        <label htmlFor="minigame-answer">
          {unscramble ? "Unscrambled word" : "Missing word or phrase"}
        </label>
        <div>
          <input
            id="minigame-answer"
            value={value}
            disabled={Boolean(feedback)}
            autoComplete="off"
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            placeholder="Type your answer"
          />
          {!feedback && <button disabled={!value.trim()}>Check answer</button>}
        </div>
      </form>
      {feedback && (
        <div className={`answer-feedback ${feedback}`} role="status">
          <div>
            <b>{feedback === "correct" ? "Correct!" : "Keep this one."}</b>
            {feedback === "incorrect" && <span>Answer: {round.answer}</span>}
          </div>
          <button onClick={next}>
            {index === game.rounds.length - 1 ? "See results" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}

function PlaySpace({ game, files, onReset }) {
  const [roundKey, setRoundKey] = useState(0);
  const mode = MODES.find((item) => item.id === game.mode);
  const replay = () => setRoundKey((key) => key + 1);
  return (
    <section className="card minigame-play-placeholder">
      <div className="minigame-play-heading">
        <div>
          <Badge>{mode?.title || "MINIGAME"}</Badge>
          <h2>{game.title}</h2>
          <p className="muted">{game.instructions}</p>
        </div>
        <span className="game-source-count">
          {files.length} source{files.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="minigame-stage playable">
        {game.mode === "matching-pairs" ? (
          <MatchingPairs
            key={roundKey}
            game={game}
            onReplay={replay}
            onReset={onReset}
          />
        ) : (
          <WrittenRound
            key={roundKey}
            game={game}
            onReplay={replay}
            onReset={onReset}
          />
        )}
      </div>
    </section>
  );
}

export default function Games() {
  const [phase, setPhase] = useState(1);
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState(null);
  const [game, setGame] = useState(null);
  const [generationError, setGenerationError] = useState("");
  const [generationAttempt, setGenerationAttempt] = useState(0);

  useEffect(() => {
    if (phase !== 3 || !mode || !files.length) return;
    let active = true;
    setGame(null);
    setGenerationError("");
    api("minigame", {
      mode,
      fileIds: files.map((file) => file.id),
    })
      .then((result) => {
        if (!active) return;
        setGame(result);
        setPhase(4);
      })
      .catch((error) => {
        if (active) setGenerationError(error.message);
      });
    return () => {
      active = false;
    };
  }, [phase, mode, files, generationAttempt]);

  function reset() {
    setPhase(1);
    setFiles([]);
    setMode(null);
    setGame(null);
    setGenerationError("");
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
                Upload the notes, worksheet or sample paper you want the
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
                Pick a mode and we’ll build a fresh round from your uploaded
                material.
              </p>
            </div>
          </div>
          <div
            className="mode-bubbles"
            role="radiogroup"
            aria-label="Game mode"
          >
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={mode === item.id}
                className="mode-bubble"
                onClick={() => setMode(item.id)}
              >
                <span aria-hidden="true">{item.icon}</span>
                <small>Mode {item.number}</small>
                <b>{item.title}</b>
                <em>{item.description}</em>
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
          {!generationError && (
            <div className="minigame-orbit" aria-hidden="true">
              <span />
            </div>
          )}
          <Badge>
            {generationError ? "GENERATION PAUSED" : "BUILDING YOUR PRACTICE"}
          </Badge>
          <h2>
            {generationError
              ? "Your game couldn’t be built yet."
              : "Turning revision into a game…"}
          </h2>
          {generationError ? (
            <>
              <ErrorBox error={generationError} />
              <div className="actions">
                <button
                  onClick={() => {
                    setGenerationError("");
                    setGenerationAttempt((attempt) => attempt + 1);
                  }}
                >
                  Try again
                </button>
                <button className="secondary" onClick={() => setPhase(2)}>
                  Choose another mode
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              Reading {files.length} material{files.length === 1 ? "" : "s"} and
              preparing the play space.
            </p>
          )}
        </section>
      )}

      {phase === 4 && game && (
        <PlaySpace game={game} files={files} onReset={reset} />
      )}
    </>
  );
}
