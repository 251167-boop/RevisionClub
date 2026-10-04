const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  rules = require("../lib/club/rules.cjs"),
  {
    SUBJECT_VISUAL_POLICIES,
    subjectVisualPolicy,
    validateVisualPlan,
  } = require("../lib/club/visual-policy.cjs"),
  { openDatabase } = require("../lib/club/database.cjs"),
  { service } = require("../lib/club/service.cjs");

const question = {
  id: "1",
  type: "short_answer",
  text: "Plot y = 2x + 1.",
  marks: 2,
  topic: "Linear graphs",
  page: 1,
  space: 4,
  options: [],
  items: [],
};

test("visual policies cover the complete official subject list", () => {
  assert.deepEqual(Object.keys(SUBJECT_VISUAL_POLICIES), rules.SUBJECTS);
  for (const subject of rules.SUBJECTS) {
    const policy = subjectVisualPolicy(subject);
    assert.equal(policy.subject, subject);
    assert.ok(policy.guidance.length > 20);
    assert.ok(policy.suitableVisuals.length > 0);
  }
});

test("paper validation persists suitable visual plans with durable IDs", () => {
  const paper = rules.validatePaper(
    {
      instructions: "Answer all questions.",
      questions: [
        {
          ...question,
          visual: {
            needed: true,
            strategy: "deterministic",
            type: "straight_line_graph",
            description:
              "Coordinate grid from -5 to 5 on both axes with y = 2x + 1 plotted and axes labelled x and y.",
            altText: "Graph of the straight line y equals 2x plus 1.",
            caption: "Figure 1",
          },
        },
      ],
    },
    "Maths",
  );

  assert.deepEqual(paper.questions[0].visual, {
    id: "figure-1",
    policyVersion: 2,
    strategy: "deterministic",
    type: "straight_line_graph",
    description:
      "Coordinate grid from -5 to 5 on both axes with y = 2x + 1 plotted and axes labelled x and y.",
    altText: "Graph of the straight line y equals 2x plus 1.",
    caption: "Figure 1",
    renderData: "{}",
    status: "planned",
  });
});

test("subject policy rejects unsuitable and misleading visual workflows", () => {
  const paper = (visual) => ({
    instructions: "Answer all questions.",
    questions: [{ ...question, visual }],
  });
  assert.throws(
    () =>
      rules.validatePaper(
        paper({
          needed: true,
          strategy: "generated_image",
          type: "straight_line_graph",
          description: "Decorative graph.",
          altText: "A graph.",
        }),
        "Maths",
      ),
    /deterministic visual workflow/,
  );
  assert.throws(
    () =>
      rules.validatePaper(
        paper({
          needed: true,
          strategy: "generated_image",
          type: "historical_source_image",
          description: "Fabricated historical photograph.",
          altText: "A supposed historical photograph.",
        }),
        "History",
      ),
    /source_image visual workflow/,
  );
  assert.throws(
    () =>
      rules.validatePaper(
        paper({
          needed: true,
          strategy: "deterministic",
          type: "straight_line_graph",
          description: "A graph with invalid stored data.",
          altText: "A graph.",
          renderData: "{invalid",
        }),
        "Maths",
      ),
    /valid JSON object/,
  );
});

test("validated image plans preserve safe stored asset references", () => {
  const visual = validateVisualPlan(
    {
      strategy: "generated_image",
      type: "picture_writing_prompt",
      description: "A child finding a lost umbrella at a bus stop.",
      altText: "A child notices an umbrella beside a bus-stop bench.",
      assetId: "2aa0fb0d-2e83-41b2-84bf-24a42fde804c",
      assetMime: "image/png",
      generatedAt: "2026-10-04T10:00:00.000Z",
    },
    "English",
    "3",
  );
  assert.equal(visual.assetId, "2aa0fb0d-2e83-41b2-84bf-24a42fde804c");
  assert.equal(visual.assetMime, "image/png");
  assert.equal(visual.status, "ready");
  assert.throws(
    () =>
      validateVisualPlan(
        {
          ...visual,
          assetId: "../../private",
        },
        "English",
        "3",
      ),
    /asset reference is invalid/,
  );
});

test("visual plans survive the normal paper version persistence flow", () => {
  const db = openDatabase(":memory:");
  db.prepare(
    "INSERT INTO users(id,email,password,username) VALUES(?,?,?,?)",
  ).run(1, "visuals@example.test", "fake", "Visual Author");
  const club = service(db),
    saved = club.savePaper(
      1,
      { title: "Graphs", subject: "Maths" },
      {
        instructions: "Answer all questions.",
        questions: [
          {
            ...question,
            visual: {
              needed: true,
              strategy: "deterministic",
              type: "coordinate_grid",
              description:
                "A coordinate grid with both axes ranging from negative five to five.",
              altText: "A blank coordinate grid.",
              caption: "",
              renderData: JSON.stringify({
                xMin: -5,
                xMax: 5,
                yMin: -5,
                yMax: 5,
              }),
            },
          },
        ],
      },
      [
        {
          questionId: "1",
          answer: "A correctly plotted straight line.",
          rubric: "",
          alternatives: [],
        },
      ],
    ),
    reloaded = club.paper(1, saved.paperId).versions[0].content.questions[0];

  assert.equal(reloaded.visual.id, "figure-1");
  assert.equal(reloaded.visual.status, "planned");
  assert.equal(reloaded.visual.type, "coordinate_grid");
  assert.deepEqual(JSON.parse(reloaded.visual.renderData), {
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
  });
  db.close();
});
