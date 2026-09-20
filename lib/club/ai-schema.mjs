// Gemini response contracts. Domain validation remains authoritative after decoding.
const string = { type: "STRING" };
const strings = { type: "ARRAY", items: string };
const integer = () => ({ type: "INTEGER" });
const object = (properties, required = Object.keys(properties)) => ({
  type: "OBJECT",
  properties,
  required,
});
export function paperSchema() {
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
      options: strings,
      items: {
        ...strings,
        description: "Left-side prompts for matching; empty for other types.",
      },
    },
    ["id", "text", "marks", "topic", "page", "space", "options"],
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
