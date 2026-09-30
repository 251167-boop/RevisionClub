import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import {
  deleteMysqlUploadChunks,
  mysqlFiles,
  mysqlFileUsage,
  saveMysqlFile,
  saveMysqlUploadChunk,
} from "@/lib/club/mysql-drafts";
import { readBody } from "@/lib/club/request-body.mjs";
import { assertSameOrigin } from "@/lib/club/security";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_CHUNK_BYTES,
  UPLOAD_PURPOSES,
  prepareUploadedFile,
} from "@/lib/club/upload-file.mjs";

export const dynamic = "force-dynamic";

const localUploads = globalThis.__revisionLocalUploadChunks || new Map();
globalThis.__revisionLocalUploadChunks = localUploads;

function cleanMetadata(form) {
  const uploadId = String(form.get("uploadId") || ""),
    index = Number(form.get("index")),
    total = Number(form.get("total")),
    originalSize = Number(form.get("originalSize")),
    name = String(form.get("name") || "").slice(0, 200),
    mime = String(form.get("mime") || "").slice(0, 120),
    purpose = String(form.get("purpose") || ""),
    chunk = form.get("chunk"),
    maxChunks = Math.ceil(MAX_UPLOAD_BYTES / UPLOAD_CHUNK_BYTES);
  if (!/^[a-f0-9-]{20,64}$/i.test(uploadId))
    throw new Error("Invalid upload reference.");
  if (
    !Number.isInteger(index) ||
    !Number.isInteger(total) ||
    index < 0 ||
    total < 2 ||
    total > maxChunks ||
    index >= total
  )
    throw new Error("Invalid upload chunk.");
  if (
    !Number.isInteger(originalSize) ||
    originalSize <= 0 ||
    originalSize > MAX_UPLOAD_BYTES
  )
    throw new Error("Upload a non-empty file up to 10 MB.");
  if (!UPLOAD_PURPOSES.includes(purpose))
    throw new Error("Choose a file purpose.");
  if (!chunk || typeof chunk.arrayBuffer !== "function")
    throw new Error("Upload chunk is missing.");
  if (!chunk.size || chunk.size > UPLOAD_CHUNK_BYTES)
    throw new Error("Upload chunk is too large.");
  return {
    uploadId,
    index,
    total,
    originalSize,
    name,
    mime,
    purpose,
    chunk,
  };
}

function verifyChunks(chunks, metadata) {
  if (chunks.length !== metadata.total) return null;
  const ordered = [...chunks].sort(
    (left, right) => Number(left.chunk_index) - Number(right.chunk_index),
  );
  for (let index = 0; index < ordered.length; index++) {
    const chunk = ordered[index];
    if (
      Number(chunk.chunk_index) !== index ||
      Number(chunk.total_chunks) !== metadata.total ||
      Number(chunk.original_size) !== metadata.originalSize ||
      String(chunk.name) !== metadata.name ||
      String(chunk.purpose) !== metadata.purpose ||
      String(chunk.mime) !== metadata.mime
    )
      throw new Error("Upload chunks do not match. Please restart the upload.");
  }
  const buffer = Buffer.concat(
    ordered.map((chunk) => Buffer.from(chunk.content)),
  );
  if (buffer.length !== metadata.originalSize)
    throw new Error("Upload is incomplete. Please restart it.");
  return buffer;
}

function responseFor(file, status) {
  return {
    complete: true,
    id: file.id,
    name: file.name,
    purpose: file.purpose,
    size: Number(file.content?.length || file.size || 0),
    status: status || "Ready for AI document analysis",
  };
}

async function saveLocalChunk(userId, metadata, content) {
  const key = `${userId}:${metadata.uploadId}`;
  const current = localUploads.get(key) || {
    createdAt: Date.now(),
    metadata,
    chunks: new Map(),
  };
  if (Date.now() - current.createdAt > 24 * 60 * 60 * 1000) {
    localUploads.delete(key);
    throw new Error("This upload expired. Please restart it.");
  }
  current.chunks.set(metadata.index, content);
  localUploads.set(key, current);
  return Array.from(current.chunks, ([chunk_index, chunkContent]) => ({
    chunk_index,
    total_chunks: current.metadata.total,
    name: current.metadata.name,
    purpose: current.metadata.purpose,
    mime: current.metadata.mime,
    original_size: current.metadata.originalSize,
    content: chunkContent,
  }));
}

export async function POST(request) {
  let metadata;
  try {
    const { user } = await verifyAuth();
    if (!user) throw new Error("Sign in required.");
    assertSameOrigin(request);
    const requestLimit = UPLOAD_CHUNK_BYTES + 256 * 1024;
    if (Number(request.headers.get("content-length")) > requestLimit)
      throw new Error("Upload chunk is too large.");
    const bytes = await readBody(request, requestLimit);
    const form = await new Response(bytes, {
      headers: { "content-type": request.headers.get("content-type") || "" },
    }).formData();
    metadata = cleanMetadata(form);

    if (mysqlPool) {
      const existing = (await mysqlFiles(user.id, [metadata.uploadId]))[0];
      if (existing) return NextResponse.json(responseFor(existing));
    }

    const content = Buffer.from(await metadata.chunk.arrayBuffer());
    const chunks = mysqlPool
      ? await saveMysqlUploadChunk(user.id, {
          ...metadata,
          content,
        })
      : await saveLocalChunk(user.id, metadata, content);
    const buffer = verifyChunks(chunks, metadata);
    if (!buffer)
      return NextResponse.json({
        complete: false,
        received: chunks.length,
        total: metadata.total,
      });

    const prepared = await prepareUploadedFile({
      buffer,
      mime: metadata.mime,
      name: metadata.name,
      purpose: metadata.purpose,
    });
    const createdAt = new Date().toISOString();
    if (mysqlPool) {
      const totalUsage = await mysqlFileUsage(user.id);
      if (totalUsage + buffer.length > 100 * 1024 * 1024)
        throw new Error("Upload allowance of 100 MB reached.");
      await saveMysqlFile({
        id: metadata.uploadId,
        owner_id: user.id,
        name: prepared.name,
        purpose: prepared.purpose,
        mime: prepared.mime,
        content: prepared.content,
        extracted: prepared.extracted,
        created_at: createdAt,
      });
      await deleteMysqlUploadChunks(user.id, metadata.uploadId);
    } else {
      const { db } = await import("@/lib/db");
      const totalUsage = db
        .prepare(
          "SELECT COALESCE(SUM(length(content)),0) n FROM rc_files WHERE owner_id=?",
        )
        .get(user.id).n;
      if (totalUsage + buffer.length > 100 * 1024 * 1024)
        throw new Error("Upload allowance of 100 MB reached.");
      db.prepare("INSERT INTO rc_files VALUES(?,?,?,?,?,?,?,?)").run(
        metadata.uploadId,
        user.id,
        prepared.name,
        prepared.purpose,
        prepared.mime,
        prepared.content,
        prepared.extracted,
        createdAt,
      );
      localUploads.delete(`${user.id}:${metadata.uploadId}`);
    }
    return NextResponse.json(
      responseFor(
        {
          id: metadata.uploadId,
          name: prepared.name,
          purpose: prepared.purpose,
          content: prepared.content,
        },
        prepared.status,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "The material could not be uploaded." },
      { status: error.message === "Sign in required." ? 401 : 400 },
    );
  }
}
