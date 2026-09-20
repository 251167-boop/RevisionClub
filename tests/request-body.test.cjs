const { test } = require("node:test"),
  assert = require("node:assert/strict");
test("request limits count real streamed bytes without trusting headers", async () => {
  const { readJSON } = await import("../lib/club/request-body.mjs");
  const request = (body) =>
    new Request("http://localhost/api", { method: "POST", body });
  assert.deepEqual(await readJSON(request('{"text":"é"}'), 13), { text: "é" });
  await assert.rejects(
    () => readJSON(request('{"text":"é"}'), 12),
    /too large/,
  );
  let cancelled = false;
  const stream = new ReadableStream({
    pull(c) {
      c.enqueue(new Uint8Array(100));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () =>
      readJSON(
        new Request("http://localhost/api", {
          method: "POST",
          body: stream,
          duplex: "half",
        }),
        50,
      ),
    /too large/,
  );
  assert.equal(cancelled, true);
  for (const bad of ["null", "[]", "oops"])
    await assert.rejects(() => readJSON(request(bad)), /valid JSON object/);
});
