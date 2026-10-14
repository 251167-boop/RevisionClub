const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  {
    SUPPORTED_OUTLINE_TYPES,
    buildVisualModel,
    flowDiagramLayout,
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

test("cycle diagrams arrange nodes without overlap and close the final arrow", () => {
  for (const count of [3, 4, 5, 6]) {
    const { nodes, edges, cycle } = flowDiagramLayout("water_cycle", count);

    assert.equal(cycle, true);
    assert.equal(nodes.length, count);
    assert.equal(edges.length, count);
    for (let first = 0; first < nodes.length; first++) {
      for (let second = first + 1; second < nodes.length; second++) {
        const a = nodes[first],
          b = nodes[second];
        assert.ok(
          Math.abs(a.x - b.x) >= (a.width + b.width) / 2 ||
            Math.abs(a.y - b.y) >= (a.height + b.height) / 2,
          `cycle nodes ${first} and ${second} overlap with ${count} labels`,
        );
      }
    }
  }
});

test("long process diagrams use a non-overlapping serpentine layout", () => {
  const { nodes, edges, cycle } = flowDiagramLayout("process_diagram", 6);

  assert.equal(cycle, false);
  assert.equal(nodes.length, 6);
  assert.equal(edges.length, 5);
  assert.equal(nodes[2].x, nodes[3].x);
  assert.ok(nodes[2].y < nodes[3].y);
  for (let first = 0; first < nodes.length; first++) {
    for (let second = first + 1; second < nodes.length; second++) {
      const a = nodes[first],
        b = nodes[second];
      assert.ok(
        Math.abs(a.x - b.x) >= (a.width + b.width) / 2 ||
          Math.abs(a.y - b.y) >= (a.height + b.height) / 2,
        `process nodes ${first} and ${second} overlap`,
      );
    }
  }
});

test("flow arrows stop on the edges of their source and destination nodes", () => {
  const { nodes, edges } = flowDiagramLayout("water_cycle", 5),
    onBoundary = (point, node) =>
      Math.abs(
        Math.max(
          Math.abs(point.x - node.x) / (node.width / 2),
          Math.abs(point.y - node.y) / (node.height / 2),
        ) - 1,
      ) < 1e-9;

  edges.forEach((edge, index) => {
    assert.ok(onBoundary({ x: edge.x1, y: edge.y1 }, nodes[index]));
    assert.ok(
      onBoundary({ x: edge.x2, y: edge.y2 }, nodes[(index + 1) % nodes.length]),
    );
  });
});
