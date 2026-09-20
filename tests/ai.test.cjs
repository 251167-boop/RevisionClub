const { test } = require("node:test");
const assert = require("node:assert/strict");
const content = {
  instructions: "Answer.",
  questions: [
    {
      id: "1",
      text: "What powers evaporation?",
      marks: 2,
      page: 1,
      space: 3,
      topic: "Water cycle",
    },
  ],
};
const key = {
  source: "Human-provided marking scheme",
  content: [
    {
      questionId: "1",
      answer: "Solar heating",
      rubric: "",
      alternatives: ["Heat from the sun"],
    },
  ],
};
const response = (value) => ({
  ok: true,
  json: async () => ({
    candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }],
  }),
});
const openRouterResponse = (value) => ({
  ok: true,
  json: async () => ({
    choices: [{ message: { content: JSON.stringify(value) } }],
  }),
});
const providerFailure = (status, providerStatus, message, headers = {}) => ({
  ok: false,
  status,
  headers: {
    get(name) {
      return headers[name.toLowerCase()] || null;
    },
  },
  json: async () => ({ error: { status: providerStatus, message } }),
});
test("keyless marking accepts explicit answers and flags rubric ambiguity", async (t) => {
  const old = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  t.after(() => {
    if (old) process.env.GEMINI_API_KEY = old;
    else delete process.env.GEMINI_API_KEY;
  });
  const { markPaper } = await import("../lib/club/ai.mjs");
  const good = await markPaper({ content, key }, { 1: "Heat from the sun" });
  assert.equal(good.items[0].awarded, 2);
  const ambiguous = await markPaper(
    { content, key },
    { 1: "The sun warms it" },
  );
  assert.equal(ambiguous.items[0].confidence, "Low");
  const rubric = await markPaper(
    {
      content,
      key: {
        ...key,
        content: [
          { ...key.content[0], rubric: "Must include working for full marks" },
        ],
      },
    },
    { 1: "Solar heating" },
  );
  assert.equal(rubric.items[0].awarded, 0);
  assert.equal(rubric.items[0].confidence, "Low");
});
test("AI generation enforces sources and validates structured responses", async (t) => {
  const old = process.env.GEMINI_API_KEY,
    fetch = global.fetch;
  process.env.GEMINI_API_KEY = "local-test-placeholder";
  t.after(() => {
    global.fetch = fetch;
    if (old) process.env.GEMINI_API_KEY = old;
    else delete process.env.GEMINI_API_KEY;
  });
  const { generatePaper, markPaper } = await import("../lib/club/ai.mjs");
  await assert.rejects(
    () => generatePaper({ onlySources: true }, []),
    /Upload revision/,
  );
  global.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    assert.ok(b.systemInstruction.parts[0].text.includes("Source-only"));
    return response({
      ...content,
      title: "Water cycle",
      answerKey: key.content,
    });
  };
  const paper = await generatePaper(
    { onlySources: true, questionCount: 1, totalMarks: 2 },
    [
      {
        name: "notes.txt",
        purpose: "Revision Material",
        extracted: "Solar heating drives evaporation.",
      },
    ],
  );
  assert.equal(paper.questions.length, 1);
  assert.equal(paper.answerKey.length, 1);
  await assert.rejects(
    () => generatePaper({ questionCount: 2 }, []),
    (error) =>
      /question count/.test(error.message) &&
      error.publicCode === "AI_INVALID_RESPONSE" &&
      error.httpStatus === 502,
  );
  global.fetch = async () =>
    response({
      items: [
        {
          questionId: "1",
          awarded: 99,
          correct: "wrong",
          explanation: "Wrong",
          confidence: "High",
        },
      ],
    });
  await assert.rejects(
    () => markPaper({ content, key }, { 1: "hi" }),
    /Invalid mark/,
  );
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: "invalid json" }] } }],
    }),
  });
  await assert.rejects(
    () => generatePaper({}, []),
    (error) =>
      /incomplete response/.test(error.message) &&
      error.publicCode === "AI_INVALID_RESPONSE" &&
      error.httpStatus === 502,
  );
});
test("marking transports the original human scheme and creator instructions", async (t) => {
  const old = process.env.GEMINI_API_KEY,
    fetch = global.fetch;
  process.env.GEMINI_API_KEY = "local-test-placeholder";
  t.after(() => {
    global.fetch = fetch;
    if (old) process.env.GEMINI_API_KEY = old;
    else delete process.env.GEMINI_API_KEY;
  });
  const { markPaper } = await import("../lib/club/ai.mjs");
  global.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body),
      parts = b.contents[0].parts;
    assert.equal(
      JSON.parse(parts[0].text).creatorInstructions,
      "Use the human scheme",
    );
    assert.ok(parts.some((p) => p.text === "Award 1 for naming the sun."));
    return response({
      items: [
        {
          questionId: "1",
          awarded: 1,
          correct: "Human scheme answer",
          explanation: "One of two points",
          confidence: "High",
        },
      ],
    });
  };
  const result = await markPaper(
    {
      content,
      key,
      creatorInstructions: "Use the human scheme",
      schemeFiles: [
        { name: "scheme.txt", extracted: "Award 1 for naming the sun." },
      ],
    },
    { 1: "sun" },
  );
  assert.equal(result.items[0].correct, "Human scheme answer");
  assert.equal(result.items[0].awarded, 1);
});
test("targeted regeneration preserves other questions and remaps private keys", async (t) => {
  const old = process.env.GEMINI_API_KEY,
    fetch = global.fetch;
  process.env.GEMINI_API_KEY = "local-test-placeholder";
  t.after(() => {
    global.fetch = fetch;
    if (old) process.env.GEMINI_API_KEY = old;
    else delete process.env.GEMINI_API_KEY;
  });
  const { regenerateQuestions } = await import("../lib/club/ai.mjs");
  const paper = {
    ...content,
    questions: [
      { ...content.questions[0], id: "A", page: 2 },
      { ...content.questions[0], id: "B", text: "Untouched", page: 3 },
    ],
  };
  global.fetch = async () =>
    response({
      ...content,
      questions: [
        { ...content.questions[0], id: "generated", text: "Replacement" },
      ],
      answerKey: [{ questionId: "generated", answer: "Replacement answer" }],
    });
  const result = await regenerateQuestions(
    { title: "Keep title" },
    [],
    {
      content: paper,
      answerKey: [
        { questionId: "A", answer: "Old" },
        { questionId: "B", answer: "Unchanged key" },
      ],
    },
    ["A"],
  );
  assert.equal(result.questions[0].text, "Replacement");
  assert.equal(result.questions[0].id, "A");
  assert.equal(result.questions[0].page, 2);
  assert.deepEqual(result.questions[1], {
    ...paper.questions[1],
    type: "short_answer",
    passage: "",
    options: [],
    items: [],
  });
  assert.equal(
    result.answerKey.find((k) => k.questionId === "A").answer,
    "Replacement answer",
  );
  assert.equal(
    result.answerKey.find((k) => k.questionId === "B").answer,
    "Unchanged key",
  );
  await assert.rejects(
    () => regenerateQuestions({}, [], { content: paper }, ["missing"]),
    /Select existing/,
  );
});

test("generation sends typed schemas and preserves the requested duration", async (t) => {
  const old = process.env.GEMINI_API_KEY,
    original = global.fetch;
  process.env.GEMINI_API_KEY = "local-test-placeholder";
  t.after(() => {
    global.fetch = original;
    if (old) process.env.GEMINI_API_KEY = old;
    else delete process.env.GEMINI_API_KEY;
  });
  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    const schema = body.generationConfig.responseSchema;
    assert.ok(schema);
    assert.ok(JSON.stringify(schema).includes('"INTEGER"'));
    return response({
      ...content,
      duration: "AI changed the duration",
      title: "Paper",
      answerKey: key.content,
    });
  };
  const { generatePaper } = await import("../lib/club/ai.mjs");
  const paper = await generatePaper(
    { duration: 15, questionCount: 1, totalMarks: 2 },
    [],
  );
  assert.equal(paper.duration, 15);
  global.fetch = async () =>
    response({
      ...content,
      questions: [{ ...content.questions[0], page: "Page one" }],
      answerKey: key.content,
    });
  await assert.rejects(
    () => generatePaper({ duration: 15 }, []),
    /whole number/,
  );
});

test("AI timeout and connectivity failures have actionable messages", async (t) => {
  const oldKey = process.env.GEMINI_API_KEY,
    oldFetch = global.fetch,
    oldDelay = process.env.AI_RETRY_BASE_MS;
  process.env.GEMINI_API_KEY = "synthetic-test-key";
  process.env.AI_RETRY_BASE_MS = "0";
  t.after(() => {
    global.fetch = oldFetch;
    if (oldKey) process.env.GEMINI_API_KEY = oldKey;
    else delete process.env.GEMINI_API_KEY;
    if (oldDelay === undefined) delete process.env.AI_RETRY_BASE_MS;
    else process.env.AI_RETRY_BASE_MS = oldDelay;
  });
  const { generatePaper } = await import("../lib/club/ai.mjs");
  let calls = 0;
  global.fetch = async () => {
    calls++;
    const error = new Error("timeout");
    error.name = "TimeoutError";
    throw error;
  };
  await assert.rejects(
    generatePaper({}, []),
    (error) =>
      error.publicCode === "AI_TIMEOUT" &&
      error.httpStatus === 504 &&
      error.attempts === 3,
  );
  assert.equal(calls, 3);
  calls = 0;
  global.fetch = async () => {
    calls++;
    const error = new TypeError("fetch failed");
    error.cause = { code: "UND_ERR_CONNECT_TIMEOUT" };
    throw error;
  };
  await assert.rejects(
    generatePaper({}, []),
    (error) =>
      error.publicCode === "AI_NETWORK_ERROR" &&
      error.httpStatus === 503 &&
      error.retryable &&
      error.networkCodes.includes("UND_ERR_CONNECT_TIMEOUT"),
  );
  assert.equal(calls, 3);
});

test("AI retries transient provider failures and succeeds without losing the request", async (t) => {
  const oldKey = process.env.GEMINI_API_KEY,
    oldFetch = global.fetch,
    oldDelay = process.env.AI_RETRY_BASE_MS;
  process.env.GEMINI_API_KEY = "synthetic-test-key";
  process.env.AI_RETRY_BASE_MS = "0";
  t.after(() => {
    global.fetch = oldFetch;
    if (oldKey) process.env.GEMINI_API_KEY = oldKey;
    else delete process.env.GEMINI_API_KEY;
    if (oldDelay === undefined) delete process.env.AI_RETRY_BASE_MS;
    else process.env.AI_RETRY_BASE_MS = oldDelay;
  });
  const bodies = [];
  global.fetch = async (_url, options) => {
    bodies.push(options.body);
    if (bodies.length < 3)
      return providerFailure(503, "UNAVAILABLE", "Temporarily overloaded");
    return response({
      ...content,
      title: "Recovered paper",
      answerKey: key.content,
    });
  };
  const { generatePaper } = await import("../lib/club/ai.mjs");
  const paper = await generatePaper({ questionCount: 1, totalMarks: 2 }, []);
  assert.equal(paper.title, "Recovered paper");
  assert.equal(bodies.length, 3);
  assert.equal(new Set(bodies).size, 1);
});

test("AI distinguishes unsupported network regions from malformed requests", async (t) => {
  const oldKey = process.env.GEMINI_API_KEY,
    oldFetch = global.fetch,
    oldDelay = process.env.AI_RETRY_BASE_MS;
  process.env.GEMINI_API_KEY = "synthetic-test-key";
  process.env.AI_RETRY_BASE_MS = "0";
  t.after(() => {
    global.fetch = oldFetch;
    if (oldKey) process.env.GEMINI_API_KEY = oldKey;
    else delete process.env.GEMINI_API_KEY;
    if (oldDelay === undefined) delete process.env.AI_RETRY_BASE_MS;
    else process.env.AI_RETRY_BASE_MS = oldDelay;
  });
  const { generatePaper } = await import("../lib/club/ai.mjs");
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return providerFailure(
      400,
      "FAILED_PRECONDITION",
      "User location is not supported for the API use.",
      { "x-request-id": "provider-reference" },
    );
  };
  await assert.rejects(
    generatePaper({}, []),
    (error) =>
      error.publicCode === "AI_REGION_UNAVAILABLE" &&
      error.httpStatus === 503 &&
      error.upstreamStatus === 400 &&
      error.providerStatus === "FAILED_PRECONDITION" &&
      error.requestId === "provider-reference" &&
      !error.retryable,
  );
  assert.equal(calls, 1);
  global.fetch = async () =>
    providerFailure(400, "INVALID_ARGUMENT", "Invalid response schema");
  await assert.rejects(
    generatePaper({}, []),
    (error) =>
      error.publicCode === "AI_REQUEST_REJECTED" &&
      error.httpStatus === 502 &&
      error.providerStatus === "INVALID_ARGUMENT",
  );
});

test("OpenRouter automatically backs up Gemini with strict structured output", async (t) => {
  const oldGemini = process.env.GEMINI_API_KEY,
    oldOpenRouter = process.env.OPENROUTER_API_KEY,
    oldOpenRouterModel = process.env.OPENROUTER_MODEL,
    oldFetch = global.fetch,
    oldDelay = process.env.AI_RETRY_BASE_MS;
  process.env.GEMINI_API_KEY = "synthetic-gemini-key";
  process.env.OPENROUTER_API_KEY = "synthetic-openrouter-key";
  process.env.OPENROUTER_MODEL = "openrouter/free";
  process.env.AI_RETRY_BASE_MS = "0";
  t.after(() => {
    global.fetch = oldFetch;
    for (const [name, value] of [
      ["GEMINI_API_KEY", oldGemini],
      ["OPENROUTER_API_KEY", oldOpenRouter],
      ["OPENROUTER_MODEL", oldOpenRouterModel],
      ["AI_RETRY_BASE_MS", oldDelay],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.includes("generativelanguage.googleapis.com"))
      return providerFailure(503, "UNAVAILABLE", "Temporary outage");
    const body = JSON.parse(options.body),
      schema = body.response_format.json_schema;
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(body.model, "openrouter/free");
    assert.equal(body.provider.require_parameters, true);
    assert.equal(schema.strict, true);
    assert.equal(schema.schema.type, "object");
    assert.equal(schema.schema.additionalProperties, false);
    assert.equal(
      schema.schema.properties.questions.items.additionalProperties,
      false,
    );
    assert.ok(
      body.messages[1].content.some(
        (part) => part.type === "text" && part.text.includes("questionCount"),
      ),
    );
    return openRouterResponse({
      ...content,
      title: "OpenRouter fallback paper",
      answerKey: key.content,
      sourceWarnings: [],
      error: "",
    });
  };
  const { generatePaper, markPaper } = await import("../lib/club/ai.mjs");
  const paper = await generatePaper({ questionCount: 1, totalMarks: 2 }, []);
  assert.equal(paper.title, "OpenRouter fallback paper");
  assert.equal(requests.length, 3);
  assert.equal(
    requests.filter((request) =>
      request.url.includes("generativelanguage.googleapis.com"),
    ).length,
    2,
  );

  delete process.env.GEMINI_API_KEY;
  global.fetch = async (url) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    return openRouterResponse({
      items: [
        {
          questionId: "1",
          awarded: 2,
          correct: "Solar heating",
          explanation: "The accepted answer matches.",
          confidence: "High",
        },
      ],
    });
  };
  const marked = await markPaper({ content, key }, { 1: "Solar heating" });
  assert.equal(marked.items[0].awarded, 2);
  assert.equal(marked.source, "OpenRouter AI · Human-provided marking scheme");

  global.fetch = async (url, options) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(options.body),
      messageParts = body.messages[1].content;
    assert.deepEqual(body.plugins, [
      { id: "file-parser", pdf: { engine: "cloudflare-ai" } },
    ]);
    assert.ok(
      messageParts.some(
        (part) =>
          part.type === "file" &&
          part.file.filename.endsWith(".pdf") &&
          part.file.file_data === "data:application/pdf;base64,JVBERi0xLjQ=",
      ),
    );
    assert.ok(
      messageParts.some(
        (part) =>
          part.type === "image_url" &&
          part.image_url.url === "data:image/png;base64,iVBORw0KGgo=",
      ),
    );
    return openRouterResponse({
      ...content,
      title: "Multimodal fallback paper",
      answerKey: key.content,
      sourceWarnings: [],
      error: "",
    });
  };
  const multimodalPaper = await generatePaper(
    { questionCount: 1, totalMarks: 2 },
    [
      {
        name: "notes.pdf",
        purpose: "Revision Material",
        mime: "application/pdf",
        content: Buffer.from("%PDF-1.4"),
      },
      {
        name: "diagram.png",
        purpose: "Revision Material",
        mime: "image/png",
        content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      },
    ],
  );
  assert.equal(multimodalPaper.title, "Multimodal fallback paper");

  requests.length = 0;
  process.env.GEMINI_API_KEY = "synthetic-gemini-key";
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return url.includes("generativelanguage.googleapis.com")
      ? providerFailure(
          400,
          "FAILED_PRECONDITION",
          "User location is not supported for the API use.",
        )
      : providerFailure(503, "UNAVAILABLE", "Temporary outage");
  };
  await assert.rejects(
    generatePaper({}, []),
    (error) =>
      error.publicCode === "AI_ALL_PROVIDERS_UNAVAILABLE" &&
      error.provider === "OpenRouter" &&
      error.providerFailures.length === 2 &&
      error.providerFailures[0].provider === "Gemini" &&
      error.providerFailures[1].provider === "OpenRouter",
  );
  assert.equal(requests.length, 4);
});

test("OpenRouter retries a structurally valid but unusable paper once", async (t) => {
  const oldGemini = process.env.GEMINI_API_KEY,
    oldOpenRouter = process.env.OPENROUTER_API_KEY,
    oldDelay = process.env.AI_RETRY_BASE_MS,
    oldFetch = global.fetch;
  delete process.env.GEMINI_API_KEY;
  process.env.OPENROUTER_API_KEY = "synthetic-openrouter-key";
  process.env.AI_RETRY_BASE_MS = "0";
  t.after(() => {
    global.fetch = oldFetch;
    for (const [name, value] of [
      ["GEMINI_API_KEY", oldGemini],
      ["OPENROUTER_API_KEY", oldOpenRouter],
      ["AI_RETRY_BASE_MS", oldDelay],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return openRouterResponse({
      ...content,
      title: calls === 1 ? "Incomplete key" : "Recovered paper",
      answerKey: calls === 1 ? [] : key.content,
      sourceWarnings: [],
      error: "",
    });
  };
  const { generatePaper } = await import("../lib/club/ai.mjs");
  const paper = await generatePaper(
    { questionCount: 1, totalMarks: 2, duration: 30 },
    [],
  );
  assert.equal(paper.title, "Recovered paper");
  assert.equal(calls, 2);
});

test("OpenRouter retries an empty successful response", async (t) => {
  const oldGemini = process.env.GEMINI_API_KEY,
    oldOpenRouter = process.env.OPENROUTER_API_KEY,
    oldDelay = process.env.AI_RETRY_BASE_MS,
    oldFetch = global.fetch;
  delete process.env.GEMINI_API_KEY;
  process.env.OPENROUTER_API_KEY = "synthetic-openrouter-key";
  process.env.AI_RETRY_BASE_MS = "0";
  t.after(() => {
    global.fetch = oldFetch;
    for (const [name, value] of [
      ["GEMINI_API_KEY", oldGemini],
      ["OPENROUTER_API_KEY", oldOpenRouter],
      ["AI_RETRY_BASE_MS", oldDelay],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls === 1)
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "" } }] }),
      };
    return openRouterResponse({
      ...content,
      title: "Recovered from empty response",
      answerKey: key.content,
      sourceWarnings: [],
      error: "",
    });
  };
  const { generatePaper } = await import("../lib/club/ai.mjs");
  const paper = await generatePaper(
    { questionCount: 1, totalMarks: 2, duration: 30 },
    [],
  );
  assert.equal(paper.title, "Recovered from empty response");
  assert.equal(calls, 2);
});

test("OpenRouter retries a response-body timeout", async (t) => {
  const oldGemini = process.env.GEMINI_API_KEY,
    oldOpenRouter = process.env.OPENROUTER_API_KEY,
    oldDelay = process.env.AI_RETRY_BASE_MS,
    oldFetch = global.fetch;
  delete process.env.GEMINI_API_KEY;
  process.env.OPENROUTER_API_KEY = "synthetic-openrouter-key";
  process.env.AI_RETRY_BASE_MS = "0";
  t.after(() => {
    global.fetch = oldFetch;
    for (const [name, value] of [
      ["GEMINI_API_KEY", oldGemini],
      ["OPENROUTER_API_KEY", oldOpenRouter],
      ["AI_RETRY_BASE_MS", oldDelay],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls === 1)
      return {
        ok: true,
        json: async () => {
          const error = new Error("response body timed out");
          error.name = "TimeoutError";
          throw error;
        },
      };
    return openRouterResponse({
      ...content,
      title: "Recovered from body timeout",
      answerKey: key.content,
      sourceWarnings: [],
      error: "",
    });
  };
  const { generatePaper } = await import("../lib/club/ai.mjs");
  const paper = await generatePaper(
    { questionCount: 1, totalMarks: 2, duration: 30 },
    [],
  );
  assert.equal(paper.title, "Recovered from body timeout");
  assert.equal(calls, 2);
});
