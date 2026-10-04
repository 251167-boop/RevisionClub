const CHART_TYPES = new Set([
  "chart",
  "graph",
  "bar_chart",
  "line_graph",
  "pie_chart",
  "histogram",
  "scatter_plot",
  "climate_graph",
  "population_pyramid",
]);
const CARTESIAN_TYPES = new Set([
  "coordinate_grid",
  "straight_line_graph",
  "quadratic_graph",
  "function_plot",
]);
const GEOMETRY_TYPES = new Set([
  "geometry_diagram",
  "triangle",
  "quadrilateral",
  "circle",
  "angle",
  "polygon",
  "transformation",
  "symmetry",
  "solid_3d",
  "net",
]);
const DOCUMENT_TYPES = new Set([
  "advertisement",
  "notice",
  "poster",
  "leaflet",
  "timetable",
  "menu",
  "table",
  "infographic",
  "structured_prompt",
]);
const MAP_TYPES = new Set([
  "map",
  "schematic_map",
  "contour_diagram",
  "cross_section",
  "river_profile",
  "drainage_basin",
  "landform_diagram",
  "settlement_model",
  "transport_network",
  "flow_map",
  "choropleth_map",
  "geographic_process",
  "weather_diagram",
]);
const SCIENCE_TYPES = new Set([
  "biology_diagram",
  "plant_cell",
  "animal_cell",
  "organ",
  "body_system",
  "apparatus",
  "laboratory_setup",
  "particle_diagram",
  "state_change",
  "force_diagram",
  "ray_diagram",
  "electric_circuit",
]);
const FLOW_TYPES = new Set([
  "diagram",
  "food_chain",
  "food_web",
  "energy_flow",
  "process_diagram",
  "scientific_cycle",
  "water_cycle",
  "rock_cycle",
  "plate_tectonics",
  "probability_tree",
  "venn_diagram",
]);
const SUPPORTED_OUTLINE_TYPES = new Set([
  ...CHART_TYPES,
  ...CARTESIAN_TYPES,
  ...GEOMETRY_TYPES,
  ...DOCUMENT_TYPES,
  ...MAP_TYPES,
  ...SCIENCE_TYPES,
  ...FLOW_TYPES,
  "number_line",
]);

function string(value, max = 80) {
  return String(value || "")
    .trim()
    .slice(0, max);
}
function number(value, fallback = 0, min = -10000, max = 10000) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(min, Math.min(max, parsed))
    : fallback;
}
function strings(value, fallback = []) {
  const list = Array.isArray(value) ? value : fallback;
  return list
    .slice(0, 12)
    .map((item) => string(item, 50))
    .filter(Boolean);
}
function parseStoredData(renderData) {
  if (!renderData) return {};
  if (typeof renderData === "object" && !Array.isArray(renderData))
    return renderData;
  try {
    const parsed = JSON.parse(String(renderData));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
function inferredEquation(description) {
  const source = String(description || "").replace(/−/g, "-");
  const quadratic = source.match(
    /y\s*=\s*([+-]?\d*\.?\d*)\s*x(?:\^?2|²)(?:\s*([+-])\s*(\d*\.?\d+)\s*x)?(?:\s*([+-])\s*(\d*\.?\d+))?/i,
  );
  if (quadratic)
    return {
      kind: "quadratic",
      a: number(
        quadratic[1] === "" || quadratic[1] === "+" ? 1 : quadratic[1],
        1,
      ),
      b: number(`${quadratic[2] || "+"}${quadratic[3] || 0}`, 0),
      c: number(`${quadratic[4] || "+"}${quadratic[5] || 0}`, 0),
    };
  const linear = source.match(
    /y\s*=\s*([+-]?\d*\.?\d*)\s*x(?:\s*([+-])\s*(\d*\.?\d+))?/i,
  );
  if (!linear) return null;
  return {
    kind: "linear",
    m: number(linear[1] === "" || linear[1] === "+" ? 1 : linear[1], 1),
    b: number(`${linear[2] || "+"}${linear[3] || 0}`, 0),
  };
}
function inferredPairs(description) {
  return [
    ...String(description || "").matchAll(
      /([A-Za-z][A-Za-z ]{0,18})\s*[:=]\s*(-?\d+(?:\.\d+)?)/g,
    ),
  ]
    .slice(0, 10)
    .map((match) => ({ label: string(match[1]), value: number(match[2]) }));
}
function cleanPoints(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).map((point, index) => ({
    x: number(point?.x, index),
    y: number(point?.y, 0),
    label: string(point?.label, 30),
  }));
}
function visualFamily(type) {
  if (CARTESIAN_TYPES.has(type) || type === "number_line") return "cartesian";
  if (CHART_TYPES.has(type)) return "chart";
  if (GEOMETRY_TYPES.has(type)) return "geometry";
  if (DOCUMENT_TYPES.has(type)) return "document";
  if (MAP_TYPES.has(type)) return "map";
  if (SCIENCE_TYPES.has(type)) return "science";
  if (FLOW_TYPES.has(type)) return "flow";
  return "flow";
}
function buildVisualModel(visual) {
  if (!visual || visual.status === "failed") return null;
  const type = string(visual.type, 60),
    source = parseStoredData(visual.renderData),
    inferred = inferredPairs(visual.description),
    labels = strings(
      source.labels,
      inferred.map((item) => item.label),
    ),
    values = (
      Array.isArray(source.values)
        ? source.values
        : Array.isArray(source.series?.[0]?.values)
          ? source.series[0].values
          : inferred.map((item) => item.value)
    )
      .slice(0, 12)
      .map((value) => number(value));
  if (!SUPPORTED_OUTLINE_TYPES.has(type)) return null;
  return {
    type,
    family: visualFamily(type),
    title: string(
      source.title || visual.caption || type.replaceAll("_", " "),
      100,
    ),
    altText: string(
      visual.altText || visual.description || "Question figure",
      500,
    ),
    caption: string(visual.caption, 300),
    description: string(visual.description, 2000),
    labels,
    values,
    secondaryValues: (Array.isArray(source.secondaryValues)
      ? source.secondaryValues
      : Array.isArray(source.series?.[1]?.values)
        ? source.series[1].values
        : []
    )
      .slice(0, 12)
      .map((value) => number(value)),
    points: cleanPoints(source.points),
    equation:
      source.equation && typeof source.equation === "object"
        ? {
            kind: source.equation.kind === "quadratic" ? "quadratic" : "linear",
            m: number(source.equation.m, 1),
            b: number(source.equation.b, 0),
            a: number(source.equation.a, 1),
            c: number(source.equation.c, 0),
          }
        : inferredEquation(visual.description),
    xLabel: string(source.xLabel || "x", 20),
    yLabel: string(source.yLabel || "y", 20),
    xMin: number(source.xMin, -5, -1000, 999),
    xMax: number(source.xMax, 5, -999, 1000),
    yMin: number(source.yMin, -5, -1000, 999),
    yMax: number(source.yMax, 5, -999, 1000),
  };
}

module.exports = {
  SUPPORTED_OUTLINE_TYPES,
  buildVisualModel,
  visualFamily,
  parseStoredData,
};
