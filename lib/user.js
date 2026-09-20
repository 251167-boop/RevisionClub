// lib/user.js
import { db } from "@/lib/db";

/**
 * Insert a new user.
 */
export function createUser(email, password, username) {
  const result = db
    .prepare("INSERT INTO users (email, password, username) VALUES (?, ?, ?)")
    .run(email, password, username);
  return result.lastInsertRowid;
}

/**
 * Lookup by email (unchanged).
 */
export function getUserByEmail(email) {
  return db
    .prepare("SELECT id, email, password, username FROM users WHERE lower(email) = lower(?)")
    .get(email);
}

export function getUser(userIdOrUsername) {
  try {
    const identifier = userIdOrUsername ? String(userIdOrUsername).trim() : null;
    if (!identifier) {
      console.log("getUser: Invalid identifier provided:", userIdOrUsername);
      return null;
    }

    const stmt = typeof userIdOrUsername === "number"
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
export function updateUserAvatar(userId, avatarUrl) {
  try {
    if (!userId || !avatarUrl) {
      throw new Error("userId and avatarUrl are required");
    }

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
