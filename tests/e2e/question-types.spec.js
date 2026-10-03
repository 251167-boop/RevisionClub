const { test, expect } = require("@playwright/test");

test("the nine base question formats render and accept their intended responses", async ({
  page,
}) => {
  test.setTimeout(120000);
  const name = "Formats" + Date.now();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

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
    .fill("Format editor QA");
  await page.getByRole("button", { name: "Write a manual paper" }).click();
  await page
    .getByRole("button", { name: "Edit question 1", exact: true })
    .click();
  const format = page.getByLabel("Question format 1", { exact: true });
  await format.selectOption("mc_box");
  await expect(
    page.getByLabel("Option A for question 1", { exact: true }),
  ).toBeVisible();
  await format.selectOption("comprehension");
  await expect(page.getByLabel("Passage 1", { exact: true })).toBeVisible();
  await format.selectOption("matching");
  await expect(
    page.getByLabel("Matching prompts 1", { exact: true }),
  ).toBeVisible();
  await format.selectOption("fill_blanks");
  await expect(
    page.getByLabel("Word 1 for question 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Hide word box from students", { exact: true }),
  ).toBeVisible();

  const questions = [
    {
      id: "1",
      type: "mc_box",
      text: "Which number is four?",
      marks: 1,
      topic: "Numbers",
      page: 1,
      space: 1,
      options: ["1", "2", "3", "4"],
      items: [],
    },
    {
      id: "2",
      type: "mc_single_box",
      text: "Which letter comes first?",
      marks: 1,
      topic: "Alphabet",
      page: 1,
      space: 1,
      options: ["A", "B", "C", "D"],
      items: [],
    },
    {
      id: "3",
      type: "mc_circle",
      text: "Select the colour of the sky.",
      marks: 1,
      topic: "Vocabulary",
      page: 1,
      space: 1,
      options: ["Red", "Blue", "Green", "Yellow"],
      items: [],
    },
    {
      id: "4",
      type: "answer_space",
      text: "Show your working for 2 + 2.",
      marks: 2,
      topic: "Addition",
      page: 1,
      space: 5,
      options: [],
      items: [],
    },
    {
      id: "5",
      type: "short_answer",
      text: "Write the answer to 3 + 3.",
      marks: 1,
      topic: "Addition",
      page: 1,
      space: 1,
      options: [],
      items: [],
    },
    {
      id: "6",
      type: "comprehension",
      text: "What fruit did Sam buy?",
      passage: "Sam went to the market and bought an apple.",
      marks: 1,
      topic: "Reading",
      page: 1,
      space: 2,
      options: [],
      items: [],
    },
    {
      id: "7",
      type: "fill_blanks",
      text: "Plants need ___ and ___ to grow.",
      marks: 2,
      topic: "Plants",
      page: 1,
      space: 2,
      lineSpacing: 8,
      hideWordBox: false,
      options: ["water", "sunlight", "stone"],
      items: [],
    },
    {
      id: "8",
      type: "ordering",
      text: "Put the stages in order.",
      marks: 3,
      topic: "Sequences",
      page: 1,
      space: 3,
      options: ["Wake up", "Eat breakfast", "Go to school"],
      items: [],
    },
    {
      id: "9",
      type: "matching",
      text: "Match each number to its Chinese numeral.",
      marks: 2,
      topic: "Numbers",
      page: 1,
      space: 2,
      options: ["一", "二"],
      items: ["one", "two"],
    },
  ];
  const response = await page.request.post("/api/club/papers", {
    headers: { Origin: "http://127.0.0.1:3010" },
    data: {
      title: "Nine question formats",
      subject: "Maths",
      grade: "Primary 1",
      difficulty: "Foundation",
      language: "English",
      content: {
        duration: 30,
        instructions: "Answer every question.",
        questions,
      },
      answerKey: [
        { questionId: "1", answer: "4" },
        { questionId: "2", answer: "A" },
        { questionId: "3", answer: "Blue" },
        { questionId: "4", answer: "4" },
        { questionId: "5", answer: "6" },
        { questionId: "6", answer: "apple" },
        { questionId: "7", answer: "water | sunlight" },
        {
          questionId: "8",
          answer: JSON.stringify(["Wake up", "Eat breakfast", "Go to school"]),
        },
        {
          questionId: "9",
          answer: JSON.stringify({ one: "一", two: "二" }),
        },
      ],
    },
  });
  expect(response.ok()).toBeTruthy();
  const paper = await response.json();

  await page.goto("/papers/" + paper.paperId);
  await expect(page.locator(".mc_box .choice-box")).toHaveCount(4);
  await expect(page.locator(".mc_single_box .choice-box")).toHaveCount(0);
  await expect(page.locator(".single-answer-box")).toHaveCount(1);
  await expect(page.locator(".mc_circle .choice-circle")).toHaveCount(4);
  await expect(page.locator(".blank-answer-space")).toHaveCount(1);
  await expect(page.locator(".short-answer-line")).toHaveCount(1);
  await expect(page.locator(".comprehension-box")).toContainText(
    "Sam went to the market",
  );
  await expect(page.locator(".fill-word-box")).toContainText("sunlight");
  await expect(page.locator(".fill-blank-fields > div")).toHaveCount(2);
  await expect(page.locator(".ordering-response")).toHaveCount(1);
  await expect(page.locator(".matching-response")).toHaveCount(1);

  await page.getByRole("button", { name: /Attempt paper/ }).click();
  await expect(page).toHaveURL(/attempts/);
  await page.locator(".mc_box .mc-option").last().click();
  await expect(page.locator(".mc_box .choice-box.selected")).toHaveCount(1);
  await page.locator(".mc_single_box .mc-option").nth(1).click();
  await expect(page.locator(".single-answer-box")).toContainText("B");
  await page.locator(".mc_circle .mc-option").nth(1).click();
  await expect(page.locator(".mc_circle .choice-circle.selected")).toHaveCount(
    1,
  );
  await page.getByLabel("Answer to question 4").fill("2 + 2 = 4");
  await page.getByLabel("Answer to question 5").fill("6");
  await page.getByLabel("Answer to question 6").fill("apple");
  await page.getByRole("button", { name: "water", exact: true }).click();
  await page.getByRole("button", { name: "sunlight", exact: true }).click();
  await expect(page.getByLabel("Blank 1 for question 7")).toHaveValue("water");
  await expect(page.getByLabel("Blank 2 for question 7")).toHaveValue(
    "sunlight",
  );
  await page.getByLabel("Position 1 for question 8").selectOption("Wake up");
  await page
    .getByLabel("Position 2 for question 8")
    .selectOption("Eat breakfast");
  await page
    .getByLabel("Position 3 for question 8")
    .selectOption("Go to school");
  await page.getByLabel("Match for one").selectOption("一");
  await page.getByLabel("Match for two").selectOption("二");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft answers saved.")).toBeVisible();
  await page.screenshot({
    path: "test-results/nine-question-formats.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
