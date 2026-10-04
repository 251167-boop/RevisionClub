const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  {
    SUPPORTED_OUTLINE_TYPES,
    buildVisualModel,
    visualFamily,
  } = require("../lib/club/visual-renderer.cjs"),
  { SUBJECT_VISUAL_POLICIES } = require("../lib/club/visual-policy.cjs");

test("requested subject figures map to deterministic renderer families", () => {
  assert.equal(visualFamily("advertisement"), "document");
  assert.equal(visualFamily("coordinate_grid"), "cartesian");
  assert.equal(visualFamily("plant_cell"), "science");
  assert.equal(visualFamily("climate_graph"), "chart");
  assert.equal(visualFamily("drainage_basin"), "map");
});

test("all deterministic types across the official subject list have renderers", () => {
  for (const subject of Object.keys(SUBJECT_VISUAL_POLICIES)) {
    for (const item of SUBJECT_VISUAL_POLICIES[subject].deterministic)
      assert.ok(
        SUPPORTED_OUTLINE_TYPES.has(item.type),
        `${subject} ${item.type} is missing a renderer`,
      );
  }
});

test("remaining subjects use dedicated renderer families and source placeholders", () => {
  assert.equal(visualFamily("dynastic_timeline"), "history");
  assert.equal(visualFamily("supply_demand_graph"), "economics");
  assert.equal(visualFamily("network_diagram"), "ict");
  assert.equal(visualFamily("musical_staff"), "music");
  assert.equal(visualFamily("place_of_worship"), "religious");
  assert.equal(visualFamily("historical_source_image"), "placeholder");
  assert.equal(
    buildVisualModel({
      type: "musical_staff",
      description: "A C-major scale.",
      altText: "Music notation.",
      renderData: JSON.stringify({ labels: ["C4", "D4", "E4"] }),
    }).labels.join(","),
    "C4,D4,E4",
  );
});

test("renderer consumes exact stored plotting data without changing values", () => {
  const model = buildVisualModel({
    type: "straight_line_graph",
    strategy: "deterministic",
    description: "Plot the supplied line.",
    altText: "A line graph.",
    renderData: JSON.stringify({
      equation: { kind: "linear", m: 2, b: 1 },
      xMin: -4,
      xMax: 6,
      yMin: -7,
      yMax: 9,
      xLabel: "time",
      yLabel: "distance",
    }),
  });
  assert.deepEqual(model.equation, {
    kind: "linear",
    m: 2,
    b: 1,
    a: 1,
    c: 0,
  });
  assert.equal(model.xMin, -4);
  assert.equal(model.yMax, 9);
  assert.equal(model.xLabel, "time");
});

test("older Step 1 plans infer equations and labelled values from descriptions", () => {
  const graph = buildVisualModel({
      type: "straight_line_graph",
      description: "Draw y = -2x + 3 on axes from -5 to 5.",
      altText: "Line graph.",
    }),
    chart = buildVisualModel({
      type: "bar_chart",
      description: "Show Apples: 4, Pears: 7 and Oranges: 5.",
      altText: "Fruit chart.",
    });
  assert.deepEqual(graph.equation, { kind: "linear", m: -2, b: 3 });
  assert.deepEqual(chart.labels, ["Show Apples", "Pears", "and Oranges"]);
  assert.deepEqual(chart.values, [4, 7, 5]);
});

test("malformed optional render data falls back safely", () => {
  const model = buildVisualModel({
    type: "water_cycle",
    description: "Evaporation then condensation then precipitation.",
    altText: "Water cycle.",
    renderData: "{broken",
  });
  assert.equal(model.family, "flow");
  assert.deepEqual(model.labels, []);
});
