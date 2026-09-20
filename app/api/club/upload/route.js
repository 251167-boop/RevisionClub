import office from "@/lib/club/office-text.cjs";
import { readBody } from "@/lib/club/request-body.mjs";
import { assertSameOrigin } from "@/lib/club/security";
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
export async function POST(request) {
  try {
    const { user } = await verifyAuth();
    if (!user)
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    assertSameOrigin(request);
    if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024)
      throw new Error("Maximum file size is 10 MB.");
    const bytes = await readBody(request, 11 * 1024 * 1024);
    const form = await new Response(bytes, {
        headers: { "content-type": request.headers.get("content-type") || "" },
      }).formData(),
      file = form.get("file"),
      purpose = form.get("purpose");
    if (
      ![
        "Revision Material",
        "Answer Key / Marking Scheme",
        "Sample Paper",
      ].includes(purpose)
    )
      throw new Error("Choose a file purpose.");
    if (!file || file.size > 10 * 1024 * 1024 || file.size === 0)
      throw new Error("Upload a non-empty file up to 10 MB.");
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type;
    const supported = [
      ...Object.values(office.OFFICE_MIMES),
      "text/plain",
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];
    if (!supported.includes(mime))
      throw new Error("Use PDF, DOCX, PPTX, TXT, PNG, JPG or WebP.");
    if (mime === "application/pdf" && buf.subarray(0, 5).toString() !== "%PDF-")
      throw new Error("This is not a valid PDF.");
    if (mime.startsWith("image/")) {
      const sharp = (await import("sharp")).default;
      await sharp(buf, { limitInputPixels: 40000000 }).metadata();
    }
    const isOffice = Object.values(office.OFFICE_MIMES).includes(mime);
    let extracted = isOffice
      ? await office.extractOfficeText(buf, mime)
      : mime === "text/plain"
        ? new TextDecoder("utf-8", { fatal: true }).decode(buf)
        : "";
    if (extracted.includes("\u0000"))
      throw new Error("Text extraction failed. Upload UTF-8 text.");
    if (extracted.length > 150000)
      throw new Error(
        "Text file is too long. Split it into smaller materials.",
      );
    const total = db
      .prepare(
        "SELECT COALESCE(SUM(length(content)),0) n FROM rc_files WHERE owner_id=?",
      )
      .get(user.id).n;
    if (total + buf.length > 100 * 1024 * 1024)
      throw new Error("Local upload allowance of 100 MB reached.");
    const id = randomUUID(),
      name = String(file.name).slice(0, 200);
    db.prepare("INSERT INTO rc_files VALUES(?,?,?,?,?,?,?,?)").run(
      id,
      user.id,
      name,
      purpose,
      mime,
      buf,
      extracted,
      new Date().toISOString(),
    );
    return NextResponse.json({
      id,
      name,
      purpose,
      size: buf.length,
      status: isOffice
        ? "Text extracted · use PDF to include diagrams and layout"
        : extracted
          ? "Text extracted"
          : "Ready for AI document analysis",
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
