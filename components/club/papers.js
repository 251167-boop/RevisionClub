"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import rules from "@/lib/club/rules.cjs";
import {
  api,
  useData,
  Loading,
  Heading,
  Empty,
  ErrorBox,
  PaperCard,
  Badge,
  ActionForm,
} from "./ui";
const { SUBJECTS, QUESTION_TYPES: QUESTION_TYPE_IDS } = rules;
const QUESTION_TYPES = [
  ["mc_box", "MC · A–D with answer boxes"],
  ["mc_single_box", "MC · one answer box"],
  ["mc_circle", "MC · fillable circles"],
  ["answer_space", "Large blank answer space"],
  ["short_answer", "Short answer"],
  ["comprehension", "Comprehension passage"],
  ["ordering", "Ordering"],
  ["matching", "Matching"],
];
function questionType(question) {
  if (QUESTION_TYPE_IDS.includes(question.type)) return question.type;
  return question.options?.length ? "mc_box" : "short_answer";
}
const ASPECTS = [
  "Font / typography",
  "Font size",
  "Spacing",
  "Question type",
  "Question layout",
  "Page structure",
  "Header",
  "Footer",
  "Marks placement",
  "Answer-writing spaces",
  "Diagrams / figures",
  "General visual style",
];
export function Library({ community = false }) {
  const [page, setPage] = useState(1),
    [subject, setSubject] = useState("All subjects"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("Newest"),
    [difficulty, setDifficulty] = useState("All difficulties"),
    [grade, setGrade] = useState("All years"),
    { data, error } = useData(
      community
        ? `papers?community=true&page=${page}&pageSize=12&q=${encodeURIComponent(query)}&subject=${encodeURIComponent(subject)}&difficulty=${encodeURIComponent(difficulty)}&grade=${encodeURIComponent(grade)}&sort=${encodeURIComponent(sort)}`
        : "papers",
    );
  const search = useSearchParams();
  useEffect(() => {
    setQuery(search.get("q") || "");
  }, [search]);
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  const rows = community ? data.items : data,
    filtered = (community ? rows : rows
    .filter(
      (p) =>
        (subject === "All subjects" || p.subject === subject) &&
        (difficulty === "All difficulties" || p.difficulty === difficulty) &&
        (grade === "All years" || p.grade === grade) &&
        [p.title, p.description, p.username, ...(p.topics || [])]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Rating"
        ? (b.rating || 0) - (a.rating || 0)
        : sort === "Most attempted"
          ? b.attempts - a.attempts
        : 0,
    ));
  return (
    <>
      <Heading
        eyebrow={
          community ? "MADE TO BE SHARED" : "YOUR PERSONAL PAPER LIBRARY"
        }
        title={community ? "Community papers." : "Your next good practice."}
        description={
          community
            ? "Discover practice papers published by fellow students."
            : "From your first draft to your next breakthrough."
        }
      >
        <Link href="/papers/create" className="button">
          ＋ Create a paper
        </Link>
      </Heading>
      <div className="toolbar">
        <input
          aria-label="Search papers"
          placeholder="Search title, topic or creator…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
        />
        <select
          aria-label="Filter subject"
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setPage(1); }}
        >
          <option>All subjects</option>
          {SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter difficulty"
          value={difficulty}
          onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}
        >
          {["All difficulties", "Foundation", "Standard", "Challenging"].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>
        <select
          aria-label="Filter year"
          value={grade}
          onChange={(e) => { setGrade(e.target.value); setPage(1); }}
        >
          <option>All years</option>
          {[...new Set(rows.map((p) => p.grade).filter(Boolean))]
            .sort()
            .map((x) => (
              <option key={x}>{x}</option>
            ))}
        </select>
        <select
          aria-label="Sort papers"
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
        >
          <option>Newest</option>
          <option>Rating</option>
          <option>Most attempted</option>
        </select>
        <Link className="text-link" href="/results">
          My results →
        </Link>
      </div>
      {filtered.length ? (
        <>
          <div className="paper-grid">
            {filtered.map((p) => (
              <PaperCard key={p.id} paper={p} />
            ))}
          </div>
          {community && data.pages > 1 && (
            <nav className="pagination" aria-label="Community paper pages">
              <button
                className="secondary"
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
              >
                ← Previous
              </button>
              <span aria-live="polite">
                Page {data.page} of {data.pages} · {data.total} papers
              </span>
              <button
                className="secondary"
                disabled={page === data.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next →
              </button>
            </nav>
          )}
        </>
      ) : (
        <Empty
          title={
            community
              ? rows.length
                ? "No papers match these filters."
                : "Good practice is worth sharing."
              : rows.length
                ? "No papers match these filters."
                : "Your first paper starts here."
          }
          href="/papers/create"
          label="Create a paper"
        >
          {community
            ? "Published papers will appear here. Private papers stay private."
            : "Upload your notes or write your own questions."}
        </Empty>
      )}
    </>
  );
}
function Upload({ purpose, onAdd }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(files) {
    setBusy(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("file", file);
        form.set("purpose", purpose);
        const r = await fetch("/api/club/upload", {
          method: "POST",
          body: form,
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        onAdd(d);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <label
        className="upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
      >
        <span className="upload-icon">↥</span>
        <b>
          {busy
            ? "Uploading…"
            : purpose === "Revision Material"
              ? "Drag your revision materials here"
              : `Upload ${purpose.toLowerCase()}`}
        </b>
        <span>
          or click to browse · PDF, DOCX, PPTX, TXT, images · up to 10 MB each
        </span>
        <input
          aria-label={purpose}
          type="file"
          multiple
          disabled={busy}
          accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.webp"
          onChange={(e) => upload(e.target.files)}
        />
      </label>
      <p className="muted small">
        Word and PowerPoint imports use text only. Use PDF when diagrams,
        equations or sample formatting matter.
      </p>
      <ErrorBox error={error} />
    </>
  );
}
const initial = {
  title: "",
  subject: "Maths",
  description: "",
  totalMarks: 20,
  duration: 30,
  difficulty: "Standard",
  grade: "Form 2",
  language: "English",
  questionCount: 5,
  pages: 2,
  onlySources: false,
  generateKey: true,
  sampleAspects: [],
};
export function CreatePaper() {
  const router = useRouter(),
    search = useSearchParams();
  const [settings, setSettings] = useState(initial),
    [files, setFiles] = useState([]),
    [content, setContent] = useState(null),
    [key, setKey] = useState([]),
    [busy, setBusy] = useState(""),
    [busySeconds, setBusySeconds] = useState(0),
    [error, setError] = useState(""),
    [mode, setMode] = useState("ai");
  const { data: viewer } = useData("dashboard");
  const groupId = search.get("group");
  const { data: group } = useData(groupId ? "groups/" + groupId : null);
  const allowed = group
    ? group.subjects.filter(
        (s) =>
          group.role !== "Member" ||
          group.members
            .find((m) => m.id === viewer?.user.id)
            ?.subjects.includes(s),
      )
    : SUBJECTS;
  const [keySource, setKeySource] = useState("Human-provided answer key");
  const [draftLoading, setDraftLoading] = useState(true),
    [draftMessage, setDraftMessage] = useState("");
  useEffect(() => {
    if (!busy) {
      setBusySeconds(0);
      return;
    }
    const started = Date.now();
    setBusySeconds(0);
    const timer = window.setInterval(
      () => setBusySeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    let active = true;
    setDraftLoading(true);
    api(
      "paper-draft" + (groupId ? "?group=" + encodeURIComponent(groupId) : ""),
    )
      .then((d) => {
        if (!active) return;
        if (d) {
          setSettings({ ...initial, ...d.settings });
          setFiles(d.files);
          setContent(d.content);
          setKey(d.answerKey);
          setKeySource(d.keySource);
          setDraftMessage("Your saved draft has been restored.");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setDraftLoading(false);
      });
    return () => {
      active = false;
    };
  }, [groupId]);
  async function saveDraft() {
    setError("");
    setBusy("Saving your private draft");
    try {
      await api("paper-draft", {
        groupId,
        draft: { settings, files, content, answerKey: key, keySource },
      });
      setDraftMessage("Draft saved. You can return to it from this account.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  const set = (name, value) => setSettings((s) => ({ ...s, [name]: value }));
  async function generate() {
    setError("");
    setBusy("Analysing materials and generating your paper");
    try {
      const p = await api("generate", {
        ...settings,
        groupId,
        fileIds: files.map((f) => f.id),
      });
      setContent(p);
      setDraftMessage(
        "Generated paper saved as a private draft. Save draft again after editing.",
      );
      setKey(settings.generateKey ? p.answerKey : []);
      setKeySource("AI-generated marking scheme");
      if (!settings.title)
        set(
          "title",
          p.title || `${settings.grade} ${settings.subject} — Practice Paper`,
        );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function save() {
    setError("");
    setBusy("Saving your paper and linked answer key");
    try {
      const r = await api("papers", {
        ...settings,
        groupId,
        fileIds: files.map((f) => f.id),
        content,
        answerKey: key.length ? key : null,
        keySource,
      });
      router.push("/papers/" + r.paperId);
    } catch (e) {
      setError(e.message);
      setBusy("");
    }
  }
  return (
    <>
      <Heading
        eyebrow="TEST PAPERS / CREATE"
        title="Make it your own."
        description="Bring your materials. Build the practice you need."
      >
        <button
          className="secondary"
          disabled={draftLoading || !!busy}
          onClick={saveDraft}
        >
          Save draft
        </button>
      </Heading>
      {draftMessage && (
        <p role="status" className="notice">
          {draftMessage}
        </p>
      )}
      <div className="stepper">
        <span className={!content ? "current" : ""}>01 Materials & brief</span>
        <span className={content ? "current" : ""}>02 Preview & refine</span>
        <span>03 Save & share</span>
      </div>
      <ErrorBox error={error} />
      {draftLoading ? (
        <Loading />
      ) : busy ? (
        <section className="generation-screen" role="status">
          <div className="pulse" />
          <h2>{busy}…</h2>
          <p>
            We’ll show the paper when the response has been checked. AI
            generation can take 30–90 seconds; this request has been running for
            {busySeconds}s.
          </p>
          <ul>
            <li>✓ Your settings are ready</li>
            <li>● Processing your request</li>
            <li>○ Preview and review</li>
          </ul>
        </section>
      ) : content ? (
        <>
          <label className="card">
            Paper title
            <input
              value={settings.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </label>
          <PaperEditor
            content={content}
            setContent={setContent}
            answerKey={key}
            setAnswerKey={setKey}
            onRegenerate={async (questionIds) => {
              const next = await api("regenerate", {
                ...settings,
                groupId,
                fileIds: files.map((f) => f.id),
                content,
                answerKey: key,
                questionIds,
              });
              setKeySource("AI-generated marking scheme");
              setDraftMessage(
                "Regenerated questions saved in your private draft. Review the new questions and answers.",
              );
              return next;
            }}
          />
          <div className="sticky-actions">
            <button className="secondary" onClick={() => setContent(null)}>
              ← Back to brief
            </button>
            <button onClick={save}>Save to My Papers →</button>
          </div>
        </>
      ) : (
        <div className="create-layout">
          <div className="stack">
            <section className="card">
              <div className="section-heading">
                <h2>
                  <span className="step-number">01</span> Your source material
                </h2>
                <Badge>START HERE</Badge>
              </div>
              <Upload
                purpose="Revision Material"
                onAdd={(f) => setFiles((x) => [...x, f])}
              />
              <div className="file-list">
                {files
                  .filter((f) => f.purpose === "Revision Material")
                  .map((f) => (
                    <div key={f.id}>
                      <span>
                        ▤ {f.name}
                        <small>{f.status}</small>
                      </span>
                      <button
                        className="icon-button"
                        onClick={() =>
                          setFiles((x) => x.filter((v) => v.id !== f.id))
                        }
                        aria-label={"Remove " + f.name}
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.onlySources}
                  onChange={(e) => set("onlySources", e.target.checked)}
                />
                Only use uploaded materials
              </label>
            </section>
            <section className="card">
              <h2>
                <span className="step-number">02</span> The paper brief
              </h2>
              <label>
                Paper title
                <input
                  placeholder="e.g. Form 2 Geography — The Water Cycle"
                  value={settings.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </label>
              <label>Subject</label>
              <div className="chips">
                {SUBJECTS.map((s) => (
                  <button
                    className={
                      "chip " + (settings.subject === s ? "selected" : "")
                    }
                    key={s}
                    onClick={() => set("subject", s)}
                    disabled={group && !allowed.includes(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {group && (
                <p className="muted">
                  Creating for {group.name}. Member subject access is checked
                  when generating and saving.
                </p>
              )}
              <label>
                What would you like to practise?
                <textarea
                  rows={5}
                  placeholder="Create a 20-mark Form 2 paper. Include short answers and structured questions, based on my notes…"
                  value={settings.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </label>
            </section>
            <section className="card">
              <h2>
                <span className="step-number">03</span> Format & marking{" "}
                <span className="muted small">OPTIONAL</span>
              </h2>
              <Upload
                purpose="Sample Paper"
                onAdd={(f) => setFiles((x) => [...x, f])}
              />
              <p className="muted">
                Choose only the sample characteristics you want to follow.
              </p>
              <div className="chips">
                {ASPECTS.map((s) => (
                  <button
                    key={s}
                    className={
                      "chip " +
                      (settings.sampleAspects.includes(s) ? "selected" : "")
                    }
                    onClick={() =>
                      set(
                        "sampleAspects",
                        settings.sampleAspects.includes(s)
                          ? settings.sampleAspects.filter((x) => x !== s)
                          : [...settings.sampleAspects, s],
                      )
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Upload
                purpose="Answer Key / Marking Scheme"
                onAdd={(f) => setFiles((x) => [...x, f])}
              />
              {files
                .filter((f) => f.purpose !== "Revision Material")
                .map((f) => (
                  <p key={f.id} className="muted">
                    ▤ {f.name} · {f.purpose}
                  </p>
                ))}
            </section>
          </div>
          <aside className="stack">
            <section className="card settings-card">
              <div className="eyebrow">THE DETAILS</div>
              <h2>Paper settings</h2>
              <div className="form-grid">
                {[
                  ["Total marks", "totalMarks", 1, 300],
                  ["Duration (mins)", "duration", 5, 180],
                  ["Questions", "questionCount", 1, 40],
                  ["Pages", "pages", 1, 30],
                ].map(([label, name, min, max]) => (
                  <label key={name}>
                    {label}
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={settings[name]}
                      onChange={(e) => set(name, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
              <label>
                Difficulty
                <select
                  value={settings.difficulty}
                  onChange={(e) => set("difficulty", e.target.value)}
                >
                  <option>Foundation</option>
                  <option>Standard</option>
                  <option>Challenging</option>
                </select>
              </label>
              <label>
                Form / year
                <input
                  value={settings.grade}
                  onChange={(e) => set("grade", e.target.value)}
                />
              </label>
              <label>
                Language
                <select
                  value={settings.language}
                  onChange={(e) => set("language", e.target.value)}
                >
                  <option>English</option>
                  <option>Traditional Chinese</option>
                  <option>Simplified Chinese</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings.generateKey}
                  onChange={(e) => set("generateKey", e.target.checked)}
                />
                Generate Answer Key
              </label>
              <button className="full" onClick={generate}>
                ✦ Generate paper
              </button>
              <p className="muted small">
                AI generation requires a configured Gemini key. Always review
                questions and the marking scheme.
              </p>
            </section>
            <section className="card warm">
              <h3>Prefer to write it yourself?</h3>
              <p className="muted">
                Create a manual paper and add your own marking scheme. No AI key
                needed.
              </p>
              <button
                className="secondary full"
                onClick={() => {
                  if (!settings.title)
                    set("title", `${settings.subject} — Practice Paper`);
                  setContent({
                    instructions:
                      "Answer all questions. Show your working where appropriate.",
                    duration: settings.duration,
                    questions: [
                      {
                        id: "1",
                        type: "short_answer",
                        text: "",
                        passage: "",
                        marks: 4,
                        page: 1,
                        space: 4,
                        topic: "General",
                        options: [],
                        items: [],
                      },
                    ],
                  });
                  setKey([
                    {
                      questionId: "1",
                      answer: "",
                      rubric: "",
                      alternatives: [],
                    },
                  ]);
                }}
              >
                Write a manual paper →
              </button>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
export function PaperEditor({
  content,
  setContent,
  answerKey,
  setAnswerKey,
  onRegenerate,
}) {
  const [page, setPage] = useState(1),
    [zoom, setZoom] = useState(100),
    [history, setHistory] = useState([]),
    [future, setFuture] = useState([]),
    [regenerating, setRegenerating] = useState(false),
    [regenerationError, setRegenerationError] = useState("");
  const pages = [...new Set(content.questions.map((q) => q.page))].sort(
    (a, b) => a - b,
  );
  const selectedPage = pages.includes(page) ? page : pages[0];
  function update(next, nextKey = answerKey) {
    setHistory((h) => [...h.slice(-49), { content, answerKey }]);
    setFuture([]);
    setContent(next);
    setAnswerKey(nextKey);
  }
  function updateKey(next) {
    update(content, next);
  }
  function moveQuestion(q, direction) {
    const questions = [...content.questions],
      from = questions.findIndex((x) => x.id === q.id);
    let to = from + direction;
    while (to >= 0 && to < questions.length && questions[to].page !== q.page)
      to += direction;
    if (to < 0 || to >= questions.length) return;
    [questions[from], questions[to]] = [questions[to], questions[from]];
    update({ ...content, questions });
  }
  function movePage(direction) {
    const destination = pages[pages.indexOf(selectedPage) + direction];
    if (destination === undefined) return;
    update({
      ...content,
      questions: content.questions.map((q) => ({
        ...q,
        page:
          q.page === selectedPage
            ? destination
            : q.page === destination
              ? selectedPage
              : q.page,
      })),
    });
    setPage(destination);
  }
  function deletePage() {
    if (pages.length === 1) return;
    const remaining = content.questions.filter((q) => q.page !== selectedPage);
    const ids = new Set(remaining.map((q) => q.id));
    update(
      { ...content, questions: remaining },
      answerKey.filter((k) => ids.has(k.questionId)),
    );
  }
  function question(q, field, value) {
    update({
      ...content,
      questions: content.questions.map((x) =>
        x.id === q.id ? { ...x, [field]: value } : x,
      ),
    });
  }
  async function regenerate(ids) {
    setRegenerating(true);
    setRegenerationError("");
    try {
      const next = await onRegenerate(ids);
      update(next, next.answerKey);
    } catch (e) {
      setRegenerationError(e.message);
    } finally {
      setRegenerating(false);
    }
  }
  return (
    <>
      <ErrorBox error={regenerationError} />
      {regenerating && (
        <p className="notice" role="status">
          Regenerating selected questions…
        </p>
      )}
      <fieldset className="editor editor-fieldset" disabled={regenerating}>
        <aside className="page-rail">
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={"page-thumb " + (selectedPage === p ? "selected" : "")}
            >
              ▤<small>Page {p}</small>
            </button>
          ))}
          <button
            className="secondary small"
            disabled={pages.indexOf(selectedPage) === 0}
            onClick={() => movePage(-1)}
          >
            Move page earlier
          </button>
          <button
            className="secondary small"
            disabled={pages.indexOf(selectedPage) === pages.length - 1}
            onClick={() => movePage(1)}
          >
            Move page later
          </button>
          <button
            className="secondary small"
            disabled={pages.length === 1}
            onClick={deletePage}
          >
            Delete page
          </button>
          <button
            className="secondary small"
            disabled={!history.length}
            onClick={() => {
              const previous = history.at(-1);
              setFuture((f) => [...f, { content, answerKey }]);
              setContent(previous.content);
              setAnswerKey(previous.answerKey);
              setHistory((h) => h.slice(0, -1));
            }}
          >
            ↶ Undo
          </button>
          <button
            className="secondary small"
            disabled={!future.length}
            onClick={() => {
              const next = future.at(-1);
              setHistory((h) => [...h, { content, answerKey }]);
              setContent(next.content);
              setAnswerKey(next.answerKey);
              setFuture((f) => f.slice(0, -1));
            }}
          >
            ↷ Redo
          </button>
        </aside>
        <div>
          <div className="preview-toolbar">
            <Badge>EDITABLE PREVIEW</Badge>
            {onRegenerate && (
              <button
                className="secondary small"
                onClick={() =>
                  regenerate(
                    content.questions
                      .filter((q) => q.page === selectedPage)
                      .map((q) => q.id),
                  )
                }
              >
                Regenerate page
              </button>
            )}
            <label>
              Zoom
              <select value={zoom} onChange={(e) => setZoom(+e.target.value)}>
                {[75, 90, 100, 110].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <span>
              Page {selectedPage} · {pages.length} pages
            </span>
          </div>
          <div className="editor-page-scroll">
            <article className="exam-paper" style={{ zoom: zoom / 100 }}>
              <div className="exam-brand">
                REVISION CLUB <span>PRACTICE PAPER</span>
              </div>
              <label>
                Paper instructions
                <textarea
                  value={content.instructions}
                  onChange={(e) =>
                    update({ ...content, instructions: e.target.value })
                  }
                />
              </label>
              {content.questions
                .filter((q) => q.page === selectedPage)
                .map((q, i) => (
                  <section className="edit-question" key={q.id}>
                    <div className="section-heading">
                      <b>Question {q.id}</b>
                      {onRegenerate && (
                        <button
                          className="secondary small"
                          aria-label={"Regenerate question " + q.id}
                          onClick={() => regenerate([q.id])}
                        >
                          Regenerate
                        </button>
                      )}
                      <div className="actions">
                        <button
                          className="icon-button"
                          aria-label={"Move question " + q.id + " up"}
                          disabled={i === 0}
                          onClick={() => moveQuestion(q, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="icon-button"
                          aria-label={"Move question " + q.id + " down"}
                          disabled={
                            i ===
                            content.questions.filter(
                              (x) => x.page === selectedPage,
                            ).length -
                              1
                          }
                          onClick={() => moveQuestion(q, 1)}
                        >
                          ↓
                        </button>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={"Delete question " + q.id}
                        disabled={content.questions.length === 1}
                        onClick={() => {
                          update(
                            {
                              ...content,
                              questions: content.questions.filter(
                                (x) => x.id !== q.id,
                              ),
                            },
                            answerKey.filter((x) => x.questionId !== q.id),
                          );
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <label>
                      Question
                      <textarea
                        aria-label={"Question " + q.id + " text"}
                        rows={3}
                        value={q.text}
                        onChange={(e) => question(q, "text", e.target.value)}
                      />
                    </label>
                    <div className="form-grid">
                      <label>
                        Question format
                        <select
                          aria-label={"Question format " + q.id}
                          value={questionType(q)}
                          onChange={(e) => question(q, "type", e.target.value)}
                        >
                          {QUESTION_TYPES.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Marks
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={q.marks}
                          onChange={(e) =>
                            question(q, "marks", +e.target.value)
                          }
                        />
                      </label>
                    </div>
                    {questionType(q) === "comprehension" && (
                      <label>
                        Passage shown inside the comprehension box
                        <textarea
                          aria-label={"Passage " + q.id}
                          rows={8}
                          value={q.passage || ""}
                          onChange={(e) =>
                            question(q, "passage", e.target.value)
                          }
                          placeholder="Paste or write the Chinese or English passage here…"
                        />
                      </label>
                    )}
                    {["mc_box", "mc_single_box", "mc_circle", "ordering", "matching"].includes(
                      questionType(q),
                    ) && (
                      <label>
                        {questionType(q) === "ordering"
                          ? "Items to order"
                          : questionType(q) === "matching"
                            ? "Right-side matching choices"
                            : "Answer choices"}{" "}
                        (one per line)
                        <textarea
                          aria-label={"Options " + q.id}
                          value={(q.options || []).join("\n")}
                          onChange={(e) =>
                            question(
                              q,
                              "options",
                              e.target.value.split("\n").slice(0, 8),
                            )
                          }
                          placeholder={
                            ["mc_box", "mc_single_box", "mc_circle"].includes(questionType(q))
                              ? "Use four lines for A, B, C and D"
                              : "Add at least two items"
                          }
                        />
                      </label>
                    )}
                    {questionType(q) === "matching" && (
                      <label>
                        Left-side matching prompts (one per line)
                        <textarea
                          aria-label={"Matching prompts " + q.id}
                          value={(q.items || []).join("\n")}
                          onChange={(e) =>
                            question(
                              q,
                              "items",
                              e.target.value.split("\n").slice(0, 8),
                            )
                          }
                          placeholder="Use the same number of left and right items"
                        />
                      </label>
                    )}
                    <label>
                      Correct answer{" "}
                      <span className="muted small">
                        PRIVATE · CREATOR ONLY
                      </span>
                      <textarea
                        aria-label={"Answer key " + q.id}
                        value={
                          answerKey.find((x) => x.questionId === q.id)
                            ?.answer || ""
                        }
                        onChange={(e) =>
                          updateKey([
                            ...answerKey.filter((x) => x.questionId !== q.id),
                            {
                              ...answerKey.find((x) => x.questionId === q.id),
                              questionId: q.id,
                              answer: e.target.value,
                            },
                          ])
                        }
                      />
                    </label>
                    <details className="question-advanced">
                      <summary>More options</summary>
                      <div className="form-grid">
                        <label>
                          Topic
                          <input value={q.topic} onChange={(e) => question(q, "topic", e.target.value)} />
                        </label>
                        <label>
                          Page
                          <input type="number" min={1} max={30} value={q.page} onChange={(e) => question(q, "page", +e.target.value)} />
                        </label>
                        <label>
                          Answer lines
                          <input type="number" min={1} max={16} value={q.space} onChange={(e) => question(q, "space", +e.target.value)} />
                        </label>
                      </div>
                      <label>
                        Accepted alternatives (one per line, up to 20)
                        <span className="muted small"> PRIVATE · CREATOR ONLY</span>
                        <textarea
                          aria-label={"Accepted alternatives " + q.id}
                          value={(answerKey.find((x) => x.questionId === q.id)?.alternatives || []).join("\n")}
                          onChange={(e) => updateKey([
                            ...answerKey.filter((x) => x.questionId !== q.id),
                            { ...answerKey.find((x) => x.questionId === q.id), questionId: q.id, alternatives: e.target.value.split("\n").slice(0, 20) },
                          ])}
                        />
                      </label>
                      <label>
                        Rubric / method marks
                        <textarea
                          aria-label={"Rubric " + q.id}
                          value={answerKey.find((x) => x.questionId === q.id)?.rubric || ""}
                          onChange={(e) => updateKey([
                            ...answerKey.filter((x) => x.questionId !== q.id),
                            { ...answerKey.find((x) => x.questionId === q.id), questionId: q.id, rubric: e.target.value },
                          ])}
                        />
                      </label>
                    </details>
                  </section>
                ))}
              <button
                className="secondary"
                onClick={() => {
                  const qid = String(
                    Math.max(
                      ...content.questions.map((x) => Number(x.id) || 0),
                    ) + 1,
                  );
                  update({
                    ...content,
                    questions: [
                      ...content.questions,
                      {
                        id: qid,
                        type: "short_answer",
                        text: "",
                        passage: "",
                        marks: 2,
                        page: selectedPage,
                        space: 4,
                        topic: "General",
                        options: [],
                        items: [],
                      },
                    ],
                  });
                }}
              >
                ＋ Add question
              </button>
            </article>
          </div>
        </div>
      </fieldset>
    </>
  );
}

function parsedAnswer(value, fallback) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readableAnswer(value) {
  const parsed = parsedAnswer(value, null);
  if (Array.isArray(parsed)) return parsed.filter(Boolean).join(" → ");
  if (parsed)
    return Object.entries(parsed)
      .filter(([, answer]) => answer)
      .map(([prompt, answer]) => `${prompt} → ${answer}`)
      .join("; ");
  return value || "(No answer)";
}

function QuestionResponse({ question, value = "", onChange }) {
  const type = questionType(question),
    options = question.options || [],
    editable = Boolean(onChange);
  if (type === "mc_box" || type === "mc_single_box" || type === "mc_circle")
    return (
      <div className={`mc-options ${type}`}>
        {options.map((option, index) => {
          const letter = String.fromCharCode(65 + index),
            selected = value === option || value === letter;
          const content = (
            <>
              {type === "mc_circle" && (
                <span
                  className={`choice-circle ${selected ? "selected" : ""}`}
                />
              )}
              {type !== "mc_single_box" && <span className="choice-copy">
                <b>{letter}.</b> {option}
              </span>}
              {type === "mc_single_box" && <span className="choice-copy"><b>{letter}.</b> {option}</span>}
              {type === "mc_box" && (
                <span className={`choice-box ${selected ? "selected" : ""}`}>
                  {selected ? letter : ""}
                </span>
              )}
            </>
          );
          return editable ? (
            <button
              type="button"
              className="mc-option"
              aria-pressed={selected}
              key={index}
              onClick={() => onChange(option)}
            >
              {content}
            </button>
          ) : (
            <div className="mc-option" key={index}>
              {content}
            </div>
          );
        })}
      </div>
    );
  if (type === "answer_space")
    return editable ? (
      <textarea
        className="blank-answer-space"
        aria-label={"Answer to question " + question.id}
        rows={Math.max(5, question.space)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write your answer and working here…"
      />
    ) : (
      <div
        className="blank-answer-space print-space"
        style={{ minHeight: `${Math.max(5, question.space) * 7}mm` }}
      />
    );
  if (type === "ordering") {
    const ordered = parsedAnswer(value, []);
    return (
      <div className="ordering-response">
        {options.map((_, index) =>
          editable ? (
            <label key={index}>
              <span>{index + 1}</span>
              <select
                aria-label={`Position ${index + 1} for question ${question.id}`}
                value={ordered[index] || ""}
                onChange={(event) => {
                  const next = [...ordered];
                  next[index] = event.target.value;
                  onChange(JSON.stringify(next));
                }}
              >
                <option value="">Choose an item</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="ordering-line" key={index}>
              <span>{index + 1}</span>
              <i />
            </div>
          ),
        )}
        <div className="ordering-bank">
          {options.map((option) => (
            <span key={option}>{option}</span>
          ))}
        </div>
      </div>
    );
  }
  if (type === "matching") {
    const matches = parsedAnswer(value, {}),
      prompts = question.items || [];
    return (
      <div className="matching-response">
        <div className="matching-list">
          {prompts.map((prompt, index) => (
            <div className="matching-row" key={index}>
              <span>
                {index + 1}. {prompt}
              </span>
              {editable ? (
                <select
                  aria-label={`Match for ${prompt}`}
                  value={matches[prompt] || ""}
                  onChange={(event) =>
                    onChange(
                      JSON.stringify({
                        ...matches,
                        [prompt]: event.target.value,
                      }),
                    )
                  }
                >
                  <option value="">Choose a match</option>
                  {options.map((option, optionIndex) => (
                    <option key={option} value={option}>
                      {String.fromCharCode(65 + optionIndex)}. {option}
                    </option>
                  ))}
                </select>
              ) : (
                <i />
              )}
            </div>
          ))}
        </div>
        <div className="matching-bank">
          {options.map((option, index) => (
            <div key={option}>
              <b>{String.fromCharCode(65 + index)}.</b> {option}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (editable)
    return type === "short_answer" ? (
      <input
        className="short-answer-input"
        aria-label={"Answer to question " + question.id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Short answer"
      />
    ) : (
      <textarea
        aria-label={"Answer to question " + question.id}
        rows={question.space}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write your answer here…"
      />
    );
  if (type === "short_answer") return <div className="short-answer-line" />;
  return (
    <div className="answer-lines">
      {Array.from({ length: question.space }, (_, index) => (
        <div key={index} />
      ))}
    </div>
  );
}

export function ExamPaper({
  title,
  content,
  page,
  answers,
  onAnswer,
  items,
  highlight,
}) {
  const pages = page
    ? [page]
    : [...new Set(content.questions.map((q) => q.page))].sort((a, b) => a - b);
  return (
    <>
      {pages.map((p) => (
        <article key={p} className="exam-paper">
          <div className="exam-brand">
            REVISION CLUB <span>PRACTICE PAPER</span>
          </div>
          <h2>{title}</h2>
          <div className="exam-meta">
            <span>{content.duration || 30} minutes</span>
            <span>
              {content.questions.reduce((n, q) => n + q.marks, 0)} marks
            </span>
          </div>
          <p className="exam-instructions">{content.instructions}</p>
          {content.questions
            .filter((q) => q.page === p)
            .map((q) => {
              const item = items?.find((i) => i.question_id === q.id);
              const answerValue = item?.answer || answers?.[q.id] || "";
              const answerIndex = (q.options || []).indexOf(answerValue);
              const answerLetter = /^[A-Z]$/.test(answerValue)
                ? answerValue
                : answerIndex >= 0
                  ? String.fromCharCode(65 + answerIndex)
                  : "";
              return (
                <section
                  id={"question-" + q.id}
                  key={q.id}
                  className={
                    "exam-question " + (highlight === q.id ? "highlighted" : "")
                  }
                >
                  <div className="question-heading">
                    <strong>
                      {q.id}. {q.text}
                    </strong>
                    {questionType(q) === "mc_single_box" && (
                      <span className="single-answer-box" aria-label={`Answer box for question ${q.id}`}>{answerLetter}</span>
                    )}
                    <span>[{q.marks} marks]</span>
                  </div>
                  {questionType(q) === "comprehension" && q.passage && (
                    <div className="comprehension-box">{q.passage}</div>
                  )}
                  {item ? (
                    <div className="marked-answer">
                      <p>{readableAnswer(item.answer)}</p>
                      <Badge>
                        {item.awarded} / {item.maximum}
                      </Badge>
                    </div>
                  ) : (
                    <QuestionResponse
                      question={q}
                      value={answers?.[q.id] || ""}
                      onChange={
                        onAnswer ? (value) => onAnswer(q.id, value) : null
                      }
                    />
                  )}
                </section>
              );
            })}
          <footer className="exam-footer">
            <span>Revision Club · {title}</span>
            <span>{p}</span>
          </footer>
        </article>
      ))}
    </>
  );
}
export function PaperDetail({ id }) {
  const router = useRouter(),
    { data, error, reload } = useData("papers/" + id),
    { data: dashboard } = useData("dashboard"),
    { data: groups } = useData("groups"),
    [version, setVersion] = useState(""),
    [edit, setEdit] = useState(false),
    [content, setContent] = useState(null),
    [key, setKey] = useState([]),
    [versionKeySource, setVersionKeySource] = useState(
      "Human-provided marking scheme",
    ),
    [message, setMessage] = useState(""),
    [err, setErr] = useState(""),
    [page, setPage] = useState(1);
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  const v = data.versions.find((v) => v.id === version) || data.versions[0],
    owner = data.owner_id === dashboard?.user.id;
  async function action(fn) {
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="TEST PAPERS / MY PAPER"
        title={data.title}
        description={`${data.subject} · Version ${v.number} · ${data.state}`}
      >
        <button className="secondary" onClick={() => window.print()}>
          ↓ Export PDF / Print
        </button>
        <button
          onClick={() =>
            action(async () => {
              const a = await api("attempts", { versionId: v.id });
              router.push("/attempts/" + a.id);
            })
          }
        >
          Attempt paper →
        </button>
      </Heading>
      <ErrorBox error={err} />
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
      <div className="toolbar">
        <select
          aria-label="Paper version"
          value={v.id}
          onChange={(e) => {
            setVersion(e.target.value);
            setEdit(false);
            setPage(1);
          }}
        >
          {data.versions.map((x) => (
            <option value={x.id} key={x.id}>
              Version {x.number}
            </option>
          ))}
        </select>
        <button
          className="secondary"
          onClick={() =>
            action(async () => {
              const url = window.location.href;
              if (navigator.share)
                await navigator.share({ title: data.title, url });
              else await navigator.clipboard.writeText(url);
              setMessage(
                "Link shared. Private papers remain restricted to authorized members.",
              );
            })
          }
        >
          Share / Copy link ↗
        </button>
        {owner && (
          <>
            <button
              className="secondary"
              onClick={() =>
                action(async () => {
                  if (edit) {
                    setEdit(false);
                    return;
                  }
                  const draft = await api("version-draft/" + v.id);
                  setContent(draft?.content || v.content);
                  setKey(draft?.answerKey || v.key?.content || []);
                  setVersionKeySource(
                    draft?.keySource ||
                      v.key?.source ||
                      "Human-provided marking scheme",
                  );
                  setMessage(
                    draft
                      ? "Your saved version edit has been restored."
                      : "Save an edit draft before leaving to keep your changes.",
                  );
                  setEdit(true);
                })
              }
            >
              {edit ? "Close editor" : "Edit new version"}
            </button>
            <button
              className="secondary"
              onClick={() =>
                action(async () => {
                  const r = await api("action", {
                    action: "duplicate",
                    paperId: id,
                  });
                  router.push("/papers/" + r.paperId);
                })
              }
            >
              Duplicate
            </button>
            <button
              className="secondary"
              onClick={() =>
                action(async () => {
                  if (
                    !data.public &&
                    !window.confirm(
                      "Publish this paper to Community Papers? Its questions will be visible to all signed-in students.",
                    )
                  )
                    return;
                  await api("action", {
                    action: "publish",
                    paperId: id,
                    public: !data.public,
                  });
                  reload();
                })
              }
            >
              {data.public ? "Unpublish" : "Publish to community"}
            </button>
          </>
        )}
      </div>
      {edit ? (
        <>
          <PaperEditor
            content={content}
            setContent={setContent}
            answerKey={key}
            setAnswerKey={setKey}
            onRegenerate={async (questionIds) => {
              const next = await api("version-regenerate/" + v.id, {
                content,
                answerKey: key,
                questionIds,
              });
              setVersionKeySource("AI-generated marking scheme");
              setMessage(
                "Regenerated questions saved as a private version edit. Review before saving a new version.",
              );
              return next;
            }}
          />
          <button
            className="secondary"
            onClick={() =>
              action(async () => {
                await api("version-draft/" + v.id, {
                  content,
                  answerKey: key,
                  keySource: versionKeySource,
                });
                setMessage("Version edit draft saved.");
              })
            }
          >
            Save edit draft
          </button>
          <button
            onClick={() =>
              action(async () => {
                const saved = await api("papers", {
                  paperId: id,
                  sourceVersionId: v.id,
                  title: data.title,
                  subject: data.subject,
                  content,
                  answerKey: key.length ? key : null,
                  keySource: versionKeySource,
                });
                setVersion(saved.versionId);
                setMessage(
                  "New version saved. Earlier versions remain unchanged.",
                );
                setEdit(false);
                reload();
              })
            }
          >
            Save new version →
          </button>
        </>
      ) : (
        <div className="paper-detail-layout">
          <div>
            <ExamPaper title={data.title} content={v.content} />
          </div>
          <aside className="stack no-print">
            <section className="card">
              <div className="eyebrow">READY WHEN YOU ARE</div>
              <h2>A paper, with purpose.</h2>
              <p className="muted">
                {v.content.questions.length} questions
                <br />
                {v.content.questions.reduce((n, q) => n + q.marks, 0)} marks
                <br />
                {v.hasKey
                  ? "Marking scheme ready"
                  : "Answer key required before attempting"}
              </p>
              <p className="small muted">
                Use Export, then choose “Save as PDF” in your browser’s print
                dialog. A4 layout is included.
              </p>
            </section>
            {owner && (
              <section className="card">
                <h3>Assign to a study group</h3>
                <ActionForm
                  onSubmit={async (b) => {
                    await api("action", {
                      action: "assign",
                      groupId: b.groupId,
                      versionId: v.id,
                      dueAt: b.dueAt || null,
                    });
                    setMessage("Assignment posted to your group.");
                  }}
                >
                  <label>
                    Study group
                    <select name="groupId" required>
                      <option value="">Choose a group</option>
                      {groups?.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Due date (optional)
                    <input type="datetime-local" name="dueAt" />
                  </label>
                  <button className="full secondary">Assign paper →</button>
                </ActionForm>
              </section>
            )}
            {owner && v.key && (
              <details className="card">
                <summary>Private marking scheme</summary>
                {v.key.content.map((k) => (
                  <div key={k.questionId}>
                    <b>Question {k.questionId}</b>
                    <p>{k.answer}</p>
                    <p className="muted">{k.rubric}</p>
                  </div>
                ))}
              </details>
            )}
            {Boolean(data.public) && !owner && (
              <section className="card">
                <h3>Rate this paper</h3>
                <ActionForm
                  onSubmit={async (b) => {
                    await api("action", {
                      action: "rate",
                      paperId: id,
                      rating: +b.rating,
                    });
                    setMessage("Thank you. Your rating is saved.");
                  }}
                >
                  <label>
                    Rating
                    <select name="rating">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <button className="secondary">Save rating</button>
                </ActionForm>
              </section>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
export function Attempt({ id }) {
  const router = useRouter(),
    { data, error } = useData("attempts/" + id),
    [answers, setAnswers] = useState({}),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [err, setErr] = useState(""),
    [clock, setClock] = useState(() => Date.now()),
    [ready, setReady] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const expired = Boolean(
    data?.quizDeadline && clock >= Date.parse(data.quizDeadline),
  );
  useEffect(() => {
    if (!data?.quizDeadline) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [data?.quizDeadline]);
  useEffect(() => {
    if (
      !ready ||
      data?.id !== id ||
      !data?.quizDeadline ||
      data.submitted_at ||
      busy ||
      expired
    )
      return;
    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => api("answers/" + id, { answers }))
        .then(() => {
          setMessage("Quiz answers autosaved.");
          setErr("");
        })
        .catch((e) => setErr("Answers have not been saved: " + e.message));
    }, 300);
    return () => clearTimeout(timer);
  }, [
    answers,
    ready,
    data?.quizDeadline,
    data?.submitted_at,
    data?.id,
    busy,
    expired,
    id,
  ]);
  useEffect(() => {
    if (!expired || data?.submitted_at) return;
    api("attempts/" + id)
      .then((saved) => setAnswers(saved.answers))
      .catch((e) => setErr(e.message));
  }, [expired, data?.submitted_at, id]);
  useEffect(() => {
    if (data) {
      setAnswers(data.answers);
      setReady(true);
    }
  }, [data]);
  useEffect(() => {
    const fn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, []);
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  return (
    <>
      <Heading
        eyebrow="YOUR FOCUS SESSION"
        title={data.title}
        description={
          data.quizDeadline
            ? "Quick Quiz · five minutes. Answers autosave while you work; only answers saved before time runs out are marked."
            : "Take your time. Show your working. Every attempt is a step forward."
        }
      />
      <ErrorBox error={err} />
      {data.quizDeadline && !data.submitted_at && (
        <div className="notice" role="timer" aria-label="Quiz time remaining">
          {expired
            ? "Time is up. Submit your saved answers for marking."
            : `${Math.floor(Math.max(0, Date.parse(data.quizDeadline) - clock) / 60000)}:${String(Math.floor(Math.max(0, Date.parse(data.quizDeadline) - clock) / 1000) % 60).padStart(2, "0")} remaining`}
        </div>
      )}
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
      {data.submitted_at ? (
        <Empty
          title="This attempt is complete."
          href="/results"
          label="See your results"
        />
      ) : (
        <>
          <div className="toolbar">
            <Badge>{data.subject}</Badge>
            <span>
              {Object.values(answers).filter((x) => x.trim()).length} /{" "}
              {data.content.questions.length} answered
            </span>
            <button
              className="secondary"
              disabled={busy || expired}
              onClick={async () => {
                try {
                  await saveQueue.current;
                  await api("answers/" + id, { answers });
                  setMessage("Draft answers saved.");
                } catch (e) {
                  setErr(e.message);
                }
              }}
            >
              Save draft
            </button>
          </div>
          <fieldset disabled={!ready || busy || expired}>
            <ExamPaper
              title={data.title}
              content={data.content}
              answers={answers}
              onAnswer={(q, a) => setAnswers((x) => ({ ...x, [q]: a }))}
            />
          </fieldset>
          <div className="sticky-actions">
            <span className="muted">Submitting locks this attempt.</span>
            <button
              disabled={busy}
              onClick={async () => {
                if (
                  !window.confirm(
                    "Submit this attempt for marking? You cannot edit answers after submission.",
                  )
                )
                  return;
                setBusy(true);
                setErr("");
                try {
                  await saveQueue.current;
                  const r = await api("submit/" + id, { answers });
                  router.push("/results/" + r.id);
                } catch (e) {
                  setErr(e.message);
                  setBusy(false);
                }
              }}
            >
              {busy ? "Checking your answers…" : "Submit for marking →"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
