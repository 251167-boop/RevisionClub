import { readBody } from "@/lib/club/request-body.mjs";
import {
  DIRECT_UPLOAD_BYTES,
  prepareUploadedFile,
} from "@/lib/club/upload-file.mjs";
import { assertSameOrigin } from "@/lib/club/security";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { mysqlFileUsage, saveMysqlFile } from "@/lib/club/mysql-drafts";
import { randomUUID } from "node:crypto";
export async function POST(request) {
  try {
    const { user } = await verifyAuth();
    if (!user)
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    assertSameOrigin(request);
    const requestLimit = DIRECT_UPLOAD_BYTES + 1024 * 1024;
    if (Number(request.headers.get("content-length")) > requestLimit)
      throw new Error("Large files must use the chunked uploader.");
    const bytes = await readBody(request, requestLimit);
    const form = await new Response(bytes, {
        headers: { "content-type": request.headers.get("content-type") || "" },
      }).formData(),
      file = form.get("file"),
      purpose = form.get("purpose");
    if (!file || file.size > DIRECT_UPLOAD_BYTES || file.size === 0)
      throw new Error("Large files must use the chunked uploader.");
    const buf = Buffer.from(await file.arrayBuffer());
    const prepared = await prepareUploadedFile({
      buffer: buf,
      mime: file.type,
      name: file.name,
      purpose,
      extractedText: form.get("extracted"),
    });
    if (!mysqlPool) throw new Error("MySQL is required.");
    const total = await mysqlFileUsage(user.id);
    if (total + buf.length > 100 * 1024 * 1024)
      throw new Error("Upload allowance of 100 MB reached.");
    const id = randomUUID(),
      name = prepared.name,
      createdAt = new Date().toISOString();
    await saveMysqlFile({
      id,
      owner_id: user.id,
      name,
      purpose,
      mime: prepared.mime,
      content: buf,
      extracted: prepared.extracted,
      created_at: createdAt,
    });
    return NextResponse.json({
      id,
      name,
      purpose,
      mime: prepared.mime,
      size: buf.length,
      status: prepared.status,
      hasExtracted: Boolean(prepared.extracted),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
