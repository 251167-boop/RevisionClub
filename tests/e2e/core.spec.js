const { test, expect } = require("@playwright/test");
test("sign-up, manual paper, second student marking and creator challenge resolution", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const creator = await browser.newContext(),
    student = await browser.newContext();
  const page = await creator.newPage(),
    pupil = await student.newPage();
  const suffix = Date.now();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  pupil.on("pageerror", (e) => errors.push(e.message));
  async function signup(p, name) {
    await p.goto("/signIn?mode=signup");
    await p.getByLabel("Username", { exact: true }).fill(name);
    await p.getByLabel("Email", { exact: true }).fill(name + "@example.test");
    await p
      .getByLabel("Password", { exact: true })
      .fill("LocalQA-password-2026");
    await p.getByRole("button", { name: "Create account" }).click();
    await expect(p).toHaveURL(/dashboard/);
    await expect(
      p.getByRole("heading", { name: new RegExp(name) }),
    ).toBeVisible();
  }
  await signup(page, "Creator" + suffix);
  await page.goto("/papers/create");
  await page
    .getByLabel("Paper title", { exact: true })
    .fill("Geography water cycle QA");
  await page.getByRole("button", { name: "Geography", exact: true }).click();
  await page.getByRole("button", { name: "Write a manual paper" }).click();
  await page
    .getByLabel("Question 1 text", { exact: true })
    .fill("What powers evaporation in the water cycle?");
  await page.getByLabel("Answer key 1", { exact: true }).fill("Solar heating");
  await page.getByRole("button", { name: "Save to My Papers" }).click();
  await expect(page).toHaveURL(/papers\/[a-f0-9-]+$/);
  const paperURL = page.url();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Publish to community", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unpublish", exact: true }),
  ).toBeVisible();
  await signup(pupil, "Student" + suffix);
  await pupil.goto(paperURL);
  await expect(
    pupil.getByText("Private marking scheme", { exact: true }),
  ).toHaveCount(0);
  await pupil
    .getByRole("button", { name: "Attempt paper", exact: false })
    .click();
  await expect(pupil).toHaveURL(/attempts/);
  await pupil
    .getByLabel("Answer to question 1", { exact: true })
    .fill("Heat from the sun");
  await pupil.getByRole("button", { name: "Save draft" }).click();
  await expect(pupil.getByText("Draft answers saved.")).toBeVisible();
  pupil.once("dialog", (d) => d.accept());
  await pupil.getByRole("button", { name: "Submit for marking" }).click();
  await expect(pupil).toHaveURL(/results\//);
  const resultURL = pupil.url();
  await pupil.goto(paperURL);
  await pupil.getByLabel("Rating").selectOption("5");
  await pupil.getByRole("button", { name: "Save rating" }).click();
  await expect(pupil.getByText("Thank you. Your rating is saved.")).toBeVisible();
  await pupil.goto(resultURL);
  await pupil.getByText("Challenge marking ↗", { exact: true }).click();
  await pupil
    .getByLabel("Why should this be reviewed?")
    .fill("Heat from the sun means solar heating.");
  await pupil.getByRole("button", { name: "Send to paper creator" }).click();
  await expect(pupil.getByText("Challenged", { exact: true })).toBeVisible();
  await page.goto(resultURL);
  await page.getByLabel("Revised mark", { exact: true }).fill("4");
  await page
    .getByLabel("Decision explanation", { exact: true })
    .fill("Semantically equivalent answer. Full marks.");
  await page.getByRole("button", { name: "Resolve challenge" }).click();
  await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
  await pupil.reload();
  await expect(pupil.getByText("4 / 4 · 100%", { exact: true })).toBeVisible();
  for (const route of [
    "dashboard",
    "papers",
    "assignments",
    "community",
    "study",
    "mistakes",
    "groups",
    "friends",
    "leaderboard",
    "challenges",
    "timetable",
    "minigames",
    "profile",
    "settings",
  ]) {
    await page.goto("/" + route);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator(".notice.error")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Toggle menu" })).toBeVisible();
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await expect(
    page.getByRole("link", { name: "Study Timetable", exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await creator.close();
  await student.close();
});
test("anonymous private API and page access blocked", async ({
  page,
  request,
}) => {
  const r = await request.get("/api/club/dashboard");
  expect(r.status()).toBe(401);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/signIn/);
});
test("private draft recovery and answer-key undo follow editor changes", async ({
  page,
}) => {
  const name = "Draft" + Date.now();
  await page.goto("/signIn?mode=signup");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(name + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalQA-password-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/papers/create");
  await page
    .getByLabel("Paper title", { exact: true })
    .fill("Recoverable paper");
  await page.getByRole("button", { name: "Write a manual paper" }).click();
  await page
    .getByLabel("Question 1 text", { exact: true })
    .fill("What is 2 + 2?");
  await page.getByLabel("Answer key 1", { exact: true }).fill("4");
  await page
    .getByLabel("Question format 1", { exact: true })
    .selectOption("mc_box");
  await page.getByLabel("Options 1", { exact: true }).fill("3\n4\n5");
  await page.locator(".edit-question").filter({ hasText: "Question 1" }).getByText("More options", { exact: true }).click();
  await page
    .getByLabel("Accepted alternatives 1", { exact: true })
    .fill("four\nFour units");
  await page.getByRole("button", { name: "Add question" }).click();
  await page
    .getByLabel("Question 2 text", { exact: true })
    .fill("What is 3 + 3?");
  await page.getByLabel("Answer key 2", { exact: true }).fill("6");
  await page
    .getByRole("button", { name: "Delete question 1", exact: true })
    .click();
  await expect(page.getByLabel("Question 1 text", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Answer key 1", { exact: true })).toHaveValue(
    "4",
  );
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByLabel("Question 1 text", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Undo" }).click();
  await page
    .getByRole("button", { name: "Move question 2 up", exact: true })
    .click();
  await expect(page.locator(".edit-question").first()).toContainText(
    "Question 2",
  );
  await page.locator(".edit-question").first().getByText("More options", { exact: true }).click();
  await page
    .getByRole("button", { name: "Regenerate question 1", exact: true })
    .click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "AI is not configured",
  );
  await expect(page.getByLabel("Answer key 1", { exact: true })).toHaveValue(
    "4",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByText("Draft saved. You can return to it from this account."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Your saved draft has been restored."),
  ).toBeVisible();
  await expect(page.getByLabel("Options 1", { exact: true })).toHaveValue(
    "3\n4\n5",
  );
  await page.locator(".edit-question").filter({ hasText: "Question 1" }).getByText("More options", { exact: true }).click();
  await expect(
    page.getByLabel("Accepted alternatives 1", { exact: true }),
  ).toHaveValue("four\nFour units");
  await expect(page.getByLabel("Paper title", { exact: true })).toHaveValue(
    "Recoverable paper",
  );
  await expect(page.getByLabel("Answer key 1", { exact: true })).toHaveValue(
    "4",
  );
  await expect(page.locator(".edit-question").first()).toContainText(
    "Question 2",
  );
  const firstQuestion = page.locator(".edit-question").first();
  await firstQuestion.locator("summary").click();
  await expect(firstQuestion.locator("details")).toHaveAttribute("open", "");
  await firstQuestion.getByLabel("Page", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Page 2", exact: false }).click();
  await page
    .getByRole("button", { name: "Move page earlier", exact: true })
    .click();
  await expect(
    page.getByLabel("Question 2 text", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete page", exact: true }).click();
  await expect(page.getByLabel("Question 2 text", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Undo", exact: false }).click();
  await expect(page.getByLabel("Answer key 2", { exact: true })).toHaveValue(
    "6",
  );
  await page.getByRole("button", { name: "Save to My Papers" }).click();
  await expect(page).toHaveURL(/papers\/[a-f0-9-]+$/);
  await page
    .getByRole("button", { name: "Edit new version", exact: true })
    .click();
  await page
    .getByLabel("Question 2 text", { exact: true })
    .fill("Updated question for a new version");
  await page
    .getByRole("button", { name: "Save edit draft", exact: true })
    .click();
  await expect(
    page.getByText("Version edit draft saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Edit new version", exact: true })
    .click();
  await expect(page.getByLabel("Question 2 text", { exact: true })).toHaveValue(
    "Updated question for a new version",
  );
  await page
    .getByRole("button", { name: "Regenerate question 2", exact: true })
    .click();
  await expect(page.locator("main [role=alert]")).toContainText(
    "AI is not configured",
  );
  await expect(page.getByLabel("Question 2 text", { exact: true })).toHaveValue(
    "Updated question for a new version",
  );
  await page
    .getByRole("button", { name: "Save new version", exact: false })
    .click();
  await expect(
    page.locator('select[aria-label="Paper version"] option:checked'),
  ).toHaveText("Version 2");
  await expect(
    page.getByText("2. Updated question for a new version", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Paper version", exact: true })
    .selectOption({ label: "Version 1" });
  await expect(
    page.getByText("2. Updated question for a new version", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/papers/create");
  await expect(
    page.getByRole("button", { name: "Write a manual paper" }),
  ).toBeVisible();
  await expect(page.getByLabel("Paper title", { exact: true })).toHaveValue("");
});
test("friends and paper challenges complete with private opponent scores and a draw", async ({
  browser,
}) => {
  const c1 = await browser.newContext(),
    c2 = await browser.newContext(),
    p1 = await c1.newPage(),
    p2 = await c2.newPage(),
    stamp = Date.now();
  const names = ["BattleA" + stamp, "BattleB" + stamp];
  for (const [i, p] of [p1, p2].entries()) {
    await p.goto("/signIn?mode=signup");
    await p.getByLabel("Username", { exact: true }).fill(names[i]);
    await p
      .getByLabel("Email", { exact: true })
      .fill(names[i] + "@example.test");
    await p
      .getByLabel("Password", { exact: true })
      .fill("LocalQA-password-2026");
    await p.getByRole("button", { name: "Create account" }).click();
    await expect(p).toHaveURL(/dashboard/);
  }
  const post = async (p, path, body) => {
    const r = await p.request.post("/api/club/" + path, {
      data: body,
      headers: { Origin: "http://127.0.0.1:3010" },
    });
    expect(r.ok()).toBeTruthy();
    return r.json();
  };
  await post(p1, "action", { action: "friendRequest", username: names[1] });
  await p1.goto("/friends");
  await expect(p1.getByText("Awaiting reply", { exact: true })).toBeVisible();
  await expect(
    p1.getByRole("button", { name: "Accept", exact: true }),
  ).toHaveCount(0);
  await p2.goto("/friends");
  await p2.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(p2.getByRole("link", { name: "Chat ↗" })).toBeVisible();
  const friendsResponse = await p1.request.get("/api/club/friends");
  const peerId = (await friendsResponse.json())[0].id;
  await post(p1, "action", {
    action: "message",
    recipientId: peerId,
    body: "Ready for our arithmetic challenge?",
  });
  await p2.reload();
  await expect(p2.getByText("1 unread", { exact: true })).toBeVisible();
  await p2.getByRole("link", { name: "Chat ↗" }).click();
  await expect(
    p2.getByText("Ready for our arithmetic challenge?", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const r = await p2.request.get("/api/club/friends");
      return (await r.json())[0].unread;
    })
    .toBe(0);
  await p2.getByLabel("Search loaded messages").fill("unmatched");
  await expect(
    p2.getByText("No matching recent messages.", { exact: true }),
  ).toBeVisible();
  await p2.getByLabel("Search loaded messages").fill("arithmetic");
  await expect(
    p2.getByText("Ready for our arithmetic challenge?", { exact: true }),
  ).toBeVisible();
  const paper = await post(p1, "papers", {
    title: "Battle arithmetic " + stamp,
    subject: "Maths",
    content: {
      instructions: "Answer.",
      questions: [
        {
          id: "1",
          text: "1 + 1?",
          marks: 1,
          page: 1,
          space: 2,
          topic: "Addition",
        },
      ],
    },
    answerKey: [{ questionId: "1", answer: "2" }],
  });
  await post(p1, "action", {
    action: "publish",
    paperId: paper.paperId,
    public: true,
  });
  await p1.goto("/challenges");
  await p1
    .getByRole("combobox", {
      name: "Friend or study group member",
      exact: true,
    })
    .selectOption({ label: names[1] + " · Friend" });
  await p1
    .getByRole("combobox", { name: "Community paper", exact: true })
    .selectOption(paper.versionId);
  await p1.getByRole("button", { name: "Send paper challenge" }).click();
  await expect(p1.getByText("Pending", { exact: true })).toBeVisible();
  await expect(
    p1.getByRole("button", { name: "Accept", exact: true }),
  ).toHaveCount(0);
  await p2.goto("/challenges");
  await p2.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(
    p2.getByRole("button", { name: "Attempt challenge" }),
  ).toBeVisible();
  for (const p of [p1, p2]) {
    await p.goto("/challenges");
    await p.getByRole("button", { name: "Attempt challenge" }).click();
    await p.getByLabel("Answer to question 1", { exact: true }).fill("2");
    p.once("dialog", (d) => d.accept());
    await p.getByRole("button", { name: "Submit for marking" }).click();
    await expect(p).toHaveURL(/results\//);
    if (p === p1) {
      const r = await p2.request.get("/api/club/challenges");
      expect((await r.json())[0].scores[0]).toBeNull();
    }
  }
  await p1.goto("/challenges");
  await expect(
    p1.getByText("A draw — equally matched.", { exact: true }),
  ).toBeVisible();
  await expect(p1.getByText(/Your XP receipt: \+\d+ XP/)).toBeVisible();
  await expect(
    p1.getByRole("link", { name: "Review my answers" }),
  ).toBeVisible();
  await expect(
    p1.getByRole("button", { name: "Attempt challenge" }),
  ).toHaveCount(0);
  await c1.close();
  await c2.close();
});
test("timetable preserves local time and supports editing, calendar views and deletion", async ({
  page,
}) => {
  const name = "Planner" + Date.now();
  await page.goto("/signIn?mode=signup");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(name + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalQA-password-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/timetable");
  const plan = await page.evaluate(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(16, 30, 0, 0);
    return {
      local: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T16:30`,
      iso: d.toISOString(),
    };
  });
  await page
    .getByLabel("Session title", { exact: true })
    .fill("Water cycle revision");
  await page
    .getByRole("combobox", { name: "Subject", exact: true })
    .selectOption("Geography");
  await page.getByLabel("Date & time", { exact: true }).fill(plan.local);
  await page.getByRole("button", { name: "Add to my timetable" }).click();
  await expect(
    page.getByRole("heading", { name: "Water cycle revision", exact: true }),
  ).toBeVisible();
  const response = await page.request.get("/api/club/dashboard");
  expect((await response.json()).sessions[0].starts_at).toBe(plan.iso);
  await expect(
    page.getByRole("button", { name: "Start focus session" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Edit Water cycle revision", exact: true })
    .click();
  await page.getByLabel("Duration (minutes)", { exact: true }).fill("30");
  await page
    .getByRole("button", { name: "Save session changes", exact: true })
    .click();
  await expect(
    page.getByText("· 30 minutes · None", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Timetable view", exact: true })
    .selectOption("Day");
  await page
    .getByLabel("Timetable date", { exact: true })
    .fill(plan.local.slice(0, 10));
  await expect(
    page.getByRole("heading", { name: "Water cycle revision", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Timetable view", exact: true })
    .selectOption("Week");
  await expect(page.locator(".calendar-session")).toContainText(
    "Water cycle revision",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/timetable-mobile.png",
    fullPage: true,
  });
  await page.locator(".calendar-session").click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete Water cycle revision", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Water cycle revision", exact: true }),
  ).toHaveCount(0);
});
