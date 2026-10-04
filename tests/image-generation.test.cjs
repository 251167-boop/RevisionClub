const { test } = require("node:test");
const assert = require("node:assert/strict");

const visual = {
  strategy: "generated_image",
  type: "picture_writing_prompt",
  description: "A clear scene of a student returning a lost library book.",
};

test("Gemini image generation requests an image and decodes inline data", async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_IMAGE_MODEL;
  const previousFetch = global.fetch;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_IMAGE_MODEL = "test-image-model";
  t.after(() => {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_IMAGE_MODEL;
    else process.env.GEMINI_IMAGE_MODEL = previousModel;
  });
  global.fetch = async (url, options) => {
    assert.match(String(url), /models\/test-image-model:generateContent$/);
    assert.equal(options.headers["x-goog-api-key"], "test-key");
    const body = JSON.parse(options.body);
    assert.deepEqual(body.generationConfig.responseModalities, ["IMAGE"]);
    assert.equal(body.generationConfig.imageConfig.aspectRatio, "4:3");
    assert.match(body.contents[0].parts[0].text, /Do not show the answer/);
    return {
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: Buffer.from("fake-png").toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      }),
    };
  };
  const { generateQuestionImage } = await import(
    "../lib/club/image-generation.mjs"
  );
  const result = await generateQuestionImage({
    subject: "English",
    questionText: "Write a story about the picture.",
    visual,
  });
  assert.equal(result.mime, "image/png");
  assert.equal(result.buffer.toString(), "fake-png");
  assert.equal(result.model, "test-image-model");
});

test("image generation fails clearly when Gemini is not configured", async (t) => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });
  const { generateQuestionImage } = await import(
    "../lib/club/image-generation.mjs"
  );
  await assert.rejects(
    () =>
      generateQuestionImage({
        subject: "English",
        questionText: "Write a story.",
        visual,
      }),
    (error) =>
      error.publicCode === "IMAGE_NOT_CONFIGURED" && error.httpStatus === 503,
  );
});
