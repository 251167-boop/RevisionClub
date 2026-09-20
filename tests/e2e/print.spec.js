const { test, expect } = require("@playwright/test");
test("print output includes every question and excludes app controls and private keys", async ({
  page,
}, testInfo) => {
  const name = "Print" + Date.now();
  await page.goto("/signIn?mode=signup");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(name + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalQA-password-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  const headers = { Origin: "http://127.0.0.1:3010" };
  for (const dense of [false, true]) {
    const questions = Array.from({ length: dense ? 8 : 4 }, (_, i) => ({
      id: String(i + 1),
      text: `PRINT_QUESTION_${i + 1}: Explain how solar energy affects evaporation and describe one observation that would support your explanation.`,
      marks: 2,
      topic: "Water cycle",
      page: dense ? 1 : Math.floor(i / 2) + 1,
      space: dense ? 10 : 2,
      options: i === 0 ? ["Higher temperature", "Lower temperature"] : [],
    }));
    const response = await page.request.post("/api/club/papers", {
      headers,
      data: {
        title: dense ? "Dense print QA" : "Two-page print QA",
        subject: "Geography",
        content: {
          instructions: "Answer every question. Show your reasoning.",
          duration: 20,
          questions,
        },
        answerKey: questions.map((q) => ({
          questionId: q.id,
          answer: "PRIVATE_KEY_MUST_NOT_PRINT",
        })),
      },
    });
    expect(response.ok()).toBeTruthy();
    const paper = await response.json();
    await page.goto("/papers/" + paper.paperId);
    await expect(page.locator("article.exam-paper")).toHaveCount(dense ? 1 : 2);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".topbar")).toBeHidden();
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeHidden();
    await expect(
      page.getByText("Private marking scheme", { exact: true }),
    ).toBeHidden();
    await page.pdf({
      path: testInfo.outputPath(dense ? "dense.pdf" : "two-page.pdf"),
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page.emulateMedia({ media: "screen" });
  }
});
