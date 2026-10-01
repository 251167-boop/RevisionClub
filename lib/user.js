import { mysqlPool } from "@/lib/mysql";

function requireMysql() {
  if (!mysqlPool)
    throw new Error("MySQL is required. SQLite fallback has been removed.");
  return mysqlPool;
}

/**
 * Insert a new user.
 */
export async function createUser(email, password, username) {
  const [result] = await requireMysql().execute(
    "INSERT INTO users (email, password, username) VALUES (?, ?, ?)",
    [email, password, username],
  );
  return result.insertId;
}

/**
 * Lookup by email (unchanged).
 */
export async function getUserByEmail(email) {
  const [rows] = await requireMysql().execute(
    "SELECT id, email, password, username, avatar_url FROM users WHERE lower(email) = lower(?) LIMIT 1",
    [email],
  );
  return rows[0] || null;
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

    const numeric =
      typeof userIdOrUsername === "number" || /^\d+$/.test(identifier);
    const [rows] = await requireMysql().execute(
      numeric
        ? "SELECT * FROM users WHERE id = ? LIMIT 1"
        : "SELECT * FROM users WHERE username = ? LIMIT 1",
      [userIdOrUsername],
    );
    return rows[0] || null;
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

    const [result] = await requireMysql().execute(
      "UPDATE users SET avatar_url = ? WHERE id = ?",
      [avatarUrl, userId],
    );
    if (result.affectedRows === 0) {
      throw new Error("No user found or no update performed");
    }
    return { success: true };
  } catch (error) {
    console.error("Error updating avatar:", error);
    throw error;
  }
}

export async function isUsernameTaken(username) {
  const [rows] = await requireMysql().execute(
    "SELECT 1 FROM users WHERE lower(username)=lower(?) LIMIT 1",
    [username],
  );
  return rows.length > 0;
}
