// lib/auth.js
import { cookies } from "next/headers";
import { createRequire } from "node:module";
import { Lucia } from "lucia";
import { BetterSqlite3Adapter } from "@lucia-auth/adapter-sqlite";
import { Mysql2Adapter } from "@lucia-auth/adapter-mysql";
import { mysqlPool } from "@/lib/mysql";
import { getUser } from "@/lib/user";

// --- shared DB instance ---

const require = createRequire(import.meta.url);

// Do not import the SQLite database unless this instance is actually using it.
// On Vercel, loading better-sqlite3 while MySQL is configured can abort the
// Node process before a sign-in request is handled.
function createSqliteAdapter() {
  const { db } = require("./db.js");
  return new BetterSqlite3Adapter(db, {
    user: "users",
    session: "sessions",
  });
}

async function ensureClubUser(userId, databaseUser) {
  if (!mysqlPool || !databaseUser) return;

  // Club data is still stored in SQLite while production authentication uses
  // MySQL. Keep the authenticated user present in SQLite so owner_id foreign
  // keys (uploads, papers, groups, and progress) reference a real local row.
  const { db } = await import("@/lib/db");
  const existingEmail = db
    .prepare("SELECT id FROM users WHERE lower(email)=lower(?)")
    .get(databaseUser.email);
  if (existingEmail && Number(existingEmail.id) !== userId) {
    throw new Error(
      "The authenticated user does not match the study-space user.",
    );
  }

  db.prepare(
    `INSERT INTO users (id,email,password,username,points,avatar_url)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       email=excluded.email,
       username=excluded.username,
       avatar_url=excluded.avatar_url`,
  ).run(
    userId,
    databaseUser.email,
    null,
    databaseUser.username,
    Number(databaseUser.points) || 0,
    databaseUser.avatar_url || null,
  );
}

const adapter = mysqlPool
  ? new Mysql2Adapter(mysqlPool, {
      user: "users",
      session: "sessions",
    })
  : createSqliteAdapter();

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    expires: false,
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
});

export async function createAuthSession(userId) {
  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  (await cookies()).set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );
}

export async function verifyAuth() {
  const sessionCookie = (await cookies()).get(lucia.sessionCookieName);
  if (!sessionCookie?.value) {
    console.info("[auth] session unavailable", { reason: "missing_cookie" });
    return { user: null, session: null };
  }

  const result = await lucia.validateSession(sessionCookie.value);
  const { session } = result;
  if (!session) {
    console.info("[auth] session unavailable", { reason: "unknown_session" });
    return { user: null, session: null };
  }

  // Pull the numeric userId directly from session.userId
  // (Lucia stores it as a string like "1.0", so parseInt)
  const rawUserId = session.userId;
  const userId = parseInt(String(rawUserId).split(".")[0], 10);

  let username = null;
  let avatar_url = null;
  try {
    const row = await getUser(userId);
    if (row) {
      username = row.username;
      avatar_url = row.avatar_url;
      await ensureClubUser(userId, row);
    }
  } catch (e) {
    console.error("[auth] failed to load study-space user", {
      userId,
      message: e instanceof Error ? e.message : "unknown_error",
    });
    throw new Error("Could not load your study space.");
  }

  // Return a user object with id & username
  return {
    user: { id: userId, username, avatar_url },
    session,
  };
}

export async function destroySession() {
  const { session } = await verifyAuth();
  if (!session) return { error: "Unauthorized!" };
  await lucia.invalidateSession(session.id);
  const blank = lucia.createBlankSessionCookie();
  (await cookies()).set(blank.name, blank.value, blank.attributes);
}

export async function createAuthCookiesOnLogin(userId) {
  // helper in your login/signup actions
  const session = await lucia.createSession(userId, {});
  const sc = lucia.createSessionCookie(session.id);
  (await cookies()).set(sc.name, sc.value, sc.attributes);
}
