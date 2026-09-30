import { randomUUID } from "node:crypto";
import { mysqlPool } from "@/lib/mysql";

function requireMysql() {
  if (!mysqlPool) throw new Error("MySQL is not configured.");
  return mysqlPool;
}

let schemaPromise;
async function ensureSchema() {
  if (!schemaPromise)
    schemaPromise = (async () => {
      await requireMysql().query(`
        CREATE TABLE IF NOT EXISTS rc_generated_minigames (
          id CHAR(36) PRIMARY KEY,
          owner_id INT NOT NULL,
          title VARCHAR(120) NOT NULL,
          mode VARCHAR(40) NOT NULL,
          visibility VARCHAR(10) NOT NULL,
          content LONGTEXT NOT NULL,
          source_count INT NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL,
          INDEX rc_minigames_owner_created (owner_id, created_at),
          INDEX rc_minigames_visibility_created (visibility, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await requireMysql().query(`
        CREATE TABLE IF NOT EXISTS rc_minigame_likes (
          game_id CHAR(36) NOT NULL,
          user_id INT NOT NULL,
          created_at DATETIME NOT NULL,
          PRIMARY KEY (game_id, user_id),
          INDEX rc_minigame_likes_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })();
  return schemaPromise;
}

function parseGame(row) {
  let content;
  try {
    content =
      typeof row.content === "object"
        ? row.content
        : JSON.parse(String(row.content || "{}"));
  } catch {
    throw new Error("A saved minigame is damaged and could not be opened.");
  }
  return {
    ...content,
    id: String(row.id),
    title: String(row.title || content.title || "Revision game"),
    mode: String(row.mode || content.mode || ""),
    visibility: String(row.visibility || "private"),
    sourceCount: Number(row.source_count || 0),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || ""),
    username: String(row.username || "Revision Club member"),
    likes: Number(row.likes || 0),
    liked: Boolean(Number(row.liked || 0)),
  };
}

export async function saveMysqlMinigame(userId, game, visibility, sourceCount) {
  await ensureSchema();
  const id = randomUUID(),
    createdAt = new Date();
  await requireMysql().execute(
    `INSERT INTO rc_generated_minigames
       (id,owner_id,title,mode,visibility,content,source_count,created_at)
     VALUES(?,?,?,?,?,?,?,?)`,
    [
      id,
      userId,
      game.title,
      game.mode,
      visibility,
      JSON.stringify(game),
      sourceCount,
      createdAt,
    ],
  );
  return {
    ...game,
    id,
    visibility,
    sourceCount,
    createdAt: createdAt.toISOString(),
    likes: 0,
    liked: false,
  };
}

export async function mysqlMinigames(userId, scope, sort) {
  await ensureSchema();
  const order =
    sort === "liked" ? "likes DESC, g.created_at DESC" : "g.created_at DESC";
  const where = scope === "mine" ? "g.owner_id=?" : "g.visibility='public'";
  const [rows] = await requireMysql().execute(
    `SELECT g.*, u.username,
            (SELECT COUNT(*) FROM rc_minigame_likes l WHERE l.game_id=g.id) likes,
            EXISTS(SELECT 1 FROM rc_minigame_likes ml WHERE ml.game_id=g.id AND ml.user_id=?) liked
       FROM rc_generated_minigames g
       LEFT JOIN users u ON u.id=g.owner_id
      WHERE ${where}
      ORDER BY ${order}
      LIMIT 60`,
    scope === "mine" ? [userId, userId] : [userId],
  );
  return rows.map(parseGame);
}

export async function toggleMysqlMinigameLike(userId, gameId) {
  await ensureSchema();
  const [games] = await requireMysql().execute(
    "SELECT id FROM rc_generated_minigames WHERE id=? AND visibility='public' LIMIT 1",
    [gameId],
  );
  if (!games.length) throw new Error("Public minigame not found.");
  const [likes] = await requireMysql().execute(
    "SELECT 1 FROM rc_minigame_likes WHERE game_id=? AND user_id=? LIMIT 1",
    [gameId, userId],
  );
  const liked = !likes.length;
  if (liked)
    await requireMysql().execute(
      "INSERT INTO rc_minigame_likes(game_id,user_id,created_at) VALUES(?,?,UTC_TIMESTAMP())",
      [gameId, userId],
    );
  else
    await requireMysql().execute(
      "DELETE FROM rc_minigame_likes WHERE game_id=? AND user_id=?",
      [gameId, userId],
    );
  const [count] = await requireMysql().execute(
    "SELECT COUNT(*) likes FROM rc_minigame_likes WHERE game_id=?",
    [gameId],
  );
  return { liked, likes: Number(count[0]?.likes || 0) };
}
