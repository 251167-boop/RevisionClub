import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { mysqlFiles } from "@/lib/club/mysql-drafts";
import { generateMinigame } from "@/lib/club/ai.mjs";
import { readJSON } from "@/lib/club/request-body.mjs";
import { assertSameOrigin } from "@/lib/club/security";

export const dynamic = "force-dynamic";

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

export async function POST(request) {
  const reference = randomUUID().slice(0, 8);
  try {
    const { user } = await verifyAuth();
    if (!user) throw new Error("Sign in required.");
    assertSameOrigin(request);
    const body = await readJSON(request, 50000);
    const files = await uploadedFiles(user.id, body.fileIds);
    const game = await generateMinigame({ mode: body.mode }, files);
    return NextResponse.json(game, {
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
