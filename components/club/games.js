"use client";
import { useState, useEffect } from "react";
import { api, useData, Heading, ErrorBox, Badge } from "./ui";
import rules from "@/lib/club/rules.cjs";
const catalogue = [
  [
    "Math Rush",
    "ϟ",
    "Maths",
    "Practise multiplication, fractions or linear equations. Build speed without losing accuracy.",
  ],
  [
    "Timeline",
    "↔",
    "History",
    "Arrange historical events from earliest to latest.",
  ],
  [
    "Keyword Blitz",
    "◈",
    "Integrated Science",
    "Match terms with their definitions.",
  ],
  [
    "True or Trap",
    "◐",
    "ICT",
    "Think carefully about each computing statement.",
  ],
  [
    "Diagram Dash",
    "◎",
    "Geography",
    "Identify the processes in the water cycle.",
  ],
  [
    "Boss Battle",
    "♜",
    "Maths",
    "Each correct answer deals damage. Take on ten questions.",
  ],
];
const topicOptions = {
  "Math Rush": rules.MATH_GAME_TOPICS,
  "Boss Battle": rules.MATH_GAME_TOPICS,
  Timeline: ["World history", "Chinese history", "Hong Kong history"],
  "Keyword Blitz": ["Integrated Science", "Geography", "ICT", "History"],
  "True or Trap": ["ICT", "Integrated Science", "Geography"],
  "Diagram Dash": ["Water cycle"],
};
function Timeline({ question, value, onChange }) {
  const ids = value ? value.split(",") : question.events.map((e) => e.id);
  const [drag, setDrag] = useState(null);
  function move(from, to) {
    const next = [...ids];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next.join(","));
  }
  return (
    <ol className="timeline-sort">
      {ids.map((id, i) => (
        <li
          key={id}
          draggable
          onDragStart={() => setDrag(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (drag !== null) move(drag, i);
            setDrag(null);
          }}
        >
          <span>
            {i + 1}. {question.events.find((e) => e.id === id)?.text}
          </span>
          <button
            type="button"
            className="secondary"
            aria-label={`Move event ${i + 1} earlier`}
            disabled={i === 0}
            onClick={() => move(i, i - 1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="secondary"
            aria-label={`Move event ${i + 1} later`}
            disabled={i === ids.length - 1}
            onClick={() => move(i, i + 1)}
          >
            ↓
          </button>
        </li>
      ))}
    </ol>
  );
}
function WaterCycle() {
  return (
    <figure className="cycle-diagram">
      <svg
        viewBox="0 0 600 190"
        role="img"
        aria-label="Water-cycle process diagram. Water vapour travels from surface water at A to cloud droplets at B, then falls at C and collects at D."
      >
        <defs>
          <marker
            id="cycle-arrow"
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
          >
            <path d="M0 0 L7 3.5 L0 7" fill="#7b865e" />
          </marker>
        </defs>
        <g fill="#eef1e3" stroke="#7b865e">
          <rect x="20" y="60" width="120" height="60" rx="8" />
          <rect x="235" y="10" width="130" height="60" rx="8" />
          <rect x="450" y="60" width="130" height="60" rx="8" />
          <rect x="235" y="130" width="130" height="45" rx="8" />
        </g>
        <g fill="#244b3c" fontSize="13" textAnchor="middle">
          <text x="80" y="93">
            Surface water
          </text>
          <text x="300" y="44">
            Water vapour
          </text>
          <text x="515" y="93">
            Cloud droplets
          </text>
          <text x="300" y="158">
            Falling water
          </text>
        </g>
        <g
          fill="none"
          stroke="#7b865e"
          strokeWidth="2"
          markerEnd="url(#cycle-arrow)"
        >
          <path d="M140 78 L232 43" />
          <path d="M365 43 L446 78" />
          <path d="M490 123 L370 148" />
          <path d="M232 148 L108 123" />
        </g>
        <g fill="#244b3c" fontWeight="bold" fontSize="18">
          <text x="175" y="48">
            A
          </text>
          <text x="402" y="47">
            B
          </text>
          <text x="425" y="155">
            C
          </text>
          <text x="165" y="155">
            D
          </text>
        </g>
      </svg>
      <figcaption>Follow the arrows around the water cycle.</figcaption>
    </figure>
  );
}
export default function Games() {
  const { data: papers } = useData("papers"),
    [game, setGame] = useState(null),
    [answers, setAnswers] = useState({}),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [elapsed, setElapsed] = useState(0),
    [started, setStarted] = useState(0),
    [boss, setBoss] = useState(null),
    [topics, setTopics] = useState({}),
    [sourceVersion, setSourceVersion] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!game || result) return;
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [game, result, started]);
  async function start(name, versionId = "") {
    setError("");
    setBusy(true);
    try {
      const g = await api("gameStart", {
        game: name,
        topic: topics[name] || topicOptions[name]?.[0] || "Multiplication",
        versionId: versionId || undefined,
      });
      setGame(g);
      setAnswers(
        Object.fromEntries(
          g.questions
            .filter((q) => q.type === "timeline")
            .map((q) => [q.id, q.events.map((e) => e.id).join(",")]),
        ),
      );
      setResult(null);
      setBoss({ answers: [], bossHealth: 100, health: 100, complete: false });
      setStarted(Date.now());
      setElapsed(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="A quick change of pace."
        eyebrow="PRACTICE / MINIGAMES"
        description="Short practice. Real learning. A little momentum for your day."
      />
      <ErrorBox error={error} />
      {!game ? (
        <>
          <section className="card revision-mix-card">
            <div>
              <Badge>YOUR REVISION MATERIAL</Badge>
              <h2>Revision Mix</h2>
              <p className="muted">Turn up to ten short questions from one of your saved papers into a quick game. The paper must include an answer key.</p>
            </div>
            <label>
              Source paper
              <select value={sourceVersion} onChange={(event) => setSourceVersion(event.target.value)}>
                <option value="">Choose a saved paper</option>
                {papers?.map((paper) => <option key={paper.version_id} value={paper.version_id}>{paper.title} · {paper.subject}</option>)}
              </select>
            </label>
            <button disabled={busy || !sourceVersion} onClick={() => start("Revision Mix", sourceVersion)}>Play from this paper →</button>
          </section>
          <div className="subject-grid spaced">
          {catalogue.map(([name, icon, subject, description]) => (
            <section className="card game-card" key={name}>
              <span className="game-icon">{icon}</span>
              <Badge>{subject}</Badge>
              <h2>{name}</h2>
              <p className="muted">{description}</p>
              {topicOptions[name]?.length > 1 && (
                <label>
                  Topic
                  <select
                    aria-label={name + " topic"}
                    value={topics[name] || topicOptions[name][0]}
                    onChange={(e) =>
                      setTopics((current) => ({
                        ...current,
                        [name]: e.target.value,
                      }))
                    }
                  >
                    {topicOptions[name].map((topic) => (
                      <option key={topic}>{topic}</option>
                    ))}
                  </select>
                </label>
              )}
              <p className="small muted">
                3 minutes · Score at least 50% for +10 XP, once daily across
                games.
              </p>
              <button disabled={busy} onClick={() => start(name)}>
                Play {name} →
              </button>
            </section>
          ))}
          </div>
        </>
      ) : result ? (
        <section className="card game-result">
          <div className="eyebrow">A LITTLE STRONGER</div>
          <h2>
            {result.correct} / {result.total}
          </h2>
          <p>
            {Math.round((result.correct / result.total) * 100)}% accuracy ·{" "}
            {result.elapsed}s · +{result.xpEarned} XP
          </p>
          <p>Personal best: {Math.round(result.best)}%</p>
          {game.name === "Boss Battle" && (
            <h3>
              {result.correct === result.total
                ? "Boss defeated!"
                : `Boss health: ${(result.total - result.correct) * 10}% — learn the gaps and try again.`}
            </h3>
          )}
          <details>
            <summary>Review answers</summary>
            {result.items.map((i) => (
              <div className="list-row" key={i.id}>
                <span>
                  <b>{i.text}</b>
                  <small>{i.explanation || i.answer}</small>
                </span>
                <Badge>{i.correct ? "Correct" : "Review"}</Badge>
              </div>
            ))}
          </details>
          <button
            className="spaced"
            onClick={() => {
              setGame(null);
              setResult(null);
            }}
          >
            Back to minigames →
          </button>
        </section>
      ) : (
        <section className="card">
          <div className="section-heading">
            <h2>{game.name}</h2>
            {game.topic && <Badge>{game.topic}</Badge>}
            <Badge>{elapsed}s / 180s</Badge>
          </div>
          {game.name === "Diagram Dash" && <WaterCycle />}
          {game.name === "Boss Battle" && (
            <div className="notice">
              <label>
                Boss health: {boss.bossHealth}%
                <progress
                  aria-label="Boss health"
                  max={100}
                  value={boss.bossHealth}
                />
              </label>
              <label>
                Your health: {boss.health}%
                <progress
                  aria-label="Your health"
                  max={100}
                  value={boss.health}
                />
              </label>
              <p>
                Correct answers deal 10 damage. Incorrect answers cost 20
                health. Each answer is final.
              </p>
              {boss.lastAnswer && (
                <p role="status">
                  {boss.lastAnswer.correct
                    ? "Hit! Correct answer."
                    : "The boss strikes back. Correct answer: " +
                      boss.lastAnswer.expected}
                </p>
              )}
              {boss.complete && (
                <p>
                  {boss.health === 0
                    ? "Your health ran out. Save the round to review and practise."
                    : boss.bossHealth === 0
                      ? "Boss defeated! Save your round below."
                      : "Round complete. Save to review the questions you missed."}
                </p>
              )}
            </div>
          )}
          <div className="game-questions">
            {game.questions
              .filter(
                (q, index) =>
                  game.name !== "Boss Battle" ||
                  (!boss.complete && index === boss.answers.length),
              )
              .map((q) => (
                <div key={q.id}>
                  {q.type === "timeline" ? (
                    <Timeline
                      question={q}
                      value={answers[q.id]}
                      onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                    />
                  ) : (
                    <label>
                      {q.text}
                      {q.options ? (
                        <select
                          value={answers[q.id] || ""}
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              [q.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Choose an answer</option>
                          {q.options.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          inputMode={q.type === "number" ? "numeric" : "text"}
                          value={answers[q.id] || ""}
                          onChange={(e) =>
                            setAnswers((a) => ({
                              ...a,
                              [q.id]: e.target.value,
                            }))
                          }
                        />
                      )}
                    </label>
                  )}
                </div>
              ))}
          </div>
          {game.name === "Boss Battle" && !boss.complete && (
            <button
              disabled={
                busy ||
                elapsed > 180 ||
                !answers[game.questions[boss.answers.length]?.id]?.trim()
              }
              onClick={async () => {
                setBusy(true);
                setError("");
                const q = game.questions[boss.answers.length];
                try {
                  setBoss(
                    await api("bossAnswer", {
                      id: game.id,
                      questionId: q.id,
                      answer: answers[q.id],
                    }),
                  );
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Checking…" : "Attack →"}
            </button>
          )}
          <button
            disabled={
              busy ||
              elapsed < 10 ||
              elapsed > 180 ||
              (game.name === "Boss Battle" && !boss.complete)
            }
            onClick={async () => {
              setBusy(true);
              try {
                setResult(await api("gameFinish", { id: game.id, answers }));
              } catch (e) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Checking…" : "Finish round →"}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setGame(null)}
          >
            {elapsed > 180 ? "Time’s up · Try again" : "Leave round"}
          </button>
        </section>
      )}
    </>
  );
}
