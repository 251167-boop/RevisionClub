const { test, expect } = require("@playwright/test");

test("confirmed mistakes suggest a topic and planning it removes the duplicate suggestion", async ({
  browser,
}) => {
  const contexts = [];
  const pages = [];
  const post = async (page, path, data) => {
    const response = await page.request.post("/api/club/" + path, {
      data,
      headers: { Origin: "http://127.0.0.1:3010" },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  try {
    const stamp = Date.now();
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      const name = "Focus" + stamp + i;
      await page.goto("/signIn?mode=signup");
      await page.getByLabel("Username", { exact: true }).fill(name);
      await page
        .getByLabel("Email", { exact: true })
        .fill(name + "@example.test");
      await page
        .getByLabel("Password", { exact: true })
        .fill("LocalQA-password-2026");
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page).toHaveURL(/dashboard/);
    }
    const [creator, student] = pages;
    const group = await post(creator, "action", {
      action: "groupCreate",
      name: "Confirmed rankings",
    });
    const groupResponse = await creator.request.get(
      "/api/club/groups/" + group.id,
    );
    const groupData = await groupResponse.json();
    await post(student, "action", {
      action: "groupJoin",
      invite: groupData.invite,
    });
    const paper = await post(creator, "papers", {
      title: "Addition practice",
      subject: "Maths",
      content: {
        instructions: "Show your working.",
        questions: [
          {
            id: "1",
            text: "What is 2 + 2?",
            marks: 2,
            topic: "Addition",
            page: 1,
            space: 3,
            options: [],
          },
        ],
      },
      answerKey: [{ questionId: "1", answer: "4" }],
    });
    await post(creator, "action", {
      action: "publish",
      paperId: paper.paperId,
      public: true,
    });
    const attempt = await post(student, "attempts", {
      versionId: paper.versionId,
    });
    const result = await post(student, "submit/" + attempt.id, {
      answers: { 1: "3" },
    });
    const provisional = await student.request.get("/api/club/dashboard");
    expect((await provisional.json()).suggestions).toEqual([]);
    const reviewResponse = await student.request.get(
      "/api/club/results/" + result.id,
    );
    const review = await reviewResponse.json();
    const challenge = await post(student, "challenge", {
      itemId: review.items[0].id,
      reason: "Please check my working for method marks.",
    });
    await post(creator, "resolve", {
      challengeId: challenge.id,
      mark: 1,
      reason: "One method mark, but the final answer remains incorrect.",
    });
    await student.goto("/groups/" + group.id);
    await student
      .getByRole("button", { name: "Dashboard", exact: true })
      .click();
    const podium = student
      .locator("section")
      .filter({
        has: student.getByRole("heading", {
          name: "Top students · confirmed marks",
          exact: true,
        }),
      });
    await expect(podium.getByText("50%", { exact: true })).toBeVisible();
    await student.goto("/profile");
    const topper = student
      .locator("section.achievement")
      .filter({
        has: student.getByRole("heading", { name: "Topper", exact: true }),
      });
    await expect(topper).toHaveClass(/unlocked/);
    await expect(topper.getByText(/Unlocked/)).toBeVisible();
    await student.goto("/dashboard");
    await expect(
      student.getByRole("heading", {
        name: "A little more Addition.",
        exact: true,
      }),
    ).toBeVisible();
    await student.getByRole("link", { name: "Plan focused revision" }).click();
    await student
      .getByRole("button", { name: "Plan Addition", exact: true })
      .click();
    await expect(
      student.getByLabel("Session title", { exact: true }),
    ).toHaveValue("Revise Addition");
    await expect(student.getByLabel("Topic", { exact: true })).toHaveValue(
      "Addition",
    );
    const local = await student.evaluate(() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T16:00`;
    });
    await student.getByLabel("Date & time", { exact: true }).fill(local);
    await student.getByRole("button", { name: "Add to my timetable" }).click();
    await expect(
      student.getByRole("heading", { name: "Revise Addition", exact: true }),
    ).toBeVisible();
    await expect(
      student.getByRole("button", { name: "Plan Addition", exact: true }),
    ).toHaveCount(0);
  } finally {
    for (const context of contexts) await context.close();
  }
});
