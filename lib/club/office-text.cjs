const yauzl = require("yauzl");
const { SaxesParser } = require("saxes");
const path = require("node:path").posix;
const OFFICE_MIMES = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const MAX_XML = 2 * 1024 * 1024;
function parseXML(xml, handlers = {}) {
  const parser = new SaxesParser({ xmlns: true });
  let depth = 0;
  parser.on("doctype", () => {
    throw new Error("Document contains an unsupported XML doctype.");
  });
  parser.on("opentag", (node) => {
    if (++depth > 128) throw new Error("Document XML is too deeply nested.");
    handlers.open?.(node);
  });
  parser.on("closetag", (node) => {
    handlers.close?.(node);
    depth--;
  });
  parser.on("text", (text) => handlers.text?.(text));
  parser.on("cdata", (text) => handlers.text?.(text));
  parser.write(xml).close();
}
function officeText(xml) {
  let reading = false,
    output = "";
  const academic = (node) =>
    /\/(wordprocessingml|drawingml)\/(2006\/main|main)$/.test(node.uri);
  parseXML(xml, {
    open(node) {
      if (academic(node) && node.local === "t") reading = true;
      if (academic(node) && ["tab", "br"].includes(node.local)) output += " ";
    },
    text(text) {
      if (reading) output += text;
    },
    close(node) {
      if (academic(node) && node.local === "t") reading = false;
      if (academic(node) && node.local === "p") output += "\n";
    },
  });
  return output
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
async function readParts(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, zip) => {
        if (error)
          return reject(new Error("This is not a readable DOCX or PPTX file."));
        const parts = new Map(),
          names = new Set();
        let count = 0,
          declared = 0,
          actual = 0,
          stopped = false,
          active;
        const fail = (error) => {
          if (stopped) return;
          stopped = true;
          active?.destroy();
          zip.close();
          reject(error);
        };
        zip.on("error", () =>
          fail(new Error("The document archive is damaged or unsupported.")),
        );
        zip.on("entry", (entry) => {
          if (stopped) return;
          declared += entry.uncompressedSize;
          if (++count > 2000 || declared > 40 * 1024 * 1024)
            return fail(
              new Error(
                "Document is too complex. Export a smaller PDF instead.",
              ),
            );
          if (names.has(entry.fileName))
            return fail(new Error("Document contains duplicate parts."));
          names.add(entry.fileName);
          const selected =
            /^(\[Content_Types\]\.xml|word\/document\.xml|ppt\/presentation\.xml|ppt\/_rels\/presentation\.xml\.rels|ppt\/slides\/slide\d+\.xml)$/.test(
              entry.fileName,
            );
          if (!selected) return zip.readEntry();
          if (
            entry.uncompressedSize > MAX_XML ||
            entry.generalPurposeBitFlag & 1
          )
            return fail(new Error("Document part is too large or encrypted."));
          zip.openReadStream(entry, (error, stream) => {
            if (error)
              return fail(new Error("Unable to read document content."));
            if (stopped) return stream.destroy();
            active = stream;
            const chunks = [];
            let size = 0;
            stream.on("error", () =>
              fail(new Error("Document content is damaged.")),
            );
            stream.on("data", (chunk) => {
              size += chunk.length;
              actual += chunk.length;
              if (size > MAX_XML || actual > 8 * 1024 * 1024)
                return fail(new Error("Expanded document text is too large."));
              chunks.push(chunk);
            });
            stream.on("end", () => {
              if (stopped) return;
              try {
                parts.set(
                  entry.fileName,
                  new TextDecoder("utf-8", { fatal: true }).decode(
                    Buffer.concat(chunks),
                  ),
                );
              } catch {
                return fail(
                  new Error(
                    "Document text is not valid UTF-8. Export it to PDF.",
                  ),
                );
              }
              active = null;
              zip.readEntry();
            });
          });
        });
        zip.on("end", () => {
          if (!stopped) {
            stopped = true;
            resolve(parts);
          }
        });
        zip.readEntry();
      },
    );
  });
}
async function extractOfficeText(buffer, mime) {
  if (!Object.values(OFFICE_MIMES).includes(mime))
    throw new Error("Unsupported Office format.");
  const parts = await readParts(buffer);
  if (!parts.has("[Content_Types].xml"))
    throw new Error("Document package metadata is missing.");
  parseXML(parts.get("[Content_Types].xml"));
  let extracted;
  if (mime === OFFICE_MIMES.docx) {
    if (!parts.has("word/document.xml"))
      throw new Error("Word document body is missing.");
    extracted = officeText(parts.get("word/document.xml"));
  } else {
    if (
      !parts.has("ppt/presentation.xml") ||
      !parts.has("ppt/_rels/presentation.xml.rels")
    )
      throw new Error("PowerPoint slide order is missing.");
    const relationships = new Map(),
      ordered = [];
    parseXML(parts.get("ppt/_rels/presentation.xml.rels"), {
      open(node) {
        if (node.local !== "Relationship") return;
        const values = Object.fromEntries(
          Object.values(node.attributes).map((a) => [a.local, a.value]),
        );
        if (values.TargetMode !== "External")
          relationships.set(values.Id, values.Target);
      },
    });
    parseXML(parts.get("ppt/presentation.xml"), {
      open(node) {
        if (node.local !== "sldId") return;
        const rel = Object.values(node.attributes).find(
          (a) => a.local === "id" && a.uri.endsWith("/relationships"),
        );
        const target = relationships.get(rel?.value);
        const name =
          target &&
          path.normalize(
            target.startsWith("/") ? target.slice(1) : "ppt/" + target,
          );
        if (
          !name ||
          !/^ppt\/slides\/slide\d+\.xml$/.test(name) ||
          !parts.has(name)
        )
          throw new Error("A presentation slide is missing or unsupported.");
        ordered.push(name);
      },
    });
    extracted = ordered
      .map((name, i) => `Slide ${i + 1}\n${officeText(parts.get(name))}`)
      .join("\n\n");
    if (!ordered.some((name) => officeText(parts.get(name)))) extracted = "";
  }
  if (!extracted.trim())
    throw new Error(
      "No readable text found. Export image-only documents to PDF for AI analysis.",
    );
  if (extracted.length > 150000)
    throw new Error(
      "Document text is too long. Split it into smaller materials.",
    );
  return extracted;
}
module.exports = { OFFICE_MIMES, extractOfficeText };
