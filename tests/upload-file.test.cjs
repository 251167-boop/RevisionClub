const { test } = require("node:test");
const assert = require("node:assert/strict");

test("uploads keep locally extracted text instead of requiring a vision provider", async () => {
  const { prepareUploadedFile } = await import("../lib/club/upload-file.mjs");
  const prepared = await prepareUploadedFile({
    buffer: Buffer.from("fallback bytes"),
    mime: "text/plain",
    name: "notes.txt",
    purpose: "Revision Material",
    extractedText: "Locally read revision content",
  });
  assert.equal(prepared.extracted, "Locally read revision content");
});

test("selectable PDFs are extracted locally on the server", async () => {
  const [{ jsPDF }, { prepareUploadedFile }] = await Promise.all([
    import("jspdf"),
    import("../lib/club/upload-file.mjs"),
  ]);
  const document = new jsPDF();
  document.text("Solar heating drives evaporation.", 20, 20);
  const prepared = await prepareUploadedFile({
    buffer: Buffer.from(document.output("arraybuffer")),
    mime: "application/pdf",
    name: "water-cycle.pdf",
    purpose: "Revision Material",
  });
  assert.match(prepared.extracted, /Solar heating drives evaporation/);
  assert.match(prepared.status, /ready for AI/);
});

test("untrusted extracted text remains bounded", async () => {
  const { prepareUploadedFile } = await import("../lib/club/upload-file.mjs");
  await assert.rejects(
    prepareUploadedFile({
      buffer: Buffer.from("x"),
      mime: "text/plain",
      name: "notes.txt",
      purpose: "Revision Material",
      extractedText: "x".repeat(150001),
    }),
    /too long/,
  );
});
