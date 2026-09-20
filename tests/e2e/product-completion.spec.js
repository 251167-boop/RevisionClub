const { test, expect } = require("@playwright/test");

test("dashboard, exams, discovery, search, profile, progress and revision games work together", async ({ page }) => {
  test.setTimeout(180000);
  const stamp = Date.now();
  const name = "Complete" + stamp;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const post = async (path, data) => {
    const response = await page.request.post("/api/club/" + path, {
      data,
      headers: { Origin: "http://127.0.0.1:3010" },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return response.json();
  };

  await page.goto("/signIn?mode=signup");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(name + "@example.test");
  await page.getByLabel("Password", { exact: true }).fill("LocalQA-password-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);

  let source;
  for (let index = 1; index <= 13; index++) {
    const paper = await post("papers", {
      title: `Pagination Ecology ${String(index).padStart(2, "0")}`,
      subject: "Geography",
      grade: "Secondary 1",
      difficulty: "Standard",
      content: {
        duration: 10,
        instructions: "Answer.",
        questions: [{ id: "1", type: "short_answer", text: "What is erosion?", marks: 1, topic: "Erosion", page: 1, space: 1, options: [], items: [] }],
      },
      answerKey: [{ questionId: "1", answer: "The wearing away of rock" }],
    });
    await post("action", { action: "publish", paperId: paper.paperId, public: true });
    source ||= paper;
  }

  await page.goto("/timetable");
  const examTime = new Date(Date.now() + 7 * 86400000);
  const local = `${examTime.getFullYear()}-${String(examTime.getMonth() + 1).padStart(2, "0")}-${String(examTime.getDate()).padStart(2, "0")}T12:00`;
  await page.getByLabel("Exam name").fill("Geography end-of-term exam");
  await page.getByLabel("Subject").first().selectOption("Geography");
  await page.getByLabel("Date and time").fill(local);
  await page.getByLabel("Notes").first().fill("Revise erosion and rivers");
  await page.getByRole("button", { name: "Add exam" }).click();
  await expect(page.getByText("Geography end-of-term exam", { exact: true })).toBeVisible();

  const sessionTime = new Date(Date.now() + 2 * 86400000);
  const sessionLocal = `${sessionTime.getFullYear()}-${String(sessionTime.getMonth() + 1).padStart(2, "0")}-${String(sessionTime.getDate()).padStart(2, "0")}T18:30`;
  await page.getByLabel("Session title").fill("Weekly geography review");
  await page.getByLabel("Subject").last().selectOption("Geography");
  await page.getByLabel("Topic").fill("Erosion");
  await page.getByLabel("Date & time").fill(sessionLocal);
  await page.getByLabel("Repeat").selectOption("Weekly");
  await page.getByRole("button", { name: "Add to my timetable" }).click();
  await expect(page.getByText("Weekly geography review", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit Weekly geography review" }).click();
  await expect(page.getByText(/Apply the time, duration and details/)).toBeVisible();
  await page.getByText(/Apply the time, duration and details/).click();
  await page.getByLabel("Duration (minutes)").fill("35");
  await page.getByRole("button", { name: "Save session changes" }).click();
  await expect(page.getByText(/35 minutes/)).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("Upcoming exams.")).toBeVisible();
  await expect(page.getByText("Geography end-of-term exam", { exact: true })).toBeVisible();
  await expect(page.getByText("Recommended activities.")).toBeVisible();
  await page.getByLabel("Dashboard subject").selectOption("Geography");

  await page.goto("/community");
  await expect(page.getByRole("navigation", { name: "Community paper pages" })).toBeVisible();
  await expect(page.getByText(/Page 1 of/)).toBeVisible();
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await expect(page.getByText(/Page 2 of/)).toBeVisible();
  await page.getByLabel("Search papers", { exact: true }).fill("Pagination Ecology 13");
  await expect(page.getByText("Pagination Ecology 13", { exact: true }).first()).toBeVisible();

  await page.goto("/search?q=Ecology%2013");
  await expect(page.getByRole("heading", { name: /result/ })).toBeVisible();
  await expect(page.getByText("Pagination Ecology 13", { exact: true }).first()).toBeVisible();

  await page.goto("/study");
  await page.getByLabel("Progress subject").selectOption("Geography");
  await expect(page.getByRole("heading", { name: "Geography" })).toBeVisible();
  await page.getByLabel("Search progress topics").fill("erosion");

  await page.goto("/settings");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await page.getByLabel("Change avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText(/Avatar saved/)).toBeVisible();
  await expect(page.getByAltText("Your avatar")).toBeVisible();
  await page.getByLabel("Study-session reminders").uncheck();
  await page.getByRole("button", { name: "Save notification preferences" }).click();

  await page.goto("/minigames");
  await page.getByLabel("Timeline topic").selectOption("Chinese history");
  await page.getByLabel("Keyword Blitz topic").selectOption("ICT");
  await page.getByLabel("True or Trap topic").selectOption("Geography");
  await page.getByLabel("Source paper").selectOption(source.versionId);
  await page.getByRole("button", { name: "Play from this paper" }).click();
  await expect(page.getByRole("heading", { name: "Revision Mix" })).toBeVisible();
  await expect(page.getByText("What is erosion?", { exact: true })).toBeVisible();

  await page.goto("/dashboard");
  await page.keyboard.press("Home");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle menu" }).click();
  await expect(page.getByRole("button", { name: "Toggle menu" })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Toggle menu" })).toHaveAttribute("aria-expanded", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
