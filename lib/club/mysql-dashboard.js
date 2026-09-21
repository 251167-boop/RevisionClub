import rules from "@/lib/club/rules.cjs";
import { mysqlPool } from "@/lib/mysql";

const { SUBJECTS, progress } = rules;

function number(value) {
  return Number(value || 0);
}

function paperDuration(content) {
  try {
    return Number(JSON.parse(content).duration) || 30;
  } catch {
    return 30;
  }
}

export async function mysqlDashboard(userId) {
  if (!mysqlPool) throw new Error("MySQL is not configured.");

  const uid = Number(userId);
  const [
    userRows,
    resultRows,
    xpRows,
    paperRows,
    groupRows,
    sessionRows,
    mistakeRows,
    achievementRows,
    notificationRows,
    battleRows,
    examRows,
  ] = await Promise.all([
    mysqlPool.execute(
      "SELECT id, username, avatar_url FROM users WHERE id=? LIMIT 1",
      [uid],
    ),
    mysqlPool.execute(
      `SELECT m.id, p.title, p.subject, a.submitted_at,
          COALESCE(SUM(i.awarded), 0) AS score,
          COALESCE(SUM(i.maximum), 0) AS maximum
         FROM rc_markings m
         JOIN rc_submissions sub ON sub.id=m.submission_id
         JOIN rc_attempts a ON a.id=sub.attempt_id
         JOIN rc_versions v ON v.id=a.version_id
         JOIN rc_papers p ON p.id=v.paper_id
         JOIN rc_marking_items i ON i.marking_id=m.id
         WHERE a.user_id=?
         GROUP BY m.id, p.title, p.subject, a.submitted_at
         ORDER BY a.submitted_at DESC`,
      [uid],
    ),
    mysqlPool.execute(
      "SELECT COALESCE(SUM(amount), 0) AS xp FROM rc_xp WHERE user_id=?",
      [uid],
    ),
    mysqlPool.execute(
      `SELECT p.id, p.title, p.subject, p.state, p.created_at, v.content
         FROM rc_papers p
         LEFT JOIN rc_versions v ON v.paper_id=p.id
          AND v.number=(SELECT MAX(v2.number) FROM rc_versions v2 WHERE v2.paper_id=p.id)
         WHERE p.owner_id=? ORDER BY p.updated_at DESC LIMIT 4`,
      [uid],
    ),
    mysqlPool.execute(
      `SELECT g.id, g.name, COUNT(m2.user_id) AS members
         FROM rc_members mine JOIN rc_groups g ON g.id=mine.group_id
         JOIN rc_members m2 ON m2.group_id=g.id
         WHERE mine.user_id=? GROUP BY g.id, g.name ORDER BY g.created_at DESC`,
      [uid],
    ),
    mysqlPool.execute(
      "SELECT * FROM rc_sessions WHERE user_id=? ORDER BY starts_at",
      [uid],
    ),
    mysqlPool.execute(
      `SELECT e.id, e.subject, e.topic, i.question_id, i.marking_id, e.corrected_at
         FROM rc_mistakes e JOIN rc_marking_items i ON i.id=e.item_id
         WHERE e.user_id=? ORDER BY e.id DESC LIMIT 5`,
      [uid],
    ),
    mysqlPool.execute("SELECT * FROM rc_achievements WHERE user_id=?", [uid]),
    mysqlPool.execute(
      "SELECT * FROM rc_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 40",
      [uid],
    ),
    mysqlPool.execute(
      "SELECT * FROM rc_battles WHERE challenger=? OR opponent=? ORDER BY created_at DESC",
      [uid, uid],
    ),
    mysqlPool.execute(
      "SELECT * FROM rc_exams WHERE user_id=? AND starts_at>=? ORDER BY starts_at LIMIT 20",
      [uid, new Date().toISOString()],
    ),
  ]);

  const user = userRows[0][0];
  if (!user) throw new Error("Sign in required.");

  const results = resultRows[0].map((row) => ({
    ...row,
    score: number(row.score),
    maximum: number(row.maximum),
  }));
  const subjects = SUBJECTS.map((subject) => {
    const subjectResults = results.filter((row) => row.subject === subject);
    const average = subjectResults.length
      ? Math.round(
          (subjectResults.reduce(
            (sum, row) =>
              sum + (row.maximum ? (100 * row.score) / row.maximum : 0),
            0,
          ) /
            subjectResults.length) *
            10,
        ) / 10
      : null;
    return { subject, count: subjectResults.length, average };
  });
  const percentages = results.map((row) =>
    row.maximum ? (100 * row.score) / row.maximum : 0,
  );
  const recent = percentages.slice(0, 5);
  const previous = percentages.slice(5, 10);
  const average = percentages.length
    ? Math.round(
        (percentages.reduce((sum, value) => sum + value, 0) /
          percentages.length) *
          10,
      ) / 10
    : null;
  const trend =
    recent.length && previous.length
      ? Math.round(
          (recent.reduce((sum, value) => sum + value, 0) / recent.length -
            previous.reduce((sum, value) => sum + value, 0) / previous.length) *
            10,
        ) / 10
      : null;

  return {
    generatedAt: new Date().toISOString(),
    user,
    stats: {
      ...progress(number(xpRows[0][0].xp)),
      tests: results.length,
      average,
      streak: 0,
      subjects,
      trend,
    },
    history: [],
    topics: [],
    suggestions: [],
    papers: paperRows[0].map((paper) => ({
      ...paper,
      duration: paperDuration(paper.content),
    })),
    results: results.slice(0, 5),
    groups: groupRows[0].map((group) => ({
      ...group,
      members: number(group.members),
    })),
    sessions: sessionRows[0],
    mistakes: mistakeRows[0],
    achievements: achievementRows[0],
    notifications: notificationRows[0],
    battles: battleRows[0],
    exams: examRows[0],
    assignments: [],
    friends: [],
  };
}
