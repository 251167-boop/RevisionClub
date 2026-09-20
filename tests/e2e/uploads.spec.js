const { test, expect } = require("@playwright/test");
const { docx, pptx } = require("../helpers/office-fixtures.cjs");
const { OFFICE_MIMES } = require("../../lib/club/office-text.cjs");
test("uploads validate file content and keep sources private across accounts", async ({
  browser,
}) => {
  const contexts = [await browser.newContext(), await browser.newContext()],
    pages = await Promise.all(contexts.map((c) => c.newPage()));
  const stamp = Date.now();
  for (const [i, p] of pages.entries()) {
    const name = "Upload" + i + stamp;
    await p.goto("/signIn?mode=signup");
    await p.getByLabel("Username", { exact: true }).fill(name);
    await p.getByLabel("Email", { exact: true }).fill(name + "@example.test");
    await p
      .getByLabel("Password", { exact: true })
      .fill("LocalQA-password-2026");
    await p.getByRole("button", { name: "Create account" }).click();
    await expect(p).toHaveURL(/dashboard/);
  }
  const headers = { Origin: "http://127.0.0.1:3010" };
  const invalid = await pages[0].request.post("/api/club/upload", {
    headers,
    multipart: {
      purpose: "Revision Material",
      file: {
        name: "bad.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("not a pdf"),
      },
    },
  });
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error).toContain("valid PDF");
  const upload = await pages[0].request.post("/api/club/upload", {
    headers,
    multipart: {
      purpose: "Revision Material",
      file: {
        name: "notes.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Solar heating drives evaporation."),
      },
    },
  });
  expect(upload.ok()).toBeTruthy();
  const file = await upload.json();
  expect(file.status).toBe("Text extracted");
  const officeIds = [];
  await pages[0].goto("/papers/create");
  for (const [extension, buffer] of [
    ["docx", docx("Solar heating drives evaporation.")],
    ["pptx", pptx()],
  ]) {
    const response = pages[0].waitForResponse((r) =>
      r.url().endsWith("/api/club/upload"),
    );
    await pages[0]
      .getByLabel("Revision Material", { exact: true })
      .setInputFiles({
        name: "notes." + extension,
        mimeType: OFFICE_MIMES[extension],
        buffer,
      });
    const uploaded = await (await response).json();
    expect(uploaded.status).toContain("Text extracted");
    expect(uploaded.status).toContain("PDF");
    await expect(
      pages[0].getByText("notes." + extension, { exact: false }),
    ).toBeVisible();
    officeIds.push(uploaded.id);
  }
  const invalidOffice = await pages[0].request.post("/api/club/upload", {
    headers,
    multipart: {
      purpose: "Revision Material",
      file: {
        name: "bad.docx",
        mimeType: OFFICE_MIMES.docx,
        buffer: Buffer.from("not a document archive"),
      },
    },
  });
  expect(invalidOffice.status()).toBe(400);
  expect((await invalidOffice.json()).error).toContain("not a readable");
  const denied = await pages[1].request.post("/api/club/generate", {
    headers,
    data: { subject: "Geography", fileIds: [...officeIds, file.id] },
  });
  expect(denied.status()).toBe(400);
  expect((await denied.json()).error).toContain("File access denied");
  const oversized = await pages[0].request.post("/api/club/paper-draft", {
    headers,
    data: { draft: { settings: { title: "x".repeat(500001) } } },
  });
  expect(oversized.status()).toBe(400);
  expect((await oversized.json()).error).toContain("too large");
  for (const c of contexts) await c.close();
});
