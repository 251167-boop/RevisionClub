const { test, expect } = require("@playwright/test");

test("boss battle checks each answer, applies damage and saves a single reward", async ({
  page,
}) => {
  const name = "Boss" + Date.now();
  await page.goto("/signIn?mode=signup");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(name + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalQA-password-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/minigames");
  const started = page.waitForResponse((r) =>
    r.url().endsWith("/api/club/gameStart"),
  );
  await page.getByRole("button", { name: "Play Boss Battle" }).click();
  const game = await (await started).json();
  expect(game.questions.every((q) => q.answer === undefined)).toBeTruthy();
  for (let i = 0; i < 10; i++) {
    const q = game.questions[i];
    const [a, b] = q.text.split(" × ").map(Number);
    await page.getByLabel(q.text, { exact: true }).fill(String(a * b));
    await page.getByRole("button", { name: "Attack", exact: false }).click();
    await expect(
      page.getByRole("progressbar", { name: "Boss health" }),
    ).toHaveAttribute("value", String(90 - i * 10));
    await expect(
      page.getByRole("progressbar", { name: "Your health" }),
    ).toHaveAttribute("value", "100");
  }
  await expect(
    page.getByText("Boss defeated! Save your round below.", { exact: true }),
  ).toBeVisible();
  const finish = page.getByRole("button", { name: "Finish round" });
  await expect(finish).toBeEnabled();
  await finish.click();
  await expect(
    page.getByRole("heading", { name: "10 / 10", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/100% accuracy.*\+10 XP/)).toBeVisible();
  const replay = await page.request.post("/api/club/gameFinish", {
    data: { id: game.id, answers: {} },
    headers: { Origin: "http://127.0.0.1:3010" },
  });
  expect(replay.status()).toBe(400);
  await page.getByRole("button", { name: "Back to minigames" }).click();
  await page
    .getByRole("combobox", { name: "Boss Battle topic" })
    .selectOption("Fractions");
  const lostStart = page.waitForResponse((r) =>
    r.url().endsWith("/api/club/gameStart"),
  );
  await page.getByRole("button", { name: "Play Boss Battle" }).click();
  const lostGame = await (await lostStart).json();
  expect(lostGame.topic).toBe("Fractions");
  for (let i = 0; i < 5; i++) {
    await page
      .getByLabel(lostGame.questions[i].text, { exact: true })
      .fill("-1");
    await page.getByRole("button", { name: "Attack", exact: false }).click();
    await expect(
      page.getByRole("progressbar", { name: "Your health" }),
    ).toHaveAttribute("value", String(80 - i * 20));
  }
  await expect(
    page.getByRole("button", { name: "Attack", exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Finish round" }),
  ).toBeEnabled();
  const forgedAnswers = Object.fromEntries(
    lostGame.questions.map((q) => {
      const [, numerator, denominator, total] = q.text.match(
        /What is (\d+)\/(\d+) of (\d+)\?/,
      );
      return [
        q.id,
        String((Number(numerator) * Number(total)) / Number(denominator)),
      ];
    }),
  );
  const forgedFinish = await page.request.post("/api/club/gameFinish", {
    data: { id: lostGame.id, answers: forgedAnswers },
    headers: { Origin: "http://127.0.0.1:3010" },
  });
  expect(forgedFinish.ok()).toBeTruthy();
  const result = await forgedFinish.json();
  expect(result.correct).toBe(0);
  expect(result.xpEarned).toBe(0);
});
