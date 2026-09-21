"use server";
import { checkAuthRate } from "@/lib/club/auth-limits";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { hashUserPassword, verifyPassword } from "@/lib/hash";
import { createUser, getUserByEmail, isUsernameTaken } from "@/lib/user";
import { lucia, verifyAuth as _verifyAuth } from "@/lib/auth";

//
// ——— PUBLIC SESSION READ (no cookie write) ———
//
export async function getSession() {
  const { user, session } = await _verifyAuth();
  return { user, session };
}

//
// ——— SESSION REFRESH (cookie-write allowed in Route Handler) ———
//
export async function refreshSessionCookie() {
  const { user, session } = await _verifyAuth();

  if (session && session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    (await cookies()).set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
  } else if (!session) {
    const blank = lucia.createBlankSessionCookie();
    (await cookies()).set(blank.name, blank.value, blank.attributes);
  }

  return { user, session };
}

//
// ——— SIGNUP / LOGIN / LOGOUT ———
//
export async function signup(prevState, formData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const errors = {};
  if (!(await checkAuthRate(email)))
    return {
      errors: { email: "Too many attempts. Please try again in 15 minutes." },
    };

  // Validate email
  if (
    !email ||
    email.length > 200 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    errors.email = "Please enter a valid email address.";
  }
  // Validate password
  if (!password || password.length < 8 || password.length > 256) {
    errors.password = "Password must be at least 8 characters long.";
  }
  // Validate username
  if (!username || username.length < 3 || username.length > 40) {
    errors.username =
      "Username is required and must be at least 3 characters long.";
  } else if (
    !/^[a-zA-Z0-9_-]+$/.test(username) ||
    (await isUsernameTaken(username))
  ) {
    errors.username =
      "Choose an available username using letters, numbers, underscores or hyphens.";
    return { errors };
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  try {
    const hashedPassword = hashUserPassword(password);
    const userId = await createUser(email, hashedPassword, username);
    console.info("[auth] account created", { userId: String(userId) });

    // Create session and set cookie
    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    (await cookies()).set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );

    // Redirect after successful setup
    redirect("/dashboard");
  } catch (error) {
    if (
      error.code?.startsWith("SQLITE_CONSTRAINT") ||
      error.code === "ER_DUP_ENTRY"
    ) {
      return {
        errors: {
          email: "An account with that email already exists.",
          username: "That username may already be taken.",
        },
      };
    }
    console.error("[auth] signup failed", {
      code: error?.code || "unknown_error",
    });
    throw error;
  }
}

export async function login(prevState, formData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "").trim();

  if (!(await checkAuthRate(email)))
    return {
      errors: { email: "Too many attempts. Please try again in 15 minutes." },
    };
  const existingUser = await getUserByEmail(email);
  if (!existingUser) {
    console.info("[auth] login rejected", { reason: "unknown_email" });
    return {
      errors: {
        email: "Could not authenticate—please check your credentials.",
      },
    };
  }

  const valid =
    typeof password === "string" &&
    password.length <= 256 &&
    verifyPassword(existingUser.password, password);
  if (!valid) {
    console.info("[auth] login rejected", { reason: "invalid_password" });
    return {
      errors: {
        password: "Could not authenticate—please check your credentials.",
      },
    };
  }

  const session = await lucia.createSession(existingUser.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  (await cookies()).set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );
  console.info("[auth] login session cookie set");

  redirect("/dashboard");
}

export async function logout() {
  const { session } = await _verifyAuth();
  if (session) {
    await lucia.invalidateSession(session.id);
    const blank = lucia.createBlankSessionCookie();
    (await cookies()).set(blank.name, blank.value, blank.attributes);
  }
  redirect("/");
}
