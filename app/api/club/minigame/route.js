import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { mysqlFiles } from "@/lib/club/mysql-drafts";
import { generateMinigame } from "@/lib/club/ai.mjs";
import { readJSON } from "@/lib/club/request-body.mjs";
import { assertSameOrigin } from "@/lib/club/security";
import {
  mysqlMinigames,
  saveMysqlMinigame,
  toggleMysqlMinigameLike,
} from "@/lib/club/mysql-minigames";

export const dynamic = "force-dynamic";

async function uploadedFiles(userId, fileIds) {
  const ids = [...new Set((fileIds || []).map(String))];
  if (!ids.length) throw new Error("Upload at least one revision material.");
  if (ids.length > 8) throw new Error("Use up to eight revision materials.");
  if (!mysqlPool) throw new Error("MySQL is required.");
  const files = await mysqlFiles(userId, ids);
  if (files.length !== ids.length) throw new Error("File access denied.");
  return files;
}

export async function GET(request) {
  try {
    const { user } = await verifyAuth();
    if (!user) throw new Error("Sign in required.");
    const query = new URL(request.url).searchParams,
      scope = query.get("scope") === "mine" ? "mine" : "public",
      sort = query.get("sort") === "liked" ? "liked" : "recent";
    if (!mysqlPool) throw new Error("MySQL is required.");
    const items = await mysqlMinigames(user.id, scope, sort);
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.message === "Sign in required." ? 401 : 400 },
    );
  }
}

export async function POST(request) {
  const reference = randomUUID().slice(0, 8);
  try {
    const { user } = await verifyAuth();
    if (!user) throw new Error("Sign in required.");
    assertSameOrigin(request);
    const body = await readJSON(request, 50000);
    if (body.action === "toggle-like") {
      const gameId = String(body.gameId || "");
      if (!gameId) throw new Error("Choose a public minigame.");
      if (!mysqlPool) throw new Error("MySQL is required.");
      const result = await toggleMysqlMinigameLike(user.id, gameId);
      return NextResponse.json(result);
    }
    const visibility =
      body.visibility === "public"
        ? "public"
        : body.visibility === "private"
          ? "private"
          : null;
    if (!visibility) throw new Error("Choose who can see this minigame.");
    const files = await uploadedFiles(user.id, body.fileIds);
    const game = await generateMinigame({ mode: body.mode }, files);
    const saved = await saveMysqlMinigame(
      user.id,
      game,
      visibility,
      files.length,
    );
    return NextResponse.json(saved, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status =
      error.httpStatus || (error.message === "Sign in required." ? 401 : 400);
    console.error(
      "Minigame generation failed " +
        JSON.stringify({
          reference,
          code: error.publicCode || error.name || "REQUEST_FAILED",
          status,
          provider: error.provider || null,
          retryable: Boolean(error.retryable),
        }),
    );
    return NextResponse.json(
      {
        error: error.message,
        code: error.publicCode || undefined,
        retryable: Boolean(error.retryable),
        reference: error.publicCode ? reference : undefined,
      },
      { status },
    );
  }
}
