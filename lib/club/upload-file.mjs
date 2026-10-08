import office from "./office-text.cjs";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
export const UPLOAD_CHUNK_BYTES = 3 * 1024 * 1024;

export const UPLOAD_PURPOSES = [
  "Revision Material",
  "Answer Key / Marking Scheme",
  "Sample Paper",
  "Question Figure",
];

const SUPPORTED_MIMES = [
  ...Object.values(office.OFFICE_MIMES),
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

function validateExtractedText(value) {
  const extracted = String(value || "").trim();
  if (extracted.includes("\u0000"))
    throw new Error("Text extraction failed. Upload UTF-8 text.");
  if (extracted.length > 150000)
    throw new Error("Extracted text is too long. Split it into smaller materials.");
  return extracted;
}

export async function extractPdfText(buffer) {
  try {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(buffer), {
      mergePages: true,
    });
    return validateExtractedText(result.text);
  } catch {
    // Scanned PDFs have no usable text layer. The browser OCR path handles
    // those; keeping upload available also preserves the provider fallback.
    return "";
  }
}

export async function prepareUploadedFile({
  buffer,
  mime,
  name,
  purpose,
  extractedText = "",
}) {
  if (!UPLOAD_PURPOSES.includes(purpose))
    throw new Error("Choose a file purpose.");
  if (
    !Buffer.isBuffer(buffer) ||
    !buffer.length ||
    buffer.length > MAX_UPLOAD_BYTES
  )
    throw new Error("Upload a non-empty file up to 10 MB.");
  if (!SUPPORTED_MIMES.includes(mime))
    throw new Error("Use PDF, DOCX, PPTX, TXT, PNG, JPG or WebP.");
  if (purpose === "Question Figure" && !mime.startsWith("image/"))
    throw new Error("Question figures must be PNG, JPG or WebP images.");
  if (
    mime === "application/pdf" &&
    buffer.subarray(0, 5).toString() !== "%PDF-"
  )
    throw new Error("This is not a valid PDF.");
  if (mime.startsWith("image/")) {
    const sharp = (await import("sharp")).default;
    await sharp(buffer, { limitInputPixels: 40000000 }).metadata();
  }
  const isOffice = Object.values(office.OFFICE_MIMES).includes(mime);
  const extracted = validateExtractedText(
    extractedText ||
      (isOffice
        ? await office.extractOfficeText(buffer, mime)
        : mime === "text/plain"
          ? new TextDecoder("utf-8", { fatal: true }).decode(buffer)
          : mime === "application/pdf"
            ? await extractPdfText(buffer)
            : ""),
  );
  return {
    name: String(name || "Revision material").slice(0, 200),
    purpose,
    mime,
    content: buffer,
    extracted,
    status: isOffice
      ? "Text extracted · use PDF to include diagrams and layout"
      : extracted
        ? mime === "application/pdf" || mime.startsWith("image/")
          ? "Text read locally · ready for AI"
          : "Text extracted"
        : "Ready for AI document analysis",
  };
}
