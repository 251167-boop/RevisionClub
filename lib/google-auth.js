import crypto from "node:crypto";
import { mysqlPool } from "@/lib/mysql";

export const GOOGLE_STATE_COOKIE = "revision_google_oauth_state";

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

export function createGoogleState() {
  return crypto.randomBytes(32).toString("base64url");
}

export function safeStateMatch(received, stored) {
  if (!received || !stored) return false;
  const left = Buffer.from(String(received));
  const right = Buffer.from(String(stored));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function googleAuthorizationUrl(origin, state) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleCode(origin, code) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) throw new Error("Google token exchange failed.");
  const tokens = await tokenResponse.json();
  if (!tokens.access_token) throw new Error("Google access token is missing.");

  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    },
  );
  if (!profileResponse.ok) throw new Error("Google profile lookup failed.");
  const profile = await profileResponse.json();
  if (!profile.sub || !profile.email || profile.email_verified !== true)
    throw new Error("Google did not provide a verified email address.");
  return profile;
}

async function availableUsername(profile) {
  const fallback = String(profile.email).split("@")[0];
  const source = String(profile.name || fallback)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 32);
  const base = source.length >= 3 ? source : `student${source}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    const suffix = attempt ? String(attempt + 1) : "";
    const candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    const [rows] = await mysqlPool.execute(
      "SELECT 1 FROM users WHERE lower(username)=lower(?) LIMIT 1",
      [candidate],
    );
    if (!rows.length) return candidate;
  }
  return `student_${crypto.randomBytes(6).toString("hex")}`;
}

export async function findOrCreateGoogleUser(profile) {
  if (!mysqlPool) throw new Error("Google sign-in requires MySQL.");
  const email = String(profile.email).trim().toLowerCase();
  const [linked] = await mysqlPool.execute(
    "SELECT id FROM users WHERE google_sub=? LIMIT 1",
    [profile.sub],
  );
  if (linked[0]) return linked[0].id;

  const [matching] = await mysqlPool.execute(
    "SELECT id, google_sub FROM users WHERE lower(email)=lower(?) LIMIT 1",
    [email],
  );
  if (matching[0]) {
    if (matching[0].google_sub && matching[0].google_sub !== profile.sub)
      throw new Error("That email is linked to another Google account.");
    await mysqlPool.execute("UPDATE users SET google_sub=? WHERE id=?", [
      profile.sub,
      matching[0].id,
    ]);
    return matching[0].id;
  }

  const username = await availableUsername(profile);
  const [result] = await mysqlPool.execute(
    "INSERT INTO users (email, password, username, google_sub) VALUES (?, NULL, ?, ?)",
    [email, username, profile.sub],
  );
  return result.insertId;
}
