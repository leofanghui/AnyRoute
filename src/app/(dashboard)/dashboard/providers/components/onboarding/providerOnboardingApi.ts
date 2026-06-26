import { z } from "zod";

import {
  createProviderNodeSchema,
  createProviderSchema,
  validateProviderApiKeySchema,
} from "@/shared/validation/schemas/provider";

export type OnboardingConnection = {
  id: string;
  provider: string;
  name?: string;
  testStatus?: string;
  [key: string]: unknown;
};

export type OnboardingTestResult = {
  valid?: boolean;
  error?: string;
  warning?: string;
  latencyMs?: number;
  statusCode?: number;
  diagnosis?: { type?: string; message?: string };
  testedAt?: string;
  [key: string]: unknown;
};

export type OnboardingModelPoolVerificationResult = {
  verified?: number;
  passed?: number;
  partial?: number;
  failed?: number;
  [key: string]: unknown;
};

export type CompatibleNodeMode = "openai" | "anthropic" | "cc";

export type CompatibleProviderNode = {
  id: string;
  name?: string;
  baseUrl?: string;
  detected?: Record<string, unknown>;
  [key: string]: unknown;
};

export type OnboardingProviderNodes = {
  ccCompatibleProviderEnabled: boolean;
};

export type CreateCompatibleProviderNodeInput = {
  mode: CompatibleNodeMode;
  name: string;
  prefix: string;
  baseUrl: string;
  apiType?: string;
  chatPath?: string;
  modelsPath?: string;
};

export type AutoCompatibleProviderInput = {
  baseUrl: string;
  apiKey: string;
  name?: string;
  prefix?: string;
  chatPath?: string;
  modelsPath?: string;
};

export type ValidateOnboardingApiKeyInput = z.input<typeof validateProviderApiKeySchema>;

export type CreateOnboardingConnectionInput = {
  provider: string;
  name: string;
  apiKey?: string;
  providerSpecificData?: Record<string, unknown> | null;
  testStatus?: string;
};

const compatibleProviderNodeInputSchema = z.object({
  mode: z.enum(["openai", "anthropic", "cc"]),
  name: z.string().trim().min(1, "Name is required"),
  prefix: z.string().trim().min(1, "Prefix is required"),
  baseUrl: z.string().trim().min(1, "Base URL is required"),
  apiType: z.enum(["chat", "responses"]).optional(),
  chatPath: z.string().trim().optional(),
  modelsPath: z.string().trim().optional(),
});

const autoCompatibleProviderInputSchema = z.object({
  baseUrl: z.string().trim().min(1, "Base URL is required"),
  apiKey: z.string().trim().min(1, "API key is required"),
  name: z.string().trim().optional(),
  prefix: z.string().trim().optional(),
  chatPath: z.string().trim().optional(),
  modelsPath: z.string().trim().optional(),
});

const providerNodesResponseSchema = z
  .object({
    ccCompatibleProviderEnabled: z.boolean().optional(),
  })
  .catchall(z.unknown());

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function extractError(data: Record<string, unknown>, fallback: string): string {
  const diagnosis = data.diagnosis;
  if (diagnosis && typeof diagnosis === "object" && "message" in diagnosis) {
    const message = (diagnosis as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  const error = data.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  if (typeof data.message === "string") return data.message;
  return fallback;
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}

function slugifyPrefix(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function inferNameFromBaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname.replace(/^api\./, "") || "Custom Gateway";
  } catch {
    return "Custom Gateway";
  }
}

function inferPrefixFromBaseUrl(baseUrl: string) {
  const source = inferNameFromBaseUrl(baseUrl);
  return slugifyPrefix(source) || `gateway-${Math.random().toString(36).slice(2, 8)}`;
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, fallback: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = formatZodError(result.error);
    throw new Error(message ? `${fallback}: ${message}` : fallback);
  }
  return result.data;
}

async function expectOk<T>(response: Response, fallback: string): Promise<T> {
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(extractError(data, fallback));
  }
  return data as T;
}

export async function fetchOnboardingConnections(): Promise<OnboardingConnection[]> {
  const response = await fetch("/api/providers");
  const data = await expectOk<{ connections?: OnboardingConnection[] }>(
    response,
    "Failed to load provider connections"
  );
  return Array.isArray(data.connections) ? data.connections : [];
}

export async function fetchOnboardingProviderNodes(): Promise<OnboardingProviderNodes> {
  const response = await fetch("/api/provider-nodes");
  const data = await expectOk<Record<string, unknown>>(response, "Failed to load provider nodes");
  const parsed = parseOrThrow(providerNodesResponseSchema, data, "Invalid provider node response");
  return { ccCompatibleProviderEnabled: parsed.ccCompatibleProviderEnabled === true };
}

export async function validateOnboardingApiKey(
  input: ValidateOnboardingApiKeyInput
): Promise<Record<string, unknown>> {
  const payload = parseOrThrow(
    validateProviderApiKeySchema,
    input,
    "Provider credentials are not valid"
  );
  const response = await fetch("/api/providers/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await expectOk<Record<string, unknown>>(
    response,
    "Provider credentials are not valid"
  );
  if (data.valid === false) {
    throw new Error(extractError(data, "Provider credentials are not valid"));
  }
  return data;
}

export async function createOnboardingConnection(
  input: CreateOnboardingConnectionInput
): Promise<OnboardingConnection> {
  const payload = parseOrThrow(
    createProviderSchema,
    {
      provider: input.provider,
      name: input.name,
      apiKey: input.apiKey,
      priority: 1,
      testStatus: input.testStatus || "unknown",
      providerSpecificData: input.providerSpecificData || undefined,
    },
    "Provider connection data is invalid"
  );
  const response = await fetch("/api/providers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await expectOk<{ connection?: OnboardingConnection }>(
    response,
    "Failed to create provider connection"
  );
  if (!data.connection?.id) {
    throw new Error("Provider connection was created without an id");
  }
  return data.connection;
}

export async function testOnboardingConnection(
  connectionId: string
): Promise<OnboardingTestResult> {
  const response = await fetch(`/api/providers/${encodeURIComponent(connectionId)}/test`, {
    method: "POST",
  });
  return expectOk<OnboardingTestResult>(response, "Failed to test provider connection");
}

export async function verifyOnboardingModelPoolConnection(
  connectionId: string
): Promise<OnboardingModelPoolVerificationResult> {
  const response = await fetch("/api/model-pool/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId }),
  });
  return expectOk<OnboardingModelPoolVerificationResult>(
    response,
    "Failed to verify model pool models"
  );
}

export function buildCompatibleNodeRequest(input: CreateCompatibleProviderNodeInput) {
  const sanitizedInput = parseOrThrow(
    compatibleProviderNodeInputSchema,
    input,
    "Compatible provider data is invalid"
  );
  const modeDefaults = {
    openai: {
      type: "openai-compatible",
      hasApiType: true,
      hasModelsPath: true,
      chatPath: "",
    },
    anthropic: {
      type: "anthropic-compatible",
      hasApiType: false,
      hasModelsPath: true,
      chatPath: "",
    },
    cc: {
      type: "anthropic-compatible",
      compatMode: "cc",
      hasApiType: false,
      hasModelsPath: false,
      chatPath: "/v1/messages?beta=true",
    },
  } as const;
  const defaults = modeDefaults[sanitizedInput.mode];
  const body: Record<string, unknown> = {
    name: sanitizedInput.name,
    prefix: sanitizedInput.prefix,
    baseUrl: sanitizedInput.baseUrl,
    type: defaults.type,
    chatPath: sanitizedInput.chatPath || defaults.chatPath,
  };
  if (defaults.hasApiType) body.apiType = sanitizedInput.apiType || "chat";
  if (defaults.hasModelsPath) body.modelsPath = sanitizedInput.modelsPath || "";
  if ("compatMode" in defaults) body.compatMode = defaults.compatMode;
  return parseOrThrow(createProviderNodeSchema, body, "Compatible provider data is invalid");
}

export async function createCompatibleProviderNode(
  input: CreateCompatibleProviderNodeInput
): Promise<CompatibleProviderNode> {
  const response = await fetch("/api/provider-nodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildCompatibleNodeRequest(input)),
  });
  const data = await expectOk<{ node?: CompatibleProviderNode }>(
    response,
    "Failed to create compatible provider"
  );
  if (!data.node?.id) {
    throw new Error("Compatible provider was created without an id");
  }
  return data.node;
}

export async function validateCompatibleProviderAuto(input: AutoCompatibleProviderInput) {
  const payload = parseOrThrow(
    autoCompatibleProviderInputSchema,
    input,
    "Compatible provider data is invalid"
  );
  const response = await fetch("/api/provider-nodes/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: payload.baseUrl,
      apiKey: payload.apiKey,
      chatPath: payload.chatPath || undefined,
      modelsPath: payload.modelsPath || undefined,
    }),
  });
  const data = await expectOk<Record<string, unknown>>(
    response,
    "Failed to auto-detect compatible provider"
  );
  if (data.valid === false) {
    throw new Error(extractError(data, "Compatible provider auto-detect failed"));
  }
  return data;
}

export async function createCompatibleProviderNodeAuto(
  input: AutoCompatibleProviderInput
): Promise<CompatibleProviderNode> {
  const payload = parseOrThrow(
    autoCompatibleProviderInputSchema,
    input,
    "Compatible provider data is invalid"
  );
  const detected = await validateCompatibleProviderAuto(payload);
  return createCompatibleProviderNodeFromDetection(payload, detected);
}

export async function createCompatibleProviderNodeFromDetection(
  input: AutoCompatibleProviderInput,
  detected: Record<string, unknown>
): Promise<CompatibleProviderNode> {
  const payload = parseOrThrow(
    autoCompatibleProviderInputSchema,
    input,
    "Compatible provider data is invalid"
  );
  const detectedType =
    typeof detected.detectedType === "string" ? detected.detectedType : "openai-compatible";
  const mode: CompatibleNodeMode =
    detectedType === "claude-code-compatible"
      ? "cc"
      : detectedType === "anthropic-compatible"
        ? "anthropic"
        : "openai";
  const baseUrl =
    typeof detected.baseUrl === "string" && detected.baseUrl ? detected.baseUrl : payload.baseUrl;

  const node = await createCompatibleProviderNode({
    mode,
    name: payload.name || inferNameFromBaseUrl(baseUrl),
    prefix: payload.prefix || inferPrefixFromBaseUrl(baseUrl),
    baseUrl,
    apiType: typeof detected.apiType === "string" ? detected.apiType : "chat",
    chatPath: payload.chatPath || "",
    modelsPath: payload.modelsPath || "",
  });
  return { ...node, detected };
}
