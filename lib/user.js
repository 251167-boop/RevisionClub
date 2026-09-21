import { mysqlPool } from "@/lib/mysql";

async function sqliteDb() {
  const { db } = await import("@/lib/db");
  return db;
}

/**
 * Insert a new user.
 */
export async function createUser(email, password, username) {
  if (mysqlPool) {
    const [result] = await mysqlPool.execute(
      "INSERT INTO users (email, password, username) VALUES (?, ?, ?)",
      [email, password, username],
    );
    return result.insertId;
  }
  const db = await sqliteDb();
  const result = db
    .prepare("INSERT INTO users (email, password, username) VALUES (?, ?, ?)")
    .run(email, password, username);
  return result.lastInsertRowid;
}

/**
 * Lookup by email (unchanged).
 */
export async function getUserByEmail(email) {
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      "SELECT id, email, password, username, avatar_url FROM users WHERE lower(email) = lower(?) LIMIT 1",
      [email],
    );
    return rows[0] || null;
  }
  const db = await sqliteDb();
  return db
    .prepare(
      "SELECT id, email, password, username FROM users WHERE lower(email) = lower(?)",
    )
    .get(email);
}

export async function getUser(userIdOrUsername) {
  try {
    const identifier = userIdOrUsername
      ? String(userIdOrUsername).trim()
      : null;
    if (!identifier) {
      console.log("getUser: Invalid identifier provided:", userIdOrUsername);
      return null;
    }

    if (mysqlPool) {
      const numeric =
        typeof userIdOrUsername === "number" || /^\d+$/.test(identifier);
      const [rows] = await mysqlPool.execute(
        numeric
          ? "SELECT * FROM users WHERE id = ? LIMIT 1"
          : "SELECT * FROM users WHERE username = ? LIMIT 1",
        [userIdOrUsername],
      );
      return rows[0] || null;
    }
    const db = await sqliteDb();
    const stmt =
      typeof userIdOrUsername === "number"
        ? db.prepare("SELECT * FROM users WHERE id = ?")
        : db.prepare("SELECT * FROM users WHERE username = ?");
    const user = stmt.get(userIdOrUsername); // Use original input to match type
    if (!user) {
      console.log("getUser: No user found for identifier:", userIdOrUsername);
    } else {
    }
    return user || null;
  } catch (error) {
    console.error("Database error in getUser:", error);
    return null;
  }
}
export async function updateUserAvatar(userId, avatarUrl) {
  try {
    if (!userId || !avatarUrl) {
      throw new Error("userId and avatarUrl are required");
    }

    if (mysqlPool) {
      const [result] = await mysqlPool.execute(
        "UPDATE users SET avatar_url = ? WHERE id = ?",
        [avatarUrl, userId],
      );
      if (result.affectedRows === 0) {
        throw new Error("No user found or no update performed");
      }
      return { success: true };
    }
    const db = await sqliteDb();
    const stmt = db.prepare(`
      UPDATE users
      SET avatar_url = ?
      WHERE id = ?
    `);
    const result = stmt.run(avatarUrl, userId);
    if (result.changes === 0) {
      throw new Error("No user found or no update performed");
    }
    console.log("Updated avatar_url for userId:", userId, "to:", avatarUrl);
    return { success: true };
  } catch (error) {
    console.error("Error updating avatar:", error);
    throw error;
  }
}

export async function isUsernameTaken(username) {
  if (mysqlPool) {
    const [rows] = await mysqlPool.execute(
      "SELECT 1 FROM users WHERE lower(username)=lower(?) LIMIT 1",
      [username],
    );
    return rows.length > 0;
  }
  const db = await sqliteDb();
  return Boolean(
    db
      .prepare("SELECT 1 FROM users WHERE lower(username)=lower(?)")
      .get(username),
  );
}
