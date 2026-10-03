export async function readApiResponse(response, fallback) {
  const raw = await response.text();
  let data;
  let parsed = false;
  try {
    data = raw ? JSON.parse(raw) : {};
    parsed = true;
  } catch {}

  if (!response.ok) {
    const platformTooLarge =
      response.status === 413 ||
      /request entity too large|function_payload_too_large|payload too large/i.test(
        raw,
      );
    const error = new Error(
      platformTooLarge
        ? "This upload is too large for a single request. Revision Club will split files over 4 MB automatically; please retry."
        : data?.error || fallback || "Something went wrong. Please retry.",
    );
    error.code = data?.code;
    error.retryable = Boolean(data?.retryable);
    error.reference = data?.reference;
    throw error;
  }

  // Optional resources such as paper and version drafts deliberately return
  // JSON null when nothing has been saved yet. That is a valid API response.
  if (!parsed || (data !== null && typeof data !== "object"))
    throw new Error(fallback || "The server returned an invalid response.");
  return data;
}
