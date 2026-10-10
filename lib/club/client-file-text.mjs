const MAX_EXTRACTED_TEXT = 150000;

function cleanText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_TEXT);
}

async function pdfDocument(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  return pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    useWorkerFetch: false,
  }).promise;
}

async function selectablePdfText(pdf, progress) {
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    progress?.(`Reading page ${pageNumber} of ${pdf.numPages}…`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => (typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push(`[Page ${pageNumber}]\n${text}`);
    page.cleanup();
  }
  return cleanText(pages.join("\n\n"));
}

async function renderPdfPage(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const original = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, 2600 / Math.max(original.width, original.height));
  const viewport = page.getViewport({ scale: Math.max(1.5, scale) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();
  return canvas;
}

async function ocrSources(sources, progress) {
  const { createWorker } = await import("tesseract.js");
  let lastProgress = -1;
  const worker = await createWorker(["eng", "chi_tra"], 1, {
    langPath: "/tessdata",
    workerPath: "/tessdata/worker.min.js",
    corePath: "/tessdata/tesseract-core-lstm.wasm.js",
    workerBlobURL: false,
    logger(message) {
      if (message.status !== "recognizing text") return;
      const percent = Math.round(Number(message.progress || 0) * 100);
      if (percent !== lastProgress) {
        lastProgress = percent;
        progress?.(`Reading scanned text… ${percent}%`);
      }
    },
  });
  try {
    const pages = [];
    for (let index = 0; index < sources.length; index++) {
      progress?.(`Reading scan ${index + 1} of ${sources.length}…`);
      const result = await worker.recognize(await sources[index]());
      const text = cleanText(result.data?.text);
      if (text) pages.push(`[Page ${index + 1}]\n${text}`);
      if (pages.join("\n\n").length >= MAX_EXTRACTED_TEXT) break;
    }
    return cleanText(pages.join("\n\n"));
  } finally {
    await worker.terminate();
  }
}

/**
 * Extracts document text on the user's device. PDF/image failures are surfaced
 * so binary files cannot silently fall through to a vision provider.
 */
export async function extractClientFileText(file, { progress } = {}) {
  if (!file || typeof window === "undefined") return "";
  const needsText =
    file.type === "application/pdf" || file.type.startsWith("image/");
  if (!needsText) return "";
  try {
    if (file.type === "application/pdf") {
      const pdf = await pdfDocument(file);
      try {
        if (pdf.numPages > 80)
          throw new Error("This PDF has more than 80 pages.");
        const text = await selectablePdfText(pdf, progress);
        const usefulText = text.replace(/\[Page \d+\]/g, "").trim();
        if (usefulText.length >= Math.max(1, pdf.numPages * 4)) return text;
        progress?.("This PDF is scanned. Reading it on your device…");
        const recognized = await ocrSources(
          Array.from({ length: pdf.numPages }, (_, index) => () =>
            renderPdfPage(pdf, index + 1),
          ),
          progress,
        );
        if (recognized) return recognized;
        throw new Error("No readable text was found in this PDF.");
      } finally {
        await pdf.destroy();
      }
    }
    if (file.type.startsWith("image/")) {
      progress?.("Reading text from the image on your device…");
      const recognized = await ocrSources([() => file], progress);
      if (recognized) return recognized;
      throw new Error("No readable text was found in this image.");
    }
  } catch (error) {
    console.error("Local document text extraction failed.", error);
    if (/No readable text/.test(error.message)) throw error;
    throw new Error(
      "Revision Club could not read this file on your device. Check your connection, then retry. If it still fails, upload a clearer scan or copy the material as text.",
    );
  }
  throw new Error("Revision Club could not read this file on your device.");
}
