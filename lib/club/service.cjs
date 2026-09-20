const { randomUUID } = require("node:crypto");
const {
  SUBJECTS,
  REWARDS,
  ACHIEVEMENTS,
  progress,
  validSubject,
  text,
  integer,
  validatePaper,
  validateKey,
  normalize,
  validateMarks,
} = require("./rules.cjs");
const id = () => randomUUID(),
  now = () => new Date().toISOString();
function addLocalWeeks(iso, weeks, timeZone = "UTC") {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const values = Object.fromEntries(
      formatter
        .formatToParts(new Date(iso))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const target = Date.UTC(
      values.year,
      values.month - 1,
      values.day + weeks * 7,
      values.hour,
      values.minute,
      values.second,
    );
    let candidate = target;
    for (let attempt = 0; attempt < 4; attempt++) {
      const local = Object.fromEntries(
        formatter
          .formatToParts(new Date(candidate))
          .filter((part) => part.type !== "literal")
          .map((part) => [part.type, Number(part.value)]),
      );
      const represented = Date.UTC(
        local.year,
        local.month - 1,
        local.day,
        local.hour,
        local.minute,
        local.second,
      );
      candidate += target - represented;
    }
    return new Date(candidate).toISOString();
  } catch {
    return new Date(Date.parse(iso) + weeks * 7 * 86400000).toISOString();
  }
}
function service(db) {
  const get = (s, ...p) => db.prepare(s).get(...p),
    all = (s, ...p) => db.prepare(s).all(...p),
    run = (s, ...p) => db.prepare(s).run(...p);
  function requireUser(uid) {
    if (!get("SELECT id FROM users WHERE id=?", uid))
      throw new Error("Sign in required.");
  }
  function notify(uid, title, body, href) {
    const preferences = get(
      "SELECT * FROM rc_notification_preferences WHERE user_id=?",
      uid,
    );
    const lower = title.toLowerCase();
    if (preferences) {
      if (!preferences.study_reminders && lower.includes("study session")) return;
      if (
        !preferences.achievement_updates &&
        (lower.includes("achievement") || lower.includes("streak"))
      )
        return;
      if (
        !preferences.social_updates &&
        ["challenge", "friend", "group", "subject access"].some((word) =>
          lower.includes(word),
        )
      )
        return;
    }
    run(
      "INSERT INTO rc_notifications VALUES(?,?,?,?,?,0,?)",
      id(),
      uid,
      title,
      body,
      href,
      now(),
    );
  }
  function xp(uid, kind, reference) {
    const caps = {
      submit: 3,
      highScore: 3,
      correction: 5,
      minigame: 1,
      mastery: 3,
      session: 8,
    };
    if (
      caps[kind] &&
      get(
        "SELECT COUNT(*) n FROM rc_xp WHERE user_id=? AND kind=? AND amount>0 AND substr(created_at,1,10)=?",
        uid,
        kind,
        now().slice(0, 10),
      ).n >= caps[kind]
    )
      return;

    run(
      "INSERT INTO rc_xp VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,kind,reference) DO UPDATE SET amount=excluded.amount",
      id(),
      uid,
      kind,
      String(reference),
      REWARDS[kind],
      now(),
    );
  }
  function membership(uid, gid, admin = false) {
    const m = get(
      "SELECT * FROM rc_members WHERE group_id=? AND user_id=?",
      gid,
      uid,
    );
    if (get("SELECT archived FROM rc_groups WHERE id=?", gid)?.archived)
      throw new Error("This group is archived.");
    if (!m || (admin && m.role === "Member"))
      throw new Error("Group permission denied.");
    return m;
  }
  function groupSubject(uid, gid, subject) {
    const m = membership(uid, gid);
    if (
      !get(
        "SELECT 1 FROM rc_group_subjects WHERE group_id=? AND subject=?",
        gid,
        subject,
      )
    )
      throw new Error("This subject is not enabled in the group.");
    if (
      m.role === "Member" &&
      !get(
        "SELECT 1 FROM rc_member_subjects WHERE group_id=? AND user_id=? AND subject=?",
        gid,
        uid,
        subject,
      )
    )
      throw new Error("Request subject access from a group admin first.");
  }
  function paperAccess(uid, pid) {
    const p = get("SELECT * FROM rc_papers WHERE id=?", pid);
    if (!p) throw new Error("Paper not found.");
    if (
      p.owner_id !== uid &&
      !p.public &&
      !get(
        `SELECT 1 FROM rc_assignments a JOIN rc_versions v ON v.id=a.version_id JOIN rc_members m ON m.group_id=a.group_id WHERE v.paper_id=? AND m.user_id=? AND EXISTS(SELECT 1 FROM rc_groups g WHERE g.id=a.group_id AND g.archived=0)`,
        pid,
        uid,
      ) &&
      !get(
        "SELECT 1 FROM rc_battles b JOIN rc_versions v ON v.id=b.version_id WHERE v.paper_id=? AND b.status<>'Declined' AND (b.challenger=? OR b.opponent=?)",
        pid,
        uid,
        uid,
      )
    )
      throw new Error("Paper access denied.");
    return p;
  }
  function versionAccess(uid, vid) {
    const v = get("SELECT * FROM rc_versions WHERE id=?", vid);
    if (!v) throw new Error("Version not found.");
    const p = paperAccess(uid, v.paper_id);
    if (
      p.owner_id !== uid &&
      !p.public &&
      !get(
        "SELECT 1 FROM rc_assignments a JOIN rc_members m ON m.group_id=a.group_id WHERE a.version_id=? AND m.user_id=? AND EXISTS(SELECT 1 FROM rc_groups g WHERE g.id=a.group_id AND g.archived=0)",
        vid,
        uid,
      ) &&
      !get(
        "SELECT 1 FROM rc_battles WHERE version_id=? AND status<>'Declined' AND (challenger=? OR opponent=?)",
        vid,
        uid,
        uid,
      )
    )
      throw new Error("Version access denied.");
    return { v, p };
  }
  function keyFor(vid) {
    const k = get("SELECT * FROM rc_keys WHERE version_id=?", vid);
    return k ? { ...k, content: JSON.parse(k.content) } : null;
  }
  function savePaper(
    uid,
    input,
    content,
    key,
    source = "Human-provided answer key",
  ) {
    requireUser(uid);
    const base = input.sourceVersionId
      ? versionEditContext(uid, input.sourceVersionId)
      : null;
    if (base) {
      if (base.paperId !== input.paperId)
        throw new Error("Source version does not belong to this paper.");
      input = {
        ...base.settings,
        ...input,
        description: input.description ?? base.creatorInstructions,
      };
    }
    const subject = validSubject(input.subject);
    const title = text(input.title, 160);
    content = validatePaper({
      ...content,
      grade: input.grade ?? content.grade,
      difficulty: input.difficulty ?? content.difficulty,
      language: input.language ?? content.language,
    });
    if (input.groupId) groupSubject(uid, input.groupId, subject);
    if (key) key = validateKey(key, content.questions);
    return db.transaction(() => {
      let pid = input.paperId;
      if (pid) {
        const p = paperAccess(uid, pid);
        if (p.owner_id !== uid)
          throw new Error("Only the creator can edit a paper.");
        run(
          "UPDATE rc_papers SET title=?,subject=?,description=?,updated_at=? WHERE id=?",
          title,
          subject,
          String(input.description || "").slice(0, 6000),
          now(),
          pid,
        );
      } else {
        pid = id();
        run(
          "INSERT INTO rc_papers VALUES(?,?,?,?,?,?,0,?,?)",
          pid,
          uid,
          title,
          subject,
          String(input.description || "").slice(0, 6000),
          "Generated",
          now(),
          now(),
        );
      }
      const number = get(
          "SELECT COALESCE(MAX(number),0)+1 AS n FROM rc_versions WHERE paper_id=?",
          pid,
        ).n,
        vid = id();
      run(
        "INSERT INTO rc_versions VALUES(?,?,?,?,?)",
        vid,
        pid,
        number,
        JSON.stringify(content),
        now(),
      );
      run(
        "INSERT INTO rc_version_context(version_id,instructions,generation_settings) VALUES(?,?,?)",
        vid,
        String(input.description || "").slice(0, 6000),
        JSON.stringify({
          onlySources: !!input.onlySources,
          generateKey: !!key,
          sampleAspects: Array.isArray(input.sampleAspects)
            ? input.sampleAspects.slice(0, 20).map(String)
            : [],
        }),
      );
      if (key)
        run(
          "INSERT INTO rc_keys VALUES(?,?,?)",
          vid,
          JSON.stringify(key),
          source,
        );
      for (const fid of input.fileIds || []) {
        if (!get("SELECT 1 FROM rc_files WHERE id=? AND owner_id=?", fid, uid))
          throw new Error("File access denied.");
        run("INSERT OR IGNORE INTO rc_paper_files VALUES(?,?)", pid, fid);
      }
      const fileIds =
        input.fileIds ??
        base?.files.map((f) => f.id) ??
        all("SELECT file_id FROM rc_paper_files WHERE paper_id=?", pid).map(
          (f) => f.file_id,
        );
      for (const fid of new Set(fileIds)) {
        if (!get("SELECT 1 FROM rc_files WHERE id=? AND owner_id=?", fid, uid))
          throw new Error("File access denied.");
        run("INSERT INTO rc_version_files VALUES(?,?)", vid, fid);
      }
      if (base)
        run(
          "DELETE FROM rc_version_drafts WHERE version_id=? AND user_id=?",
          input.sourceVersionId,
          uid,
        );
      notify(uid, "Paper ready", title, `/papers/${pid}`);
      return { paperId: pid, versionId: vid };
    })();
  }
  function versionEditContext(uid, vid) {
    const { v, p } = versionAccess(uid, vid);
    if (p.owner_id !== uid)
      throw new Error("Only the creator can edit this version.");
    const content = JSON.parse(v.content),
      stored = get("SELECT * FROM rc_version_context WHERE version_id=?", vid);
    const files = all(
      "SELECT f.* FROM rc_files f JOIN rc_version_files vf ON vf.file_id=f.id WHERE vf.version_id=?",
      vid,
    );
    const settings = JSON.parse(stored?.generation_settings || "{}");
    return {
      paperId: p.id,
      versionId: vid,
      content,
      answerKey: keyFor(vid)?.content || [],
      files,
      creatorInstructions: stored?.instructions || "",
      settings: {
        title: p.title,
        subject: p.subject,
        description: stored?.instructions || "",
        duration: content.duration,
        grade: content.grade,
        difficulty: content.difficulty,
        language: content.language,
        onlySources:
          settings.onlySources ??
          files.some((f) => f.purpose === "Revision Material"),
        generateKey: settings.generateKey ?? !!keyFor(vid),
        sampleAspects: settings.sampleAspects || [],
      },
    };
  }
  function versionDraft(uid, vid) {
    versionEditContext(uid, vid);
    const row = get(
      "SELECT content,updated_at FROM rc_version_drafts WHERE version_id=? AND user_id=?",
      vid,
      uid,
    );
    return row
      ? { ...JSON.parse(row.content), updatedAt: row.updated_at }
      : null;
  }
  function saveVersionDraft(uid, vid, draft) {
    versionEditContext(uid, vid);
    if (!draft || typeof draft !== "object")
      throw new Error("Invalid edit draft.");
    const encoded = JSON.stringify({
      content: draft.content,
      answerKey: draft.answerKey || [],
      keySource: String(draft.keySource || "Human-provided marking scheme"),
    });
    if (encoded.length > 400000) throw new Error("Paper draft is too large.");
    run(
      "INSERT INTO rc_version_drafts VALUES(?,?,?,?) ON CONFLICT(version_id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at",
      vid,
      uid,
      encoded,
      now(),
    );
    return { saved: true };
  }
  function paper(uid, pid) {
    const p = paperAccess(uid, pid);
    let versions = all(
      "SELECT * FROM rc_versions WHERE paper_id=? ORDER BY number DESC",
      pid,
    );
    if (p.owner_id !== uid && !p.public)
      versions = versions.filter((v) => {
        try {
          versionAccess(uid, v.id);
          return true;
        } catch {
          return false;
        }
      });
    return {
      ...p,
      versions: versions.map((v) => ({
        ...v,
        content: JSON.parse(v.content),
        key: p.owner_id === uid ? keyFor(v.id) : undefined,
        hasKey: !!get("SELECT 1 FROM rc_keys WHERE version_id=?", v.id),
      })),
    };
  }
  function startAttempt(uid, vid, assignmentId = null) {
    requireUser(uid);
    const access = versionAccess(uid, vid);
    if (!assignmentId && access.p.owner_id !== uid && !access.p.public) {
      const permitted = get(
        "SELECT a.id FROM rc_assignments a JOIN rc_members m ON m.group_id=a.group_id JOIN rc_groups g ON g.id=a.group_id WHERE a.version_id=? AND m.user_id=? AND g.archived=0 AND (a.due_at IS NULL OR a.due_at>=?) ORDER BY a.created_at DESC LIMIT 1",
        vid,
        uid,
        now(),
      );
      if (permitted) assignmentId = permitted.id;
      else if (
        !get(
          "SELECT 1 FROM rc_battles WHERE version_id=? AND status='Accepted' AND (challenger=? OR opponent=?)",
          vid,
          uid,
          uid,
        )
      )
        throw new Error("No open assignment permits a new attempt.");
    }
    if (!keyFor(vid))
      throw new Error(
        "The creator must add an answer key before this paper can be attempted.",
      );
    if (assignmentId) {
      const a = get("SELECT * FROM rc_assignments WHERE id=?", assignmentId);
      if (!a || a.version_id !== vid) throw new Error("Assignment mismatch.");
      membership(uid, a.group_id);
      if (a.due_at && new Date(a.due_at) < new Date())
        throw new Error("The assignment deadline has passed.");
    }
    const old = get(
      "SELECT id FROM rc_attempts WHERE user_id=? AND version_id=? AND assignment_id IS ? AND submitted_at IS NULL",
      uid,
      vid,
      assignmentId,
    );
    if (old) return old;
    const aid = id();
    run(
      "INSERT INTO rc_attempts VALUES(?,?,?,?,?,?,NULL)",
      aid,
      uid,
      vid,
      assignmentId,
      "{}",
      now(),
    );
    return { id: aid };
  }
  function attempt(uid, aid) {
    const a = get("SELECT * FROM rc_attempts WHERE id=?", aid);
    if (!a || a.user_id !== uid) throw new Error("Attempt access denied.");
    const v = get("SELECT * FROM rc_versions WHERE id=?", a.version_id),
      p = get("SELECT * FROM rc_papers WHERE id=?", v.paper_id);
    const quiz = get(
      "SELECT 1 FROM rc_battles WHERE mode='Quick Quiz' AND (challenger_attempt=? OR opponent_attempt=?)",
      aid,
      aid,
    );
    return {
      ...a,
      answers: JSON.parse(a.answers),
      content: { ...JSON.parse(v.content), ...(quiz ? { duration: 5 } : {}) },
      quizDeadline: quiz
        ? new Date(Date.parse(a.started_at) + 5 * 60000).toISOString()
        : null,
      title: p.title,
      subject: p.subject,
      paper_id: p.id,
    };
  }
  function saveAnswers(uid, aid, answers) {
    const a = attempt(uid, aid);
    if (a.submitted_at)
      throw new Error("This attempt has already been submitted.");
    if (a.quizDeadline && Date.now() >= Date.parse(a.quizDeadline))
      return a.answers;
    const clean = {};
    for (const q of a.content.questions)
      clean[q.id] = String(answers[q.id] || "").slice(0, 12000);
    run(
      "UPDATE rc_attempts SET answers=? WHERE id=?",
      JSON.stringify(clean),
      aid,
    );
    return clean;
  }
  function markingContext(uid, aid) {
    const a = attempt(uid, aid);
    if (a.submitted_at)
      throw new Error("This attempt has already been submitted.");
    return {
      ...a,
      key: keyFor(a.version_id),
      creatorInstructions:
        get(
          "SELECT instructions FROM rc_version_context WHERE version_id=?",
          a.version_id,
        )?.instructions || "",
      schemeFiles: all(
        "SELECT f.* FROM rc_files f JOIN rc_version_files v ON v.file_id=f.id WHERE v.version_id=? AND f.purpose='Answer Key / Marking Scheme'",
        a.version_id,
      ),
    };
  }
  function finishSubmission(uid, aid, answers, items, source) {
    return db.transaction(() => {
      const a = attempt(uid, aid);
      if (a.submitted_at) throw new Error("Already submitted.");
      const clean = saveAnswers(uid, aid, answers);
      items = validateMarks(items, a.content.questions);
      const sid = id(),
        mid = id();
      run(
        "INSERT INTO rc_submissions VALUES(?,?,?,?)",
        sid,
        aid,
        JSON.stringify(clean),
        now(),
      );
      run("INSERT INTO rc_markings VALUES(?,?,?,?)", mid, sid, source, now());
      for (const x of items) {
        const iid = id(),
          q = a.content.questions.find((q) => q.id === String(x.questionId));
        run(
          "INSERT INTO rc_marking_items VALUES(?,?,?,?,?,?,?,?,?)",
          iid,
          mid,
          q.id,
          x.awarded,
          q.marks,
          clean[q.id],
          String(x.correct || ""),
          x.explanation,
          x.confidence,
        );
        if (x.awarded < q.marks)
          run(
            "INSERT INTO rc_mistakes(id,user_id,item_id,subject,topic) VALUES(?,?,?,?,?)",
            id(),
            uid,
            iid,
            a.subject,
            q.topic,
          );
      }
      run("UPDATE rc_attempts SET submitted_at=? WHERE id=?", now(), aid);
      const beforeXp = stats(uid).xp;
      xp(uid, "submit", a.version_id);
      reconcileRewards(uid, mid, a.version_id);
      const battle = get(
        "SELECT id FROM rc_battles WHERE challenger_attempt=? OR opponent_attempt=?",
        aid,
        aid,
      );
      if (battle)
        run(
          "INSERT OR REPLACE INTO rc_battle_xp_receipts VALUES(?,?,?)",
          battle.id,
          uid,
          Math.max(0, stats(uid).xp - beforeXp),
        );
      notify(uid, "Paper marked", a.title, `/results/${mid}`);
      return { id: mid };
    })();
  }
  function reconcileRewards(uid, mid, vid) {
    const totals = get(
      "SELECT SUM(awarded) score,SUM(maximum) maximum FROM rc_marking_items WHERE marking_id=?",
      mid,
    );
    const qualifying = get(
      `SELECT 1 FROM rc_markings m JOIN rc_submissions s ON s.id=m.submission_id JOIN rc_attempts a ON a.id=s.attempt_id JOIN rc_marking_items i ON i.marking_id=m.id WHERE a.user_id=? AND a.version_id=? GROUP BY m.id HAVING SUM(i.awarded)*1.0/SUM(i.maximum)>=0.9 AND SUM(CASE WHEN i.confidence='Low' THEN 1 ELSE 0 END)=0`,
      uid,
      vid,
    );
    if (qualifying) xp(uid, "highScore", vid);
    else
      run(
        "UPDATE rc_xp SET amount=0 WHERE user_id=? AND kind=? AND reference=?",
        uid,
        "highScore",
        vid,
      );
    updateTopics(uid);
    achievements(uid);
    for (const g of groups(uid)) awardGroupToppers(g.id);
    return totals;
  }
  function review(uid, mid) {
    const m = get(
      `SELECT m.*,a.user_id,a.version_id,p.owner_id,p.title,p.subject,v.content FROM rc_markings m JOIN rc_submissions s ON s.id=m.submission_id JOIN rc_attempts a ON a.id=s.attempt_id JOIN rc_versions v ON v.id=a.version_id JOIN rc_papers p ON p.id=v.paper_id WHERE m.id=?`,
      mid,
    );
    if (!m || (m.user_id !== uid && m.owner_id !== uid))
      throw new Error("Submission access denied.");
    const items = all(
      "SELECT * FROM rc_marking_items WHERE marking_id=?",
      mid,
    ).map((x) => ({
      ...x,
      challenge:
        get("SELECT * FROM rc_challenges WHERE item_id=?", x.id) || null,
      history: all(
        "SELECT d.*,u.username FROM rc_decisions d JOIN rc_challenges c ON c.id=d.challenge_id JOIN users u ON u.id=d.reviewer_id WHERE c.item_id=? ORDER BY d.created_at",
        x.id,
      ),
    }));
    return {
      ...m,
      content: JSON.parse(m.content),
      items,
      score: items.reduce((n, x) => n + x.awarded, 0),
      maximum: items.reduce((n, x) => n + x.maximum, 0),
    };
  }
  function challenge(uid, iid, reason) {
    const item = get("SELECT * FROM rc_marking_items WHERE id=?", iid);
    if (!item) throw new Error("Question not found.");
    const r = review(uid, item.marking_id);
    if (r.user_id !== uid)
      throw new Error("Only the student can challenge their marking.");
    return db.transaction(() => {
      const cid = id();
      run(
        "INSERT INTO rc_challenges VALUES(?,?,?,?,?,?)",
        cid,
        iid,
        uid,
        String(reason || "").slice(0, 3000),
        "Challenged",
        now(),
      );
      notify(
        r.owner_id,
        "Marking challenge received",
        `${r.title} · Question ${item.question_id}`,
        `/results/${r.id}`,
      );
      return { id: cid };
    })();
  }
  function resolve(uid, cid, mark, reason, confirmReduction) {
    return db.transaction(() => {
      const c = get("SELECT * FROM rc_challenges WHERE id=?", cid);
      if (!c || c.status === "Resolved")
        throw new Error("Challenge is not open.");
      const item = get("SELECT * FROM rc_marking_items WHERE id=?", c.item_id),
        r = review(uid, item.marking_id);
      if (r.owner_id !== uid)
        throw new Error("Only the paper creator can resolve this challenge.");
      mark = Number(mark);
      if (!Number.isFinite(mark) || mark < 0 || mark > item.maximum)
        throw new Error("Mark is outside the allowed range.");
      reason = text(reason, 3000);
      if (mark < item.awarded && !confirmReduction)
        throw new Error("Confirm the score reduction.");
      run(
        "INSERT INTO rc_decisions VALUES(?,?,?,?,?,?,?)",
        id(),
        cid,
        uid,
        item.awarded,
        mark,
        reason,
        now(),
      );
      run(
        "UPDATE rc_marking_items SET awarded=?,confidence='High' WHERE id=?",
        mark,
        item.id,
      );
      run("UPDATE rc_challenges SET status='Resolved' WHERE id=?", cid);
      if (mark === item.maximum) {
        run(
          "UPDATE rc_xp SET amount=0 WHERE user_id=? AND kind='correction' AND reference=?",
          r.user_id,
          item.id,
        );
        run("DELETE FROM rc_mistakes WHERE item_id=?", item.id);
      } else
        run(
          "INSERT OR IGNORE INTO rc_mistakes(id,user_id,item_id,subject,topic) VALUES(?,?,?,?,?)",
          id(),
          r.user_id,
          item.id,
          r.subject,
          r.content.questions.find((q) => q.id === item.question_id)?.topic ||
            "General",
        );
      reconcileRewards(r.user_id, r.id, r.version_id);
      notify(r.user_id, "Challenge resolved", reason, `/results/${r.id}`);
      return { id: r.id };
    })();
  }
  function results(uid) {
    return all(
      `SELECT m.id,p.title,p.subject,a.submitted_at,SUM(i.awarded) score,SUM(i.maximum) maximum FROM rc_markings m JOIN rc_submissions s ON s.id=m.submission_id JOIN rc_attempts a ON a.id=s.attempt_id JOIN rc_versions v ON v.id=a.version_id JOIN rc_papers p ON p.id=v.paper_id JOIN rc_marking_items i ON i.marking_id=m.id WHERE a.user_id=? GROUP BY m.id ORDER BY a.submitted_at DESC`,
      uid,
    );
  }
  function stats(uid) {
    const rows = results(uid),
      subjects = SUBJECTS.map((subject) => {
        const r = rows.filter((x) => x.subject === subject);
        return {
          subject,
          count: r.length,
          average: r.length
            ? Math.round(
                (r.reduce((n, x) => n + (100 * x.score) / x.maximum, 0) /
                  r.length) *
                  10,
              ) / 10
            : null,
        };
      });
    const days = all(
      "SELECT DISTINCT substr(created_at,1,10) day FROM rc_xp WHERE user_id=? AND kind IN ('submit','session','minigame','correction') AND amount>0 ORDER BY day DESC",
      uid,
    ).map((x) => x.day);
    let streak = 0,
      d = new Date();
    if (!days.includes(d.toISOString().slice(0, 10)))
      d.setUTCDate(d.getUTCDate() - 1);
    while (days.includes(d.toISOString().slice(0, 10))) {
      streak++;
      d.setUTCDate(d.getUTCDate() - 1);
    }
    return {
      ...progress(
        get("SELECT COALESCE(SUM(amount),0) xp FROM rc_xp WHERE user_id=?", uid)
          .xp,
      ),
      tests: rows.length,
      average: rows.length
        ? Math.round(
            (rows.reduce((n, x) => n + (100 * x.score) / x.maximum, 0) /
              rows.length) *
              10,
          ) / 10
        : null,
      streak,
      subjects,
    };
  }
  function achievements(uid) {
    const s = stats(uid);
    const perfect = !!get(
      "SELECT 1 FROM rc_markings m JOIN rc_submissions s ON s.id=m.submission_id JOIN rc_attempts a ON a.id=s.attempt_id JOIN rc_marking_items i ON i.marking_id=m.id WHERE a.user_id=? GROUP BY m.id HAVING SUM(i.awarded)=SUM(i.maximum) AND SUM(CASE WHEN i.confidence='Low' THEN 1 ELSE 0 END)=0",
      uid,
    );
    const criteria = {
      perfect,
      streak: s.streak >= 7,
      comeback:
        get(
          "SELECT COUNT(*) n FROM rc_mistakes WHERE user_id=? AND corrected_at IS NOT NULL",
          uid,
        ).n >= 20,
      addict: s.tests >= 50,
      weapon: s.level === 50,
      speed: !!get(
        "SELECT 1 FROM rc_games WHERE user_id=? AND finished_at IS NOT NULL AND elapsed<60 AND correct=total AND total>=8",
        uid,
      ),
    };
    for (const [key, yes] of Object.entries(criteria))
      if (yes) {
        const change = run(
          "INSERT OR IGNORE INTO rc_achievements VALUES(?,?,?)",
          uid,
          key,
          now(),
        );
        if (change.changes)
          notify(
            uid,
            "Achievement unlocked",
            ACHIEVEMENTS.find((x) => x.id === key).title,
            "/profile",
          );
      }
    for (const code of ["perfect", "weapon", "comeback"])
      if (!criteria[code])
        run(
          "DELETE FROM rc_achievements WHERE user_id=? AND achievement=?",
          uid,
          code,
        );
    if (s.streak >= 7) {
      const days = all(
        "SELECT DISTINCT substr(created_at,1,10) day FROM rc_xp WHERE user_id=? AND kind IN ('submit','session','minigame','correction') AND amount>0 ORDER BY day DESC",
        uid,
      ).map((x) => x.day);
      let d = new Date(),
        count = 0;
      if (!days.includes(d.toISOString().slice(0, 10)))
        d.setUTCDate(d.getUTCDate() - 1);
      while (days.includes(d.toISOString().slice(0, 10))) {
        count++;
        d.setUTCDate(d.getUTCDate() - 1);
      }
      if (count >= 7)
        xp(
          uid,
          "streak",
          d.toISOString().slice(0, 10) + ":" + Math.floor(count / 7),
        );
    }
  }
  function topicProgress(uid) {
    return all(
      "SELECT * FROM rc_topic_progress WHERE user_id=? ORDER BY subject,topic",
      uid,
    );
  }
  function updateTopics(uid) {
    const rows = all(
        `SELECT p.subject,p.id paper_id,v.content,i.question_id,i.awarded,i.maximum,i.confidence FROM rc_attempts a JOIN rc_versions v ON v.id=a.version_id JOIN rc_papers p ON p.id=v.paper_id JOIN rc_submissions s ON s.attempt_id=a.id JOIN rc_markings m ON m.submission_id=s.id JOIN rc_marking_items i ON i.marking_id=m.id WHERE a.user_id=? AND p.owner_id<>? ORDER BY a.submitted_at,a.id`,
        uid,
        uid,
      ),
      topics = new Map();
    for (const r of rows) {
      const topic =
          JSON.parse(r.content).questions.find((q) => q.id === r.question_id)
            ?.topic || "General",
        k = r.subject + "|" + topic;
      const t = topics.get(k) || {
        subject: r.subject,
        topic,
        items: new Map(),
      };
      t.items.set(r.paper_id + ":" + r.question_id, r);
      topics.set(k, t);
    }
    for (const t of topics.values()) {
      const items = [...t.items.values()],
        sum = items.reduce((n, x) => n + x.awarded, 0),
        maximum = items.reduce((n, x) => n + x.maximum, 0),
        average = (100 * sum) / maximum,
        successful = new Set(
          items
            .filter(
              (x) => x.awarded / x.maximum >= 0.9 && x.confidence !== "Low",
            )
            .map((x) => x.paper_id),
        ).size;
      const mastered =
          successful >= 3 &&
          items.length >= 10 &&
          average >= 90 &&
          items.every((x) => x.confidence !== "Low"),
        state = mastered
          ? "Mastered"
          : successful >= 2 && average >= 80
            ? "Proficient"
            : items.length >= 5
              ? "Practising"
              : "Learning";
      run(
        "INSERT INTO rc_topic_progress VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id,subject,topic) DO UPDATE SET successful_papers=excluded.successful_papers,questions=excluded.questions,average=excluded.average,state=excluded.state,updated_at=excluded.updated_at",
        uid,
        t.subject,
        t.topic,
        successful,
        items.length,
        average,
        state,
        now(),
      );
      if (mastered) xp(uid, "mastery", t.subject + ":" + t.topic);
      else
        run(
          "UPDATE rc_xp SET amount=0 WHERE user_id=? AND kind='mastery' AND reference=?",
          uid,
          t.subject + ":" + t.topic,
        );
    }
  }
  function paperDraft(uid, scope = "") {
    requireUser(uid);
    const row = get(
      "SELECT content,updated_at FROM rc_paper_drafts WHERE user_id=? AND scope=?",
      uid,
      String(scope),
    );
    return row
      ? { ...JSON.parse(row.content), updatedAt: row.updated_at }
      : null;
  }
  function savePaperDraft(uid, scope, draft) {
    requireUser(uid);
    scope = String(scope || "");
    if (scope) membership(uid, scope);
    if (draft === null) {
      run(
        "DELETE FROM rc_paper_drafts WHERE user_id=? AND scope=?",
        uid,
        scope,
      );
      return { saved: true };
    }
    if (!draft || typeof draft !== "object" || Array.isArray(draft))
      throw new Error("Invalid paper draft.");
    const clean = {
      settings: Object.fromEntries(
        [
          "title",
          "subject",
          "description",
          "totalMarks",
          "duration",
          "difficulty",
          "grade",
          "language",
          "questionCount",
          "pages",
          "onlySources",
          "generateKey",
          "sampleAspects",
        ]
          .filter((k) => Object.hasOwn(draft.settings || {}, k))
          .map((k) => [k, draft.settings[k]]),
      ),
      files: draft.files || [],
      content: draft.content || null,
      answerKey: draft.answerKey || [],
      keySource: String(draft.keySource || "Human-provided answer key"),
    };
    const encoded = JSON.stringify(clean);
    if (encoded.length > 400000) throw new Error("Paper draft is too large.");
    const savedAt = now();
    run(
      "INSERT INTO rc_paper_drafts VALUES(?,?,?,?) ON CONFLICT(user_id,scope) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at",
      uid,
      scope,
      encoded,
      savedAt,
    );
    return { saved: true, updatedAt: savedAt };
  }
  function papers(uid, community = false) {
    return all(
      `SELECT p.*,u.username,(SELECT content FROM rc_versions WHERE paper_id=p.id ORDER BY number DESC LIMIT 1) metadata,(SELECT COUNT(*) FROM rc_attempts a JOIN rc_versions v ON v.id=a.version_id WHERE v.paper_id=p.id AND a.submitted_at IS NOT NULL) attempts,(SELECT id FROM rc_versions WHERE paper_id=p.id ORDER BY number DESC LIMIT 1) version_id,(SELECT COUNT(*) FROM rc_versions WHERE paper_id=p.id) versions,(SELECT ROUND(AVG(rating),1) FROM rc_ratings WHERE paper_id=p.id) rating FROM rc_papers p JOIN users u ON u.id=p.owner_id WHERE ${community ? "p.public=1" : "p.owner_id=?"} ORDER BY p.updated_at DESC`,
      ...(community ? [] : [uid]),
    ).map(({ metadata, ...p }) => {
      const c = JSON.parse(metadata || "{}");
      return {
        ...p,
        grade: c.grade || "",
        difficulty: c.difficulty || "Standard",
        language: c.language || "English",
        duration: c.duration || 30,
        questionCount: (c.questions || []).length,
        topics: [...new Set((c.questions || []).map((q) => q.topic))],
      };
    });
  }
  function paperPage(uid, community = false, page = 1, pageSize = 12, filters = {}) {
    page = Math.max(1, Math.min(10000, Number(page) || 1));
    pageSize = Math.max(1, Math.min(48, Number(pageSize) || 12));
    const query = String(filters.query || "").toLowerCase(),
      rows = papers(uid, community)
        .filter((p) => !filters.subject || filters.subject === "All subjects" || p.subject === filters.subject)
        .filter((p) => !filters.difficulty || filters.difficulty === "All difficulties" || p.difficulty === filters.difficulty)
        .filter((p) => !filters.grade || filters.grade === "All years" || p.grade === filters.grade)
        .filter((p) => !query || [p.title, p.description, p.username, ...p.topics].join(" ").toLowerCase().includes(query))
        .sort((a, b) =>
          filters.sort === "Rating"
            ? (b.rating || 0) - (a.rating || 0)
            : filters.sort === "Most attempted"
              ? b.attempts - a.attempts
              : b.updated_at.localeCompare(a.updated_at),
        ),
      total = rows.length,
      start = (page - 1) * pageSize;
    return {
      items: rows.slice(start, start + pageSize),
      page,
      pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
  function progressHistory(uid) {
    const attempts = results(uid).map((r) => ({
      ...r,
      percent: Math.round((1000 * r.score) / r.maximum) / 10,
      day: r.submitted_at.slice(0, 10),
    }));
    const byDay = new Map();
    for (const row of attempts) {
      const bucket = byDay.get(row.day) || { day: row.day, total: 0, count: 0 };
      bucket.total += row.percent;
      bucket.count++;
      byDay.set(row.day, bucket);
    }
    return {
      attempts: attempts.slice(0, 100),
      trend: [...byDay.values()]
        .map((x) => ({ day: x.day, average: Math.round((x.total / x.count) * 10) / 10, count: x.count }))
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-30),
      topics: all(
        `SELECT p.subject,v.content,i.question_id,i.awarded,i.maximum,a.submitted_at
         FROM rc_attempts a JOIN rc_versions v ON v.id=a.version_id
         JOIN rc_papers p ON p.id=v.paper_id JOIN rc_submissions s ON s.attempt_id=a.id
         JOIN rc_markings m ON m.submission_id=s.id JOIN rc_marking_items i ON i.marking_id=m.id
         WHERE a.user_id=? ORDER BY a.submitted_at DESC LIMIT 500`,
        uid,
      ).map((x) => ({
        subject: x.subject,
        topic:
          JSON.parse(x.content).questions.find((q) => q.id === x.question_id)
            ?.topic || "General",
        score: x.awarded,
        maximum: x.maximum,
        percent: Math.round((1000 * x.awarded) / x.maximum) / 10,
        submitted_at: x.submitted_at,
      })),
    };
  }
  function messages(uid, { groupId, friendId, before, limit = 50 }) {
    limit = Math.max(10, Math.min(100, Number(limit) || 50));
    let rows;
    if (groupId) {
      membership(uid, groupId);
      rows = all(
        `SELECT m.rowid position,m.*,u.username FROM rc_messages m JOIN users u ON u.id=m.sender_id
         WHERE m.group_id=? AND (? IS NULL OR m.rowid<?) ORDER BY m.rowid DESC LIMIT ?`,
        groupId,
        before || null,
        before || null,
        limit + 1,
      );
    } else {
      friendId = Number(friendId);
      if (!isFriend(uid, friendId)) throw new Error("Private chat access denied.");
      rows = all(
        `SELECT m.rowid position,m.*,u.username FROM rc_messages m JOIN users u ON u.id=m.sender_id
         WHERE ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))
         AND (? IS NULL OR m.rowid<?) ORDER BY m.rowid DESC LIMIT ?`,
        uid,
        friendId,
        friendId,
        uid,
        before || null,
        before || null,
        limit + 1,
      );
    }
    const hasMore = rows.length > limit;
    rows = rows.slice(0, limit).reverse();
    if (groupId)
      rows = rows.map((message) => ({
        ...message,
        paper: message.paper_id ? sharedPaper(message.paper_id, groupId) : null,
      }));
    return { items: rows, hasMore, nextCursor: hasMore ? rows[0]?.position : null };
  }
  function globalSearch(uid, query) {
    const q = String(query || "").trim().toLowerCase();
    if (q.length < 2) return [];
    const contains = (value) => String(value || "").toLowerCase().includes(q);
    const out = [];
    for (const p of [...papers(uid), ...papers(uid, true)])
      if (contains(p.title) || contains(p.subject) || contains(p.username) || p.topics.some(contains))
        out.push({ type: p.public ? "Community paper" : "My paper", title: p.title, detail: `${p.subject} · ${p.username}`, href: `/papers/${p.id}` });
    for (const g of groups(uid))
      if (contains(g.name) || contains(g.description))
        out.push({ type: "Study group", title: g.name, detail: g.description, href: `/groups/${g.id}` });
    for (const a of assignments(uid))
      if (contains(a.title) || contains(a.group_name) || contains(a.subject))
        out.push({ type: "Assignment", title: a.title, detail: `${a.group_name} · ${a.status}`, href: "/assignments" });
    for (const u of all("SELECT id,username FROM users WHERE id<>? ORDER BY username LIMIT 500", uid))
      if (contains(u.username)) out.push({ type: "Student", title: u.username, detail: isFriend(uid, u.id) ? "Friend" : "Revision Club student", href: "/friends" });
    for (const subject of SUBJECTS)
      if (contains(subject)) out.push({ type: "Subject", title: subject, detail: "Subject progress", href: `/study?subject=${encodeURIComponent(subject)}` });
    return out.slice(0, 50);
  }
  function assignments(uid) {
    return all(
      `SELECT a.*,g.name group_name,p.subject,v.paper_id FROM rc_assignments a JOIN rc_groups g ON g.id=a.group_id JOIN rc_members m ON m.group_id=a.group_id JOIN rc_versions v ON v.id=a.version_id JOIN rc_papers p ON p.id=v.paper_id WHERE m.user_id=? AND g.archived=0 ORDER BY a.created_at DESC`,
      uid,
    ).map((a) => {
      const attempt = get(
        "SELECT * FROM rc_attempts WHERE assignment_id=? AND user_id=? ORDER BY started_at DESC LIMIT 1",
        a.id,
        uid,
      );
      const marking = attempt
        ? get(
            "SELECT m.id FROM rc_markings m JOIN rc_submissions s ON s.id=m.submission_id WHERE s.attempt_id=?",
            attempt.id,
          )
        : null;
      const marks = all(
        `SELECT SUM(i.awarded)*100.0/SUM(i.maximum) average FROM rc_attempts at JOIN rc_submissions s ON s.attempt_id=at.id JOIN rc_markings m ON m.submission_id=s.id JOIN rc_marking_items i ON i.marking_id=m.id WHERE at.assignment_id=? GROUP BY at.id`,
        a.id,
      );
      return {
        ...a,
        attempt_id: attempt?.id || null,
        marking_id: marking?.id || null,
        status: attempt?.submitted_at
          ? "Submitted"
          : a.due_at && a.due_at < now()
            ? "Overdue"
            : attempt
              ? "In progress"
              : "Open",
        completion_count: get(
          "SELECT COUNT(DISTINCT user_id) n FROM rc_attempts WHERE assignment_id=? AND submitted_at IS NOT NULL",
          a.id,
        ).n,
        average: marks.length
          ? Math.round(
              (marks.reduce((sum, x) => sum + x.average, 0) / marks.length) *
                10,
            ) / 10
          : null,
      };
    });
  }
  function groups(uid) {
    return all(
      "SELECT g.*,m.role,(SELECT COUNT(*) FROM rc_members WHERE group_id=g.id) members FROM rc_groups g JOIN rc_members m ON m.group_id=g.id WHERE m.user_id=? AND g.archived=0",
      uid,
    ).map((g) => ({ ...g, unread: unreadMessages(uid, g.id) }));
  }
  function groupRanking(gid) {
    // Match the group podium: average each confirmed paper percentage equally.
    const rows = all(
      `
      SELECT member.user_id id, AVG(mark.score * 100.0 / mark.maximum) average
      FROM rc_members member JOIN rc_groups g ON g.id=member.group_id
      JOIN rc_attempts a ON a.user_id=member.user_id
      JOIN rc_submissions submission ON submission.attempt_id=a.id
      JOIN (
        SELECT m.id,m.submission_id,SUM(i.awarded) score,SUM(i.maximum) maximum
        FROM rc_markings m JOIN rc_marking_items i ON i.marking_id=m.id
        GROUP BY m.id
        HAVING SUM(CASE WHEN i.confidence='Low' OR EXISTS(
          SELECT 1 FROM rc_challenges c WHERE c.item_id=i.id AND c.status='Challenged'
        ) THEN 1 ELSE 0 END)=0
      ) mark ON mark.submission_id=submission.id
      WHERE member.group_id=? AND g.archived=0
      GROUP BY member.user_id ORDER BY average DESC,member.user_id`,
      gid,
    );
    return rows.map((r) => ({
      ...r,
      average: Math.round(r.average * 10) / 10,
    }));
  }
  function awardGroupToppers(gid) {
    const ranking = groupRanking(gid);
    if (!ranking.length) return;
    for (const row of ranking.filter((r) => r.average === ranking[0].average)) {
      const change = run(
        "INSERT OR IGNORE INTO rc_achievements VALUES(?,?,?)",
        row.id,
        "topper",
        now(),
      );
      if (change.changes)
        notify(row.id, "Achievement unlocked", "Topper", "/profile");
    }
  }
  function group(uid, gid) {
    const m = membership(uid, gid),
      g = get("SELECT * FROM rc_groups WHERE id=?", gid);
    awardGroupToppers(gid);
    const ranking = groupRanking(gid);
    const members = all(
      "SELECT u.id,u.username,u.avatar_url,m.role FROM rc_members m JOIN users u ON u.id=m.user_id WHERE m.group_id=?",
      gid,
    ).map((u) => ({
      ...u,
      ...stats(u.id),
      rankingAverage: ranking.find((r) => r.id === u.id)?.average ?? null,
      subjectStats: stats(u.id).subjects,
      subjects: all(
        "SELECT subject FROM rc_member_subjects WHERE group_id=? AND user_id=?",
        gid,
        u.id,
      ).map((x) => x.subject),
      papers: get(
        "SELECT COUNT(DISTINCT v.paper_id) n FROM rc_assignments a JOIN rc_versions v ON v.id=a.version_id JOIN rc_papers p ON p.id=v.paper_id WHERE a.group_id=? AND p.owner_id=?",
        gid,
        u.id,
      ).n,
    }));
    const scored = members.filter((x) => x.average !== null);
    return {
      ...g,
      role: m.role,
      members,
      average: scored.length
        ? Math.round(
            (scored.reduce((n, x) => n + x.average, 0) / scored.length) * 100,
          ) / 100
        : null,
      subjects: all(
        "SELECT subject FROM rc_group_subjects WHERE group_id=?",
        gid,
      ).map((x) => x.subject),
      messages: all(
        "SELECT m.rowid position,m.*,u.username FROM rc_messages m JOIN users u ON u.id=m.sender_id WHERE group_id=? ORDER BY m.rowid DESC LIMIT 50",
        gid,
      )
        .reverse()
        .map((message) => ({
          ...message,
          paper: message.paper_id ? sharedPaper(message.paper_id, gid) : null,
        })),
      messageHasMore:
        get("SELECT COUNT(*) n FROM rc_messages WHERE group_id=?", gid).n > 50,
      assignments: all(
        `SELECT a.*,p.subject,v.paper_id,(SELECT COUNT(*) FROM rc_attempts WHERE assignment_id=a.id AND submitted_at IS NOT NULL) completed FROM rc_assignments a JOIN rc_versions v ON v.id=a.version_id JOIN rc_papers p ON p.id=v.paper_id WHERE a.group_id=? ORDER BY a.created_at DESC`,
        gid,
      ),
      requests: all(
        `SELECT r.*,u.username FROM rc_subject_requests r JOIN users u ON u.id=r.user_id WHERE group_id=? ${m.role === "Member" ? "AND r.user_id=?" : ""} ORDER BY r.rowid DESC`,
        ...(m.role === "Member" ? [gid, uid] : [gid]),
      ),
    };
  }
  function friends(uid) {
    return all(
      "SELECT f.*,u.id,u.username FROM rc_friends f JOIN users u ON u.id=CASE WHEN f.requester=? THEN f.recipient ELSE f.requester END WHERE f.requester=? OR f.recipient=?",
      uid,
      uid,
      uid,
    ).map((f) => ({
      ...f,
      incoming: f.recipient === uid,
      unread: f.status === "Accepted" ? unreadMessages(uid, null, f.id) : 0,
    }));
  }
  function unreadMessages(uid, groupId, friendId) {
    const scope = groupId ? "group:" + groupId : "friend:" + friendId;
    const cursor =
      get(
        "SELECT last_row FROM rc_message_reads WHERE user_id=? AND scope=?",
        uid,
        scope,
      )?.last_row || 0;
    return groupId
      ? get(
          "SELECT COUNT(*) n FROM rc_messages WHERE group_id=? AND sender_id<>? AND rowid>?",
          groupId,
          uid,
          cursor,
        ).n
      : get(
          "SELECT COUNT(*) n FROM rc_messages WHERE recipient_id=? AND sender_id=? AND rowid>?",
          uid,
          friendId,
          cursor,
        ).n;
  }
  function sharedPaper(paperId, groupId) {
    const p = get(
      `SELECT p.id,p.title,p.subject,u.username FROM rc_papers p JOIN users u ON u.id=p.owner_id WHERE p.id=? AND (p.public=1 OR EXISTS(SELECT 1 FROM rc_assignments a JOIN rc_versions v ON v.id=a.version_id WHERE a.group_id=? AND v.paper_id=p.id))`,
      paperId,
      groupId,
    );
    if (!p) return null;
    const version = get(
      `SELECT v.content FROM rc_versions v JOIN rc_papers p ON p.id=v.paper_id WHERE p.id=? AND (p.public=1 OR EXISTS(SELECT 1 FROM rc_assignments a WHERE a.group_id=? AND a.version_id=v.id)) ORDER BY v.number DESC LIMIT 1`,
      p.id,
      groupId,
    );
    const c = JSON.parse(version?.content || "{}");
    return {
      ...p,
      duration: c.duration || 30,
      marks: (c.questions || []).reduce((sum, q) => sum + q.marks, 0),
    };
  }
  function isFriend(a, b) {
    return !!get(
      "SELECT 1 FROM rc_friends WHERE status='Accepted' AND ((requester=? AND recipient=?) OR (requester=? AND recipient=?))",
      a,
      b,
      b,
      a,
    );
  }
  function challengeOpponents(uid) {
    return all(
      `SELECT u.id,u.username,
        EXISTS(SELECT 1 FROM rc_friends f WHERE f.status='Accepted' AND ((f.requester=? AND f.recipient=u.id) OR (f.recipient=? AND f.requester=u.id))) friend
       FROM users u WHERE u.id<>? AND (
        EXISTS(SELECT 1 FROM rc_friends f WHERE f.status='Accepted' AND ((f.requester=? AND f.recipient=u.id) OR (f.recipient=? AND f.requester=u.id)))
        OR EXISTS(SELECT 1 FROM rc_members mine JOIN rc_members other ON other.group_id=mine.group_id JOIN rc_groups g ON g.id=mine.group_id WHERE mine.user_id=? AND other.user_id=u.id AND g.archived=0)
       ) ORDER BY u.username COLLATE NOCASE,u.id`,
      uid,
      uid,
      uid,
      uid,
      uid,
      uid,
    ).map((u) => ({
      ...u,
      relationship: u.friend ? "Friend" : "Study group member",
    }));
  }
  function reminders(uid) {
    const rows = all(
      "SELECT * FROM rc_sessions WHERE user_id=? AND reminded=0 AND completed_at IS NULL AND starts_at>=? AND starts_at<=?",
      uid,
      now(),
      new Date(Date.now() + 300000).toISOString(),
    );
    for (const s of rows)
      db.transaction(() => {
        run("UPDATE rc_sessions SET reminded=1 WHERE id=?", s.id);
        notify(uid, "Study session begins soon", s.title, "/timetable");
      })();
  }
  function studySuggestions(uid) {
    const rows = all(
      `WITH latest AS (
      SELECT p.subject,mt.topic,mt.id mistake_id,mt.corrected_at,i.confidence,i.awarded,i.maximum,a.submitted_at,
      EXISTS(SELECT 1 FROM rc_challenges c WHERE c.item_id=i.id AND c.status<>'Resolved') disputed,
      ROW_NUMBER() OVER (PARTITION BY v.paper_id,i.question_id ORDER BY a.submitted_at DESC,a.rowid DESC) position
      FROM rc_attempts a JOIN rc_versions v ON v.id=a.version_id JOIN rc_papers p ON p.id=v.paper_id
      JOIN rc_submissions sub ON sub.attempt_id=a.id JOIN rc_markings m ON m.submission_id=sub.id
      JOIN rc_marking_items i ON i.marking_id=m.id LEFT JOIN rc_mistakes mt ON mt.item_id=i.id WHERE a.user_id=?
    ) SELECT subject,topic,COUNT(*) count,MAX(submitted_at) recent FROM latest
      WHERE position=1 AND mistake_id IS NOT NULL AND corrected_at IS NULL AND confidence<>'Low' AND disputed=0 AND awarded<maximum
      GROUP BY subject,topic ORDER BY count DESC,recent DESC,subject,topic`,
      uid,
    );
    const planned = all(
      "SELECT subject,topic,starts_at,duration,started_at FROM rc_sessions WHERE user_id=? AND completed_at IS NULL",
      uid,
    ).filter(
      (s) =>
        s.started_at ||
        Date.parse(s.starts_at) + s.duration * 60000 >= Date.now(),
    );
    return rows
      .filter(
        (r) =>
          !planned.some(
            (s) =>
              s.subject === r.subject &&
              normalize(s.topic) === normalize(r.topic),
          ),
      )
      .slice(0, 3)
      .map((r) => ({
        id: r.subject + ":" + r.topic,
        subject: r.subject,
        topic: r.topic,
        title: "Revise " + r.topic,
        duration: 20,
        reason: `${r.count} confirmed question${r.count === 1 ? "" : "s"} to revisit in ${r.topic}. Based on your latest answers; provisional marks and open marking reviews are excluded.`,
      }));
  }
  function dashboard(uid) {
    requireUser(uid);
    reminders(uid);
    const s = stats(uid),
      history = progressHistory(uid),
      recent = history.attempts.slice(0, 5),
      previous = history.attempts.slice(5, 10),
      recentAverage = recent.length
        ? recent.reduce((sum, x) => sum + x.percent, 0) / recent.length
        : null,
      previousAverage = previous.length
        ? previous.reduce((sum, x) => sum + x.percent, 0) / previous.length
        : null;
    return {
      generatedAt: now(),
      stats: {
        ...s,
        trend:
          recentAverage === null || previousAverage === null
            ? null
            : Math.round((recentAverage - previousAverage) * 10) / 10,
      },
      history: history.trend,
      topics: topicProgress(uid),
      suggestions: studySuggestions(uid),
      papers: papers(uid).slice(0, 4),
      results: results(uid).slice(0, 5),
      groups: groups(uid),
      sessions: all(
        "SELECT * FROM rc_sessions WHERE user_id=? ORDER BY starts_at",
        uid,
      ),
      mistakes: mistakes(uid)
        .filter((x) => !x.corrected_at)
        .slice(0, 5),
      achievements: all("SELECT * FROM rc_achievements WHERE user_id=?", uid),
      notifications: all(
        "SELECT * FROM rc_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 40",
        uid,
      ),
      battles: battles(uid),
      exams: all(
        "SELECT * FROM rc_exams WHERE user_id=? AND starts_at>=? ORDER BY starts_at LIMIT 20",
        uid,
        now(),
      ),
      assignments: assignments(uid).filter((a) => a.status !== "Submitted").slice(0, 5),
      friends: leaderboard(uid, "Friends", "Weekly", "XP").slice(0, 3),
    };
  }
  function mistakes(uid) {
    return all(
      "SELECT e.*,i.question_id,i.answer,i.correct,i.explanation,i.marking_id,v.content FROM rc_mistakes e JOIN rc_marking_items i ON i.id=e.item_id JOIN rc_markings m ON m.id=i.marking_id JOIN rc_submissions s ON s.id=m.submission_id JOIN rc_attempts a ON a.id=s.attempt_id JOIN rc_versions v ON v.id=a.version_id WHERE e.user_id=? ORDER BY e.rowid DESC",
      uid,
    ).map((x) => ({
      ...x,
      question: JSON.parse(x.content).questions.find(
        (q) => q.id === x.question_id,
      ),
      content: undefined,
    }));
  }
  function bossState(uid, gameId) {
    const g = get(
      "SELECT * FROM rc_games WHERE id=? AND user_id=? AND game='Boss Battle'",
      gameId,
      uid,
    );
    if (!g) throw new Error("Boss battle unavailable.");
    const questions = JSON.parse(g.questions);
    const answers = all(
      "SELECT question_id,answer,correct FROM rc_game_answers WHERE game_id=? ORDER BY rowid",
      gameId,
    );
    const correct = answers.filter((a) => a.correct).length;
    const health = Math.max(0, 100 - (answers.length - correct) * 20);
    return {
      answers,
      bossHealth: Math.max(
        0,
        Math.round(100 - (correct * 100) / questions.length),
      ),
      health,
      complete: health === 0 || answers.length === questions.length,
    };
  }
  function revisionGame(uid, versionId) {
    const { v, p } = versionAccess(uid, versionId),
      content = JSON.parse(v.content),
      key = keyFor(versionId);
    if (!key) throw new Error("Choose a paper with an answer key.");
    const questions = content.questions
      .map((question) => {
        const answer = key.content.find((item) => item.questionId === question.id)?.answer;
        if (!answer || answer.length > 300) return null;
        const options = (question.options || []).filter(Boolean);
        return {
          id: question.id,
          text: question.text,
          type: options.length >= 2 ? "choice" : "text",
          answer,
          options: options.length >= 2 ? options : undefined,
          explanation: `From ${p.title} · ${question.topic || "General"}`,
        };
      })
      .filter(Boolean)
      .slice(0, 10);
    if (!questions.length)
      throw new Error("This paper does not contain short game-ready questions.");
    return {
      name: "Revision Mix",
      icon: "✦",
      subject: p.subject,
      description: `Questions from ${p.title}`,
      topic: p.title,
      questions,
    };
  }
  function bossAnswer(uid, gameId, questionId, answer) {
    return db.transaction(() => {
      const g = get(
        "SELECT * FROM rc_games WHERE id=? AND user_id=? AND game='Boss Battle'",
        gameId,
        uid,
      );
      if (!g || g.finished_at || Date.now() - Date.parse(g.started_at) > 180000)
        throw new Error("Boss battle ended. Start a new round.");
      const questions = JSON.parse(g.questions);
      const q = questions.find((q) => q.id === String(questionId));
      if (!q) throw new Error("Question unavailable.");
      let state = bossState(uid, gameId);
      if (!state.answers.some((a) => a.question_id === q.id)) {
        if (state.complete) throw new Error("This round has ended.");
        if (questions[state.answers.length].id !== q.id)
          throw new Error("Answer the current question first.");
        const clean = text(answer, 1000);
        run(
          "INSERT INTO rc_game_answers VALUES(?,?,?,?)",
          gameId,
          q.id,
          clean,
          Number(normalize(clean) === normalize(q.answer)),
        );
        state = bossState(uid, gameId);
      }
      return {
        ...state,
        lastAnswer: {
          questionId: q.id,
          correct: !!state.answers.find((a) => a.question_id === q.id).correct,
          expected: q.answer,
        },
      };
    })();
  }
  function battleResult(b) {
    const scores = [b.challenger_attempt, b.opponent_attempt]
      .map((aid) =>
        aid
          ? get(
              `SELECT m.id marking_id,a.user_id,a.started_at,a.submitted_at,SUM(i.awarded) score,SUM(i.maximum) maximum,SUM(CASE WHEN i.confidence='Low' THEN 1 ELSE 0 END) uncertain,(SELECT COUNT(*) FROM rc_challenges c JOIN rc_marking_items mi ON mi.id=c.item_id WHERE mi.marking_id=m.id AND c.status<>'Resolved') open_challenges FROM rc_attempts a JOIN rc_submissions s ON s.attempt_id=a.id JOIN rc_markings m ON m.submission_id=s.id JOIN rc_marking_items i ON i.marking_id=m.id WHERE a.id=? GROUP BY m.id`,
              aid,
            )
          : null,
      )
      .map((s) =>
        s
          ? {
              ...s,
              elapsed: Math.max(
                0,
                Date.parse(s.submitted_at) - Date.parse(s.started_at),
              ),
            }
          : null,
      );
    const both = scores.every((s) => s?.maximum),
      pending = both && scores.some((s) => s.uncertain || s.open_challenges);
    let winner = null;
    if (both && !pending) {
      const [a, o] = scores;
      winner =
        a.score > o.score
          ? b.challenger
          : o.score > a.score
            ? b.opponent
            : null;
      if (
        winner === null &&
        b.mode === "Speed Battle" &&
        a.elapsed !== o.elapsed
      )
        winner = a.elapsed < o.elapsed ? b.challenger : b.opponent;
    }
    return {
      ...b,
      scores,
      status: both ? (pending ? "Under review" : "Completed") : b.status,
      winner,
      completed_at: both
        ? scores
            .map((s) => s.submitted_at)
            .sort()
            .at(-1)
        : null,
    };
  }
  function battles(uid) {
    return all(
      "SELECT b.*,u.username challenger_name,o.username opponent_name,p.title,p.id paper_id FROM rc_battles b JOIN users u ON u.id=b.challenger JOIN users o ON o.id=b.opponent JOIN rc_versions v ON v.id=b.version_id JOIN rc_papers p ON p.id=v.paper_id WHERE challenger=? OR opponent=? ORDER BY b.created_at DESC",
      uid,
      uid,
    ).map((row) => {
      const b = battleResult(row),
        mine = b.challenger === uid ? 0 : 1;
      return {
        ...b,
        incoming: b.opponent === uid,
        my_attempt: mine === 0 ? b.challenger_attempt : b.opponent_attempt,
        my_result: b.scores[mine]?.marking_id || null,
        xp_earned:
          get(
            "SELECT amount FROM rc_battle_xp_receipts WHERE battle_id=? AND user_id=?",
            b.id,
            uid,
          )?.amount || 0,
        scores: b.scores.map((s, i) =>
          s && (i === mine || b.scores[mine])
            ? { score: s.score, maximum: s.maximum, elapsed: s.elapsed }
            : null,
        ),
        winner_name:
          b.winner === b.challenger
            ? b.challenger_name
            : b.winner === b.opponent
              ? b.opponent_name
              : null,
      };
    });
  }
  function challengeWins(uid, since) {
    const seen = new Set();
    let wins = 0;
    const rows = all(
      "SELECT b.*,v.paper_id FROM rc_battles b JOIN rc_versions v ON v.id=b.version_id WHERE challenger=? OR opponent=? ORDER BY b.created_at,b.rowid",
      uid,
      uid,
    );
    for (const row of rows) {
      const b = battleResult(row);
      if (b.status !== "Completed") continue;
      const opponent = b.challenger === uid ? b.opponent : b.challenger;
      const ref = opponent + ":" + b.paper_id;
      if (seen.has(ref)) continue;
      seen.add(ref);
      if (b.winner === uid && b.completed_at >= since) wins++;
    }
    return wins;
  }
  function leaderboard(
    uid,
    scope = "Global",
    range = "Weekly",
    category = "XP",
  ) {
    let users = all(
      "SELECT u.id,u.username,p.school FROM users u LEFT JOIN rc_profiles p ON p.user_id=u.id",
    );
    if (scope === "Friends")
      users = users.filter((u) => u.id === uid || isFriend(uid, u.id));
    if (scope === "School") {
      const school = get(
        "SELECT school FROM rc_profiles WHERE user_id=?",
        uid,
      )?.school;
      users = users.filter((u) => school && u.school === school);
    }
    const since =
      range === "All Time"
        ? "1970"
        : new Date(
            Date.now() - (range === "Monthly" ? 30 : 7) * 86400000,
          ).toISOString();
    return users
      .map((u) => {
        let value = 0;
        if (category === "XP")
          value = get(
            "SELECT COALESCE(SUM(amount),0) n FROM rc_xp WHERE user_id=? AND created_at>=?",
            u.id,
            since,
          ).n;
        else if (category === "Papers Completed")
          value = results(u.id).filter((r) => r.submitted_at >= since).length;
        else if (category === "Challenges Won")
          value = challengeWins(u.id, since);
        else if (category === "Revision Streak") value = stats(u.id).streak;
        else if (category === "Questions Correct")
          value = get(
            "SELECT COUNT(*) n FROM rc_marking_items i JOIN rc_markings m ON m.id=i.marking_id JOIN rc_submissions s ON s.id=m.submission_id JOIN rc_attempts a ON a.id=s.attempt_id WHERE a.user_id=? AND a.submitted_at>=? AND i.awarded=i.maximum",
            u.id,
            since,
          ).n;
        return {
          ...u,
          value,
          ...progress(
            get(
              "SELECT COALESCE(SUM(amount),0) n FROM rc_xp WHERE user_id=?",
              u.id,
            ).n,
          ),
        };
      })
      .sort((a, b) => b.value - a.value || a.username.localeCompare(b.username))
      .slice(0, 100);
  }
  function mutate(uid, action, b) {
    requireUser(uid);
    return db.transaction(() => {
      if (action === "publish") {
        const p = paperAccess(uid, b.paperId);
        if (p.owner_id !== uid)
          throw new Error("Only the creator can publish.");
        run(
          "UPDATE rc_papers SET public=?,state=?,updated_at=? WHERE id=?",
          b.public ? 1 : 0,
          b.public ? "Published" : "Generated",
          now(),
          p.id,
        );
        return {};
      }
      if (action === "archive") {
        const p = paperAccess(uid, b.paperId);
        if (p.owner_id !== uid) throw new Error("Creator permission required.");
        run("UPDATE rc_papers SET state='Archived' WHERE id=?", p.id);
        return {};
      }
      if (action === "duplicate") {
        const p = paper(uid, b.paperId),
          v = p.versions[0];
        if (p.owner_id !== uid) throw new Error("Creator permission required.");
        const context = versionEditContext(uid, v.id);
        return savePaper(
          uid,
          {
            ...context.settings,
            title: p.title + " — copy",
            fileIds: context.files.map((f) => f.id),
          },
          v.content,
          v.key?.content,
          v.key?.source,
        );
      }
      if (action === "notification") {
        run(
          "UPDATE rc_notifications SET is_read=1 WHERE user_id=? AND id=?",
          uid,
          b.id,
        );
        return {};
      }
      if (action === "notificationsReadAll") {
        run("UPDATE rc_notifications SET is_read=1 WHERE user_id=?", uid);
        return {};
      }
      if (action === "notificationDelete") {
        run("DELETE FROM rc_notifications WHERE user_id=? AND id=?", uid, b.id);
        return {};
      }
      if (action === "notificationsClearRead") {
        run("DELETE FROM rc_notifications WHERE user_id=? AND is_read=1", uid);
        return {};
      }
      if (action === "profile") {
        run(
          "INSERT INTO rc_profiles VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET school=excluded.school,bio=excluded.bio",
          uid,
          String(b.school || "").slice(0, 100),
          String(b.bio || "").slice(0, 500),
        );
        return {};
      }
      if (action === "profileAvatar") {
        const avatar = String(b.avatar || "");
        if (
          avatar &&
          (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar) ||
            avatar.length > 450000)
        )
          throw new Error("Use a PNG, JPEG or WebP avatar smaller than 300 KB.");
        run("UPDATE users SET avatar_url=? WHERE id=?", avatar || null, uid);
        return { avatarUrl: avatar || null };
      }
      if (action === "notificationPreferences") {
        run(
          `INSERT INTO rc_notification_preferences VALUES(?,?,?,?)
           ON CONFLICT(user_id) DO UPDATE SET study_reminders=excluded.study_reminders,social_updates=excluded.social_updates,achievement_updates=excluded.achievement_updates`,
          uid,
          Number(!!b.studyReminders),
          Number(!!b.socialUpdates),
          Number(!!b.achievementUpdates),
        );
        return {};
      }
      if (action === "groupCreate") {
        const gid = id();
        run(
          "INSERT INTO rc_groups(id,name,description,owner_id,invite,created_at) VALUES(?,?,?,?,?,?)",
          gid,
          text(b.name, 100),
          String(b.description || "").slice(0, 1000),
          uid,
          id(),
          now(),
        );
        run("INSERT INTO rc_members VALUES(?,?,?)", gid, uid, "Owner");
        for (const s of b.subjects || SUBJECTS)
          run(
            "INSERT INTO rc_group_subjects VALUES(?,?)",
            gid,
            validSubject(s),
          );
        return { id: gid };
      }
      if (action === "groupJoin") {
        const g = get(
          "SELECT * FROM rc_groups WHERE invite=?",
          text(b.invite, 100),
        );
        if (!g || g.archived) throw new Error("Invalid invite code.");
        run(
          "INSERT OR IGNORE INTO rc_members VALUES(?,?,?)",
          g.id,
          uid,
          "Member",
        );
        awardGroupToppers(g.id);
        return { id: g.id };
      }
      if (action === "assign") {
        const { p } = versionAccess(uid, b.versionId);
        if (p.owner_id !== uid)
          throw new Error("Only the creator can assign this paper.");
        groupSubject(uid, b.groupId, p.subject);
        if (
          get("SELECT COUNT(*) n FROM rc_members WHERE group_id=?", b.groupId)
            .n < 3
        )
          throw new Error("Invite at least 3 members to activate assignments.");
        if (
          b.dueAt &&
          (!Number.isFinite(Date.parse(b.dueAt)) ||
            Date.parse(b.dueAt) < Date.now())
        )
          throw new Error("Choose a future deadline.");
        const aid = id();
        run(
          "INSERT INTO rc_assignments VALUES(?,?,?,?,?,?,?)",
          aid,
          b.groupId,
          b.versionId,
          uid,
          p.title,
          b.dueAt ? new Date(b.dueAt).toISOString() : null,
          now(),
        );
        for (const m of all(
          "SELECT user_id FROM rc_members WHERE group_id=?",
          b.groupId,
        ))
          notify(
            m.user_id,
            "Assignment posted",
            p.title,
            `/groups/${b.groupId}`,
          );
        return { id: aid };
      }
      if (action === "subjectRequest") {
        membership(uid, b.groupId);
        validSubject(b.subject);
        if (
          !get(
            "SELECT 1 FROM rc_group_subjects WHERE group_id=? AND subject=?",
            b.groupId,
            b.subject,
          )
        )
          throw new Error("Subject is not enabled.");
        if (
          get(
            "SELECT 1 FROM rc_subject_requests WHERE group_id=? AND user_id=? AND subject=? AND status='Pending'",
            b.groupId,
            uid,
            b.subject,
          )
        )
          throw new Error("A request is already pending.");
        run(
          "INSERT INTO rc_subject_requests(id,group_id,user_id,subject,reason) VALUES(?,?,?,?,?)",
          id(),
          b.groupId,
          uid,
          b.subject,
          String(b.reason || "").slice(0, 1000),
        );
        for (const m of all(
          "SELECT user_id FROM rc_members WHERE group_id=? AND role<>'Member'",
          b.groupId,
        ))
          notify(
            m.user_id,
            "Subject access requested",
            b.subject,
            `/groups/${b.groupId}`,
          );
        return {};
      }
      if (action === "subjectReview") {
        const r = get("SELECT * FROM rc_subject_requests WHERE id=?", b.id);
        if (!r || r.status !== "Pending")
          throw new Error("Request is not pending.");
        membership(uid, r.group_id, true);
        run(
          "UPDATE rc_subject_requests SET status=?,response=?,reviewed_by=?,reviewed_at=? WHERE id=?",
          b.approve ? "Approved" : "Rejected",
          text(b.response, 1000),
          uid,
          now(),
          r.id,
        );
        if (
          b.approve &&
          get(
            "SELECT 1 FROM rc_member_subjects WHERE group_id=? AND subject=? AND user_id<>?",
            r.group_id,
            r.subject,
            r.user_id,
          )
        )
          throw new Error(
            "Subject is already assigned. Use member access management for an explicit overlap override.",
          );
        if (b.approve)
          run(
            "INSERT OR IGNORE INTO rc_member_subjects VALUES(?,?,?)",
            r.group_id,
            r.user_id,
            r.subject,
          );
        notify(
          r.user_id,
          b.approve ? "Subject Access Approved" : "Subject Access Rejected",
          b.response,
          `/groups/${r.group_id}`,
        );
        return {};
      }
      if (action === "memberSubject") {
        membership(uid, b.groupId, true);
        membership(b.userId, b.groupId);
        validSubject(b.subject);
        if (
          !get(
            "SELECT 1 FROM rc_group_subjects WHERE group_id=? AND subject=?",
            b.groupId,
            b.subject,
          )
        )
          throw new Error("Subject not enabled.");
        if (
          b.allow &&
          !b.override &&
          get(
            "SELECT 1 FROM rc_member_subjects WHERE group_id=? AND subject=? AND user_id<>?",
            b.groupId,
            b.subject,
            b.userId,
          )
        )
          throw new Error(
            "This subject is assigned to another member. Confirm an overlap override.",
          );
        if (b.allow)
          run(
            "INSERT OR IGNORE INTO rc_member_subjects VALUES(?,?,?)",
            b.groupId,
            b.userId,
            b.subject,
          );
        else
          run(
            "DELETE FROM rc_member_subjects WHERE group_id=? AND user_id=? AND subject=?",
            b.groupId,
            b.userId,
            b.subject,
          );
        notify(
          b.userId,
          "Subject access updated",
          `${b.subject} access ${b.allow ? "added" : "removed"}`,
          `/groups/${b.groupId}`,
        );
        return {};
      }
      if (action === "groupSettings") {
        membership(uid, b.groupId, true);
        run(
          "UPDATE rc_groups SET name=?,description=? WHERE id=?",
          text(b.name, 100),
          String(b.description || "").slice(0, 1000),
          b.groupId,
        );
        const subjects = [...new Set(b.subjects || [])].map(validSubject);
        if (!subjects.length)
          throw new Error("Keep at least one allowed subject.");
        for (const old of all(
          "SELECT subject FROM rc_group_subjects WHERE group_id=?",
          b.groupId,
        ))
          if (!subjects.includes(old.subject)) {
            for (const member of all(
              "SELECT user_id FROM rc_member_subjects WHERE group_id=? AND subject=?",
              b.groupId,
              old.subject,
            ))
              notify(
                member.user_id,
                "Subject access removed",
                old.subject,
                "/groups/" + b.groupId,
              );
            run(
              "DELETE FROM rc_member_subjects WHERE group_id=? AND subject=?",
              b.groupId,
              old.subject,
            );
          }
        run("DELETE FROM rc_group_subjects WHERE group_id=?", b.groupId);
        for (const subject of subjects)
          run("INSERT INTO rc_group_subjects VALUES(?,?)", b.groupId, subject);
        return {};
      }
      if (action === "groupTransfer") {
        const own = membership(uid, b.groupId, true);
        if (own.role !== "Owner")
          throw new Error("Only the owner can transfer ownership.");
        const next = Number(b.userId);
        if (next === uid) throw new Error("Choose another member.");
        membership(next, b.groupId);
        run(
          "UPDATE rc_members SET role='Admin' WHERE group_id=? AND user_id=?",
          b.groupId,
          uid,
        );
        run(
          "UPDATE rc_members SET role='Owner' WHERE group_id=? AND user_id=?",
          b.groupId,
          next,
        );
        run("UPDATE rc_groups SET owner_id=? WHERE id=?", next, b.groupId);
        notify(
          next,
          "You now own this group",
          "Ownership transferred.",
          "/groups/" + b.groupId,
        );
        return {};
      }
      if (action === "groupRemoveMember" || action === "groupLeave") {
        const own = membership(uid, b.groupId),
          target = action === "groupLeave" ? uid : Number(b.userId),
          member = membership(target, b.groupId);
        if (member.role === "Owner")
          throw new Error("Transfer ownership before leaving.");
        if (
          target !== uid &&
          (own.role === "Member" ||
            (own.role === "Admin" && member.role !== "Member"))
        )
          throw new Error("Member management permission denied.");
        run(
          "DELETE FROM rc_member_subjects WHERE group_id=? AND user_id=?",
          b.groupId,
          target,
        );
        run(
          "DELETE FROM rc_subject_requests WHERE group_id=? AND user_id=?",
          b.groupId,
          target,
        );
        run(
          "DELETE FROM rc_members WHERE group_id=? AND user_id=?",
          b.groupId,
          target,
        );
        notify(
          target,
          "Group membership ended",
          "Your private submissions are retained in Results.",
          "/results",
        );
        return {};
      }
      if (action === "groupDelete") {
        if (membership(uid, b.groupId, true).role !== "Owner")
          throw new Error("Only the owner can delete the group.");
        if (!b.confirm) throw new Error("Confirm group deletion.");
        run(
          "UPDATE rc_groups SET archived=1,invite=? WHERE id=?",
          id(),
          b.groupId,
        );
        return {};
      }
      if (action === "role") {
        const m = membership(uid, b.groupId, true);
        if (
          m.role !== "Owner" ||
          b.userId === uid ||
          !["Admin", "Member"].includes(b.role)
        )
          throw new Error("Only the owner can manage admins.");
        membership(b.userId, b.groupId);
        run(
          "UPDATE rc_members SET role=? WHERE group_id=? AND user_id=?",
          b.role,
          b.groupId,
          b.userId,
        );
        return {};
      }
      if (action === "messageRead") {
        const friendId = Number(b.recipientId);
        if (b.groupId) membership(uid, b.groupId);
        else if (!isFriend(uid, friendId))
          throw new Error("Private chat access denied.");
        const message = get(
          "SELECT rowid position,* FROM rc_messages WHERE id=?",
          b.messageId,
        );
        const allowed =
          message &&
          (b.groupId
            ? message.group_id === b.groupId
            : !message.group_id &&
              ((message.sender_id === uid &&
                message.recipient_id === friendId) ||
                (message.sender_id === friendId &&
                  message.recipient_id === uid)));
        if (!allowed) throw new Error("Message access denied.");
        const scope = b.groupId ? "group:" + b.groupId : "friend:" + friendId;
        run(
          "INSERT INTO rc_message_reads VALUES(?,?,?) ON CONFLICT(user_id,scope) DO UPDATE SET last_row=MAX(last_row,excluded.last_row)",
          uid,
          scope,
          message.position,
        );
        return {};
      }
      if (action === "message") {
        if (b.groupId) membership(uid, b.groupId);
        else if (!isFriend(uid, Number(b.recipientId)))
          throw new Error("Private chats require an accepted friend request.");
        const shared =
          b.paperId && b.groupId ? sharedPaper(b.paperId, b.groupId) : null;
        if (b.paperId && !shared)
          throw new Error(
            "Choose a public paper or a paper assigned to this group.",
          );
        const body = b.body?.trim()
          ? text(b.body, 3000)
          : shared
            ? "Shared a paper"
            : text(b.body, 3000);
        run(
          "INSERT INTO rc_messages(id,sender_id,group_id,recipient_id,body,created_at,paper_id) VALUES(?,?,?,?,?,?,?)",
          id(),
          uid,
          b.groupId || null,
          b.groupId ? null : Number(b.recipientId),
          body,
          now(),
          shared?.id || null,
        );
        return {};
      }
      if (action === "friendRequest") {
        const other = get(
          "SELECT id FROM users WHERE username=?",
          text(b.username, 80),
        );
        if (!other || other.id === uid)
          throw new Error("Choose another registered user.");
        if (
          get(
            "SELECT 1 FROM rc_friends WHERE (requester=? AND recipient=?) OR (requester=? AND recipient=?)",
            uid,
            other.id,
            other.id,
            uid,
          )
        )
          throw new Error("A friendship or request already exists.");
        run(
          "INSERT INTO rc_friends VALUES(?,?,?,?)",
          uid,
          other.id,
          "Pending",
          now(),
        );
        notify(
          other.id,
          "Friend request received",
          "Open Friends to respond.",
          "/friends",
        );
        return {};
      }
      if (action === "friendRespond") {
        if (b.accept) {
          if (
            !get(
              "SELECT 1 FROM rc_friends WHERE requester=? AND recipient=? AND status='Pending'",
              b.userId,
              uid,
            )
          )
            throw new Error("Only the recipient can accept a pending request.");
          run(
            "UPDATE rc_friends SET status='Accepted' WHERE requester=? AND recipient=?",
            b.userId,
            uid,
          );
        } else
          run(
            "DELETE FROM rc_friends WHERE (requester=? AND recipient=?) OR (requester=? AND recipient=?)",
            b.userId,
            uid,
            uid,
            b.userId,
          );
        return {};
      }
      if (action === "sessionDelete" || action === "sessionDeleteSeries") {
        const old = get(
          "SELECT * FROM rc_sessions WHERE id=? AND user_id=?",
          b.id,
          uid,
        );
        if (!old || old.started_at || old.completed_at)
          throw new Error("Only an unstarted session can be deleted.");
        if (action === "sessionDeleteSeries" && old.series_id)
          run(
            "DELETE FROM rc_sessions WHERE user_id=? AND series_id=? AND started_at IS NULL AND completed_at IS NULL",
            uid,
            old.series_id,
          );
        else run("DELETE FROM rc_sessions WHERE id=?", old.id);
        return {};
      }
      if (action === "sessionCreate" || action === "sessionUpdate") {
        const start = Date.parse(b.startsAt);
        if (!Number.isFinite(start) || start < Date.now())
          throw new Error("Choose a future session time.");
        const fields = [
          text(b.title, 160),
          validSubject(b.subject),
          String(b.topic || "").slice(0, 100),
          new Date(start).toISOString(),
          integer(b.duration, 10, 180),
          String(b.notes || "").slice(0, 2000),
          b.recurrence === "Weekly" ? "Weekly" : "None",
        ];
        if (action === "sessionUpdate") {
          const old = get(
            "SELECT * FROM rc_sessions WHERE id=? AND user_id=?",
            b.id,
            uid,
          );
          if (!old || old.started_at || old.completed_at)
            throw new Error("Only an unstarted session can be edited.");
          if (b.applyToSeries && old.series_id) {
            const delta = start - Date.parse(old.starts_at),
              future = all(
                "SELECT id,starts_at FROM rc_sessions WHERE user_id=? AND series_id=? AND started_at IS NULL AND completed_at IS NULL AND starts_at>=?",
                uid,
                old.series_id,
                old.starts_at,
              );
            for (const item of future)
              run(
                "UPDATE rc_sessions SET title=?,subject=?,topic=?,starts_at=?,duration=?,notes=?,recurrence=?,timezone=?,reminded=0 WHERE id=?",
                fields[0],
                fields[1],
                fields[2],
                new Date(Date.parse(item.starts_at) + delta).toISOString(),
                fields[4],
                fields[5],
                fields[6],
                String(b.timezone || old.timezone || "UTC").slice(0, 100),
                item.id,
              );
          } else
            run(
              "UPDATE rc_sessions SET title=?,subject=?,topic=?,starts_at=?,duration=?,notes=?,recurrence=?,timezone=?,reminded=0 WHERE id=?",
              ...fields,
              String(b.timezone || old.timezone || "UTC").slice(0, 100),
              old.id,
            );
          return { id: old.id };
        }
        const sid = id(),
          seriesId = fields[6] === "Weekly" ? id() : null;
        run(
          "INSERT INTO rc_sessions(id,user_id,title,subject,topic,starts_at,duration,notes,recurrence,series_id,timezone) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          sid,
          uid,
          ...fields,
          seriesId,
          String(b.timezone || "UTC").slice(0, 100),
        );
        return { id: sid };
      }
      if (action === "examCreate" || action === "examUpdate") {
        const startsAt = new Date(b.startsAt).toISOString(),
          values = [
            text(b.title, 160),
            validSubject(b.subject),
            startsAt,
            String(b.notes || "").slice(0, 2000),
          ];
        if (!Number.isFinite(Date.parse(startsAt))) throw new Error("Choose a valid exam date.");
        if (action === "examUpdate") {
          const exam = get("SELECT id FROM rc_exams WHERE id=? AND user_id=?", b.id, uid);
          if (!exam) throw new Error("Exam unavailable.");
          run("UPDATE rc_exams SET title=?,subject=?,starts_at=?,notes=? WHERE id=?", ...values, exam.id);
          return { id: exam.id };
        }
        const examId = id();
        run("INSERT INTO rc_exams VALUES(?,?,?,?,?,?,?)", examId, uid, ...values, now());
        return { id: examId };
      }
      if (action === "examDelete") {
        run("DELETE FROM rc_exams WHERE id=? AND user_id=?", b.id, uid);
        return {};
      }
      if (action === "sessionStart" || action === "sessionComplete") {
        const s = get(
          "SELECT * FROM rc_sessions WHERE id=? AND user_id=?",
          b.id,
          uid,
        );
        if (!s || s.completed_at) throw new Error("Session unavailable.");
        if (action === "sessionStart") {
          if (Date.parse(s.starts_at) > Date.now() + 300000)
            throw new Error("This session is not due yet.");
          run(
            "UPDATE rc_sessions SET started_at=COALESCE(started_at,?) WHERE id=?",
            now(),
            s.id,
          );
        } else {
          if (
            !s.started_at ||
            Date.now() - Date.parse(s.started_at) < s.duration * 60000
          )
            throw new Error("Complete the planned revision duration first.");
          const overlap = get(
            "SELECT 1 FROM rc_sessions WHERE user_id=? AND completed_at>?",
            uid,
            s.started_at,
          );
          if (overlap)
            throw new Error(
              "Overlapping sessions cannot earn completion rewards.",
            );
          run("UPDATE rc_sessions SET completed_at=? WHERE id=?", now(), s.id);
          xp(uid, "session", s.id);
          if (s.recurrence === "Weekly") {
            const planned = Date.parse(s.starts_at),
              week = 7 * 86400000,
              weeks = Math.max(
                1,
                Math.floor((Date.now() - planned) / week) + 1,
              ),
              next = addLocalWeeks(
                s.starts_at,
                weeks,
                s.timezone || "UTC",
              );
            run(
              "INSERT INTO rc_sessions(id,user_id,title,subject,topic,starts_at,duration,notes,recurrence,series_id,timezone) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
              id(),
              uid,
              s.title,
              s.subject,
              s.topic,
              next,
              s.duration,
              s.notes,
              s.recurrence,
              s.series_id || id(),
              s.timezone || "UTC",
            );
          }
          achievements(uid);
        }
        return {};
      }
      if (action === "mistakeCorrect") {
        const m = mistakes(uid).find((x) => x.id === b.id);
        if (!m || m.corrected_at)
          throw new Error("Mistake is already corrected or unavailable.");
        if (normalize(b.answer) !== normalize(m.correct))
          throw new Error(
            "This answer does not match the key. Review the explanation and try again; semantic practice needs AI.",
          );
        run("UPDATE rc_mistakes SET corrected_at=? WHERE id=?", now(), m.id);
        xp(uid, "correction", m.item_id);
        achievements(uid);
        return {};
      }
      if (action === "rate") {
        const p = paperAccess(uid, b.paperId);
        if (
          !p.public ||
          p.owner_id === uid ||
          !get(
            "SELECT 1 FROM rc_attempts a JOIN rc_versions v ON v.id=a.version_id WHERE v.paper_id=? AND a.user_id=? AND a.submitted_at IS NOT NULL",
            p.id,
            uid,
          )
        )
          throw new Error("Complete this community paper before rating it.");
        run(
          "INSERT INTO rc_ratings VALUES(?,?,?) ON CONFLICT(paper_id,user_id) DO UPDATE SET rating=excluded.rating",
          p.id,
          uid,
          integer(b.rating, 1, 5),
        );
        return {};
      }
      if (action === "battleCreate") {
        const { p, v } = versionAccess(uid, b.versionId);
        if (
          b.mode === "Quick Quiz" &&
          JSON.parse(v.content).questions.length > 10
        )
          throw new Error(
            "Choose a paper with up to 10 questions for Quick Quiz.",
          );
        const opponent = Number(b.opponent);
        if (!challengeOpponents(uid).some((u) => u.id === opponent))
          throw new Error(
            "Choose an accepted friend or a member of an active shared study group.",
          );
        if (!p.public)
          throw new Error("Publish the paper before using it in a challenge.");
        const bid = id();
        run(
          "INSERT INTO rc_battles(id,challenger,opponent,version_id,mode,created_at) VALUES(?,?,?,?,?,?)",
          bid,
          uid,
          opponent,
          b.versionId,
          [
            "Paper Challenge",
            "Accuracy Battle",
            "Speed Battle",
            "Quick Quiz",
          ].includes(b.mode)
            ? b.mode
            : "Paper Challenge",
          now(),
        );
        notify(
          opponent,
          "You received a paper challenge",
          p.title,
          "/challenges",
        );
        return { id: bid };
      }
      if (action === "battleRespond") {
        const btl = get(
          "SELECT * FROM rc_battles WHERE id=? AND opponent=? AND status='Pending'",
          b.id,
          uid,
        );
        if (!btl) throw new Error("Challenge unavailable.");
        if (
          b.accept &&
          !challengeOpponents(uid).some((u) => u.id === btl.challenger)
        )
          throw new Error(
            "You must still be friends or share an active study group to accept.",
          );
        run(
          "UPDATE rc_battles SET status=? WHERE id=?",
          b.accept ? "Accepted" : "Declined",
          b.id,
        );
        return {};
      }
      if (action === "battleAttempt") {
        const btl = get(
          "SELECT * FROM rc_battles WHERE id=? AND status='Accepted'",
          b.id,
        );
        if (!btl || ![btl.challenger, btl.opponent].includes(uid))
          throw new Error("Challenge unavailable.");
        const field =
          btl.challenger === uid ? "challenger_attempt" : "opponent_attempt";
        if (btl[field]) return { id: btl[field] };
        versionAccess(uid, btl.version_id);
        if (!keyFor(btl.version_id))
          throw new Error("This paper needs an answer key.");
        const aid = id();
        run(
          "INSERT INTO rc_attempts VALUES(?,?,?,?,?,?,NULL)",
          aid,
          uid,
          btl.version_id,
          null,
          "{}",
          now(),
        );
        run(`UPDATE rc_battles SET ${field}=? WHERE id=?`, aid, b.id);
        return { id: aid };
      }
      throw new Error("Unknown action.");
    })();
  }
  return {
    get,
    all,
    run,
    requireUser,
    notify,
    xp,
    membership,
    groupSubject,
    paperAccess,
    versionAccess,
    savePaper,
    versionEditContext,
    versionDraft,
    saveVersionDraft,
    paper,
    startAttempt,
    attempt,
    saveAnswers,
    markingContext,
    finishSubmission,
    review,
    challenge,
    resolve,
    results,
    stats,
    topicProgress,
    achievements,
    papers,
    paperPage,
    progressHistory,
    messages,
    globalSearch,
    assignments,
    paperDraft,
    savePaperDraft,
    groups,
    group,
    friends,
    challengeOpponents,
    isFriend,
    dashboard,
    studySuggestions,
    mistakes,
    battles,
    bossState,
    bossAnswer,
    revisionGame,
    leaderboard,
    mutate,
  };
}
module.exports = { service, addLocalWeeks };
