import test from "node:test";
import assert from "node:assert/strict";

let nextResponse: { status: number; body: string } = { status: 200, body: "{}" };
let fetchCalls = 0;

globalThis.fetch = (async () => {
  fetchCalls++;
  return new Response(nextResponse.body, {
    status: nextResponse.status,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

const { validateWebCookieProvider } = await import("../../src/lib/providers/validation.ts");

function mockFetch(status: number, body: string) {
  nextResponse = { status, body };
  fetchCalls = 0;
}

test("web-cookie validation returns AUTH_007 when probe returns 401", async () => {
  mockFetch(401, JSON.stringify({ error: "unauthorized" }));

  const result = await validateWebCookieProvider({
    provider: "chatgpt-web",
    apiKey: "expired_cookie=session=abc123",
    providerSpecificData: {},
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result.valid, false);
  assert.equal(result.errorCode, "AUTH_007");
  assert.equal(result.error, "SESSION_EXPIRED");
});

test("web-cookie validation returns AUTH_007 when probe returns 403", async () => {
  mockFetch(403, JSON.stringify({ error: "forbidden" }));

  const result = await validateWebCookieProvider({
    provider: "chatgpt-web",
    apiKey: "expired_cookie=session=abc123",
    providerSpecificData: {},
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result.valid, false);
  assert.equal(result.errorCode, "AUTH_007");
  assert.equal(result.error, "SESSION_EXPIRED");
});

test("web-cookie validation accepts non-auth probe responses", async () => {
  mockFetch(200, JSON.stringify({ ok: true, data: [] }));

  const result = await validateWebCookieProvider({
    provider: "chatgpt-web",
    apiKey: "valid_cookie=session=abc123",
    providerSpecificData: {},
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result.valid, true);
});

test("web-cookie validation short-circuits unknown providers", async () => {
  mockFetch(200, "{}");

  const result = await validateWebCookieProvider({
    provider: "nonexistent-provider",
    apiKey: "some_cookie",
    providerSpecificData: {},
  });

  assert.equal(fetchCalls, 0);
  assert.equal(result.valid, false);
  assert.equal(result.unsupported, true);
});

test("web-cookie validation rejects empty cookie before network probe", async () => {
  mockFetch(200, "{}");

  const result = await validateWebCookieProvider({
    provider: "chatgpt-web",
    apiKey: "",
    providerSpecificData: {},
  });

  assert.equal(fetchCalls, 0);
  assert.equal(result.valid, false);
  assert.equal(result.unsupported, false);
  assert.match(result.error, /cookie/i);
});
