import { AIServiceError } from "./ai.mjs";

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function imageGenerationAvailable() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function publicError(message, options = {}) {
  return new AIServiceError(message, {
    provider: "Gemini",
    ...options,
  });
}

async function providerError(response, attempts) {
  let body = {};
  try {
    body = await response.json();
  } catch {}
  const providerMessage = String(body.error?.message || "");
  if (/location is not supported|region.+not supported/i.test(providerMessage))
    return publicError(
      "Gemini image generation is unavailable from this network location. You can upload a question image instead.",
      {
        publicCode: "IMAGE_REGION_UNAVAILABLE",
        httpStatus: 503,
        upstreamStatus: response.status,
        retryable: false,
        attempts,
      },
    );
  if (response.status === 429)
    return publicError(
      "Gemini image generation is temporarily rate-limited. Try again shortly or upload an image instead.",
      {
        publicCode: "IMAGE_RATE_LIMITED",
        httpStatus: 429,
        upstreamStatus: response.status,
        retryable: true,
        attempts,
      },
    );
  return publicError(
    RETRYABLE.has(response.status)
      ? "Gemini image generation is temporarily unavailable. Try again shortly or upload an image instead."
      : "Gemini could not generate this image. Adjust the figure instructions or upload an image instead.",
    {
      publicCode: RETRYABLE.has(response.status)
        ? "IMAGE_TEMPORARILY_UNAVAILABLE"
        : "IMAGE_GENERATION_FAILED",
      httpStatus: RETRYABLE.has(response.status) ? 503 : 422,
      upstreamStatus: response.status,
      retryable: RETRYABLE.has(response.status),
      attempts,
    },
  );
}

function imagePrompt({ subject, questionText, visual }) {
  const authenticity = ["History", "Chinese History"].includes(subject)
    ? "This is an educational illustration, not documentary evidence. Do not imitate a historical photograph or add fake source markings."
    : "";
  const religious =
    subject === "Religious Studies"
      ? "Keep all religious symbols and contexts neutral, respectful and educational."
      : "";
  return [
    `Create one clear 4:3 educational illustration for a ${subject} school test paper.`,
    `Question context: ${String(questionText || "").slice(0, 1600)}`,
    `Figure instructions: ${String(visual.description || "").slice(0, 1800)}`,
    `Figure type: ${visual.type}.`,
    authenticity,
    religious,
    "Use a clean white or very light background, strong readable shapes, restrained colour and generous margins.",
    "Do not show the answer, solution, marks, question number, watermark, logo or decorative border.",
    "Avoid small text. Include labels only when explicitly requested in the figure instructions.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateQuestionImage(input) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw publicError(
      "Image generation is not configured. Add GEMINI_API_KEY or upload a question image instead.",
      {
        publicCode: "IMAGE_NOT_CONFIGURED",
        httpStatus: 503,
        retryable: false,
      },
    );
  if (input.visual?.strategy !== "generated_image")
    throw publicError(
      "This figure is not configured for AI image generation.",
      {
        publicCode: "IMAGE_STRATEGY_INVALID",
        httpStatus: 400,
      },
    );

  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: imagePrompt(input) }],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "4:3", imageSize: "1K" },
    },
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(115000),
      });
      if (!response.ok) {
        if (RETRYABLE.has(response.status) && attempt < 2) {
          await wait(450 * attempt);
          continue;
        }
        throw await providerError(response, attempt);
      }
      const body = await response.json();
      const parts = body.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(
        (part) => part.inlineData || part.inline_data,
      );
      const inline = imagePart?.inlineData || imagePart?.inline_data;
      if (!inline?.data) {
        const blocked = body.promptFeedback?.blockReason;
        throw publicError(
          blocked
            ? "Gemini blocked this image request. Adjust the figure instructions or upload an image instead."
            : "Gemini returned no usable image. Adjust the figure instructions and try again.",
          {
            publicCode: blocked
              ? "IMAGE_GENERATION_BLOCKED"
              : "IMAGE_INVALID_RESPONSE",
            httpStatus: 422,
            retryable: !blocked,
            attempts: attempt,
          },
        );
      }
      const mime = String(inline.mimeType || inline.mime_type || "image/png");
      if (!IMAGE_MIMES.has(mime))
        throw publicError("Gemini returned an unsupported image format.", {
          publicCode: "IMAGE_INVALID_RESPONSE",
          httpStatus: 502,
          retryable: true,
          attempts: attempt,
        });
      const buffer = Buffer.from(inline.data, "base64");
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES)
        throw publicError("Gemini returned an invalid image size.", {
          publicCode: "IMAGE_INVALID_RESPONSE",
          httpStatus: 502,
          retryable: true,
          attempts: attempt,
        });
      return { buffer, mime, model };
    } catch (error) {
      if (error instanceof AIServiceError) throw error;
      if (attempt < 2) {
        await wait(450 * attempt);
        continue;
      }
      throw publicError(
        "Could not connect to Gemini image generation after automatic retries. Try again shortly or upload an image instead.",
        {
          publicCode: "IMAGE_CONNECTION_FAILED",
          httpStatus: 503,
          retryable: true,
          attempts: attempt,
        },
      );
    }
  }
}
