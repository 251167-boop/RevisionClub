const { test, expect } = require("@playwright/test");

test("study group members share private assigned papers and can challenge each other", async ({
  browser,
}) => {
  const contexts = [];
  const pages = [];
  const stamp = Date.now();
  const post = async (page, path, data) => {
    const response = await page.request.post("/api/club/" + path, {
      data,
      headers: { Origin: "http://127.0.0.1:3010" },
    });
    expect(response.ok()).toBeTruthy();
    return response.json();
  };
  try {
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      const name = "Group" + stamp + i;
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
    const [owner, member, peer] = pages;
    const group = await post(owner, "action", {
      action: "groupCreate",
      name: "Algebra circle " + stamp,
    });
    const response = await owner.request.get("/api/club/groups/" + group.id);
    const { invite } = await response.json();
    for (const page of [member, peer])
      await post(page, "action", { action: "groupJoin", invite });
    const memberData = await (await owner.request.get("/api/club/groups/" + group.id)).json();
    const adminId = memberData.members.find((item) => item.username === "Group" + stamp + "1").id;
    const peerId = memberData.members.find((item) => item.username === "Group" + stamp + "2").id;
    await post(owner, "action", { action: "role", groupId: group.id, userId: adminId, role: "Admin" });
    await post(member, "action", {
      action: "groupSettings",
      groupId: group.id,
      name: "Algebra circle " + stamp,
      description: "Updated by the group admin",
      subjects: ["Maths"],
    });
    const denied = await peer.request.post("/api/club/action", {
      data: { action: "groupSettings", groupId: group.id, name: "No", subjects: ["Maths"] },
      headers: { Origin: "http://127.0.0.1:3010" },
    });
    expect(denied.status()).toBe(400);
    const paper = await post(owner, "papers", {
      title: "Group algebra " + stamp,
      subject: "Maths",
      content: {
        duration: 15,
        instructions: "Solve.",
        questions: [
          {
            id: "1",
            text: "Find x when x + 3 = 5.",
            marks: 2,
            topic: "Algebra",
            page: 1,
            space: 3,
            options: [],
          },
        ],
      },
      answerKey: [{ questionId: "1", answer: "2" }],
    });
    await post(owner, "action", {
      action: "assign",
      groupId: group.id,
      versionId: paper.versionId,
    });
    await member.goto("/groups/" + group.id);
    await member
      .getByRole("combobox", { name: "Share an assigned paper" })
      .selectOption(paper.paperId);
    await member
      .getByRole("button", { name: "Share paper", exact: false })
      .click();
    await expect(
      member.getByText("Shared a paper", { exact: true }),
    ).toBeVisible();
    await member
      .getByLabel("Message", { exact: true })
      .fill("Let’s practise algebra together.");
    await member.getByRole("button", { name: "Send", exact: false }).click();
    await expect(
      member.getByText("Let’s practise algebra together.", { exact: true }),
    ).toBeVisible();
    await peer.goto("/groups");
    await expect(peer.getByText("2 unread", { exact: true })).toBeVisible();
    await peer.goto("/groups/" + group.id);
    await expect(
      peer.getByText("2 marks · 15 mins · Maths", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        const r = await peer.request.get("/api/club/groups");
        return (await r.json()).find((g) => g.id === group.id).unread;
      })
      .toBe(0);
    await peer.getByLabel("Search loaded messages").fill("together");
    await expect(
      peer.getByText("Let’s practise algebra together.", { exact: true }),
    ).toBeVisible();
    await expect(peer.getByText("Shared a paper", { exact: true })).toHaveCount(
      0,
    );
    await peer
      .getByLabel("Search loaded messages")
      .fill("No such message");
    await expect(
      peer.getByText("No matching recent messages.", { exact: true }),
    ).toBeVisible();
    await peer.getByLabel("Search loaded messages").fill("");
    await peer.getByRole("link", { name: "Open paper" }).click();
    await expect(peer).toHaveURL(new RegExp("papers/" + paper.paperId));
    await expect(
      peer.getByText("1. Find x when x + 3 = 5.", { exact: true }),
    ).toBeVisible();
    await peer.goto("/challenges");
    await expect(
      peer.getByRole("combobox", {
        name: "Friend or study group member",
        exact: true,
      }),
    ).toContainText("Group" + stamp + "1 · Study group member");
    await peer.goto("/groups/" + group.id);
    await peer.getByRole("button", { name: "Assignments" }).click();
    await peer.getByRole("button", { name: "Attempt paper" }).click();
    await peer.getByLabel("Answer to question 1").fill("2");
    peer.once("dialog", (dialog) => dialog.accept());
    await peer.getByRole("button", { name: "Submit for marking" }).click();
    await expect(peer).toHaveURL(/results/);
    await peer.goto("/assignments");
    await expect(peer.getByText("Submitted", { exact: true })).toBeVisible();
    await post(owner, "action", { action: "groupRemoveMember", groupId: group.id, userId: peerId });
    const removed = await peer.request.get("/api/club/groups/" + group.id);
    expect(removed.status()).toBe(403);
  } finally {
    for (const context of contexts) await context.close();
  }
});
