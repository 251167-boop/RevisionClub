const SUBJECTS = [
  "Chinese",
  "English",
  "Maths",
  "Integrated Science",
  "History",
  "Chinese History",
  "CES",
  "Geography",
  "ICT",
  "Music",
  "Religious Studies",
];
const QUESTION_TYPES = [
  "mc_box",
  "mc_single_box",
  "mc_circle",
  "answer_space",
  "short_answer",
  "comprehension",
  "ordering",
  "matching",
];
const REWARDS = {
  minigame: 10,
  session: 20,
  submit: 30,
  correction: 20,
  highScore: 50,
  mastery: 100,
  streak: 25,
};
const ACHIEVEMENTS = [
  ["perfect", "Perfect Paper", "Score 100% on a test.", "✦", "Rare"],
  [
    "streak",
    "Locked In",
    "Maintain a 7-day revision streak.",
    "♨",
    "Uncommon",
  ],
  ["comeback", "Comeback Kid", "Correct 20 previous mistakes.", "↗", "Rare"],
  ["addict", "Revision Addict", "Complete 50 tests.", "▤", "Rare"],
  [
    "speed",
    "Speedrunner",
    "Finish an eligible game in under 60 seconds.",
    "ϟ",
    "Uncommon",
  ],
  ["weapon", "Academic Weapon", "Reach Level 50.", "♛", "Legendary"],
  [
    "topper",
    "Topper",
    "Reach joint or sole #1 by confirmed average in a study group.",
    "♜",
    "Rare",
  ],
].map(([id, title, description, icon, rarity]) => ({
  id,
  title,
  description,
  icon,
  rarity,
}));
function threshold(level) {
  return Math.round((100 * (Math.pow(1.12, level) - 1)) / 0.12);
}
function progress(xp) {
  let level = 0;
  while (level < 50 && xp >= threshold(level + 1)) level++;
  const league =
    level <= 10
      ? "Rookie"
      : level <= 20
        ? "Silver"
        : level <= 30
          ? "Gold"
          : level <= 40
            ? "Diamond"
            : level <= 45
              ? "Obsidian"
              : "Legend";
  return {
    xp,
    level,
    league,
    current: threshold(level),
    next: level === 50 ? threshold(50) : threshold(level + 1),
    percent:
      level === 50
        ? 100
        : Math.min(
            100,
            Math.round(
              ((xp - threshold(level)) /
                (threshold(level + 1) - threshold(level))) *
                100,
            ),
          ),
  };
}
function validSubject(s) {
  if (!SUBJECTS.includes(s)) throw new Error("Choose an official subject.");
  return s;
}
function text(v, max = 2000) {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw new Error(`Text must contain 1–${max} characters.`);
  return v.trim();
}
function integer(v, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`Expected a whole number between ${min} and ${max}.`);
  return n;
}
function validatePaper(p) {
  if (
    !p ||
    !Array.isArray(p.questions) ||
    p.questions.length < 1 ||
    p.questions.length > 40
  )
    throw new Error("Paper must have 1–40 questions.");
  const ids = new Set();
  let total = 0;
  return {
    duration: integer(p.duration || 30, 5, 180),
    language: String(p.language || "English").slice(0, 40),
    grade: String(p.grade || "").slice(0, 60),
    difficulty: ["Foundation", "Standard", "Challenging"].includes(p.difficulty)
      ? p.difficulty
      : "Standard",
    instructions: text(p.instructions || "Answer all questions.", 4000),
    questions: p.questions.map((q, i) => {
      const id = String(q.id || i + 1);
      if (ids.has(id)) throw new Error("Question IDs must be unique.");
      ids.add(id);
      const marks = integer(q.marks, 1, 100);
      total += marks;
      if (total > 300) throw new Error("Maximum paper total is 300 marks.");
      const options = Array.isArray(q.options)
          ? q.options
              .filter((x) => String(x).trim())
              .slice(0, 8)
              .map((x) => text(x, 1000))
          : [],
        type = QUESTION_TYPES.includes(q.type)
          ? q.type
          : options.length
            ? "mc_box"
            : "short_answer",
        items = Array.isArray(q.items)
          ? q.items
              .filter((x) => String(x).trim())
              .slice(0, 12)
              .map((x) => text(x, 1000))
          : [];
      if (["mc_box", "mc_single_box", "mc_circle"].includes(type) && options.length < 2)
        throw new Error("Multiple-choice questions need at least two options.");
      if (type === "ordering" && options.length < 2)
        throw new Error("Ordering questions need at least two items.");
      if (
        type === "matching" &&
        (items.length < 2 || items.length !== options.length)
      )
        throw new Error(
          "Matching questions need equal left and right lists with at least two items.",
        );
      return {
        id,
        type,
        text: text(q.text, 8000),
        passage: q.passage ? text(q.passage, 12000) : "",
        marks,
        topic: String(q.topic || "General").slice(0, 100),
        page: integer(q.page || Math.floor(i / 4) + 1, 1, 30),
        space: integer(q.space || 4, 1, 16),
        options,
        items,
      };
    }),
  };
}
function validateKey(key, questions) {
  if (!Array.isArray(key) || key.length !== questions.length)
    throw new Error("Provide one answer key entry per question.");
  return questions.map((q) => {
    const entries = key.filter((k) => String(k.questionId) === q.id);
    if (entries.length !== 1)
      throw new Error("Provide one answer key entry per question.");
    const k = entries[0];
    if (k.alternatives !== undefined && !Array.isArray(k.alternatives))
      throw new Error("Acceptable alternatives must be a list.");
    return {
      questionId: q.id,
      answer: text(k.answer, 12000),
      rubric: k.rubric ? text(k.rubric, 8000) : "",
      alternatives: (k.alternatives || [])
        .filter((a) => String(a).trim())
        .slice(0, 20)
        .map((a) => text(a, 3000)),
    };
  });
}
function normalize(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!。]+$/, "");
}
function validateMarks(items, questions) {
  if (!Array.isArray(items) || items.length !== questions.length)
    throw new Error("Marking is incomplete.");
  return questions.map((q) => {
    const rows = items.filter((x) => String(x.questionId) === q.id);
    if (rows.length !== 1) throw new Error("Marking question mismatch.");
    const x = rows[0],
      awarded = Number(x.awarded);
    if (!Number.isFinite(awarded) || awarded < 0 || awarded > q.marks)
      throw new Error("Invalid mark returned.");
    return {
      ...x,
      awarded,
      maximum: q.marks,
      explanation: text(x.explanation, 5000),
      confidence: ["High", "Medium", "Low"].includes(x.confidence)
        ? x.confidence
        : "Low",
    };
  });
}
const MATH_GAME_TOPICS = ["Multiplication", "Fractions", "Linear equations"];
module.exports = {
  MATH_GAME_TOPICS,
  SUBJECTS,
  QUESTION_TYPES,
  REWARDS,
  ACHIEVEMENTS,
  threshold,
  progress,
  validSubject,
  text,
  integer,
  validatePaper,
  validateKey,
  normalize,
  validateMarks,
};
