const { test, expect } = require("@playwright/test");
test("all remaining minigames grade their interactions and share the daily XP cap", async ({
  page,
}) => {
  test.setTimeout(180000);
  const name = "Catalogue" + Date.now();
  await page.goto("/signIn?mode=signup");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(name + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalQA-password-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/minigames");
  const terms = {
    "Liquid changing into a gas at its surface.": "Evaporation",
    "Gas changing into a liquid.": "Condensation",
    "A solid changing into a liquid.": "Melting",
    "A liquid changing into a solid.": "Freezing",
    "The attractive force between masses.": "Gravity",
    "The process by which plants use light energy to make sugars.":
      "Photosynthesis",
    "A material that allows electric current to pass through easily.":
      "Conductor",
    "A material that strongly resists electric current.": "Insulator",
  };
  const falseStatements = [
    "RAM normally retains its contents when the power is off.",
    "A URL and an email address are always the same thing.",
    "Every website using HTTPS is guaranteed to be trustworthy.",
    "Deleting a shortcut always deletes the original file.",
  ];
  const timeline = [
    "Printing of the Gutenberg Bible",
    "Beginning of the French Revolution",
    "Start of the First World War",
    "End of the First World War",
    "Start of the Second World War in Europe",
    "United Nations founded",
  ];
  for (const [index, name] of [
    "Math Rush",
    "Timeline",
    "Keyword Blitz",
    "True or Trap",
    "Diagram Dash",
  ].entries()) {
    if (name === "Math Rush")
      await page
        .getByRole("combobox", { name: "Math Rush topic" })
        .selectOption("Linear equations");
    const response = page.waitForResponse((r) =>
      r.url().endsWith("/api/club/gameStart"),
    );
    await page
      .getByRole("button", { name: "Play " + name, exact: false })
      .click();
    const game = await (await response).json();
    expect(
      game.questions.every(
        (q) => q.answer === undefined && q.explanation === undefined,
      ),
    ).toBeTruthy();
    if (name === "Timeline") {
      for (let target = 0; target < timeline.length; target++) {
        const row = page
          .locator(".timeline-sort li")
          .filter({ hasText: timeline[target] });
        let current = (
          await page.locator(".timeline-sort li").allTextContents()
        ).findIndex((t) => t.includes(timeline[target]));
        while (current > target) {
          await row.getByRole("button", { name: /earlier/ }).click();
          current--;
        }
      }
    } else
      for (const q of game.questions) {
        const field = q.options ? page.getByRole("combobox", { name: q.text, exact: true }) : page.getByLabel(q.text, { exact: true });
        if (name === "Math Rush") {
          const [, a, b, c] = q.text.match(/Find x: (\d+)x \+ (\d+) = (-?\d+)/);
          await field.fill(String((Number(c) - Number(b)) / Number(a)));
        } else if (name === "Keyword Blitz")
          await field.selectOption(terms[q.text]);
        else if (name === "True or Trap")
          await field.selectOption(
            falseStatements.includes(q.text) ? "False" : "True",
          );
        else
          await field.selectOption(
            {
              A: "Evaporation",
              B: "Condensation",
              C: "Precipitation",
              D: "Collection",
            }[q.label],
          );
      }
    if (name === "Diagram Dash")
      await expect(
        page.getByRole("img", { name: /Water-cycle process diagram/ }),
      ).toBeVisible();
    const finish = page.getByRole("button", { name: "Finish round" });
    await expect(finish).toBeEnabled();
    const marked = page.waitForResponse((r) =>
      r.url().endsWith("/api/club/gameFinish"),
    );
    await finish.click();
    const result = await (await marked).json();
    expect(result.correct).toBe(game.questions.length);
    expect(result.xpEarned).toBe(index === 0 ? 10 : 0);
    await expect(
      page.getByRole("heading", {
        name: `${result.total} / ${result.total}`,
        exact: true,
      }),
    ).toBeVisible();
    await page.getByText("Review answers", { exact: true }).click();
    await expect(page.getByText("Correct", { exact: true })).toHaveCount(
      result.total,
    );
    await page.getByRole("button", { name: "Back to minigames" }).click();
  }
});
