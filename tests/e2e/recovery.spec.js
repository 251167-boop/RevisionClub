const { test, expect } = require("@playwright/test");

test("failed page data offers retry and keyboard navigation can skip the sidebar", async ({
  page,
}) => {
  const name = "Recovery" + Date.now();
  await page.goto("/signIn?mode=signup");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(name + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("LocalQA-password-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.route("**/api/club/papers", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporary test outage" }),
    }),
  );
  await page.goto("/papers");
  await expect(
    page.getByRole("heading", { name: "This page couldn’t load." }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("status")).toHaveCount(0);
  await page.unroute("**/api/club/papers");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "This page couldn’t load." }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Create a paper", exact: false }).first(),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});
