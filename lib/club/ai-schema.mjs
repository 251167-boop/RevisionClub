// Gemini response contracts. Domain validation remains authoritative after decoding.
import visualPolicy from "./visual-policy.cjs";

const { VISUAL_TYPES, STRATEGIES } = visualPolicy;
const string = { type: "STRING" };
const strings = { type: "ARRAY", items: string };
const integer = () => ({ type: "INTEGER" });
const object = (properties, required = Object.keys(properties)) => ({
  type: "OBJECT",
  properties,
  required,
});
export function paperSchema() {
  const visual = object({
    needed: {
      type: "BOOLEAN",
      description: "Whether this question genuinely needs a visual.",
    },
    strategy: {
      type: "STRING",
      enum: ["none", ...STRATEGIES],
      description:
        "Use none when no visual is needed; otherwise follow the supplied subject policy.",
    },
    type: {
      type: "STRING",
      enum: ["none", ...VISUAL_TYPES],
    },
    description: {
      type: "STRING",
      description:
        "Precise content specification with all data, labels, relationships and required academic details.",
    },
    altText: {
      type: "STRING",
      description: "Concise accessible description of the intended visual.",
    },
    caption: {
      type: "STRING",
      description: "Optional student-visible caption; empty when unnecessary.",
    },
    renderData: {
      type: "STRING",
      description:
        "A compact JSON object for deterministic rendering. Use labels and values for charts; points or equation plus axis bounds for graphs; labels for diagrams. Use {} when no visual is needed.",
    },
  });
  const question = object(
    {
      id: string,
      type: {
        type: "STRING",
        enum: [
          "mc_box",
          "mc_circle",
          "answer_space",
          "short_answer",
          "comprehension",
          "fill_blanks",
          "ordering",
          "matching",
        ],
        description: "Visual question and answer format.",
      },
      text: string,
      passage: {
        type: "STRING",
        description: "Passage shown in a bordered box for comprehension only.",
      },
      marks: integer(),
      topic: string,
      page: {
        ...integer(),
        description: "One-based page number, never a label or object.",
      },
      space: {
        ...integer(),
        description: "Answer height or number of writing lines.",
      },
      lineSpacing: {
        ...integer(),
        description: "Writing-line spacing in millimetres from 4 to 14.",
      },
      hideWordBox: {
        type: "BOOLEAN",
        description:
          "For fill_blanks only. Whether students should answer without seeing the word box.",
      },
      options: strings,
      items: {
        ...strings,
        description: "Left-side prompts for matching; empty for other types.",
      },
      visual,
    },
    [
      "id",
      "text",
      "marks",
      "topic",
      "page",
      "space",
      "options",
      "visual",
    ],
  );
  const key = object({
    questionId: string,
    answer: string,
    rubric: string,
    alternatives: strings,
  });
  const paper = object({
    title: string,
    instructions: string,
    duration: integer(),
    language: string,
    questions: {
      type: "ARRAY",
      items: question,
    },
    answerKey: { type: "ARRAY", items: key },
    sourceWarnings: strings,
    error: {
      type: "STRING",
      description:
        "Empty on success. Explain source extraction failure here and return empty questions and answerKey arrays on failure.",
    },
  });
  return paper;
}
export function markingSchema(questions) {
  return object({
    items: {
      type: "ARRAY",
      items: object({
        questionId: { type: "STRING", enum: questions.map((q) => q.id) },
        awarded: {
          type: "NUMBER",
        },
        correct: string,
        explanation: string,
        confidence: { type: "STRING", enum: ["High", "Medium", "Low"] },
      }),
    },
  });
}

export function minigameSchema() {
  return object({
    title: string,
    instructions: string,
    rounds: {
      type: "ARRAY",
      items: object({
        id: string,
        prompt: string,
        answer: string,
        hint: string,
        scrambled: string,
      }),
    },
    sourceWarnings: strings,
    error: {
      type: "STRING",
      description:
        "Empty on success. Explain source extraction failure here and return an empty rounds array on failure.",
    },
  });
}
