"use client";
import { useEffect, useState } from "react";
import rules from "@/lib/club/rules.cjs";
import {
  api,
  useData,
  Loading,
  Heading,
  Empty,
  ErrorBox,
  Badge,
  DateText,
  ActionForm,
} from "./ui";
function dateKey(value) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function localInput(value) {
  const d = new Date(value);
  return (
    dateKey(d) +
    "T" +
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}
export function Timetable() {
  const [clock, setClock] = useState(0),
    [date, setDate] = useState(""),
    [mode, setMode] = useState("List"),
    [editing, setEditing] = useState(null),
    [editingExam, setEditingExam] = useState(null),
    [suggestion, setSuggestion] = useState(null);
  useEffect(() => {
    setClock(Date.now());
    setDate(dateKey(Date.now()));
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const { data, error, reload } = useData("dashboard"),
    [view, setView] = useState("Upcoming"),
    [subject, setSubject] = useState("All subjects"),
    [err, setErr] = useState("");
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  const missed = (s) =>
    !s.started_at &&
    !s.completed_at &&
    Date.parse(s.starts_at) + s.duration * 60000 < clock;
  const sessions = data.sessions
    .filter(
      (s) =>
        (subject === "All subjects" || s.subject === subject) &&
        (view === "All sessions" ||
          (view === "Completed"
            ? s.completed_at
            : view === "Missed"
              ? missed(s)
              : !s.completed_at)),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const anchor = new Date((date || dateKey(clock)) + "T12:00:00");
  const monday = new Date(anchor);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  async function act(action, id) {
    setErr("");
    try {
      await api("action", { action, id });
      await reload();
    } catch (e) {
      setErr(e.message);
    }
  }
  function card(s) {
    return (
      <section className="card" key={s.id}>
        <div className="section-heading">
          <Badge>{s.subject}</Badge>
          <span className="small muted">
            <DateText value={s.starts_at} />
          </span>
        </div>
        <h2>{s.title}</h2>
        <p>
          {s.topic} · {s.duration} minutes · {s.recurrence}
        </p>
        <p className="muted">{s.notes}</p>
        {s.completed_at ? (
          <Badge>Completed ✓</Badge>
        ) : (
          <>
            <p className="small muted">
              {missed(s)
                ? "Missed planned start — you can still revise."
                : s.started_at
                  ? "Focus session started. Complete it after the planned duration."
                  : "In-app reminders appear five minutes before a session while the app is open."}
            </p>
            <div className="actions">
              <button
                className="secondary"
                disabled={
                  s.started_at
                    ? clock < Date.parse(s.started_at) + s.duration * 60000
                    : Date.parse(s.starts_at) > clock + 300000
                }
                onClick={() =>
                  act(s.started_at ? "sessionComplete" : "sessionStart", s.id)
                }
              >
                {s.started_at
                  ? "Complete session · +20 XP"
                  : "Start focus session →"}
              </button>
              {!s.started_at && (
                <>
                  <button
                    className="secondary"
                    aria-label={"Edit " + s.title}
                    onClick={() => setEditing(s)}
                  >
                    Edit
                  </button>
                  {s.series_id && (
                    <button
                      className="secondary"
                      aria-label={"Delete recurring series " + s.title}
                      onClick={() => {
                        if (confirm("Delete every unstarted session in this recurring series?"))
                          act("sessionDeleteSeries", s.id);
                      }}
                    >
                      Delete series
                    </button>
                  )}
                  <button
                    className="secondary"
                    aria-label={"Delete " + s.title}
                    onClick={() => {
                      if (confirm("Delete this planned session?"))
                        act("sessionDelete", s.id);
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </section>
    );
  }
  function shift(direction) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + direction * (mode === "Week" ? 7 : 1));
    setDate(dateKey(d));
  }
  const visible =
    mode === "Day"
      ? sessions.filter((s) => dateKey(s.starts_at) === date)
      : sessions;
  return (
    <>
      <Heading
        title="Give your focus a place."
        eyebrow="STUDY / TIMETABLE"
        description="A plan that works around your life, one session at a time."
      />
      <ErrorBox error={err} />
      <section className="card spaced">
        <div className="section-heading">
          <div>
            <div className="eyebrow">UPCOMING EXAMS</div>
            <h2>Plan backwards from the date.</h2>
          </div>
        </div>
        <div className="exam-planner">
          <div>
            {data.exams.length ? data.exams.map((exam) => (
              <div className="list-row" key={exam.id}>
                <span>
                  <b>{exam.title}</b>
                  <small>{exam.subject} · <DateText value={exam.starts_at} /></small>
                  {exam.notes && <small>{exam.notes}</small>}
                </span>
                <div className="actions">
                  <button className="secondary" onClick={() => setEditingExam(exam)}>Edit</button>
                  <button className="secondary" onClick={async () => {
                    await api("action", { action: "examDelete", id: exam.id });
                    reload();
                  }}>Delete</button>
                </div>
              </div>
            )) : <p className="muted">Add an exam date to bring it into your dashboard and revision recommendations.</p>}
          </div>
          <ActionForm
            key={editingExam?.id || "new-exam"}
            onSubmit={async (b, form) => {
              await api("action", {
                action: editingExam ? "examUpdate" : "examCreate",
                id: editingExam?.id,
                ...b,
                startsAt: new Date(b.startsAt).toISOString(),
              });
              form.reset();
              setEditingExam(null);
              reload();
            }}
          >
            <label>Exam name<input name="title" required maxLength={160} defaultValue={editingExam?.title || ""} /></label>
            <label>Subject<select name="subject" defaultValue={editingExam?.subject || "Maths"}>{rules.SUBJECTS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Date and time<input name="startsAt" type="datetime-local" required defaultValue={editingExam ? localInput(editingExam.starts_at) : ""} /></label>
            <label>Notes<textarea name="notes" defaultValue={editingExam?.notes || ""} /></label>
            <button className="secondary">{editingExam ? "Save exam" : "Add exam"}</button>
            {editingExam && <button type="button" className="secondary" onClick={() => setEditingExam(null)}>Cancel</button>}
          </ActionForm>
        </div>
      </section>
      {!!data.suggestions?.length && (
        <section className="card spaced">
          <h2>Suggested focus</h2>
          <p className="muted">
            These topics have confirmed mistakes to revisit and no upcoming
            session planned. Choose a suggestion, then pick a time.
          </p>
          {data.suggestions.map((item) => (
            <div className="list-row" key={item.id}>
              <span>
                <b>
                  {item.subject} · {item.topic}
                </b>
                <small>{item.reason}</small>
              </span>
              <button
                className="secondary"
                onClick={() => {
                  setEditing(null);
                  setSuggestion(item);
                }}
              >
                Plan {item.topic}
              </button>
            </div>
          ))}
        </section>
      )}
      <div className="toolbar">
        <select
          aria-label="Timetable view"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option>List</option>
          <option>Week</option>
          <option>Day</option>
        </select>
        <select
          aria-label="Session filter"
          value={view}
          onChange={(e) => setView(e.target.value)}
        >
          {["Upcoming", "Missed", "Completed", "All sessions"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Subject filter"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option>All subjects</option>
          {rules.SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {mode !== "List" && (
          <>
            <button
              className="secondary"
              aria-label="Previous period"
              onClick={() => shift(-1)}
            >
              ←
            </button>
            <input
              aria-label="Timetable date"
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
            <button
              className="secondary"
              aria-label="Next period"
              onClick={() => shift(1)}
            >
              →
            </button>
            <button
              className="secondary"
              onClick={() => setDate(dateKey(Date.now()))}
            >
              Today
            </button>
          </>
        )}
      </div>
      {mode === "Week" && (
        <div className="week-calendar" aria-label="Weekly timetable">
          {days.map((d) => (
            <section className="calendar-day" key={dateKey(d)}>
              <button
                className="calendar-day-title"
                onClick={() => {
                  setDate(dateKey(d));
                  setMode("Day");
                }}
              >
                {d.toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </button>
              {sessions
                .filter((s) => dateKey(s.starts_at) === dateKey(d))
                .map((s) => (
                  <button
                    className="calendar-session"
                    key={s.id}
                    onClick={() => {
                      setDate(dateKey(d));
                      setMode("Day");
                    }}
                  >
                    <span>
                      {new Date(s.starts_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <strong>{s.title}</strong>
                    <span>
                      {s.subject} · {s.duration} min
                    </span>
                    <span>
                      {s.completed_at
                        ? "Completed"
                        : missed(s)
                          ? "Missed"
                          : s.started_at
                            ? "In progress"
                            : "Planned"}
                    </span>
                  </button>
                ))}
              {!sessions.some((s) => dateKey(s.starts_at) === dateKey(d)) && (
                <p className="small muted">No sessions</p>
              )}
            </section>
          ))}
        </div>
      )}
      <div className="create-layout">
        <section className="stack">
          {mode !== "Week" ? (
            visible.length ? (
              visible.map(card)
            ) : (
              <Empty title="No sessions in this view.">
                Choose another date or plan some revision.
              </Empty>
            )
          ) : (
            <section className="card">
              <h2>Your week at a glance.</h2>
              <p className="muted">
                Select a day to see its agenda and session controls. Dates and
                times use your device’s timezone.
              </p>
            </section>
          )}
        </section>
        <aside className="card">
          <h2>{editing ? "Edit your session" : "Plan a session"}</h2>
          <ActionForm
            key={editing?.id || suggestion?.id || "new"}
            onSubmit={async (b, form) => {
              await api("action", {
                action: editing ? "sessionUpdate" : "sessionCreate",
                ...b,
                id: editing?.id,
                startsAt: new Date(b.startsAt).toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                applyToSeries: b.applyToSeries === "on",
              });
              form.reset();
              setEditing(null);
              setSuggestion(null);
              reload();
            }}
          >
            <label>
              Session title
              <input
                name="title"
                placeholder="A little algebra practice"
                required
                maxLength={160}
                defaultValue={editing?.title || suggestion?.title || ""}
              />
            </label>
            {editing?.series_id && (
              <label className="check">
                <input name="applyToSeries" type="checkbox" />
                Apply the time, duration and details to this and future sessions in the series
              </label>
            )}
            <label>
              Subject
              <select
                name="subject"
                defaultValue={
                  editing?.subject || suggestion?.subject || "Maths"
                }
              >
                {rules.SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Topic
              <input
                name="topic"
                maxLength={100}
                defaultValue={editing?.topic || suggestion?.topic || ""}
              />
            </label>
            <label>
              Date &amp; time
              <input
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={editing ? localInput(editing.starts_at) : ""}
              />
            </label>
            <label>
              Duration (minutes)
              <input
                name="duration"
                type="number"
                min={10}
                max={180}
                defaultValue={editing?.duration || 20}
              />
            </label>
            <label>
              Repeat
              <select
                name="recurrence"
                defaultValue={editing?.recurrence || "None"}
              >
                <option>None</option>
                <option>Weekly</option>
              </select>
            </label>
            <label>
              Notes
              <textarea
                name="notes"
                defaultValue={editing?.notes || suggestion?.reason || ""}
              />
            </label>
            <button className="full">
              {editing ? "Save session changes" : "Add to my timetable →"}
            </button>
            {editing && (
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(null)}
              >
                Cancel editing
              </button>
            )}
          </ActionForm>
        </aside>
      </div>
    </>
  );
}
