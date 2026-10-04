const STRATEGIES = ["deterministic", "generated_image", "source_image"];

const entry = (type, label) => ({ type, label });

const SUBJECT_VISUAL_POLICIES = {
  Chinese: {
    deterministic: [
      entry("advertisement", "Advertisement or poster"),
      entry("notice", "Notice"),
      entry("chart", "Chart"),
      entry("infographic", "Infographic"),
      entry("table", "Simple table"),
      entry("map", "Map"),
      entry("structured_prompt", "Structured visual prompt"),
    ],
    generated_image: [
      entry("comprehension_illustration", "Reading-comprehension illustration"),
      entry("comic_strip", "Comic strip"),
      entry("picture_writing_prompt", "Picture-writing prompt"),
      entry("event_sequence_illustration", "Sequence-of-events illustration"),
      entry("cultural_artifact_illustration", "Traditional or cultural artifact illustration"),
      entry("contextual_illustration", "Contextual illustration"),
    ],
    source_image: [
      entry("cultural_artifact_source", "Uploaded cultural artifact image"),
      entry("contextual_source", "Uploaded contextual image"),
    ],
    guidance:
      "Prefer structured layouts for tables, posters, notices and diagrams. Use uploaded sources or generated illustrations only when real imagery is necessary.",
  },
  English: {
    deterministic: [
      entry("advertisement", "Advertisement"),
      entry("notice", "Notice"),
      entry("poster", "Poster"),
      entry("leaflet", "Leaflet"),
      entry("timetable", "Timetable"),
      entry("menu", "Menu"),
      entry("chart", "Chart"),
      entry("infographic", "Infographic"),
      entry("map", "Map"),
      entry("diagram", "Diagram"),
      entry("table", "Table"),
    ],
    generated_image: [
      entry("comprehension_illustration", "Comprehension illustration"),
      entry("picture_writing_prompt", "Picture-writing prompt"),
      entry("comic_strip", "Comic panels"),
    ],
    source_image: [],
    guidance:
      "Use deterministic layouts for functional texts and data displays; reserve generated imagery for illustrations and picture-writing prompts.",
  },
  Maths: {
    deterministic: [
      entry("coordinate_grid", "Coordinate grid"),
      entry("straight_line_graph", "Straight-line graph"),
      entry("quadratic_graph", "Quadratic graph"),
      entry("function_plot", "Function plot"),
      entry("number_line", "Number line"),
      entry("geometry_diagram", "Geometry diagram"),
      entry("triangle", "Triangle"),
      entry("quadrilateral", "Quadrilateral"),
      entry("circle", "Circle"),
      entry("angle", "Angle"),
      entry("polygon", "Polygon"),
      entry("transformation", "Transformation diagram"),
      entry("symmetry", "Symmetry diagram"),
      entry("solid_3d", "3D solid schematic"),
      entry("net", "Net"),
      entry("bar_chart", "Bar chart"),
      entry("line_graph", "Line graph"),
      entry("pie_chart", "Pie chart"),
      entry("histogram", "Histogram"),
      entry("scatter_plot", "Scatter plot"),
      entry("probability_tree", "Probability tree"),
      entry("venn_diagram", "Venn diagram"),
      entry("table", "Table"),
    ],
    generated_image: [],
    source_image: [],
    guidance:
      "Mathematical accuracy is mandatory. Use deterministic figures rather than decorative or generative imagery.",
  },
  "Integrated Science": {
    deterministic: [
      entry("biology_diagram", "Labelled biological diagram"),
      entry("plant_cell", "Plant cell"),
      entry("animal_cell", "Animal cell"),
      entry("organ", "Organ diagram"),
      entry("body_system", "Body-system diagram"),
      entry("food_chain", "Food chain"),
      entry("food_web", "Food web"),
      entry("apparatus", "Experimental apparatus"),
      entry("laboratory_setup", "Laboratory setup"),
      entry("particle_diagram", "Particle diagram"),
      entry("state_change", "State-change diagram"),
      entry("force_diagram", "Force diagram"),
      entry("ray_diagram", "Ray diagram"),
      entry("electric_circuit", "Electric circuit"),
      entry("energy_flow", "Energy-flow diagram"),
      entry("process_diagram", "Process diagram"),
      entry("graph", "Graph"),
      entry("chart", "Chart"),
      entry("table", "Table"),
      entry("scientific_cycle", "Scientific cycle"),
    ],
    generated_image: [],
    source_image: [],
    guidance:
      "Prefer clean scientific schematics. Do not use photorealistic generated imagery when a labelled diagram is more accurate.",
  },
  History: {
    deterministic: [
      entry("timeline", "Timeline"),
      entry("historical_map", "Historical map"),
      entry("territory_change_map", "Territory-change map"),
      entry("event_flow", "Event-flow diagram"),
      entry("cause_effect", "Cause-and-effect diagram"),
      entry("comparison_table", "Comparison table"),
      entry("historical_data_chart", "Historical-data chart"),
      entry("relationship_diagram", "Family or political relationship diagram"),
      entry("sequence_diagram", "Sequence diagram"),
    ],
    generated_image: [entry("political_cartoon_placeholder", "Political-cartoon placeholder")],
    source_image: [
      entry("historical_source_image", "Uploaded historical source image"),
      entry("source_image_container", "Historical source-image container"),
    ],
    guidance:
      "Historical photographs and documentary evidence must be uploaded or sourced separately. Never present generated historical imagery as authentic evidence.",
  },
  "Chinese History": {
    deterministic: [
      entry("dynastic_timeline", "Dynastic timeline"),
      entry("historical_map", "Historical map"),
      entry("territory_diagram", "Territory diagram"),
      entry("dynasty_relationship", "Emperor or dynasty relationship chart"),
      entry("event_sequence", "Event sequence"),
      entry("political_structure", "Political structure"),
      entry("social_hierarchy", "Social hierarchy"),
      entry("comparison_table", "Comparison table"),
    ],
    generated_image: [],
    source_image: [
      entry("source_image_container", "Source-image container"),
      entry("artifact_source", "Uploaded artifact image"),
    ],
    guidance:
      "Use structured historical figures. Treat artifacts and documentary sources as uploaded evidence, not generated reconstructions.",
  },
  CES: {
    deterministic: [
      entry("supply_demand_graph", "Supply-and-demand-style graph"),
      entry("economic_chart", "Economic chart"),
      entry("bar_chart", "Bar chart"),
      entry("pie_chart", "Pie chart"),
      entry("line_graph", "Line graph"),
      entry("demographic_chart", "Demographic chart"),
      entry("decision_tree", "Decision tree"),
      entry("cause_effect", "Cause-and-effect diagram"),
      entry("stakeholder_diagram", "Stakeholder diagram"),
      entry("government_structure", "Government-structure diagram"),
      entry("process_diagram", "Process diagram"),
      entry("table", "Table"),
      entry("infographic", "Infographic"),
      entry("map", "Map"),
    ],
    generated_image: [],
    source_image: [],
    guidance:
      "Prefer clear data displays and structured civic or economic diagrams over decorative imagery.",
  },
  Geography: {
    deterministic: [
      entry("climate_graph", "Climate graph"),
      entry("bar_chart", "Bar chart"),
      entry("line_graph", "Line graph"),
      entry("population_pyramid", "Population pyramid"),
      entry("map", "Map"),
      entry("schematic_map", "Schematic map"),
      entry("contour_diagram", "Contour-style diagram"),
      entry("cross_section", "Cross section"),
      entry("river_profile", "River profile"),
      entry("drainage_basin", "Drainage-basin diagram"),
      entry("water_cycle", "Water-cycle diagram"),
      entry("rock_cycle", "Rock-cycle diagram"),
      entry("plate_tectonics", "Plate-tectonic diagram"),
      entry("weather_diagram", "Weather diagram"),
      entry("landform_diagram", "Landform diagram"),
      entry("settlement_model", "Settlement model"),
      entry("transport_network", "Transport-network diagram"),
      entry("flow_map", "Flow map"),
      entry("choropleth_map", "Simplified choropleth-style map"),
      entry("table", "Table"),
      entry("geographic_process", "Labelled geographic process"),
    ],
    generated_image: [],
    source_image: [],
    guidance:
      "Prioritize deterministic educational figures and geographically accurate labels, scales and data.",
  },
  ICT: {
    deterministic: [
      entry("flowchart", "Flowchart"),
      entry("network_diagram", "Network diagram"),
      entry("computer_architecture", "Computer-architecture diagram"),
      entry("ipo_diagram", "Input-process-output diagram"),
      entry("database_relationship", "Database relationship diagram"),
      entry("table", "Table"),
      entry("logic_diagram", "Logic diagram"),
      entry("tree_structure", "Tree structure"),
      entry("ui_mockup", "Simple UI mockup"),
      entry("binary_data", "Binary or data diagram"),
      entry("system_diagram", "System diagram"),
      entry("cybersecurity_network", "Cybersecurity or network schematic"),
    ],
    generated_image: [],
    source_image: [],
    guidance:
      "Use deterministic system, data and interface schematics with unambiguous labels and connections.",
  },
  Music: {
    deterministic: [
      entry("musical_staff", "Musical staff"),
      entry("treble_clef", "Treble clef"),
      entry("bass_clef", "Bass clef"),
      entry("notes", "Notes"),
      entry("rests", "Rests"),
      entry("time_signature", "Time signature"),
      entry("rhythm_pattern", "Rhythm pattern"),
      entry("melody_excerpt", "Simple melody excerpt"),
      entry("keyboard_diagram", "Keyboard diagram"),
      entry("instrument_family", "Instrument-family diagram"),
      entry("chord_diagram", "Chord diagram"),
      entry("note_identification", "Note-identification exercise"),
    ],
    generated_image: [],
    source_image: [],
    guidance:
      "Use structured notation or SVG-compatible specifications rather than raster-generated music notation.",
  },
  "Religious Studies": {
    deterministic: [
      entry("timeline", "Timeline"),
      entry("relationship_diagram", "Relationship diagram"),
      entry("concept_map", "Concept map"),
      entry("comparison_table", "Comparison table"),
      entry("event_sequence", "Sequence-of-events diagram"),
      entry("map", "Map"),
      entry("place_of_worship", "Place-of-worship diagram"),
      entry("symbolic_object", "Symbolic-object illustration"),
      entry("family_tree", "Family tree"),
    ],
    generated_image: [],
    source_image: [entry("source_image_container", "Source-image container")],
    guidance:
      "Use respectful, neutral schematics. Avoid generated imagery that could be inappropriate, doctrinally misleading or presented as authentic evidence.",
  },
};

const VISUAL_TYPES = [
  ...new Set(
    Object.values(SUBJECT_VISUAL_POLICIES).flatMap((policy) =>
      STRATEGIES.flatMap((strategy) =>
        (policy[strategy] || []).map((item) => item.type),
      ),
    ),
  ),
];

function cleanText(value, max) {
  const result = String(value || "").trim();
  if (!result || result.length > max)
    throw new Error(`Visual text must contain 1–${max} characters.`);
  return result;
}

function subjectVisualPolicy(subject) {
  const policy = SUBJECT_VISUAL_POLICIES[subject];
  if (!policy) return null;
  return {
    subject,
    guidance: policy.guidance,
    suitableVisuals: STRATEGIES.flatMap((strategy) =>
      (policy[strategy] || []).map((item) => ({ ...item, strategy })),
    ),
  };
}

function validateVisualPlan(visual, subject, questionId) {
  if (!visual || visual.needed === false || visual.strategy === "none") return null;
  const policy = subjectVisualPolicy(subject);
  const strategy = String(visual.strategy || "");
  const type = String(visual.type || "");
  if (!STRATEGIES.includes(strategy))
    throw new Error("Choose a supported visual strategy.");
  if (!VISUAL_TYPES.includes(type)) throw new Error("Choose a supported visual type.");
  if (policy) {
    const allowed = policy.suitableVisuals.find((item) => item.type === type);
    if (!allowed)
      throw new Error(`${type} is not suitable for ${subject} papers.`);
    if (allowed.strategy !== strategy)
      throw new Error(`${type} must use the ${allowed.strategy} visual workflow.`);
  }
  const rawId = String(questionId),
    safeId =
      rawId.replace(/[^A-Za-z0-9_-]/g, "-").replace(/^-+|-+$/g, "") ||
      Buffer.from(rawId).toString("hex").slice(0, 40);
  let renderData = "{}";
  if (visual.renderData) {
    const raw =
      typeof visual.renderData === "string"
        ? visual.renderData
        : JSON.stringify(visual.renderData);
    if (raw.length > 12000) throw new Error("Figure data is too large.");
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error();
      renderData = JSON.stringify(parsed);
    } catch {
      throw new Error("Figure data must be a valid JSON object.");
    }
  }
  return {
    id: `figure-${safeId}`,
    policyVersion: 2,
    strategy,
    type,
    description: cleanText(visual.description, 2000),
    altText: cleanText(visual.altText, 500),
    caption: visual.caption ? String(visual.caption).trim().slice(0, 300) : "",
    renderData,
    status: "planned",
  };
}

module.exports = {
  STRATEGIES,
  VISUAL_TYPES,
  SUBJECT_VISUAL_POLICIES,
  subjectVisualPolicy,
  validateVisualPlan,
};
