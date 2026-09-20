const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { openDatabase } = require("../lib/club/database.cjs"),
  { service, addLocalWeeks } = require("../lib/club/service.cjs"),
  r = require("../lib/club/rules.cjs");
function setup() {
  const db = openDatabase(":memory:");
  for (let i = 1; i <= 4; i++)
    db.prepare(
      "INSERT INTO users(id,email,password,username) VALUES(?,?,?,?)",
    ).run(i, `test${i}@example.test`, "fake", `Student${i}`);
  return { db, s: service(db) };
}
const content = {
    instructions: "Answer all questions.",
    questions: [
      {
        id: "1",
        text: "2 + 2?",
        marks: 4,
        topic: "Addition",
        page: 1,
        space: 3,
        options: [],
      },
    ],
  },
  key = [{ questionId: "1", answer: "4", rubric: "Four marks for 4." }];
const paper = (s) =>
  s.savePaper(1, { title: "Maths practice", subject: "Maths" }, content, key);
function submit(s, uid, vid, mark = 1, assignmentId) {
  const a = s.startAttempt(uid, vid, assignmentId);
  return s.finishSubmission(
    uid,
    a.id,
    { 1: "3" },
    [
      {
        questionId: "1",
        awarded: mark,
        correct: "4",
        explanation: "The answer is four.",
        confidence: "High",
      },
    ],
    "Test marking",
  );
}
test("exponential XP and all level boundaries", () => {
  for (let l = 0; l <= 50; l++) {
    assert.equal(r.progress(r.threshold(l)).level, l);
    if (l < 50) assert.ok(r.threshold(l + 1) > r.threshold(l));
  }
  assert.equal(r.progress(r.threshold(11)).league, "Silver");
  assert.equal(r.progress(r.threshold(46)).league, "Legend");
  assert.equal(r.progress(1e9).level, 50);
  assert.ok(
    r.threshold(40) - r.threshold(39) > r.threshold(2) - r.threshold(1),
  );
});
test("subjects and AI output validation", () => {
  assert.equal(r.SUBJECTS.length, 11);
  assert.equal(r.QUESTION_TYPES.length, 8);
  assert.throws(() => r.validSubject("Mathematics"));
  assert.throws(() =>
    r.validatePaper({
      ...content,
      questions: [content.questions[0], content.questions[0]],
    }),
  );
  assert.throws(() =>
    r.validateMarks(
      [{ questionId: "1", awarded: 5, explanation: "bad" }],
      content.questions,
    ),
  );
  const base = content.questions[0],
    questions = [
      { ...base, id: "1", type: "mc_box", options: ["A", "B"] },
      { ...base, id: "2", type: "mc_single_box", options: ["A", "B"] },
      { ...base, id: "3", type: "mc_circle", options: ["A", "B"] },
      { ...base, id: "4", type: "answer_space" },
      { ...base, id: "5", type: "short_answer" },
      {
        ...base,
        id: "6",
        type: "comprehension",
        passage: "Read this passage.",
      },
      { ...base, id: "7", type: "ordering", options: ["First", "Second"] },
      {
        ...base,
        id: "8",
        type: "matching",
        items: ["One", "Two"],
        options: ["一", "二"],
      },
    ];
  assert.deepEqual(
    r.validatePaper({ ...content, questions }).questions.map((q) => q.type),
    r.QUESTION_TYPES,
  );
  assert.throws(() =>
    r.validatePaper({
      ...content,
      questions: [
        { ...base, type: "matching", items: ["One"], options: ["A", "B"] },
      ],
    }),
  );
});
test("migrations and foreign keys", () => {
  const { db } = setup();
  assert.ok(db.prepare("SELECT * FROM rc_migrations").all().length);
  assert.throws(() =>
    db.prepare("INSERT INTO rc_profiles VALUES(999,?,?)").run("a", "b"),
  );
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  db.close();
});
test("private papers deny strangers and keys never leak", () => {
  const { db, s } = setup(),
    p = paper(s);
  assert.throws(() => s.paper(2, p.paperId), /denied/);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  assert.equal(s.paper(2, p.paperId).versions[0].key, undefined);
  assert.ok(s.paper(1, p.paperId).versions[0].key);
  assert.throws(
    () => s.mutate(2, "publish", { paperId: p.paperId, public: true }),
    /creator/,
  );
  db.close();
});
test("full group assignment submission challenge resolution and audit flow", () => {
  const { db, s } = setup(),
    g = s.mutate(1, "groupCreate", { name: "Study Group" }),
    invite = s.group(1, g.id).invite;
  s.mutate(2, "groupJoin", { invite });
  const p = paper(s);
  assert.throws(
    () => s.mutate(1, "assign", { groupId: g.id, versionId: p.versionId }),
    /3 members/,
  );
  s.mutate(3, "groupJoin", { invite });
  const assignment = s.mutate(1, "assign", {
    groupId: g.id,
    versionId: p.versionId,
  });
  const a = s.startAttempt(2, p.versionId, assignment.id);
  assert.throws(() => s.attempt(3, a.id), /denied/);
  const result = s.finishSubmission(
    2,
    a.id,
    { 1: "4" },
    [
      {
        questionId: "1",
        awarded: 2,
        correct: "4",
        explanation: "Review required",
        confidence: "Low",
      },
    ],
    "Test",
  );
  assert.throws(() => s.review(3, result.id), /denied/);
  const c = s.challenge(
    2,
    s.review(2, result.id).items[0].id,
    "My answer matches",
  );
  assert.throws(() => s.resolve(3, c.id, 4, "Approve", false), /denied/);
  s.resolve(1, c.id, 4, "Correct full marks", false);
  assert.equal(s.review(2, result.id).score, 4);
  assert.equal(s.review(2, result.id).items[0].history.length, 1);
  assert.equal(s.stats(2).xp, 80);
  assert.throws(() => s.resolve(1, c.id, 4, "Repeat", false), /not open/);
  assert.throws(
    () => s.finishSubmission(2, a.id, {}, [], "duplicate"),
    /Already submitted/,
  );
  assert.ok(
    s
      .dashboard(1)
      .notifications.some((n) => n.title === "Marking challenge received"),
  );
  db.close();
});
test("score reduction confirmation and reward correction", () => {
  const { db, s } = setup(),
    p = paper(s);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  const result = submit(s, 2, p.versionId, 4),
    c = s.challenge(2, s.review(2, result.id).items[0].id, "Review");
  assert.throws(() => s.resolve(1, c.id, 2, "Overawarded", false), /Confirm/);
  assert.throws(() => s.resolve(1, c.id, 2, "", true), /Text/);
  s.resolve(1, c.id, 2, "Overawarded", true);
  assert.equal(s.stats(2).xp, 30);
  assert.equal(s.review(2, result.id).items[0].history[0].old_mark, 4);
  db.close();
});
test("duplicate submissions cannot farm XP", () => {
  const { db, s } = setup(),
    p = paper(s);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  submit(s, 2, p.versionId, 4);
  submit(s, 2, p.versionId, 4);
  assert.equal(s.stats(2).xp, 80);
  db.close();
});
test("versions preserve previous content", () => {
  const { db, s } = setup(),
    p = paper(s);
  const v = s.savePaper(
    1,
    { paperId: p.paperId, title: "Maths", subject: "Maths" },
    { ...content, questions: [{ ...content.questions[0], text: "3 + 3?" }] },
    [{ questionId: "1", answer: "6" }],
  );
  assert.notEqual(v.versionId, p.versionId);
  assert.equal(
    JSON.parse(
      s.get("SELECT content FROM rc_versions WHERE id=?", p.versionId).content,
    ).questions[0].text,
    "2 + 2?",
  );
  db.close();
});
test("subject permissions remain scoped to membership", () => {
  const { db, s } = setup(),
    g = s.mutate(1, "groupCreate", { name: "One" }),
    g2 = s.mutate(1, "groupCreate", { name: "Two" });
  for (const gid of [g.id, g2.id])
    s.mutate(2, "groupJoin", { invite: s.group(1, gid).invite });
  assert.throws(
    () =>
      s.savePaper(
        2,
        { title: "Denied", subject: "Maths", groupId: g.id },
        content,
        key,
      ),
    /subject access/,
  );
  s.mutate(1, "memberSubject", {
    groupId: g.id,
    userId: 2,
    subject: "Maths",
    allow: true,
  });
  assert.ok(
    s.savePaper(
      2,
      { title: "Allowed", subject: "Maths", groupId: g.id },
      content,
      key,
    ),
  );
  assert.throws(() =>
    s.savePaper(
      2,
      { title: "Denied", subject: "Maths", groupId: g2.id },
      content,
      key,
    ),
  );
  assert.throws(() => s.group(4, g.id));
  assert.throws(() =>
    s.mutate(2, "role", { groupId: g.id, userId: 1, role: "Member" }),
  );
  db.close();
});
test("private messaging requires accepted friends", () => {
  const { db, s } = setup();
  assert.throws(() =>
    s.mutate(1, "message", { recipientId: 2, body: "Hello" }),
  );
  s.mutate(1, "friendRequest", { username: "Student2" });
  s.mutate(2, "friendRespond", { userId: 1, accept: true });
  s.mutate(1, "message", { recipientId: 2, body: "Hello" });
  assert.equal(s.all("SELECT * FROM rc_messages").length, 1);
  db.close();
});
test("instant study session rewards blocked", () => {
  const { db, s } = setup(),
    x = s.mutate(1, "sessionCreate", {
      title: "Revision",
      subject: "Maths",
      startsAt: new Date(Date.now() + 60000).toISOString(),
      duration: 20,
    });
  s.mutate(1, "sessionStart", { id: x.id });
  assert.throws(() => s.mutate(1, "sessionComplete", { id: x.id }), /duration/);
  assert.equal(s.stats(1).xp, 0);
  db.close();
});
test("generated private answers never enter public paper content", () => {
  const { db, s } = setup();
  const p = s.savePaper(
    1,
    { title: "Generated paper", subject: "Maths" },
    { ...content, answerKey: key, secret: "do not expose" },
    key,
    "AI-generated marking scheme",
  );
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  const publicPaper = s.paper(2, p.paperId);
  assert.equal(publicPaper.versions[0].content.answerKey, undefined);
  assert.equal(publicPaper.versions[0].content.secret, undefined);
  db.close();
});
test("group ownership transfer, removal and deletion enforce roles", () => {
  const { db, s } = setup(),
    g = s.mutate(1, "groupCreate", { name: "Managed" });
  const invite = s.group(1, g.id).invite;
  s.mutate(2, "groupJoin", { invite });
  s.mutate(3, "groupJoin", { invite });
  assert.throws(() =>
    s.mutate(2, "groupDelete", { groupId: g.id, confirm: true }),
  );
  assert.throws(() => s.mutate(1, "groupLeave", { groupId: g.id }));
  s.mutate(1, "groupTransfer", { groupId: g.id, userId: 2 });
  assert.equal(s.group(2, g.id).role, "Owner");
  assert.throws(() =>
    s.mutate(1, "groupRemoveMember", { groupId: g.id, userId: 2 }),
  );
  s.mutate(2, "groupRemoveMember", { groupId: g.id, userId: 3 });
  assert.throws(() => s.group(3, g.id));
  s.mutate(2, "groupDelete", { groupId: g.id, confirm: true });
  assert.throws(() => s.group(1, g.id));
  assert.throws(() => s.mutate(4, "groupJoin", { invite }));
  db.close();
});
test("six game modes grade answers on server and reject incorrect results", () => {
  const { GAMES, makeGame, gradeGame } = require("../lib/club/games.cjs");
  assert.equal(GAMES.length, 6);
  for (const g of GAMES) {
    const game = makeGame(g.name),
      answers = Object.fromEntries(game.questions.map((q) => [q.id, q.answer]));
    const result = gradeGame(
      { questions: JSON.stringify(game.questions) },
      answers,
    );
    assert.equal(result.correct, result.total);
    assert.equal(
      gradeGame({ questions: JSON.stringify(game.questions) }, {}).correct,
      0,
    );
    assert.ok(game.questions.length > 0);
  }
});
test("maths game topics produce solvable fractions and linear equations", () => {
  const { makeGame } = require("../lib/club/games.cjs");
  for (const name of ["Math Rush", "Boss Battle"]) {
    assert.throws(
      () => makeGame(name, "Untrusted topic"),
      /available maths topic/,
    );
    for (const topic of ["Fractions", "Linear equations"]) {
      const game = makeGame(name, topic);
      assert.equal(game.topic, topic);
      for (const q of game.questions) {
        assert.equal(q.topic, topic);
        if (topic === "Fractions") {
          const [, numerator, denominator, total] = q.text.match(
            /What is (\d+)\/(\d+) of (\d+)\?/,
          );
          assert.equal(
            Number(q.answer) * Number(denominator),
            Number(numerator) * Number(total),
          );
        } else {
          const [, coefficient, offset, total] = q.text.match(
            /Find x: (\d+)x \+ (\d+) = (-?\d+)/,
          );
          assert.equal(
            Number(coefficient) * Number(q.answer) + Number(offset),
            Number(total),
          );
        }
      }
    }
  }
});
test("study suggestions use latest confirmed mistakes and skip already-planned topics", () => {
  const { db, s } = setup();
  const p = paper(s);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  submit(s, 2, p.versionId, 1);
  const latest = submit(s, 2, p.versionId, 2);
  assert.equal(s.studySuggestions(2).length, 1);
  assert.match(s.studySuggestions(2)[0].reason, /^1 confirmed question /);
  assert.deepEqual(s.studySuggestions(3), []);
  const item = s.review(2, latest.id).items[0];
  s.run("UPDATE rc_marking_items SET confidence='Low' WHERE id=?", item.id);
  assert.deepEqual(s.studySuggestions(2), []);
  s.run("UPDATE rc_marking_items SET confidence='High' WHERE id=?", item.id);
  const session = s.mutate(2, "sessionCreate", {
    title: "Review",
    subject: "Maths",
    topic: "addition",
    startsAt: new Date(Date.now() + 3600000).toISOString(),
    duration: 20,
  });
  assert.deepEqual(s.studySuggestions(2), []);
  s.mutate(2, "sessionDelete", { id: session.id });
  assert.equal(s.studySuggestions(2).length, 1);
  s.challenge(2, item.id, "Please review these method marks.");
  assert.deepEqual(s.studySuggestions(2), []);
  submit(s, 2, p.versionId, 4);
  assert.deepEqual(s.studySuggestions(2), []);
  db.close();
});
test("XP daily caps limit repeated trivial actions", () => {
  const { db, s } = setup();
  for (let i = 0; i < 20; i++) s.xp(1, "submit", "reference-" + i);
  assert.equal(s.stats(1).xp, 90);
  db.close();
});
test("overlapping subject responsibility requires explicit override", () => {
  const { db, s } = setup(),
    g = s.mutate(1, "groupCreate", { name: "Assignments" });
  const invite = s.group(1, g.id).invite;
  for (const uid of [2, 3]) s.mutate(uid, "groupJoin", { invite });
  s.mutate(1, "memberSubject", {
    groupId: g.id,
    userId: 2,
    subject: "Maths",
    allow: true,
  });
  assert.throws(
    () =>
      s.mutate(1, "memberSubject", {
        groupId: g.id,
        userId: 3,
        subject: "Maths",
        allow: true,
      }),
    /overlap/,
  );
  s.mutate(1, "memberSubject", {
    groupId: g.id,
    userId: 3,
    subject: "Maths",
    allow: true,
    override: true,
  });
  assert.deepEqual(s.group(3, g.id).members.find((m) => m.id === 3).subjects, [
    "Maths",
  ]);
  db.close();
});
test("mastery needs multiple distinct papers and sufficient high-confidence evidence", () => {
  const { db, s } = setup();
  const questions = Array.from({ length: 4 }, (_, i) => ({
    ...content.questions[0],
    id: String(i + 1),
  }));
  const keys = questions.map((q) => ({ questionId: q.id, answer: "4" }));
  for (let n = 0; n < 3; n++) {
    const p = s.savePaper(
      1,
      { title: "Practice " + n, subject: "Maths" },
      { ...content, questions },
      keys,
    );
    s.mutate(1, "publish", { paperId: p.paperId, public: true });
    const a = s.startAttempt(2, p.versionId);
    s.finishSubmission(
      2,
      a.id,
      Object.fromEntries(questions.map((q) => [q.id, "4"])),
      questions.map((q) => ({
        questionId: q.id,
        awarded: 4,
        correct: "4",
        explanation: "Correct",
        confidence: "High",
      })),
      "Test",
    );
    if (n < 2) assert.notEqual(s.topicProgress(2)[0].state, "Mastered");
  }
  assert.equal(s.topicProgress(2)[0].state, "Mastered");
  assert.equal(s.topicProgress(2)[0].questions, 12);
  assert.equal(
    s.get("SELECT COUNT(*) n FROM rc_xp WHERE user_id=2 AND kind='mastery'").n,
    1,
  );
  db.close();
});
test("deleted groups cannot grant paper or version access", () => {
  const { db, s } = setup(),
    g = s.mutate(1, "groupCreate", { name: "Private circle" });
  const invite = s.group(1, g.id).invite;
  for (const uid of [2, 3]) s.mutate(uid, "groupJoin", { invite });
  const p = paper(s);
  s.mutate(1, "assign", { groupId: g.id, versionId: p.versionId });
  assert.ok(s.paper(2, p.paperId));
  s.mutate(1, "groupDelete", { groupId: g.id, confirm: true });
  assert.throws(() => s.paper(2, p.paperId), /denied/);
  assert.throws(() => s.startAttempt(2, p.versionId), /denied/);
  db.close();
});
test("invalid answer-key alternatives are rejected", () => {
  const { db, s } = setup();
  assert.throws(
    () =>
      s.savePaper(1, { title: "Invalid", subject: "Maths" }, content, [
        { questionId: "1", answer: "4", alternatives: "anything" },
      ]),
    /list/,
  );
  db.close();
});
test("a score reduction removes invalid perfect-paper achievement", () => {
  const { db, s } = setup(),
    p = paper(s);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  const result = submit(s, 2, p.versionId, 4);
  assert.ok(
    s.get(
      "SELECT 1 FROM rc_achievements WHERE user_id=2 AND achievement='perfect'",
    ),
  );
  const c = s.challenge(2, s.review(2, result.id).items[0].id, "Review");
  s.resolve(1, c.id, 2, "Overawarded", true);
  assert.equal(
    s.get(
      "SELECT 1 FROM rc_achievements WHERE user_id=2 AND achievement='perfect'",
    ),
    undefined,
  );
  assert.equal(
    s.get("SELECT amount FROM rc_xp WHERE user_id=2 AND kind='highScore'")
      .amount,
    0,
  );
  db.close();
});
test("marking sources and creator instructions are frozen per version and remain private", () => {
  const { db, s } = setup();
  s.run(
    "INSERT INTO rc_files VALUES(?,?,?,?,?,?,?,?)",
    "scheme",
    1,
    "scheme.txt",
    "Answer Key / Marking Scheme",
    "text/plain",
    Buffer.from("4 gets four marks"),
    "4 gets four marks",
    new Date().toISOString(),
  );
  const p = s.savePaper(
    1,
    {
      title: "Versioned scheme",
      subject: "Maths",
      description: "Accept equivalent notation",
      fileIds: ["scheme"],
    },
    content,
    key,
  );
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  s.savePaper(
    1,
    {
      paperId: p.paperId,
      title: "Changed",
      subject: "Maths",
      description: "Changed instructions",
    },
    content,
    key,
  );
  const a = s.startAttempt(2, p.versionId),
    ctx = s.markingContext(2, a.id);
  assert.equal(ctx.creatorInstructions, "Accept equivalent notation");
  assert.equal(ctx.schemeFiles[0].extracted, "4 gets four marks");
  assert.equal(s.paper(2, p.paperId).schemeFiles, undefined);
  assert.throws(() => s.markingContext(3, a.id), /denied/);
  db.close();
});
test("assignments list tracks a submission and hides archived groups", () => {
  const { db, s } = setup(),
    g = s.mutate(1, "groupCreate", { name: "Assignment board" });
  for (const uid of [2, 3])
    s.mutate(uid, "groupJoin", { invite: s.group(1, g.id).invite });
  const p = paper(s),
    a = s.mutate(1, "assign", { groupId: g.id, versionId: p.versionId });
  assert.equal(s.assignments(2)[0].status, "Open");
  assert.equal(s.assignments(4).length, 0);
  submit(s, 2, p.versionId, 2, a.id);
  const row = s.assignments(2)[0];
  assert.equal(row.status, "Submitted");
  assert.equal(row.completion_count, 1);
  assert.equal(row.average, 50);
  assert.ok(row.marking_id);
  s.mutate(1, "groupDelete", { groupId: g.id, confirm: true });
  assert.equal(s.assignments(2).length, 0);
  db.close();
});
test("low-confidence results hold high-score XP until creator review", () => {
  const { db, s } = setup(),
    p = paper(s);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  const a = s.startAttempt(2, p.versionId),
    result = s.finishSubmission(
      2,
      a.id,
      { 1: "4" },
      [
        {
          questionId: "1",
          awarded: 4,
          correct: "4",
          explanation: "Uncertain",
          confidence: "Low",
        },
      ],
      "Test",
    );
  assert.equal(s.stats(2).xp, 30);
  assert.equal(
    s.get(
      "SELECT 1 FROM rc_achievements WHERE user_id=2 AND achievement='perfect'",
    ),
    undefined,
  );
  const c = s.challenge(2, s.review(2, result.id).items[0].id, "Verify");
  s.resolve(1, c.id, 4, "Verified full marks", false);
  assert.equal(s.stats(2).xp, 80);
  assert.ok(
    s.get(
      "SELECT 1 FROM rc_achievements WHERE user_id=2 AND achievement='perfect'",
    ),
  );
  db.close();
});
test("private paper drafts survive reload and are isolated by user and group", () => {
  const { db, s } = setup(),
    draft = {
      settings: { title: "Working copy", subject: "Maths" },
      files: [],
      content,
      answerKey: key,
      keySource: "Human-provided answer key",
    };
  s.savePaperDraft(1, "", draft);
  assert.equal(s.paperDraft(1).settings.title, "Working copy");
  assert.deepEqual(s.paperDraft(1).answerKey, key);
  assert.equal(s.paperDraft(2), null);
  const g = s.mutate(1, "groupCreate", { name: "Draft group" });
  s.savePaperDraft(1, g.id, { ...draft, settings: { title: "Group copy" } });
  assert.equal(s.paperDraft(1, g.id).settings.title, "Group copy");
  assert.equal(s.paperDraft(1).settings.title, "Working copy");
  assert.throws(() => s.savePaperDraft(2, g.id, draft));
  s.savePaperDraft(1, "", null);
  assert.equal(s.paperDraft(1), null);
  assert.ok(s.paperDraft(1, g.id));
  db.close();
});
test("community metadata and attempt counts reflect saved versions without private keys", () => {
  const { db, s } = setup();
  const p = s.savePaper(
    1,
    {
      title: "Searchable paper",
      subject: "Maths",
      grade: "Form 3",
      difficulty: "Challenging",
      language: "Chinese",
    },
    content,
    key,
  );
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  let row = s.papers(2, true)[0];
  assert.equal(row.grade, "Form 3");
  assert.equal(row.difficulty, "Challenging");
  assert.equal(row.language, "Chinese");
  assert.equal(row.attempts, 0);
  assert.deepEqual(row.topics, ["Addition"]);
  assert.equal(row.metadata, undefined);
  assert.equal(row.answerKey, undefined);
  submit(s, 2, p.versionId, 4);
  assert.equal(s.papers(2, true)[0].attempts, 1);
  s.savePaper(
    1,
    { paperId: p.paperId, title: "New version", subject: "Maths" },
    { ...content, grade: "Form 4", difficulty: "Foundation" },
    key,
  );
  row = s.papers(2, true)[0];
  assert.equal(row.grade, "Form 4");
  assert.equal(row.attempts, 1);
  assert.equal(
    JSON.parse(
      s.get("SELECT content FROM rc_versions WHERE id=?", p.versionId).content,
    ).grade,
    "Form 3",
  );
  db.close();
});
test("friend requests identify recipient and cannot be self-accepted by sender", () => {
  const { db, s } = setup();
  s.mutate(2, "friendRequest", { username: "Student3" });
  assert.equal(s.friends(2)[0].incoming, false);
  assert.equal(s.friends(3)[0].incoming, true);
  assert.throws(
    () => s.mutate(2, "friendRespond", { userId: 3, accept: true }),
    /recipient/,
  );
  assert.equal(s.isFriend(2, 3), false);
  s.mutate(3, "friendRespond", { userId: 2, accept: true });
  assert.equal(s.isFriend(2, 3), true);
  db.close();
});
test("boss battle answers are sequential, immutable and stop when health runs out", () => {
  const { db, s } = setup();
  const questions = Array.from({ length: 10 }, (_, i) => ({
    id: String(i + 1),
    text: "2 × 2",
    answer: "4",
  }));
  s.run(
    "INSERT INTO rc_games(id,user_id,game,subject,questions,started_at) VALUES(?,?,?,?,?,?)",
    "boss",
    1,
    "Boss Battle",
    "Maths",
    JSON.stringify(questions),
    new Date().toISOString(),
  );
  assert.throws(() => s.bossAnswer(2, "boss", "1", "4"), /ended/);
  assert.throws(() => s.bossAnswer(1, "boss", "2", "4"), /current question/);
  const hit = s.bossAnswer(1, "boss", "1", "4");
  assert.equal(hit.bossHealth, 90);
  assert.equal(hit.health, 100);
  assert.equal(hit.questions, undefined);
  const retry = s.bossAnswer(1, "boss", "1", "wrong");
  assert.equal(retry.answers.length, 1);
  assert.equal(retry.lastAnswer.correct, true);
  for (let i = 2; i <= 6; i++) s.bossAnswer(1, "boss", String(i), "wrong");
  const lost = s.bossState(1, "boss");
  assert.equal(lost.complete, true);
  assert.equal(lost.health, 0);
  assert.equal(lost.bossHealth, 90);
  assert.throws(() => s.bossAnswer(1, "boss", "7", "4"), /ended/);
  assert.equal(s.stats(1).xp, 0);
  db.close();
});
test("chat read cursors are scoped, monotonic and count only other senders", () => {
  const { db, s } = setup();
  const g = s.mutate(1, "groupCreate", { name: "Unread group" });
  s.mutate(2, "groupJoin", { invite: s.group(1, g.id).invite });
  s.mutate(1, "message", { groupId: g.id, body: "First" });
  const first = s.group(2, g.id).messages[0].id;
  s.mutate(2, "message", { groupId: g.id, body: "My reply" });
  assert.equal(s.groups(2)[0].unread, 1);
  s.mutate(2, "messageRead", { groupId: g.id, messageId: first });
  assert.equal(s.groups(2)[0].unread, 0);
  s.mutate(1, "message", { groupId: g.id, body: "Another" });
  assert.equal(s.groups(2)[0].unread, 1);
  const last = s.group(2, g.id).messages.at(-1).id;
  s.mutate(2, "messageRead", { groupId: g.id, messageId: last });
  s.mutate(2, "messageRead", { groupId: g.id, messageId: first });
  assert.equal(s.groups(2)[0].unread, 0);
  assert.throws(
    () => s.mutate(3, "messageRead", { groupId: g.id, messageId: last }),
    /permission denied/,
  );
  s.mutate(1, "friendRequest", { username: "Student2" });
  s.mutate(2, "friendRespond", { userId: 1, accept: true });
  s.mutate(1, "message", { recipientId: 2, body: "Private message" });
  const privateMessage = s.get(
    "SELECT id FROM rc_messages WHERE recipient_id=2",
  ).id;
  assert.equal(s.friends(2)[0].unread, 1);
  assert.throws(
    () =>
      s.mutate(2, "messageRead", { groupId: g.id, messageId: privateMessage }),
    /Message access denied/,
  );
  assert.throws(
    () => s.mutate(2, "messageRead", { recipientId: 1, messageId: last }),
    /Message access denied/,
  );
  s.mutate(2, "messageRead", { recipientId: 1, messageId: privateMessage });
  assert.equal(s.friends(2)[0].unread, 0);
  db.close();
});
test("group paper shares expose only group-accessible metadata and revoke withdrawn public shares", () => {
  const { db, s } = setup();
  const p = paper(s);
  const g = s.mutate(1, "groupCreate", { name: "Paper sharing" });
  const invite = s.group(1, g.id).invite;
  for (const uid of [2, 3]) s.mutate(uid, "groupJoin", { invite });
  const share = { groupId: g.id, paperId: p.paperId };
  assert.throws(() => s.mutate(1, "message", share), /public paper/);
  s.mutate(1, "assign", { groupId: g.id, versionId: p.versionId });
  s.savePaper(
    1,
    { paperId: p.paperId, title: "Maths practice", subject: "Maths" },
    {
      ...content,
      duration: 99,
      questions: [{ ...content.questions[0], marks: 50 }],
    },
    key,
  );
  s.mutate(2, "message", share);
  const card = s.group(3, g.id).messages[0].paper;
  assert.equal(card.id, p.paperId);
  assert.equal(card.marks, 4);
  assert.notEqual(card.duration, 99);
  assert.equal(card.content, undefined);
  assert.equal(card.answerKey, undefined);
  assert.throws(() => s.mutate(4, "message", share), /permission denied/i);
  const publicPaper = s.savePaper(
    1,
    { title: "Temporary share", subject: "Maths" },
    content,
    key,
  );
  s.mutate(1, "publish", { paperId: publicPaper.paperId, public: true });
  s.mutate(2, "message", { groupId: g.id, paperId: publicPaper.paperId });
  s.mutate(1, "publish", { paperId: publicPaper.paperId, public: false });
  assert.equal(
    s.group(2, g.id).messages.find((m) => m.paper_id === publicPaper.paperId)
      .paper,
    null,
  );
  db.close();
});
test("challenge opponents require friendship or current shared-group membership", () => {
  const { db, s } = setup();
  const p = paper(s);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  const g = s.mutate(1, "groupCreate", { name: "Challenge group" });
  s.mutate(2, "groupJoin", { invite: s.group(1, g.id).invite });
  assert.deepEqual(
    s.challengeOpponents(1).map((u) => u.id),
    [2],
  );
  assert.equal(s.challengeOpponents(1)[0].relationship, "Study group member");
  const input = { opponent: 2, versionId: p.versionId };
  assert.throws(
    () => s.mutate(1, "battleCreate", { ...input, opponent: 1 }),
    /accepted friend/,
  );
  assert.throws(
    () => s.mutate(1, "battleCreate", { ...input, opponent: 3 }),
    /accepted friend/,
  );
  const b = s.mutate(1, "battleCreate", input);
  s.run("DELETE FROM rc_members WHERE group_id=? AND user_id=2", g.id);
  assert.deepEqual(s.challengeOpponents(1), []);
  assert.throws(
    () => s.mutate(2, "battleRespond", { id: b.id, accept: true }),
    /still be friends/,
  );
  s.mutate(2, "battleRespond", { id: b.id, accept: false });
  s.mutate(2, "groupJoin", { invite: s.group(1, g.id).invite });
  s.run("UPDATE rc_groups SET archived=1 WHERE id=?", g.id);
  assert.deepEqual(s.challengeOpponents(1), []);
  s.mutate(1, "friendRequest", { username: "Student2" });
  assert.deepEqual(s.challengeOpponents(1), []);
  s.mutate(2, "friendRespond", { userId: 1, accept: true });
  assert.equal(s.challengeOpponents(1)[0].relationship, "Friend");
  const accepted = s.mutate(1, "battleCreate", input);
  s.mutate(2, "battleRespond", { id: accepted.id, accept: true });
  assert.equal(s.battles(1)[0].status, "Accepted");
  db.close();
});
test("battles isolate attempts, compute winners, reconcile reviews and limit replay wins", () => {
  const { db, s } = setup(),
    p = paper(s);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  s.mutate(2, "friendRequest", { username: "Student3" });
  s.mutate(3, "friendRespond", { userId: 2, accept: true });
  const create = () => {
    const b = s.mutate(2, "battleCreate", {
      opponent: 3,
      versionId: p.versionId,
    });
    assert.throws(
      () => s.mutate(2, "battleRespond", { id: b.id, accept: true }),
      /unavailable/,
    );
    s.mutate(3, "battleRespond", { id: b.id, accept: true });
    return b;
  };
  const first = create(),
    second = create();
  s.run(
    "UPDATE rc_battles SET created_at=? WHERE id IN (?,?)",
    new Date().toISOString(),
    first.id,
    second.id,
  );
  const a = s.mutate(2, "battleAttempt", { id: first.id }),
    a2 = s.mutate(2, "battleAttempt", { id: second.id });
  assert.notEqual(a.id, a2.id);
  const o = s.mutate(3, "battleAttempt", { id: first.id });
  const finish = (uid, aid, awarded) =>
    s.finishSubmission(
      uid,
      aid,
      { 1: "4" },
      [
        {
          questionId: "1",
          awarded,
          correct: "4",
          explanation: "Test",
          confidence: "High",
        },
      ],
      "Test",
    );
  const mine = finish(2, a.id, 4);
  assert.equal(s.battles(3).find((b) => b.id === first.id).scores[0], null);
  finish(3, o.id, 2);
  let b = s.battles(2).find((b) => b.id === first.id);
  assert.equal(b.status, "Completed");
  assert.equal(b.winner, 2);
  assert.equal(b.my_result, mine.id);
  assert.equal(b.xp_earned, 80);
  assert.equal(s.battles(4).length, 0);
  const other = s.mutate(3, "battleAttempt", { id: second.id });
  finish(2, a2.id, 4);
  finish(3, other.id, 2);
  assert.equal(s.battles(2).find((item) => item.id === second.id).xp_earned, 0);
  assert.equal(
    s
      .leaderboard(2, "Global", "All Time", "Challenges Won")
      .find((u) => u.id === 2).value,
    1,
  );
  assert.equal(s.stats(2).xp, 80);
  const c = s.challenge(2, s.review(2, mine.id).items[0].id, "Check award");
  assert.equal(
    s.battles(2).find((b) => b.id === first.id).status,
    "Under review",
  );
  s.resolve(1, c.id, 0, "Score correction", true);
  b = s.battles(2).find((b) => b.id === first.id);
  assert.equal(b.winner, 3);
  assert.equal(
    s
      .leaderboard(3, "Global", "All Time", "Challenges Won")
      .find((u) => u.id === 3).value,
    1,
  );
  db.close();
});
test("speed battle uses time only after equal scores", () => {
  const { db, s } = setup(),
    p = paper(s);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  s.mutate(2, "friendRequest", { username: "Student3" });
  s.mutate(3, "friendRespond", { userId: 2, accept: true });
  const b = s.mutate(2, "battleCreate", {
    opponent: 3,
    versionId: p.versionId,
    mode: "Speed Battle",
  });
  s.mutate(3, "battleRespond", { id: b.id, accept: true });
  for (const uid of [2, 3]) {
    const a = s.mutate(uid, "battleAttempt", { id: b.id });
    s.run(
      "UPDATE rc_attempts SET started_at=? WHERE id=?",
      new Date(Date.now() - (uid === 2 ? 60000 : 120000)).toISOString(),
      a.id,
    );
    s.finishSubmission(
      uid,
      a.id,
      { 1: "4" },
      [
        {
          questionId: "1",
          awarded: 4,
          correct: "4",
          explanation: "Test",
          confidence: "High",
        },
      ],
      "Test",
    );
  }
  assert.equal(s.battles(2)[0].winner, 2);
  db.close();
});
test("session edits and deletions preserve ownership and completion integrity", () => {
  const { db, s } = setup();
  const input = {
    title: "Study",
    subject: "Maths",
    duration: 20,
    startsAt: new Date(Date.now() + 60000).toISOString(),
  };
  const a = s.mutate(1, "sessionCreate", input);
  assert.throws(
    () => s.mutate(2, "sessionUpdate", { ...input, id: a.id }),
    /unstarted/,
  );
  assert.throws(() => s.mutate(2, "sessionDelete", { id: a.id }), /unstarted/);
  s.mutate(1, "sessionUpdate", {
    ...input,
    id: a.id,
    title: "Revised plan",
    duration: 30,
  });
  assert.equal(
    s.get("SELECT title FROM rc_sessions WHERE id=?", a.id).title,
    "Revised plan",
  );
  s.mutate(1, "sessionStart", { id: a.id });
  assert.throws(
    () => s.mutate(1, "sessionUpdate", { ...input, id: a.id }),
    /unstarted/,
  );
  assert.throws(() => s.mutate(1, "sessionDelete", { id: a.id }), /unstarted/);
  const b = s.mutate(1, "sessionCreate", input);
  s.mutate(1, "sessionDelete", { id: b.id });
  assert.equal(s.get("SELECT id FROM rc_sessions WHERE id=?", b.id), undefined);
  assert.equal(s.stats(1).xp, 0);
  db.close();
});
test("version edit drafts are creator-only and saving preserves original generation context", () => {
  const { db, s } = setup();
  for (const fid of ["old-source", "new-source"])
    s.run(
      "INSERT INTO rc_files VALUES(?,?,?,?,?,?,?,?)",
      fid,
      1,
      fid + ".txt",
      "Revision Material",
      "text/plain",
      Buffer.from("Notes"),
      "Notes",
      new Date().toISOString(),
    );
  const first = s.savePaper(
    1,
    {
      title: "Original",
      subject: "Maths",
      description: "Use only notes",
      onlySources: true,
      fileIds: ["old-source"],
    },
    content,
    key,
  );
  s.mutate(1, "publish", { paperId: first.paperId, public: true });
  const other = s.savePaper(
    1,
    {
      paperId: first.paperId,
      title: "Later",
      subject: "Maths",
      description: "Different instructions",
      onlySources: false,
      fileIds: ["new-source"],
    },
    content,
    key,
  );
  const ctx = s.versionEditContext(1, first.versionId);
  assert.equal(ctx.settings.onlySources, true);
  assert.deepEqual(
    ctx.files.map((f) => f.id),
    ["old-source"],
  );
  assert.throws(() => s.versionEditContext(2, first.versionId), /creator/);
  s.saveVersionDraft(1, first.versionId, { content, answerKey: key });
  assert.equal(s.versionDraft(1, first.versionId).answerKey[0].answer, "4");
  assert.throws(() => s.versionDraft(2, first.versionId), /creator/);
  assert.throws(
    () => s.saveVersionDraft(2, first.versionId, { content }),
    /creator/,
  );
  const saved = s.savePaper(
    1,
    {
      paperId: first.paperId,
      sourceVersionId: first.versionId,
      title: "Edited original",
      subject: "Maths",
    },
    content,
    key,
  );
  const result = s.versionEditContext(1, saved.versionId);
  assert.equal(result.creatorInstructions, "Use only notes");
  assert.equal(result.settings.onlySources, true);
  assert.deepEqual(
    result.files.map((f) => f.id),
    ["old-source"],
  );
  assert.equal(s.versionDraft(1, first.versionId), null);
  assert.deepEqual(
    s.versionEditContext(1, other.versionId).files.map((f) => f.id),
    ["new-source"],
  );
  db.close();
});

test("Topper uses confirmed group averages, supports ties and preserves unlock dates", () => {
  const { db, s } = setup();
  const g = s.mutate(1, "groupCreate", { name: "Topper QA" });
  const invite = s.group(1, g.id).invite;
  s.mutate(2, "groupJoin", { invite });
  s.mutate(3, "groupJoin", { invite });
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) n FROM rc_achievements WHERE achievement='topper'",
      )
      .get().n,
    0,
  );
  const p = paper(s);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  const a = s.startAttempt(2, p.versionId);
  const provisional = s.finishSubmission(
    2,
    a.id,
    { 1: "4" },
    [
      {
        questionId: "1",
        awarded: 4,
        correct: "4",
        explanation: "Needs review",
        confidence: "Low",
      },
    ],
    "QA",
  );
  assert.equal(
    s.group(1, g.id).members.find((m) => m.id === 2).rankingAverage,
    null,
  );
  assert.equal(
    s.dashboard(2).achievements.some((a) => a.achievement === "topper"),
    false,
  );
  const other = submit(s, 3, p.versionId, 3);
  assert.equal(
    s.dashboard(3).achievements.some((a) => a.achievement === "topper"),
    true,
  );
  const challenge = s.challenge(
    2,
    s.review(2, provisional.id).items[0].id,
    "Please confirm my score",
  );
  s.resolve(1, challenge.id, 3, "Three marks confirmed", true);
  const unlocked = s
    .dashboard(2)
    .achievements.find((a) => a.achievement === "topper");
  assert.ok(unlocked);
  const scores = s
    .group(1, g.id)
    .members.filter((m) => m.rankingAverage !== null)
    .map((m) => m.rankingAverage);
  assert.deepEqual(scores, [75, 75]);
  const review = s.challenge(3, s.review(3, other.id).items[0].id, "Recheck");
  assert.equal(
    s.group(1, g.id).members.find((m) => m.id === 3).rankingAverage,
    null,
  );
  s.resolve(1, review.id, 4, "Full marks", false);
  assert.deepEqual(
    s.dashboard(2).achievements.find((a) => a.achievement === "topper"),
    unlocked,
  );
  assert.equal(
    s
      .dashboard(2)
      .notifications.filter(
        (n) => n.title === "Achievement unlocked" && n.body === "Topper",
      ).length,
    1,
  );
  s.mutate(1, "groupDelete", { groupId: g.id, confirm: true });
  submit(s, 4, p.versionId, 4);
  assert.equal(
    s.dashboard(4).achievements.some((a) => a.achievement === "topper"),
    false,
  );
  db.close();
});

test("Quick Quiz limits paper length and freezes saved answers at the server deadline", () => {
  const { db, s } = setup(),
    p = paper(s);
  s.mutate(1, "publish", { paperId: p.paperId, public: true });
  s.mutate(2, "friendRequest", { username: "Student3" });
  s.mutate(3, "friendRespond", { userId: 2, accept: true });
  const long = s.savePaper(
    1,
    { title: "Too long", subject: "Maths" },
    {
      ...content,
      questions: Array.from({ length: 11 }, (_, n) => ({
        ...content.questions[0],
        id: String(n + 1),
      })),
    },
    Array.from({ length: 11 }, (_, n) => ({
      ...key[0],
      questionId: String(n + 1),
    })),
  );
  s.mutate(1, "publish", { paperId: long.paperId, public: true });
  assert.throws(
    () =>
      s.mutate(2, "battleCreate", {
        opponent: 3,
        versionId: long.versionId,
        mode: "Quick Quiz",
      }),
    /up to 10/,
  );
  const battle = s.mutate(2, "battleCreate", {
    opponent: 3,
    versionId: p.versionId,
    mode: "Quick Quiz",
  });
  s.mutate(3, "battleRespond", { id: battle.id, accept: true });
  const a = s.mutate(2, "battleAttempt", { id: battle.id });
  const context = s.attempt(2, a.id);
  assert.equal(context.content.duration, 5);
  assert.equal(
    Date.parse(context.quizDeadline) - Date.parse(context.started_at),
    300000,
  );
  s.saveAnswers(2, a.id, { 1: "3" });
  db.prepare("UPDATE rc_attempts SET started_at=? WHERE id=?").run(
    new Date(Date.now() - 301000).toISOString(),
    a.id,
  );
  assert.deepEqual(s.saveAnswers(2, a.id, { 1: "4" }), { 1: "3" });
  assert.deepEqual(s.attempt(2, a.id).answers, { 1: "3" });
  assert.equal(s.mutate(2, "battleAttempt", { id: battle.id }).id, a.id);
  assert.throws(() => s.saveAnswers(4, a.id, { 1: "4" }), /denied/);
  const normal = s.startAttempt(3, p.versionId);
  assert.equal(s.attempt(3, normal.id).quizDeadline, null);
  db.close();
});

test("product completion adds paged discovery, unified search and revision-paper games", () => {
  const { db, s } = setup();
  for (let i = 0; i < 15; i++) {
    const saved = s.savePaper(
      1,
      { title: `Discoverable Maths ${i}`, subject: "Maths" },
      { ...content, grade: i % 2 ? "Primary 6" : "Secondary 1", difficulty: "Standard" },
      key,
    );
    s.mutate(1, "publish", { paperId: saved.paperId, public: true });
  }
  const first = s.paperPage(2, true, 1, 6, { query: "Discoverable", subject: "Maths" });
  assert.equal(first.items.length, 6);
  assert.equal(first.total, 15);
  assert.equal(first.pages, 3);
  assert.ok(db.prepare("PRAGMA index_list(rc_papers)").all().some((index) => index.name === "rc_papers_public_updated"));
  assert.equal(s.paperPage(2, true, 3, 6, { query: "Discoverable" }).items.length, 3);
  assert.ok(s.globalSearch(2, "discoverable").some((item) => item.type === "Community paper"));
  const game = s.revisionGame(2, first.items[0].version_id);
  assert.equal(game.name, "Revision Mix");
  assert.equal(game.questions[0].answer, "4");
  assert.throws(() => s.revisionGame(3, "missing"), /Version not found/);
  db.close();
});

test("message history paginates without duplicates and preserves access checks", () => {
  const { db, s } = setup();
  s.mutate(1, "friendRequest", { username: "Student2" });
  s.mutate(2, "friendRespond", { userId: 1, accept: true });
  for (let i = 0; i < 65; i++)
    s.mutate(1, "message", { recipientId: 2, body: `History ${i}` });
  const latest = s.messages(2, { friendId: 1, limit: 25 });
  assert.equal(latest.items.length, 25);
  assert.equal(latest.hasMore, true);
  const older = s.messages(2, { friendId: 1, before: latest.nextCursor, limit: 25 });
  assert.equal(older.items.length, 25);
  assert.equal(new Set([...latest.items, ...older.items].map((item) => item.id)).size, 50);
  assert.throws(() => s.messages(3, { friendId: 1 }), /denied/);
  db.close();
});

test("recurring series, exams, avatars and notification preferences have owned lifecycles", () => {
  const { db, s } = setup(),
    start = new Date(Date.now() + 86400000).toISOString();
  const session = s.mutate(1, "sessionCreate", {
    title: "Weekly algebra",
    subject: "Maths",
    topic: "Algebra",
    startsAt: start,
    duration: 30,
    recurrence: "Weekly",
    timezone: "Asia/Hong_Kong",
  });
  const before = db.prepare("SELECT * FROM rc_sessions WHERE id=?").get(session.id);
  assert.ok(before.series_id);
  assert.equal(before.timezone, "Asia/Hong_Kong");
  s.mutate(1, "sessionUpdate", {
    id: session.id,
    title: "Weekly equations",
    subject: "Maths",
    topic: "Equations",
    startsAt: new Date(Date.parse(start) + 3600000).toISOString(),
    duration: 40,
    recurrence: "Weekly",
    timezone: "America/New_York",
    applyToSeries: true,
  });
  const changed = db.prepare("SELECT * FROM rc_sessions WHERE id=?").get(session.id);
  assert.equal(changed.topic, "Equations");
  assert.equal(changed.timezone, "America/New_York");
  const exam = s.mutate(1, "examCreate", {
    title: "Algebra exam",
    subject: "Maths",
    startsAt: new Date(Date.now() + 172800000).toISOString(),
    notes: "Chapters 1–4",
  });
  assert.equal(s.dashboard(1).exams[0].id, exam.id);
  assert.throws(() => s.mutate(2, "examUpdate", { id: exam.id, title: "No", subject: "Maths", startsAt: start }), /unavailable/);
  s.mutate(1, "profileAvatar", { avatar: "data:image/png;base64,YQ==" });
  assert.match(db.prepare("SELECT avatar_url FROM users WHERE id=1").get().avatar_url, /^data:image/);
  assert.throws(() => s.mutate(1, "profileAvatar", { avatar: "https://example.test/avatar.png" }), /PNG/);
  s.mutate(1, "notificationPreferences", { studyReminders: false, socialUpdates: true, achievementUpdates: true });
  const count = db.prepare("SELECT COUNT(*) n FROM rc_notifications WHERE user_id=1").get().n;
  s.notify(1, "Study session begins soon", "Hidden reminder", "/timetable");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM rc_notifications WHERE user_id=1").get().n, count);
  s.mutate(1, "sessionDeleteSeries", { id: session.id });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM rc_sessions WHERE series_id=?").get(before.series_id).n, 0);
  db.close();
});

test("weekly local times survive daylight-saving offset changes", () => {
  assert.equal(
    addLocalWeeks("2024-03-04T23:30:00.000Z", 1, "America/New_York"),
    "2024-03-11T22:30:00.000Z",
  );
  assert.equal(
    addLocalWeeks("2024-10-28T22:30:00.000Z", 1, "America/New_York"),
    "2024-11-04T23:30:00.000Z",
  );
  assert.equal(
    addLocalWeeks("2024-03-04T10:30:00.000Z", 1, "Asia/Hong_Kong"),
    "2024-03-11T10:30:00.000Z",
  );
});

test("non-maths minigames expose selectable expanded topic banks", () => {
  const games = require("../lib/club/games.cjs");
  assert.equal(games.makeGame("Timeline", "Chinese history").topic, "Chinese history");
  assert.equal(games.makeGame("Keyword Blitz", "ICT").questions.length, 8);
  assert.equal(games.makeGame("True or Trap", "Geography").questions.length, 10);
  assert.throws(() => games.makeGame("Timeline", "Algebra"), /available topic/);
});
