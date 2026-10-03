const { test } = require("node:test"),
  assert = require("node:assert/strict");

test("API response reader accepts an empty optional resource", async () => {
  const { readApiResponse } = await import("../lib/club/api-response.mjs");
  assert.equal(
    await readApiResponse(
      new Response("null", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
    null,
  );
});

test("API response reader still rejects malformed successful responses", async () => {
  const { readApiResponse } = await import("../lib/club/api-response.mjs");
  await assert.rejects(
    () =>
      readApiResponse(
        new Response("<html>Platform error</html>", { status: 200 }),
      ),
    /invalid response/,
  );
  await assert.rejects(
    () => readApiResponse(new Response('"not an object"', { status: 200 })),
    /invalid response/,
  );
});

test("API response reader preserves structured API errors", async () => {
  const { readApiResponse } = await import("../lib/club/api-response.mjs");
  await assert.rejects(
    async () => {
      try {
        await readApiResponse(
          new Response(
            JSON.stringify({
              error: "Please retry.",
              code: "TEMPORARY",
              retryable: true,
              reference: "abc123",
            }),
            { status: 503 },
          ),
        );
      } catch (error) {
        assert.equal(error.code, "TEMPORARY");
        assert.equal(error.retryable, true);
        assert.equal(error.reference, "abc123");
        throw error;
      }
    },
    /Please retry/,
  );
});
