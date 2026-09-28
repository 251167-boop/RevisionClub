import { mysqlPool } from "@/lib/mysql";

function requireMysql() {
  if (!mysqlPool) throw new Error("MySQL is not configured.");
  return mysqlPool;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object" && !Buffer.isBuffer(value)) return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

async function requireGroupMembership(userId, groupId) {
  if (!groupId) return;
  const [rows] = await requireMysql().execute(
    "SELECT 1 FROM rc_members WHERE group_id=? AND user_id=? LIMIT 1",
    [groupId, userId],
  );
  if (!rows.length) throw new Error("Group access denied.");
}

async function requireVersionOwner(userId, versionId) {
  const [rows] = await requireMysql().execute(
    `SELECT v.id AS version_id, v.paper_id, v.content, p.owner_id,
            p.title, p.subject, vc.instructions, vc.generation_settings,
            k.content AS key_content, k.source AS key_source
       FROM rc_versions v
       JOIN rc_papers p ON p.id=v.paper_id
       LEFT JOIN rc_version_context vc ON vc.version_id=v.id
       LEFT JOIN rc_keys k ON k.version_id=v.id
      WHERE v.id=? LIMIT 1`,
    [versionId],
  );
  const row = rows[0];
  if (!row || Number(row.owner_id) !== Number(userId))
    throw new Error("Only the creator can edit this version.");
  return row;
}

function cleanPaperDraft(draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft))
    throw new Error("Invalid paper draft.");
  const settings = Object.fromEntries(
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
      .filter((key) => Object.hasOwn(draft.settings || {}, key))
      .map((key) => [key, draft.settings[key]]),
  );
  return {
    settings,
    files: Array.isArray(draft.files) ? draft.files : [],
    content: draft.content || null,
    answerKey: Array.isArray(draft.answerKey) ? draft.answerKey : [],
    keySource: String(draft.keySource || "Human-provided answer key"),
  };
}

export async function mysqlPaperDraft(userId, scope = "") {
  scope = String(scope || "");
  await requireGroupMembership(userId, scope);
  const [rows] = await requireMysql().execute(
    "SELECT content,updated_at FROM rc_paper_drafts WHERE user_id=? AND scope=? LIMIT 1",
    [userId, scope],
  );
  return rows[0]
    ? {
        ...parseJson(rows[0].content, {}),
        updatedAt: rows[0].updated_at,
      }
    : null;
}

export async function saveMysqlPaperDraft(userId, scope = "", draft) {
  scope = String(scope || "");
  await requireGroupMembership(userId, scope);
  if (draft === null) {
    await requireMysql().execute(
      "DELETE FROM rc_paper_drafts WHERE user_id=? AND scope=?",
      [userId, scope],
    );
    return { saved: true };
  }

  const encoded = JSON.stringify(cleanPaperDraft(draft));
  if (encoded.length > 400000) throw new Error("Paper draft is too large.");
  const savedAt = new Date().toISOString();
  await requireMysql().execute(
    `INSERT INTO rc_paper_drafts(user_id,scope,content,updated_at)
     VALUES(?,?,?,?)
     ON DUPLICATE KEY UPDATE content=VALUES(content),updated_at=VALUES(updated_at)`,
    [userId, scope, encoded, savedAt],
  );
  return { saved: true, updatedAt: savedAt };
}

export async function mysqlVersionDraft(userId, versionId) {
  await requireVersionOwner(userId, versionId);
  const [rows] = await requireMysql().execute(
    "SELECT content,updated_at FROM rc_version_drafts WHERE version_id=? AND user_id=? LIMIT 1",
    [versionId, userId],
  );
  return rows[0]
    ? { ...parseJson(rows[0].content, {}), updatedAt: rows[0].updated_at }
    : null;
}

export async function saveMysqlVersionDraft(userId, versionId, draft) {
  await requireVersionOwner(userId, versionId);
  if (!draft || typeof draft !== "object" || Array.isArray(draft))
    throw new Error("Invalid edit draft.");
  const clean = {
    content: draft.content,
    answerKey: Array.isArray(draft.answerKey) ? draft.answerKey : [],
    keySource: String(draft.keySource || "Human-provided marking scheme"),
  };
  const encoded = JSON.stringify(clean);
  if (encoded.length > 400000) throw new Error("Paper draft is too large.");
  const savedAt = new Date().toISOString();
  await requireMysql().execute(
    `INSERT INTO rc_version_drafts(version_id,user_id,content,updated_at)
     VALUES(?,?,?,?)
     ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),content=VALUES(content),updated_at=VALUES(updated_at)`,
    [versionId, userId, encoded, savedAt],
  );
  return { saved: true, updatedAt: savedAt };
}

export async function deleteMysqlVersionDraft(userId, versionId) {
  await requireVersionOwner(userId, versionId);
  await requireMysql().execute(
    "DELETE FROM rc_version_drafts WHERE version_id=? AND user_id=?",
    [versionId, userId],
  );
}

export async function mysqlVersionEditContext(userId, versionId) {
  const row = await requireVersionOwner(userId, versionId);
  const [fileRows] = await requireMysql().execute(
    `SELECT f.* FROM rc_files f
       JOIN rc_version_files vf ON vf.file_id=f.id
      WHERE vf.version_id=?`,
    [versionId],
  );
  const content = parseJson(row.content, {});
  const settings = parseJson(row.generation_settings, {});
  const answerKey = parseJson(row.key_content, []);
  return {
    paperId: row.paper_id,
    versionId,
    content,
    answerKey,
    files: fileRows,
    creatorInstructions: row.instructions || "",
    settings: {
      title: row.title,
      subject: row.subject,
      description: row.instructions || "",
      duration: content.duration,
      grade: content.grade,
      difficulty: content.difficulty,
      language: content.language,
      onlySources:
        settings.onlySources ??
        fileRows.some((file) => file.purpose === "Revision Material"),
      generateKey: settings.generateKey ?? answerKey.length > 0,
      sampleAspects: settings.sampleAspects || [],
    },
  };
}

export async function mysqlFileUsage(userId) {
  const [rows] = await requireMysql().execute(
    "SELECT COALESCE(SUM(OCTET_LENGTH(content)),0) AS bytes FROM rc_files WHERE owner_id=?",
    [userId],
  );
  return Number(rows[0]?.bytes || 0);
}

export async function saveMysqlFile(file) {
  await requireMysql().execute(
    `INSERT INTO rc_files(id,owner_id,name,purpose,mime,content,extracted,created_at)
     VALUES(?,?,?,?,?,?,?,?)`,
    [
      file.id,
      file.owner_id,
      file.name,
      file.purpose,
      file.mime,
      file.content,
      file.extracted,
      file.created_at,
    ],
  );
}

export async function mysqlFiles(userId, ids) {
  const uniqueIds = [...new Set((ids || []).map(String))];
  if (!uniqueIds.length) return [];
  const placeholders = uniqueIds.map(() => "?").join(",");
  const [rows] = await requireMysql().execute(
    `SELECT * FROM rc_files WHERE owner_id=? AND id IN (${placeholders})`,
    [userId, ...uniqueIds],
  );
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  return uniqueIds.map((id) => byId.get(id)).filter(Boolean);
}
