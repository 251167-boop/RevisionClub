const { test, expect } = require("@playwright/test");
const Database = require("better-sqlite3");
const path = require("node:path");
test("Quick Quiz autosaves, freezes expired answers and completes a private-score battle", async ({
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
  const friends = await p2.request.get("/api/club/friends");
  const requester = (await friends.json())[0].id;
  await post(p2, "action", {
    action: "friendRespond",
    userId: requester,
    accept: true,
  });
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
    .getByRole("combobox", { name: "Mode", exact: true })
    .selectOption("Quick Quiz");
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
    await expect(
      p.getByText("Quiz answers autosaved.", { exact: true }),
    ).toBeVisible();
    const aid = p.url().split("/").at(-1);
    await expect
      .poll(async () => {
        const r = await p.request.get("/api/club/attempts/" + aid);
        return (await r.json()).answers["1"];
      })
      .toBe("2");
    const db = new Database(path.resolve(".data/e2e.db"));
    db.prepare("UPDATE rc_attempts SET started_at=? WHERE id=?").run(
      new Date(Date.now() - 301000).toISOString(),
      aid,
    );
    db.close();
    await p.reload();
    await expect(p.getByRole("timer")).toContainText("Time is up");
    await expect(
      p.getByLabel("Answer to question 1", { exact: true }),
    ).toBeDisabled();
    expect(await post(p, "answers/" + aid, { answers: { 1: "99" } })).toEqual({
      1: "2",
    });
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
  await expect(
    p1.getByRole("link", { name: "Review my answers" }),
  ).toBeVisible();
  await expect(
    p1.getByRole("button", { name: "Attempt challenge" }),
  ).toHaveCount(0);
  await c1.close();
  await c2.close();
});
