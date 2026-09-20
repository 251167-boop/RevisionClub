const { test, expect } = require("@playwright/test");

test("authenticated product pages keep accessible names, landmarks, focus and mobile width", async ({ page }) => {
  test.setTimeout(180000);
  const name = "A11y" + Date.now();
  await page.goto("/signIn?mode=signup");
  await page.getByLabel("Username", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(name + "@example.test");
  await page.getByLabel("Password", { exact: true }).fill("LocalQA-password-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);

  const routes = [
    "dashboard", "papers", "community", "assignments", "study", "mistakes",
    "timetable", "minigames", "groups", "friends", "leaderboard", "profile",
    "settings", "challenges", "search?q=Maths",
  ];
  for (const route of routes) {
    await page.goto("/" + route);
    await expect(page.locator("main#main h1")).toBeVisible();
    expect(await page.locator("main#main").count()).toBe(1);
    expect(await page.locator("nav[aria-label='Main navigation']").count()).toBe(1);
    const audit = await page.evaluate(() => {
      const visible = (element) => {
        const style = getComputedStyle(element), box = element.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
      };
      const nameOf = (element) => {
        const labelled = element.getAttribute("aria-labelledby");
        if (labelled)
          return labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim();
        if (element.getAttribute("aria-label")) return element.getAttribute("aria-label").trim();
        if (element.id) {
          const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
          if (label) return label.textContent.trim();
        }
        const parentLabel = element.closest("label");
        if (parentLabel) return parentLabel.textContent.trim();
        return (element.textContent || element.getAttribute("alt") || element.getAttribute("title") || element.getAttribute("placeholder") || "").trim();
      };
      const unnamed = [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea")]
        .filter(visible)
        .filter((element) => !nameOf(element))
        .map((element) => element.outerHTML.slice(0, 160));
      const imagesWithoutAlt = [...document.querySelectorAll("img")].filter((image) => !image.hasAttribute("alt"));
      return { unnamed, imagesWithoutAlt: imagesWithoutAlt.length, horizontal: document.documentElement.scrollWidth > window.innerWidth };
    });
    expect(audit.unnamed, `${route} has unnamed controls`).toEqual([]);
    expect(audit.imagesWithoutAlt, `${route} has images without alt`).toBe(0);
    expect(audit.horizontal, `${route} overflows horizontally`).toBe(false);
  }

  await page.goto("/dashboard");
  await page.keyboard.press("Home");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  const focusStyle = await page.getByRole("link", { name: "Skip to main content" }).evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(focusStyle).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
  const contrast = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const rgb = (hex) => {
      const clean = hex.trim().replace("#", "");
      return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16) / 255);
    };
    const luminance = (hex) => rgb(hex).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const ratio = (a, b) => {
      const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (light + 0.05) / (dark + 0.05);
    };
    const cream = root.getPropertyValue("--cream"), ink = root.getPropertyValue("--ink"), muted = root.getPropertyValue("--muted"), forest = root.getPropertyValue("--forest");
    return { body: ratio(ink, cream), muted: ratio(muted, cream), button: ratio("#ffffff", forest) };
  });
  expect(contrast.body).toBeGreaterThanOrEqual(4.5);
  expect(contrast.muted).toBeGreaterThanOrEqual(4.5);
  expect(contrast.button).toBeGreaterThanOrEqual(4.5);

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["dashboard", "community", "study", "timetable", "minigames", "settings", "search?q=Maths"]) {
    await page.goto("/" + route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), route).toBe(true);
  }
});
