"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GroupSettings from "./group-settings";
import rules from "@/lib/club/rules.cjs";
import {
  api,
  useData,
  Loading,
  Heading,
  Empty,
  ErrorBox,
  Badge,
  Level,
  DateText,
  ActionForm,
} from "./ui";
const { SUBJECTS } = rules;
function useReadMessages(groupId, recipientId, messageId, enabled, onError) {
  useEffect(() => {
    if (!enabled || !messageId) return;
    let active = true;
    const mark = () => {
      if (document.visibilityState !== "visible") return;
      api("action", {
        action: "messageRead",
        groupId,
        recipientId,
        messageId,
      }).catch((e) => {
        if (active) onError(e.message);
      });
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", mark);
    };
  }, [groupId, recipientId, messageId, enabled, onError]);
}
const matchesMessage = (message, search) =>
  [message.body, message.username, message.paper?.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(search.trim().toLowerCase());
export function Groups({ id, assignmentsOnly = false }) {
  const router = useRouter(),
    { data, error, reload } = useData("groups" + (id ? "/" + id : "")),
    { data: dash } = useData("dashboard"),
    [tab, setTab] = useState(assignmentsOnly ? "Assignments" : "Chat"),
    [messageSearch, setMessageSearch] = useState(""),
    [olderGroupMessages, setOlderGroupMessages] = useState([]),
    [groupHasMore, setGroupHasMore] = useState(true),
    [err, setErr] = useState("");
  useReadMessages(
    id,
    null,
    data?.messages?.at(-1)?.id,
    !!id && tab === "Chat" && !messageSearch,
    setErr,
  );
  useEffect(() => {
    if (!id) return;
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, [id, reload]);
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
          title="Find your study circle."
          eyebrow="SOCIAL / STUDY GROUPS"
          description="Share the work. Ask the questions. Grow together."
        />
        <div className="dashboard-top">
          <section className="card">
            <h2>Start a study group</h2>
            <ActionForm
              onSubmit={async (b) => {
                const r = await api("action", { action: "groupCreate", ...b });
                router.push("/groups/" + r.id);
              }}
            >
              <label>
                Group name
                <input name="name" required maxLength={100} />
              </label>
              <label>
                Description
                <textarea name="description" maxLength={1000} />
              </label>
              <button>Create group →</button>
            </ActionForm>
          </section>
          <section className="card warm">
            <h2>There’s a place for you.</h2>
            <p className="muted">
              Have an invite code? Join your classmates here.
            </p>
            <ActionForm
              onSubmit={async (b) => {
                const r = await api("action", { action: "groupJoin", ...b });
                router.push("/groups/" + r.id);
              }}
            >
              <label>
                Invite code
                <input name="invite" required />
              </label>
              <button className="secondary">Join group →</button>
            </ActionForm>
          </section>
        </div>
        <div className="subject-grid spaced">
          {data.map((g) => (
            <Link
              key={g.id}
              className="card group-card"
              href={"/groups/" + g.id}
            >
              <span className="avatar large">{g.name[0]}</span>
              <h2>{g.name}</h2>
              {g.unread > 0 && <Badge>{g.unread} unread</Badge>}
              <p className="muted">{g.description}</p>
              <Badge>
                {g.members} members · {g.members >= 3 ? "Active" : "Forming"}
              </Badge>
              <p className="text-link">Open group →</p>
            </Link>
          ))}
        </div>
      </>
    );
  const me = data.members.find((x) => x.id === dash?.user.id),
    admin = data.role !== "Member";
  async function act(b) {
    setErr("");
    try {
      await api("action", b);
      reload();
    } catch (e) {
      setErr(e.message);
    }
  }
  return (
    <>
      <Heading
        title={data.name}
        eyebrow="YOUR STUDY CIRCLE"
        description={`${data.members.length} members · ${data.members.length >= 3 ? "Active group" : "Forming · invite 3 members to activate assignments"}`}
      >
        <button className="secondary" onClick={() => setTab("Dashboard")}>
          View group dashboard ↗
        </button>
      </Heading>
      <div className="tabs">
        {["Chat", "Assignments", "Papers", "Dashboard", "Information"].map(
          (t) => (
            <button
              key={t}
              className={tab === t ? "selected" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ),
        )}
      </div>
      <ErrorBox error={err} />
      {tab === "Chat" ? (
        <section className="chat-layout">
          <aside className="chat-sidebar">
            <div className="eyebrow">IN THIS GROUP</div>
            {data.members.map((m) => (
              <div className="member-row" key={m.id}>
                <span className="avatar">{m.username[0]}</span>
                <div>
                  <b>{m.username}</b>
                  <small>{m.role}</small>
                </div>
                <Level level={m.level} league={m.league} />
              </div>
            ))}
          </aside>
          <div className="chat-main">
            <label>
              Search loaded messages
              <input
                type="search"
                value={messageSearch}
                onChange={(e) => setMessageSearch(e.target.value)}
              />
            </label>
            <div className="chat-messages">
              {(data.messageHasMore || groupHasMore && olderGroupMessages.length > 0) && (
                <button
                  className="secondary load-older"
                  onClick={async () => {
                    const first = olderGroupMessages[0] || data.messages[0];
                    if (!first) return;
                    const page = await api(`messages/0?group=${encodeURIComponent(id)}&before=${first.position}&limit=50`);
                    setOlderGroupMessages((current) => [...page.items, ...current]);
                    setGroupHasMore(page.hasMore);
                  }}
                >
                  Load older messages
                </button>
              )}
              {data.messages.length ? (
                [...olderGroupMessages, ...data.messages]
                  .filter((m) => matchesMessage(m, messageSearch))
                  .map((m) => (
                    <article
                      key={m.id}
                      className={
                        "message " +
                        (m.sender_id === dash?.user.id ? "mine" : "")
                      }
                    >
                      <b>{m.username}</b>
                      <p>{m.body}</p>
                      {m.paper && (
                        <div className="card">
                          <strong>{m.paper.title}</strong>
                          <p className="muted small">
                            {m.paper.marks} marks · {m.paper.duration} mins ·{" "}
                            {m.paper.subject}
                          </p>
                          <p className="small">Created by {m.paper.username}</p>
                          <Link
                            className="button secondary"
                            href={"/papers/" + m.paper.id}
                          >
                            Open paper →
                          </Link>
                        </div>
                      )}
                      {m.paper_id && !m.paper && (
                        <p className="muted small">
                          This shared paper is no longer available to the group.
                        </p>
                      )}
                      <small>
                        <DateText value={m.created_at} />
                      </small>
                    </article>
                  ))
              ) : (
                <Empty title="A good conversation starts here.">
                  Share what you’re working on, or ask your first question.
                </Empty>
              )}
            </div>
            {messageSearch &&
              ![...olderGroupMessages, ...data.messages].some((m) => matchesMessage(m, messageSearch)) && (
                <p className="muted">No matching recent messages.</p>
              )}
            <ActionForm
              className="message-composer"
              onSubmit={async (b, form) => {
                await api("action", {
                  action: "message",
                  groupId: id,
                  body: b.body,
                });
                form.reset();
                reload();
              }}
            >
              <label className="sr-only" htmlFor="message">
                Message
              </label>
              <input
                id="message"
                name="body"
                required
                maxLength={3000}
                placeholder="A question, a thought, a little encouragement…"
              />
              <button>Send ↗</button>
            </ActionForm>
            <ActionForm
              onSubmit={async (b, form) => {
                await api("action", {
                  action: "message",
                  groupId: id,
                  paperId: b.paperId,
                });
                form.reset();
                reload();
              }}
            >
              <label>
                Share an assigned paper
                <select name="paperId" required>
                  <option value="">Choose a group paper</option>
                  {data.assignments
                    .filter(
                      (a, i, rows) =>
                        rows.findIndex((x) => x.paper_id === a.paper_id) === i,
                    )
                    .map((a) => (
                      <option key={a.paper_id} value={a.paper_id}>
                        {a.title}
                      </option>
                    ))}
                </select>
              </label>
              <button className="secondary" disabled={!data.assignments.length}>
                Share paper →
              </button>
            </ActionForm>
          </div>
        </section>
      ) : tab === "Assignments" || tab === "Papers" ? (
        <>
          <div className="toolbar">
            <Link className="button" href={"/papers/create?group=" + id}>
              ＋ Create a group paper
            </Link>
            <Link className="text-link" href="/papers">
              Assign a saved paper →
            </Link>
          </div>
          {data.assignments.length ? (
            <div className="subject-grid">
              {data.assignments.map((a) => (
                <section className="card" key={a.id}>
                  <Badge>{a.subject}</Badge>
                  <h2>{a.title}</h2>
                  <p className="muted">
                    Due <DateText value={a.due_at} />
                    <br />
                    {a.completed} submissions
                  </p>
                  <div className="actions">
                    <button
                      onClick={async () => {
                        try {
                          const r = await api("attempts", {
                            versionId: a.version_id,
                            assignmentId: a.id,
                          });
                          router.push("/attempts/" + r.id);
                        } catch (e) {
                          setErr(e.message);
                        }
                      }}
                    >
                      Attempt paper →
                    </button>
                    <Link className="text-link" href={"/papers/" + a.paper_id}>
                      Preview
                    </Link>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <Empty title="Your shared desk is ready.">
              Create or assign a paper to start revising together.
            </Empty>
          )}
        </>
      ) : tab === "Dashboard" ? (
        <>
          <div className="dashboard-top">
            <section className="card">
              <h2>Your people.</h2>
              {data.members.map((m) => (
                <div className="member-row" key={m.id}>
                  <span className="avatar">{m.username[0]}</span>
                  <div>
                    <b>{m.username}</b>
                    <small>
                      {m.role} ·{" "}
                      {m.subjects.join(" · ") || "No assigned subjects"}
                    </small>
                  </div>
                  <Level level={m.level} league={m.league} />
                </div>
              ))}
            </section>
            <section className="card average-card">
              <div className="score-ring">
                <strong>
                  {data.average === null ? "—" : data.average + "%"}
                </strong>
                <span>Group Average</span>
              </div>
              <details>
                <summary className="text-link">Score breakdown →</summary>
                {SUBJECTS.map((s) => {
                  const values = data.members
                    .map(
                      (m) =>
                        m.subjectStats.find((x) => x.subject === s)?.average,
                    )
                    .filter((x) => x !== null && x !== undefined);
                  return (
                    <p key={s} className="muted">
                      {s}:{" "}
                      {values.length
                        ? (
                            values.reduce((n, x) => n + x, 0) / values.length
                          ).toFixed(1) + "%"
                        : "—"}
                    </p>
                  );
                })}
              </details>
            </section>
          </div>
          <div className="dashboard-middle spaced">
            <Podium
              title="Top students · confirmed marks"
              members={data.members
                .filter((x) => x.rankingAverage !== null)
                .sort((a, b) => b.rankingAverage - a.rankingAverage)}
              field="rankingAverage"
              suffix="%"
            />
            <Podium
              title="Most papers made"
              members={[...data.members].sort((a, b) => b.papers - a.papers)}
              field="papers"
              suffix=" papers"
            />
          </div>
          <section className="card spaced">
            <h2>Recent group papers</h2>
            {data.assignments.slice(0, 5).map((a) => (
              <Link
                className="list-row"
                key={a.id}
                href={"/papers/" + a.paper_id}
              >
                <b>{a.title}</b>
                <DateText value={a.created_at} />
              </Link>
            ))}
          </section>
        </>
      ) : (
        <div className="stack">
          <section className="card">
            <h2>About this group</h2>
            <p>{data.description}</p>
            <p className="muted">
              Created <DateText value={data.created_at} />
            </p>
            <label>
              Invite code
              <input readOnly value={data.invite} />
            </label>
            <div className="chips">
              {data.subjects.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
          </section>
          <section className="card">
            <h2>Member subject access</h2>
            <p className="muted">
              Subject responsibilities belong to this group only.
            </p>
            {admin ? (
              data.members.map((m) => (
                <details key={m.id} className="member-access">
                  <summary>
                    {m.username} · {m.role} ·{" "}
                    {m.subjects.join(", ") || "No assigned subjects"}
                  </summary>
                  <div className="chips">
                    {data.subjects.map((s) => (
                      <button
                        key={s}
                        className={
                          "chip " + (m.subjects.includes(s) ? "selected" : "")
                        }
                        onClick={() => {
                          const overlap = data.members.some(
                            (other) =>
                              other.id !== m.id && other.subjects.includes(s),
                          );
                          let override = false;
                          if (overlap && !m.subjects.includes(s)) {
                            override = window.confirm(
                              `${s} already has another member assigned. Share this responsibility?`,
                            );
                            if (!override) return;
                          }
                          act({
                            action: "memberSubject",
                            groupId: id,
                            userId: m.id,
                            subject: s,
                            allow: !m.subjects.includes(s),
                            override,
                          });
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {data.role === "Owner" && m.role !== "Owner" && (
                    <button
                      className="secondary"
                      onClick={() =>
                        act({
                          action: "role",
                          groupId: id,
                          userId: m.id,
                          role: m.role === "Admin" ? "Member" : "Admin",
                        })
                      }
                    >
                      {m.role === "Admin" ? "Remove admin" : "Make admin"}
                    </button>
                  )}
                </details>
              ))
            ) : (
              <ActionForm
                onSubmit={async (b) => {
                  await api("action", {
                    action: "subjectRequest",
                    groupId: id,
                    ...b,
                  });
                  reload();
                }}
              >
                <label>
                  Request subject
                  <select name="subject">
                    {data.subjects.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Reason
                  <textarea name="reason" />
                </label>
                <button className="secondary">Request access</button>
              </ActionForm>
            )}
            {data.requests.map((r) => (
              <div className="list-row" key={r.id}>
                <span>
                  <b>
                    {r.username} · {r.subject}
                  </b>
                  <small>
                    {r.reason} · {r.status}
                  </small>
                  <small>{r.response}</small>
                </span>
                {admin && r.status === "Pending" && (
                  <ActionForm
                    onSubmit={async (b) => {
                      await api("action", {
                        action: "subjectReview",
                        id: r.id,
                        approve: b.decision === "Approve",
                        response: b.response,
                      });
                      reload();
                    }}
                  >
                    <input
                      aria-label="Response"
                      name="response"
                      placeholder="Response / reason"
                      required
                    />
                    <select aria-label="Decision" name="decision">
                      <option>Approve</option>
                      <option>Reject</option>
                    </select>
                    <button className="secondary">Review</button>
                  </ActionForm>
                )}
              </div>
            ))}
          </section>
          <GroupSettings group={data} userId={dash?.user.id} reload={reload} />
        </div>
      )}
    </>
  );
}
function Podium({ title, members, field, suffix }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {members.length ? (
        <div className="podium">
          {members.slice(0, 3).map((m, i) => (
            <div key={m.id} className={"place place-" + i}>
              <span className="avatar">{m.username[0]}</span>
              <b>{m.username}</b>
              <strong>
                {m[field]}
                {suffix}
              </strong>
              <span className="podium-block">{members.findIndex((x) => x[field] === m[field]) + 1}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Complete a paper to start the rankings.</p>
      )}
    </section>
  );
}
export function Friends({ chatId }) {
  const { data, error, reload } = useData("friends"),
    {
      data: messages,
      error: messagesError,
      reload: reloadMessages,
    } = useData(chatId ? "messages/" + chatId : null),
    [err, setErr] = useState(""),
    [olderMessages, setOlderMessages] = useState([]),
    [hasOlder, setHasOlder] = useState(true),
    [messageSearch, setMessageSearch] = useState("");
  useReadMessages(
    null,
    chatId,
    messages?.items?.at(-1)?.id,
    !!chatId && !messageSearch,
    setErr,
  );
  useEffect(() => {
    if (!chatId) return;
    const t = setInterval(reloadMessages, 15000);
    return () => clearInterval(t);
  }, [chatId, reloadMessages]);
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
          chatId ? "A little study company." : "Your people, your progress."
        }
        eyebrow="SOCIAL / FRIENDS & CHATS"
        description="Connect with classmates by their Revision Club username."
      />
      <ErrorBox error={err || messagesError || error} />
      {chatId ? (
        <section className="card">
          <label>
            Search loaded messages
            <input
              type="search"
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
            />
          </label>
          <div className="chat-messages">
            {(messages?.hasMore || (hasOlder && olderMessages.length > 0)) && (
              <button
                className="secondary load-older"
                onClick={async () => {
                  const first = olderMessages[0] || messages.items[0];
                  if (!first) return;
                  const page = await api(`messages/${chatId}?before=${first.position}&limit=50`);
                  setOlderMessages((current) => [...page.items, ...current]);
                  setHasOlder(page.hasMore);
                }}
              >
                Load older messages
              </button>
            )}
            {[...olderMessages, ...(messages?.items || [])]
              ?.filter((m) => matchesMessage(m, messageSearch))
              .map((m) => (
                <div className="message" key={m.id}>
                  <b>{m.username}</b>
                  <p>{m.body}</p>
                  <small>
                    <DateText value={m.created_at} />
                  </small>
                </div>
              ))}
          </div>
          {messageSearch &&
            ![...olderMessages, ...(messages?.items || [])].some((m) => matchesMessage(m, messageSearch)) && (
              <p className="muted">No matching recent messages.</p>
            )}
          <ActionForm
            className="message-composer"
            onSubmit={async (b, form) => {
              await api("action", {
                action: "message",
                recipientId: chatId,
                body: b.body,
              });
              form.reset();
              reloadMessages();
            }}
          >
            <input
              aria-label="Private message"
              name="body"
              required
              placeholder="Type a message…"
            />
            <button>Send →</button>
          </ActionForm>
        </section>
      ) : (
        <>
          <section className="card">
            <ActionForm
              onSubmit={async (b, form) => {
                await api("action", {
                  action: "friendRequest",
                  username: b.username,
                });
                form.reset();
                reload();
              }}
            >
              <label>
                Find a friend
                <input
                  name="username"
                  required
                  placeholder="Their exact username"
                />
              </label>
              <button className="secondary">Send friend request →</button>
            </ActionForm>
          </section>
          <section className="card spaced">
            {data.length ? (
              data.map((f) => (
                <div className="list-row" key={f.id}>
                  <span>
                    <b>{f.username}</b>
                    <small>{f.status}</small>
                    {f.unread > 0 && <Badge>{f.unread} unread</Badge>}
                  </span>
                  <div className="actions">
                    {f.status === "Accepted" ? (
                      <Link
                        className="button secondary"
                        href={"/chats/" + f.id}
                      >
                        Chat ↗
                      </Link>
                    ) : f.incoming ? (
                      <button
                        className="secondary"
                        onClick={async () => {
                          try {
                            await api("action", {
                              action: "friendRespond",
                              userId: f.id,
                              accept: true,
                            });
                            reload();
                          } catch (e) {
                            setErr(e.message);
                          }
                        }}
                      >
                        Accept
                      </button>
                    ) : (
                      <span className="muted small">Awaiting reply</span>
                    )}
                    <button
                      className="secondary"
                      onClick={async () => {
                        await api("action", {
                          action: "friendRespond",
                          userId: f.id,
                          accept: false,
                        });
                        reload();
                      }}
                    >
                      {f.status === "Accepted" ? "Remove" : "Decline / cancel"}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <Empty title="Good company makes a difference.">
                Send your first friend request above.
              </Empty>
            )}
          </section>
        </>
      )}
    </>
  );
}
export function Leaderboard() {
  const [scope, setScope] = useState("Friends"),
    [range, setRange] = useState("Weekly"),
    [category, setCategory] = useState("XP"),
    { data, error } = useData(
      `leaderboard?scope=${scope}&range=${range}&category=${category}`,
    );
  return (
    <>
      <Heading
        title="A little friendly ambition."
        eyebrow="LEADERBOARD"
        description="A fresh chance to show up, every week."
      />
      <div className="tabs">
        {["Friends", "School", "Global"].map((s) => (
          <button
            key={s}
            className={scope === s ? "selected" : ""}
            onClick={() => setScope(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <select
          aria-label="Time range"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        >
          {["Weekly", "Monthly", "All Time"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Leaderboard category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {[
            "XP",
            "Papers Completed",
            "Revision Streak",
            "Questions Correct",
            "Challenges Won",
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Badge>
          {category === "Revision Streak"
            ? "Current streak"
            : range + " standings"}
        </Badge>
      </div>
      <ErrorBox error={error} />
      {!data ? (
        <Loading />
      ) : data.length ? (
        <section className="card">
          <div className="table-heading">
            <span>RANK / STUDENT</span>
            <span>{category.toUpperCase()}</span>
          </div>
          {data.map((u, i) => (
            <div className="rank-row" key={u.id}>
              <span className="rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="avatar">{u.username[0]}</span>
              <div>
                <b>{u.username}</b>
                <small>{u.league}</small>
              </div>
              <Level level={u.level} league={u.league} />
              <strong>{u.value.toLocaleString()}</strong>
            </div>
          ))}
        </section>
      ) : (
        <Empty title="A new league of possibility.">
          {scope === "School"
            ? "Set your school in Settings to find your school leaderboard."
            : "Your rankings will appear as your circle grows."}
        </Empty>
      )}
    </>
  );
}
export function Challenges() {
  const router = useRouter(),
    { data, error, reload } = useData("challenges"),
    { data: opponents, error: opponentsError } = useData("challenge-opponents"),
    { data: papers } = useData("papers?community=true"),
    [err, setErr] = useState(""),
    [mode, setMode] = useState("Paper Challenge");
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [reload]);
  if (!data)
    return (
      <>
        <Loading error={error} />
      </>
    );
  return (
    <>
      <Heading
        title="Bring out your best."
        eyebrow="PRACTICE / PAPER CHALLENGES"
        description="Same paper. Two perspectives. A reason to give it your best."
      />
      <ErrorBox error={err || error || opponentsError} />
      <section className="card">
        <h2>Challenge a study partner</h2>
        <ActionForm
          onSubmit={async (b) => {
            await api("action", { action: "battleCreate", ...b });
            reload();
          }}
        >
          <div className="form-grid">
            <label>
              Friend or study group member
              <select name="opponent" required>
                <option value="">Choose an opponent</option>
                {opponents?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.username} · {f.relationship}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Community paper
              <select name="versionId" required key={mode}>
                <option value="">Choose a paper</option>
                {papers
                  ?.filter(
                    (p) => mode !== "Quick Quiz" || p.questionCount <= 10,
                  )
                  .map((p) => (
                    <option key={p.id} value={p.version_id}>
                      {p.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label>
            Mode
            <select
              name="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option>Quick Quiz</option>
              <option>Paper Challenge</option>
              <option>Accuracy Battle</option>
              <option>Speed Battle</option>
            </select>
          </label>
          <p className="muted small">
            Quick Quiz uses up to 10 questions with five minutes to save
            answers. Highest score wins. Speed battles rank score first, then
            completion time. Each paper counts once per opponent on the wins
            leaderboard. Replays do not add paper XP.
          </p>
          <button>Send paper challenge →</button>
        </ActionForm>
      </section>
      <div className="subject-grid spaced">
        {data.map((b) => (
          <section className="card" key={b.id}>
            <Badge>{b.status}</Badge>
            <span className="muted small"> {b.mode}</span>
            <h2>{b.title}</h2>
            <p>
              {b.challenger_name} vs {b.opponent_name}
            </p>
            {b.scores.map(
              (s, i) =>
                s?.maximum && (
                  <p key={i}>
                    {i === 0 ? b.challenger_name : b.opponent_name}: {s.score}/
                    {s.maximum} · {Math.round(s.elapsed / 1000)} seconds
                  </p>
                ),
            )}
            {b.status === "Completed" && (
              <div className="notice">
                <p>
                  {b.winner_name
                    ? b.winner_name + " wins."
                    : "A draw — equally matched."}
                </p>
                <strong>
                  Your XP receipt: +{b.xp_earned} XP
                </strong>
                <small>
                  Paper and high-score rewards follow daily and replay limits, so a replay can correctly award 0 XP.
                </small>
              </div>
            )}
            {b.status === "Under review" && (
              <p className="muted">
                The winner will be confirmed after low-confidence marks and open
                marking challenges are reviewed.
              </p>
            )}
            {b.my_result && (
              <Link
                className="button secondary"
                href={"/results/" + b.my_result}
              >
                Review my answers →
              </Link>
            )}
            {b.status === "Pending" && b.incoming ? (
              <div className="actions">
                {[true, false].map((accept) => (
                  <button
                    key={String(accept)}
                    className="secondary"
                    onClick={async () => {
                      try {
                        await api("action", {
                          action: "battleRespond",
                          id: b.id,
                          accept,
                        });
                        reload();
                      } catch (e) {
                        setErr(e.message);
                      }
                    }}
                  >
                    {accept ? "Accept" : "Decline"}
                  </button>
                ))}
              </div>
            ) : (
              b.status === "Accepted" &&
              !b.my_result && (
                <button
                  onClick={async () => {
                    try {
                      const r = await api("action", {
                        action: "battleAttempt",
                        id: b.id,
                      });
                      router.push("/attempts/" + r.id);
                    } catch (e) {
                      setErr(e.message);
                    }
                  }}
                >
                  Attempt challenge →
                </button>
              )
            )}
          </section>
        ))}
      </div>
    </>
  );
}
