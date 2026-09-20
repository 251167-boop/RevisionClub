/** Browser Origin must match the HTTP Host. Do not trust forwarded host headers. */
export function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    if (request.headers.get("sec-fetch-site") === "cross-site")
      throw new Error("Cross-origin request denied.");
    return;
  }
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("Cross-origin request denied.");
  }
  const expected = process.env.APP_ORIGIN
    ? new URL(process.env.APP_ORIGIN)
    : null;
  const matches = expected
    ? parsed.origin === expected.origin
    : parsed.host === request.headers.get("host") &&
      ["http:", "https:"].includes(parsed.protocol);
  if (!matches) throw new Error("Cross-origin request denied.");
}
