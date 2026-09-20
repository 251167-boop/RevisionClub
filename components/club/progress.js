"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Level,
  DateText,
  ActionForm,
} from "./ui";
import { ExamPaper } from "./papers";
const { SUBJECTS, ACHIEVEMENTS } = rules;
export function Dashboard() {
  const { data, error } = useData("dashboard"),
    [breakdown, setBreakdown] = useState(false);
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  const s = data.stats,
    nextFocus = data.suggestions?.[0],
    activeChallenges = data.battles.filter((item) => !["Completed", "Declined"].includes(item.status)),
    todaySessions = data.sessions.filter((item) => item.starts_at.slice(0, 10) === new Date().toISOString().slice(0, 10)),
    nextExam = data.exams[0];
  return (
    <>
      <Heading
        eyebrow="LET’S MAKE TODAY COUNT"
        title={`A little better, ${data.user.username}.`}
        description="Your space to focus, practise, and see how far you’ve come."
      >
        <span className="date-label">
          {new Date().toLocaleDateString([], {
            weekday: "short",
            day: "numeric",
            month: "long",
          })}
        </span>
      </Heading>
      <div className="dashboard-top">
        <section className="focus-card">
          <div>
            <div className="eyebrow">YOUR NEXT CHAPTER</div>
            <h2>
              Turn what you know
              <br />
              into what you <em>understand.</em>
            </h2>
            <p>
              Bring your notes. Make a paper.
              <br />
              Find your next breakthrough.
            </p>
            <Link className="button light" href="/papers/create">
              Create a practice paper <span>↗</span>
            </Link>
          </div>
          <div className="focus-side">
            <span className="focus-symbol">✦</span>
            <small>
              A LITTLE PRACTICE
              <br />
              GOES A LONG WAY
            </small>
          </div>
        </section>
        <section className="card level-card">
          <div className="section-heading">
            <span className="eyebrow">YOUR JOURNEY</span>
            <Badge>{s.league}</Badge>
          </div>
          <div className="level-summary">
            <Level level={s.level} league={s.league} />
            <div>
              <h2>Level {s.level}</h2>
              <p className="muted">Keep showing up.</p>
            </div>
          </div>
          <div className="xp-label">
            <span>{s.xp.toLocaleString()} XP</span>
            <span>{s.next.toLocaleString()} XP</span>
          </div>
          <progress value={s.percent} max="100" />
          <p className="small muted">
            {s.level === 50
              ? "You’ve reached the summit."
              : `${s.next - s.xp} XP to your next level`}
          </p>
          <Link className="text-link" href="/profile">
            View your progress →
          </Link>
        </section>
      </div>
      <div className="stats-grid">
        <section className="stat-card">
          <span>♨ Revision streak</span>
          <strong>
            {s.streak}
            <small> days</small>
          </strong>
          <p>Build a habit that stays.</p>
        </section>
        <section className="stat-card">
          <span>▤ Tests completed</span>
          <strong>{s.tests}</strong>
          <p>Every attempt counts.</p>
        </section>
        <Link className="stat-card" href="/study">
          <span>
            ◎ Average score <span>View progress ↗</span>
          </span>
          <strong>{s.average === null ? "—" : s.average + "%"} </strong>
          <p>
            {s.trend === null
              ? "Complete more papers to reveal a trend"
              : `${s.trend >= 0 ? "↑" : "↓"} ${Math.abs(s.trend)} points across your latest papers`}
          </p>
        </Link>
        <section className="stat-card">
          <span>✦ Achievements</span>
          <strong>
            {data.achievements.length}
            <small> / {ACHIEVEMENTS.length}</small>
          </strong>
          <p>Small wins. Lasting progress.</p>
        </section>
      </div>
      <section className="card today-card">
        <div className="section-heading">
          <div><div className="eyebrow">TODAY, AT YOUR PACE</div><h2>A simple plan for a focused day.</h2></div>
          <Link className="text-link" href="/timetable">Plan your day ↗</Link>
        </div>
        <div className="today-grid">
          <section className="today-item">
            <span className="today-icon">◷</span><small>Next session</small>
            {todaySessions[0] ? <><b>{todaySessions[0].title}</b><p>{todaySessions[0].subject} · <DateText value={todaySessions[0].starts_at} /></p></> : <><b>Nothing scheduled yet.</b><p>Make room for your next revision block.</p></>}
            <Link className="text-link" href="/timetable">Open timetable →</Link>
          </section>
          <section className="today-item">
            <span className="today-icon">▤</span><small>Recommended activity</small>
            {nextFocus ? <><b>Revise {nextFocus.topic}</b><p>{nextFocus.reason}</p></> : activeChallenges[0] ? <><b>{activeChallenges[0].title}</b><p>{activeChallenges[0].status} challenge waiting for you.</p></> : <><b>Create a practice paper.</b><p>A focused paper is a good next step.</p></>}
            <Link className="text-link" href={nextFocus ? "/timetable" : activeChallenges[0] ? "/challenges" : "/papers/create"}>{nextFocus ? "Plan revision" : activeChallenges[0] ? "Open challenge" : "Create paper"} →</Link>
          </section>
          <section className="today-item">
            <span className="today-icon">▣</span><small>Upcoming exam</small>
            {nextExam ? <><b>{nextExam.title}</b><p>{nextExam.subject} · <DateText value={nextExam.starts_at} /></p></> : <><b>No exam dates yet.</b><p>Add one when you are ready to plan ahead.</p></>}
            <Link className="text-link" href="/timetable">{nextExam ? "View exam plan" : "Add an exam"} →</Link>
          </section>
        </div>
      </section>
      <div className="dashboard-summary-grid">
        <section className="card dashboard-summary">
          <div className="section-heading">
            <h2>Recent papers.</h2><Link className="text-link" href="/papers">View all ↗</Link>
          </div>
          {data.papers.length ? data.papers.slice(0, 2).map((paper) => <Link className="list-row" href={`/papers/${paper.id}`} key={paper.id}><span><b>{paper.title}</b><small>{paper.subject} · {paper.duration || 30} min</small></span><span>→</span></Link>) : <p className="muted">Your most recent practice papers will appear here.</p>}
        </section>
        <section className="card dashboard-summary">
          <div className="section-heading">
            <h2>Recent mistakes.</h2>
            <Link href="/mistakes" className="text-link">
              View all ↗
            </Link>
          </div>
          {data.mistakes.length ? (
            data.mistakes.slice(0, 2).map((m) => (
              <Link
                className="list-row"
                href={"/results/" + m.marking_id}
                key={m.id}
              >
                <span>
                  <b>{m.subject}</b>
                  <small>
                    {m.topic} · Question {m.question_id}
                  </small>
                </span>
                <span>↗</span>
              </Link>
            ))
          ) : (
            <p className="muted">
              Mistakes are part of learning. Your review list will appear after
              your first marked paper.
            </p>
          )}
        </section>
        <section className="card dashboard-summary">
          <div className="section-heading">
            <h2>Your study group.</h2>
            <Link href="/groups" className="text-link">
              View all ↗
            </Link>
          </div>
          {data.groups.length ? (
            data.groups.slice(0, 2).map((g) => (
              <Link className="list-row" key={g.id} href={"/groups/" + g.id}>
                <b>{g.name}</b>
                <Badge>{g.members} members</Badge>
              </Link>
            ))
          ) : (
            <p className="muted">
              Bring your study circle together. Share papers, compare progress,
              and help each other improve.
            </p>
          )}
          {data.friends[0] && <Link className="list-row" href="/friends"><span><b>{data.friends[0].username}</b><small>{data.friends[0].league} · Level {data.friends[0].level}</small></span><strong>{data.friends[0].value} XP</strong></Link>}
        </section>
      </div>
    </>
  );
}
export function SubjectBars({ subjects }) {
  return (
    <div className="subject-bars">
      {subjects.map((s) => (
        <div key={s.subject}>
          <span>{s.subject}</span>
          <progress value={s.average || 0} max={100} />
          <b>{s.average === null ? "—" : s.average + "%"}</b>
        </div>
      ))}
    </div>
  );
}
export function Results({ id }) {
  const { data, error, reload } = useData("results" + (id ? "/" + id : "")),
    { data: dash } = useData("dashboard"),
    [highlight, setHighlight] = useState(""),
    [err, setErr] = useState("");
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  if (!id)
    return (
      <>
        <Heading
          title="See what’s clicking."
          eyebrow="TEST PAPERS / RESULTS"
          description="Every result is a starting point for your next improvement."
        />
        {data.length ? (
          <div className="card">
            {data.map((r) => (
              <Link key={r.id} className="list-row" href={"/results/" + r.id}>
                <span>
                  <b>{r.title}</b>
                  <small>
                    {r.subject} · <DateText value={r.submitted_at} />
                  </small>
                </span>
                <strong>
                  {r.score} / {r.maximum} <span className="muted">↗</span>
                </strong>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title="Your progress starts with an attempt."
            href="/papers"
            label="Choose a paper"
          />
        )}
      </>
    );
  const owner = data.owner_id === dash?.user.id,
    student = data.user_id === dash?.user.id;
  return (
    <>
      <Heading
        eyebrow="RESULTS / MARKING REVIEW"
        title={data.title}
        description={data.source}
      >
        <Badge>
          {data.score} / {data.maximum} ·{" "}
          {Math.round((data.score / data.maximum) * 100)}%
        </Badge>
      </Heading>
      <ErrorBox error={err} />
      {data.items.some((i) => i.confidence === "Low") && (
        <div className="notice">
          Some marks are provisional or low-confidence. Review the explanations
          and ask the creator to check disputed answers.
        </div>
      )}
      <div className="review-layout">
        <div>
          <ExamPaper
            title={data.title}
            content={data.content}
            items={data.items}
            highlight={highlight}
          />
        </div>
        <aside className="review-inspector">
          <div className="section-heading">
            <h2>A closer look.</h2>
            <Badge>{data.items.length} questions</Badge>
          </div>
          {data.items.map((i) => (
            <section
              className={
                "card mistake-card " +
                (i.question_id === highlight ? "selected" : "")
              }
              key={i.id}
            >
              <button
                className="question-jump"
                onClick={() => {
                  setHighlight(i.question_id);
                  document
                    .getElementById("question-" + i.question_id)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              >
                <b>Question {i.question_id}</b>
                <Badge>
                  {i.awarded} / {i.maximum}
                </Badge>
              </button>
              <small className="muted">
                {i.maximum - i.awarded} marks deducted · {i.confidence}{" "}
                confidence
              </small>
              <label>Your answer</label>
              <p>{i.answer || "(No answer)"}</p>
              <label>Expected answer</label>
              <p>{i.correct}</p>
              <label>Explanation</label>
              <p className="muted">{i.explanation}</p>
              {i.challenge ? (
                <div className="challenge-box">
                  <Badge>{i.challenge.status}</Badge>
                  <p>{i.challenge.reason || "Please review this marking."}</p>
                  {owner && i.challenge.status !== "Resolved" && (
                    <ActionForm
                      onSubmit={async (b) => {
                        const mark = Number(b.mark);
                        let confirmReduction = false;
                        if (mark < i.awarded) {
                          confirmReduction = window.confirm(
                            `This will change the student's score from ${data.score}/${data.maximum} to ${data.score - i.awarded + mark}/${data.maximum}. Continue?`,
                          );
                          if (!confirmReduction) return;
                        }
                        await api("resolve", {
                          challengeId: i.challenge.id,
                          mark,
                          reason: b.reason,
                          confirmReduction,
                        });
                        reload();
                      }}
                    >
                      <label>
                        Revised mark
                        <input
                          name="mark"
                          type="number"
                          step="0.5"
                          min={0}
                          max={i.maximum}
                          defaultValue={i.awarded}
                          required
                        />
                      </label>
                      <label>
                        Decision explanation
                        <textarea name="reason" required maxLength={3000} />
                      </label>
                      <button className="full">Resolve challenge</button>
                    </ActionForm>
                  )}
                </div>
              ) : (
                student && (
                  <details>
                    <summary className="text-link">
                      Challenge marking ↗
                    </summary>
                    <ActionForm
                      onSubmit={async (b) => {
                        await api("challenge", {
                          itemId: i.id,
                          reason: b.reason,
                        });
                        reload();
                      }}
                    >
                      <label>
                        Why should this be reviewed?
                        <textarea name="reason" maxLength={3000} />
                      </label>
                      <button className="secondary full">
                        Send to paper creator
                      </button>
                    </ActionForm>
                  </details>
                )
              )}
              {i.history.length > 0 && (
                <details>
                  <summary>Marking audit history</summary>
                  {i.history.map((h) => (
                    <p key={h.id} className="small">
                      <b>
                        {h.old_mark} → {h.new_mark}
                      </b>{" "}
                      · {h.username}
                      <br />
                      {h.reason}
                      <br />
                      <DateText value={h.created_at} />
                    </p>
                  ))}
                </details>
              )}
            </section>
          ))}
        </aside>
      </div>
    </>
  );
}
export function Study() {
  const { data, error } = useData("dashboard"),
    { data: history } = useData("progress"),
    [subjectFilter, setSubjectFilter] = useState("All subjects"),
    [stateFilter, setStateFilter] = useState("All states"),
    [topicQuery, setTopicQuery] = useState("");
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  return (
    <>
      <Heading
        title="A clearer picture."
        eyebrow="STUDY / SUBJECT PROGRESS"
        description="Your official subjects, all in one place. Averages come from your marked attempts."
      />
      <div className="toolbar">
        <select aria-label="Progress subject" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
          <option>All subjects</option>
          {SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}
        </select>
        <select aria-label="Mastery state" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
          {['All states','Unstarted','Learning','Practising','Proficient','Mastered'].map((state) => <option key={state}>{state}</option>)}
        </select>
        <input aria-label="Search progress topics" type="search" placeholder="Filter topic…" value={topicQuery} onChange={(event) => setTopicQuery(event.target.value)} />
      </div>
      <div className="subject-grid">
        {data.stats.subjects
          .filter((s) => subjectFilter === "All subjects" || s.subject === subjectFilter)
          .filter((s) => stateFilter === "All states" || (s.count ? "Practising" : "Unstarted") === stateFilter || data.topics.some((topic) => topic.subject === s.subject && topic.state === stateFilter))
          .map((s) => (
          <section className="card" key={s.subject}>
            <div className="section-heading">
              <span className="subject-icon">◎</span>
              <Badge>{s.count ? "Practising" : "Unstarted"}</Badge>
            </div>
            <h2>{s.subject}</h2>
            <strong className="subject-score">
              {s.average === null ? "—" : s.average + "%"}
            </strong>
            <p className="muted">{s.count} completed papers</p>
            <progress value={s.average || 0} max={100} />
            <Link className="text-link" href="/papers/create">
              Make time for practice →
            </Link>
            {data.topics
              ?.filter((t) => t.subject === s.subject)
              .filter((t) => stateFilter === "All states" || t.state === stateFilter)
              .filter((t) => t.topic.toLowerCase().includes(topicQuery.toLowerCase()))
              .map((t) => (
                <details className="topic-history" key={t.topic}>
                  <summary className="list-row">
                    <span>
                      <b>{t.topic}</b>
                      <small>{t.questions} questions · {t.successful_papers} successful papers · {Math.round(t.average)}%</small>
                    </span>
                    <Badge>{t.state}</Badge>
                  </summary>
                  <div className="history-list">
                    {history?.topics
                      .filter((item) => item.subject === t.subject && item.topic === t.topic)
                      .slice(0, 12)
                      .map((item, index) => (
                        <div className="list-row" key={`${item.submitted_at}-${index}`}>
                          <span><DateText value={item.submitted_at} /></span>
                          <strong>{item.score} / {item.maximum} · {item.percent}%</strong>
                        </div>
                      ))}
                  </div>
                </details>
              ))}
          </section>
        ))}
      </div>
    </>
  );
}
export function Mistakes() {
  const { data, error, reload } = useData("mistakes"),
    [subject, setSubject] = useState("All subjects"),
    [show, setShow] = useState(false);
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  const rows = data.filter(
    (m) =>
      (subject === "All subjects" || m.subject === subject) &&
      (!show || !m.corrected_at),
  );
  return (
    <>
      <Heading
        title="Mistakes worth making."
        eyebrow="STUDY / YOUR SECOND CHANCE"
        description="Understand the gap, try again, and turn a mistake into progress."
      />
      <div className="toolbar">
        <select
          aria-label="Filter subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option>All subjects</option>
          {SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
          />
          Only unresolved
        </label>
      </div>
      {rows.length ? (
        <div className="subject-grid">
          {rows.map((m) => (
            <section className="card" key={m.id}>
              <Badge>
                {m.subject} · {m.topic}
              </Badge>
              <h3>{m.question.text}</h3>
              <p className="muted">{m.explanation}</p>
              {m.corrected_at ? (
                <Badge>Corrected ✓</Badge>
              ) : (
                <ActionForm
                  onSubmit={async (b) => {
                    await api("action", {
                      action: "mistakeCorrect",
                      id: m.id,
                      answer: b.answer,
                    });
                    reload();
                  }}
                >
                  <label>
                    Try the answer again
                    <textarea name="answer" required />
                  </label>
                  <button className="secondary">Check answer · +20 XP</button>
                </ActionForm>
              )}
              <Link className="text-link" href={"/results/" + m.marking_id}>
                Review original marking →
              </Link>
            </section>
          ))}
        </div>
      ) : (
        <Empty title="A clean slate." href="/papers" label="Find a paper">
          Incorrect answers from your marked papers will appear here.
        </Empty>
      )}
    </>
  );
}
export function Profile({ settings = false }) {
  const { data, error, reload } = useData("profile"),
    { data: dash } = useData("dashboard"),
    [avatarMessage, setAvatarMessage] = useState("");
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  return (
    <>
      <Heading
        title={
          settings
            ? "Make yourself at home."
            : `${dash?.user.username || "Your"}’s journey.`
        }
        eyebrow={settings ? "SETTINGS" : "PROFILE / PROGRESS"}
      />
      <div className="dashboard-top">
        <section className="card">
          <div className="profile-avatar">
            <span className="avatar avatar-large">
              {data.user.avatar_url ? (
                <Image unoptimized width={76} height={76} src={data.user.avatar_url} alt="Your avatar" />
              ) : (
                data.user.username?.[0]?.toUpperCase()
              )}
            </span>
            <label className="button secondary">
              Change avatar
              <input
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 300000) {
                    setAvatarMessage("Choose an image smaller than 300 KB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = async () => {
                    try {
                      await api("action", {
                        action: "profileAvatar",
                        avatar: reader.result,
                      });
                      setAvatarMessage("Avatar saved. Refreshing other open pages will show it there too.");
                      reload();
                    } catch (e) {
                      setAvatarMessage(e.message);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {data.user.avatar_url && (
              <button
                className="secondary"
                onClick={async () => {
                  await api("action", { action: "profileAvatar", avatar: "" });
                  reload();
                }}
              >
                Remove avatar
              </button>
            )}
          </div>
          {avatarMessage && <p role="status">{avatarMessage}</p>}
          <Level level={data.level} league={data.league} />
          <h2>
            Level {data.level} · {data.league}
          </h2>
          <p>{data.xp} XP earned</p>
          <progress value={data.percent} max={100} />
          <p className="muted">
            {data.tests} papers completed · {data.streak}-day streak
          </p>
        </section>
        <section className="card">
          <h2>Your details</h2>
          <ActionForm
            onSubmit={async (b) => {
              await api("action", { action: "profile", ...b });
              reload();
            }}
          >
            <label>
              School
              <input
                name="school"
                defaultValue={data.profile.school}
                maxLength={100}
              />
            </label>
            <label>
              About you
              <textarea
                name="bio"
                defaultValue={data.profile.bio}
                maxLength={500}
              />
            </label>
            <button className="secondary">Save profile</button>
          </ActionForm>
        </section>
      </div>
      {settings && (
        <section className="card spaced">
          <h2>Notification preferences</h2>
          <p className="muted">Choose which useful updates appear in your notification center.</p>
          <ActionForm
            onSubmit={async (b) => {
              await api("action", {
                action: "notificationPreferences",
                studyReminders: b.studyReminders === "on",
                socialUpdates: b.socialUpdates === "on",
                achievementUpdates: b.achievementUpdates === "on",
              });
              reload();
            }}
          >
            <label className="check">
              <input name="studyReminders" type="checkbox" defaultChecked={!!data.preferences.study_reminders} />
              Study-session reminders
            </label>
            <label className="check">
              <input name="socialUpdates" type="checkbox" defaultChecked={!!data.preferences.social_updates} />
              Group, friend and challenge updates
            </label>
            <label className="check">
              <input name="achievementUpdates" type="checkbox" defaultChecked={!!data.preferences.achievement_updates} />
              Achievement and streak updates
            </label>
            <button className="secondary">Save notification preferences</button>
          </ActionForm>
        </section>
      )}
      <h2 className="spaced">Little milestones. Big meaning.</h2>
      <div className="achievement-grid">
        {ACHIEVEMENTS.map((a) => {
          const earned = data.achievements.find((x) => x.achievement === a.id);
          return (
            <section
              key={a.id}
              className={"card achievement " + (earned ? "unlocked" : "locked")}
            >
              <span>{a.icon}</span>
              <Badge>{a.rarity}</Badge>
              <h3>{a.title}</h3>
              <p className="muted">{a.description}</p>
              <small>
                {earned ? (
                  <>
                    Unlocked <DateText value={earned.unlocked_at} />
                  </>
                ) : (
                  "Keep going · Not unlocked yet"
                )}
              </small>
            </section>
          );
        })}
      </div>
    </>
  );
}
