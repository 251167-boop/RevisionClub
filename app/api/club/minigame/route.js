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

const localGames = globalThis.__revisionGeneratedMinigames || new Map();
const localLikes = globalThis.__revisionGeneratedMinigameLikes || new Map();
globalThis.__revisionGeneratedMinigames = localGames;
globalThis.__revisionGeneratedMinigameLikes = localLikes;

function localGame(game, userId) {
  const likes = localLikes.get(game.id) || new Set();
  return {
    ...game.content,
    id: game.id,
    visibility: game.visibility,
    sourceCount: game.sourceCount,
    createdAt: game.createdAt,
    username: game.username,
    likes: likes.size,
    liked: likes.has(userId),
  };
}

function saveLocalGame(user, game, visibility, sourceCount) {
  const saved = {
    id: randomUUID(),
    ownerId: user.id,
    username: user.username || "Revision Club member",
    visibility,
    sourceCount,
    createdAt: new Date().toISOString(),
    content: game,
  };
  localGames.set(saved.id, saved);
  return localGame(saved, user.id);
}

async function uploadedFiles(userId, fileIds) {
  const ids = [...new Set((fileIds || []).map(String))];
  if (!ids.length) throw new Error("Upload at least one revision material.");
  if (ids.length > 8) throw new Error("Use up to eight revision materials.");
  if (mysqlPool) {
    const files = await mysqlFiles(userId, ids);
    if (files.length !== ids.length) throw new Error("File access denied.");
    return files;
  }
  const { db } = await import("@/lib/db");
  return ids.map((id) => {
    const file = db
      .prepare("SELECT * FROM rc_files WHERE id=? AND owner_id=?")
      .get(id, userId);
    if (!file) throw new Error("File access denied.");
    return file;
  });
}

export async function GET(request) {
  try {
    const { user } = await verifyAuth();
    if (!user) throw new Error("Sign in required.");
    const query = new URL(request.url).searchParams,
      scope = query.get("scope") === "mine" ? "mine" : "public",
      sort = query.get("sort") === "liked" ? "liked" : "recent";
    let items;
    if (mysqlPool) items = await mysqlMinigames(user.id, scope, sort);
    else {
      items = [...localGames.values()]
        .filter((game) =>
          scope === "mine"
            ? Number(game.ownerId) === Number(user.id)
            : game.visibility === "public",
        )
        .map((game) => localGame(game, user.id))
        .sort((left, right) =>
          sort === "liked"
            ? right.likes - left.likes ||
              Date.parse(right.createdAt) - Date.parse(left.createdAt)
            : Date.parse(right.createdAt) - Date.parse(left.createdAt),
        )
        .slice(0, 60);
    }
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
      let result;
      if (mysqlPool) result = await toggleMysqlMinigameLike(user.id, gameId);
      else {
        const game = localGames.get(gameId);
        if (!game || game.visibility !== "public")
          throw new Error("Public minigame not found.");
        const likes = localLikes.get(gameId) || new Set();
        if (likes.has(user.id)) likes.delete(user.id);
        else likes.add(user.id);
        localLikes.set(gameId, likes);
        result = { liked: likes.has(user.id), likes: likes.size };
      }
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
    const saved = mysqlPool
      ? await saveMysqlMinigame(user.id, game, visibility, files.length)
      : saveLocalGame(user, game, visibility, files.length);
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
