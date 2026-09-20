const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  OFFICE_MIMES,
  extractOfficeText,
} = require("../lib/club/office-text.cjs");
const {
  zip,
  word,
  metadata,
  docx,
  pptx,
} = require("./helpers/office-fixtures.cjs");
test("Office imports decode multilingual text and preserve presentation slide order", async () => {
  assert.equal(
    await extractOfficeText(
      docx("Water &amp; 光合作用 &lt; 10"),
      OFFICE_MIMES.docx,
    ),
    "Water & 光合作用 < 10",
  );
  assert.equal(
    await extractOfficeText(pptx(), OFFICE_MIMES.pptx),
    "Slide 1\nFirst topic\n\nSlide 2\nSecond topic",
  );
});
test("Office imports reject malformed, mislabeled, empty and unsafe documents", async () => {
  await assert.rejects(
    extractOfficeText(Buffer.from("not a zip"), OFFICE_MIMES.docx),
    /not a readable/,
  );
  await assert.rejects(
    extractOfficeText(docx("text"), OFFICE_MIMES.pptx),
    /slide order/,
  );
  await assert.rejects(
    extractOfficeText(docx(""), OFFICE_MIMES.docx),
    /No readable text/,
  );
  await assert.rejects(
    extractOfficeText(
      zip([
        metadata,
        [
          "word/document.xml",
          '<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]>' +
            word("&secret;"),
        ],
      ]),
      OFFICE_MIMES.docx,
    ),
    /doctype/,
  );
  await assert.rejects(
    extractOfficeText(
      zip([metadata, ["word/document.xml", word("x").slice(0, -3)]]),
      OFFICE_MIMES.docx,
    ),
  );
  await assert.rejects(
    extractOfficeText(
      zip([
        metadata,
        ["word/document.xml", word("x")],
        ["word/document.xml", word("y")],
      ]),
      OFFICE_MIMES.docx,
    ),
    /duplicate/,
  );
  await assert.rejects(
    extractOfficeText(
      zip([metadata, ["../word/document.xml", word("x")]]),
      OFFICE_MIMES.docx,
    ),
    /damaged|unsupported/,
  );
});
test("Office imports enforce expanded byte and extracted text limits", async () => {
  await assert.rejects(
    extractOfficeText(docx("x".repeat(3 * 1024 * 1024)), OFFICE_MIMES.docx),
    /too large/,
  );
  await assert.rejects(
    extractOfficeText(docx("x".repeat(150001)), OFFICE_MIMES.docx),
    /too long/,
  );
});
