const { test, expect } = require("@playwright/test");

test("dashboard, sidebar and editor use progressive disclosure", async ({ page }) => {
  test.setTimeout(120000);
  const name = `Simple${Date.now()}`;
  await page.goto("/signIn?mode=signup");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(`${name}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("LocalQA-password-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);

  await expect(page.locator(".today-card")).toContainText("TODAY, AT YOUR PACE");
  await expect(page.getByRole("heading", { name: "Recent papers." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent mistakes." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your study group." })).toBeVisible();
  await expect(page.locator(".today-item")).toHaveCount(3);
  await expect(page.locator(".dashboard-summary")).toHaveCount(3);

  const study = page.locator("button[aria-controls='nav-study']");
  await expect(study).toHaveAttribute("aria-expanded", "false");
  const sidebar = page.locator("#primary-navigation");
  await expect(sidebar.getByRole("link", { name: "Timetable" })).toHaveCount(0);
  await study.click();
  await expect(study).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar.getByRole("link", { name: "Timetable" })).toBeVisible();

  await page.goto("/papers/create");
  await page.getByLabel("Paper title", { exact: true }).fill("Simple editor QA");
  await page.getByRole("button", { name: "Write a manual paper" }).click();
  const question = page.locator(".edit-question").first();
  await expect(question.getByText("Question", { exact: true })).toBeVisible();
  await expect(question.getByLabel("Question format 1", { exact: true })).toBeVisible();
  await expect(question.getByLabel("Answer key 1", { exact: true })).toBeVisible();
  await expect(question.locator("details")).not.toHaveAttribute("open", "");
  await question.locator("summary").click();
  await expect(question.getByLabel("Topic", { exact: true })).toBeVisible();
  await expect(question.getByLabel("Page", { exact: true })).toBeVisible();
  await expect(question.getByLabel("Accepted alternatives 1", { exact: true })).toBeVisible();
});
