import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";

import { SignJWT } from "jose";

process.env.OMNIROUTE_ALLOW_PRIVATE_PROVIDER_URLS = "1";
process.env.JWT_SECRET = "provider-validate-test-secret";

const routeModule = import("../../src/app/api/provider-nodes/validate/route.ts");

async function buildAuthCookie() {
  const token = await new SignJWT({ sub: "provider-validate-test" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  return `auth_token=${token}`;
}

async function withServer(handler: http.RequestListener, run: (baseUrl: string) => Promise<void>) {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function validateProviderNode(body: Record<string, unknown>) {
  const { POST } = await routeModule;
  const response = await POST(
    new Request("http://localhost/api/provider-nodes/validate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: await buildAuthCookie(),
      },
      body: JSON.stringify(body),
    })
  );
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe("provider node auto-detect", () => {
  it("cleans endpoint base URLs and detects OpenAI-compatible models", async () => {
    await withServer(
      (request, response) => {
        const sendJson = (status: number, body: unknown) => {
          response.writeHead(status, { "content-type": "application/json" });
          response.end(JSON.stringify(body));
        };

        if (request.url === "/v1/models" && request.method === "GET") {
          sendJson(200, { data: [{ id: "gpt-5.1-codex", name: "GPT 5.1 Codex" }] });
          return;
        }

        if (
          (request.url === "/v1/chat/completions" || request.url === "/v1/responses") &&
          request.method === "POST"
        ) {
          request.resume();
          sendJson(
            200,
            request.url.includes("responses")
              ? {
                  output: [{ type: "message", content: [{ type: "output_text", text: "ok" }] }],
                }
              : { choices: [{ message: { content: "ok" } }] }
          );
          return;
        }

        request.resume();
        sendJson(404, { error: { message: "not supported" } });
      },
      async (serverBaseUrl) => {
        const result = await validateProviderNode({
          baseUrl: `${serverBaseUrl}/v1/chat/completions`,
          apiKey: "test-key",
        });

        assert.equal(result.status, 200);
        assert.equal(result.body.valid, true);
        assert.equal(result.body.detectedType, "openai-compatible");
        assert.equal(result.body.baseUrl, `${serverBaseUrl}/v1`);
        assert.equal(result.body.modelCount, 1);
        assert.equal(result.body.capabilities.openaiChat, true);
        assert.equal(result.body.capabilities.openaiResponses, true);
        assert.deepEqual(result.body.discoveredModels[0], {
          id: "gpt-5.1-codex",
          name: "GPT 5.1 Codex",
        });
      }
    );
  });

  it("classifies invalid keys distinctly during auto-detect", async () => {
    await withServer(
      (request, response) => {
        request.resume();
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: "Invalid API key" } }));
      },
      async (serverBaseUrl) => {
        const result = await validateProviderNode({
          baseUrl: `${serverBaseUrl}/v1/models`,
          apiKey: "bad-key",
        });

        assert.equal(result.status, 200);
        assert.equal(result.body.valid, false);
        assert.equal(result.body.detectedType, null);
        assert.equal(result.body.errorType, "invalid_key");
        assert.deepEqual(result.body.diagnosis, {
          type: "invalid_key",
          message: "Invalid API key",
        });
      }
    );
  });

  it("does not report OpenAI chat support for Claude-only endpoints", async () => {
    await withServer(
      (request, response) => {
        const sendJson = (status: number, body: unknown) => {
          response.writeHead(status, { "content-type": "application/json" });
          response.end(JSON.stringify(body));
        };

        if (request.url === "/v1/models" && request.method === "GET") {
          sendJson(200, { data: [{ id: "claude-sonnet-4-20250514" }] });
          return;
        }

        if (request.url === "/v1/messages" && request.method === "POST") {
          request.resume();
          sendJson(200, { content: [{ type: "text", text: "ok" }] });
          return;
        }

        request.resume();
        sendJson(404, { error: { message: "Endpoint not supported" } });
      },
      async (serverBaseUrl) => {
        const result = await validateProviderNode({
          baseUrl: `${serverBaseUrl}/v1/messages`,
          apiKey: "test-key",
        });

        assert.equal(result.status, 200);
        assert.equal(result.body.valid, true);
        assert.equal(result.body.detectedType, "anthropic-compatible");
        assert.deepEqual(result.body.detectedTypes, ["anthropic-compatible"]);
        assert.equal(result.body.capabilities.openaiChat, false);
        assert.equal(result.body.capabilities.openaiResponses, false);
        assert.equal(result.body.capabilities.claudeMessages, true);
      }
    );
  });
});
