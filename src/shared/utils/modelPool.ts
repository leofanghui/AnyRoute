export type ModelPoolClient = "all" | "claude" | "codex";

export type ModelPoolSource = {
  value: string;
  label?: string;
  provider?: string;
  alias?: string;
  connectionId?: string;
  connectionName?: string;
  modelId?: string;
  name?: string;
  source?: string;
  verification?: unknown;
  capabilities?: unknown;
};

export type ModelPoolCapabilities = {
  openaiChat: boolean;
  openaiResponses: boolean;
  claudeMessages: boolean;
  streaming: boolean;
  tools: boolean;
};

export type ModelPoolOption = {
  value: string;
  label: string;
  name: string;
  provider: string;
  alias: string;
  connectionId?: string;
  connectionName: string;
  modelId: string;
  source: "model-pool";
  poolId: string;
  poolFamily: string;
  poolFamilyLabel: string;
  poolDisplayName: string;
  sourceCount: number;
  sources: ModelPoolSource[];
  verificationStatus?: "ok" | "partial" | "error";
  verificationCheckedAt?: string;
  verificationMessage?: string;
  capabilities: ModelPoolCapabilities;
};

export type BuildModelPoolOptionsOptions = {
  requireVerified?: boolean;
};

const FAMILY_LABELS: Record<string, string> = {
  claude: "Claude",
  gpt: "GPT / Codex",
  deepseek: "DeepSeek",
  qwen: "Qwen",
  kimi: "Kimi",
  glm: "GLM",
  other: "其他模型",
};

const ERROR_VERIFICATION_TTL_MS = 30 * 60 * 1000;

function titleCaseWords(value: string) {
  return value
    .split(/[-_\s/]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^v?\d+(?:\.\d+)*$/i.test(part)) return part.toUpperCase();
      if (part.length <= 3) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function getBareModelId(model: ModelPoolSource) {
  const id = model.modelId || model.value || model.label || "";
  const slashIdx = id.indexOf("/");
  return slashIdx >= 0 ? id.slice(slashIdx + 1) : id;
}

function stripDateSuffix(value: string) {
  return value.replace(/[-_.]20\d{6}$/i, "").replace(/[-_.]20\d{2}[-_.]\d{2}[-_.]\d{2}$/i, "");
}

function normalizePoolKey(value: string) {
  return stripDateSuffix(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function versionFromParts(parts: string[]) {
  const nums = parts.filter((part) => /^\d+$/.test(part));
  if (nums.length === 0) return "";
  if (nums.length === 1) return nums[0];
  return `${nums[0]}.${nums[1]}`;
}

function classifyFamily(bareModel: string) {
  const normalized = bareModel.toLowerCase();
  if (normalized.includes("claude")) return "claude";
  if (
    normalized.includes("gpt") ||
    /^o[134](?:[-_.]|$)/.test(normalized) ||
    normalized.includes("codex")
  ) {
    return "gpt";
  }
  if (normalized.includes("deepseek")) return "deepseek";
  if (normalized.includes("qwen")) return "qwen";
  if (normalized.includes("kimi") || normalized.includes("moonshot")) return "kimi";
  if (normalized.includes("glm")) return "glm";
  return "other";
}

function getClaudeDisplayName(bareModel: string) {
  const normalized = stripDateSuffix(bareModel.toLowerCase());
  const family = normalized.includes("opus")
    ? "Opus"
    : normalized.includes("haiku")
      ? "Haiku"
      : normalized.includes("sonnet")
        ? "Sonnet"
        : "";
  const version = versionFromParts(normalized.split(/[^a-z0-9]+/).filter(Boolean));
  return ["Claude", family, version].filter(Boolean).join(" ");
}

function getGptDisplayName(bareModel: string) {
  const normalized = stripDateSuffix(bareModel.toLowerCase());
  const reasoningMatch = normalized.match(/^o([134])(?:[-_.]?([a-z0-9]+))?/i);
  if (reasoningMatch) {
    const suffix = reasoningMatch[2] ? titleCaseWords(reasoningMatch[2]) : "";
    return [`O${reasoningMatch[1]}`, suffix].filter(Boolean).join(" ");
  }
  const match = normalized.match(/gpt[-_]?(\d+(?:[-_.]\d+)?)/i);
  const version = match ? match[1].replace(/[-_]/g, ".") : "";
  const suffix = normalized.includes("codex")
    ? "Codex"
    : normalized.includes("mini")
      ? "Mini"
      : normalized.includes("nano")
        ? "Nano"
        : "";
  return ["GPT", version, suffix].filter(Boolean).join(" ");
}

function getDisplayName(bareModel: string) {
  const family = classifyFamily(bareModel);
  const normalized = stripDateSuffix(bareModel);

  if (family === "claude") return getClaudeDisplayName(normalized);
  if (family === "gpt") return getGptDisplayName(normalized);
  if (family === "deepseek")
    return titleCaseWords(normalized.replace(/^deepseek[-_]?/i, "DeepSeek "));
  if (family === "qwen") return titleCaseWords(normalized.replace(/^qwen[-_]?/i, "Qwen "));
  if (family === "kimi") return titleCaseWords(normalized.replace(/^kimi[-_]?/i, "Kimi "));
  if (family === "glm") return titleCaseWords(normalized.replace(/^glm[-_]?/i, "GLM "));

  return titleCaseWords(normalized);
}

function getSourceVerification(source: ModelPoolSource) {
  const verification = source.verification;
  if (!verification || typeof verification !== "object") return null;
  const record = verification as Record<string, unknown>;
  const status = record.status;
  if (status !== "ok" && status !== "partial" && status !== "error") return null;
  const checkedAt = typeof record.checkedAt === "string" ? record.checkedAt : "";
  if (status === "error" && checkedAt) {
    const checkedAtMs = Date.parse(checkedAt);
    if (Number.isFinite(checkedAtMs) && Date.now() - checkedAtMs > ERROR_VERIFICATION_TTL_MS) {
      return null;
    }
  }
  const diagnosis = record.diagnosis;
  const diagnosisMessage =
    diagnosis && typeof diagnosis === "object"
      ? (diagnosis as Record<string, unknown>).message
      : null;
  return {
    status,
    checkedAt,
    message: typeof diagnosisMessage === "string" ? diagnosisMessage : "",
  };
}

function getBestVerification(sources: ModelPoolSource[]) {
  const verifications = sources
    .map(getSourceVerification)
    .filter((item): item is NonNullable<ReturnType<typeof getSourceVerification>> => Boolean(item))
    .sort((a, b) => {
      const statusRank = { ok: 0, partial: 1, error: 2 };
      const statusDiff = statusRank[a.status] - statusRank[b.status];
      if (statusDiff !== 0) return statusDiff;
      return b.checkedAt.localeCompare(a.checkedAt);
    });

  return verifications[0] || null;
}

function isVerifiedUsableSource(source: ModelPoolSource) {
  return getSourceVerification(source)?.status === "ok";
}

function hasCapability(value: unknown, key: keyof ModelPoolCapabilities) {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record[key] === true;
}

function hasProbeStatus(value: unknown, predicate: (key: string) => boolean) {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const probes = record.probes;
  if (!probes || typeof probes !== "object") return false;
  return Object.entries(probes as Record<string, unknown>).some(([key, probe]) => {
    if (!predicate(key) || !probe || typeof probe !== "object") return false;
    return (probe as Record<string, unknown>).status === "ok";
  });
}

function getSourceProtocolScore(source: ModelPoolSource, client: ModelPoolClient) {
  if (client === "claude") {
    if (hasCapability(source.capabilities, "claudeMessages")) return 0;
    if (hasCapability(source.capabilities, "openaiChat")) return 1;
    if (hasCapability(source.capabilities, "openaiResponses")) return 2;
    return 3;
  }

  if (client === "codex") {
    if (hasCapability(source.capabilities, "openaiResponses")) return 0;
    if (hasCapability(source.capabilities, "openaiChat")) return 1;
    if (hasCapability(source.capabilities, "claudeMessages")) return 2;
    return 3;
  }

  if (
    hasCapability(source.capabilities, "openaiChat") ||
    hasCapability(source.capabilities, "openaiResponses") ||
    hasCapability(source.capabilities, "claudeMessages")
  ) {
    return 0;
  }
  return 1;
}

function getSourceVerificationScore(source: ModelPoolSource) {
  const verification = getSourceVerification(source);
  if (!verification) return 2;
  if (verification.status === "ok") return 0;
  if (verification.status === "partial") return 1;
  return 3;
}

function getSourceTypeScore(source: ModelPoolSource) {
  if (source.source === "detected") return 0;
  if (source.source === "imported") return 1;
  if (source.source === "system") return 2;
  return 3;
}

function pickPrimarySource(sources: ModelPoolSource[], client: ModelPoolClient) {
  return [...sources].sort((a, b) => {
    const verificationDiff = getSourceVerificationScore(a) - getSourceVerificationScore(b);
    if (verificationDiff !== 0) return verificationDiff;

    const protocolDiff = getSourceProtocolScore(a, client) - getSourceProtocolScore(b, client);
    if (protocolDiff !== 0) return protocolDiff;

    const typeDiff = getSourceTypeScore(a) - getSourceTypeScore(b);
    if (typeDiff !== 0) return typeDiff;

    return (a.connectionName || a.value).localeCompare(b.connectionName || b.value);
  })[0];
}

function aggregateCapabilities(sources: ModelPoolSource[]): ModelPoolCapabilities {
  return {
    openaiChat: sources.some((source) => hasCapability(source.capabilities, "openaiChat")),
    openaiResponses: sources.some((source) =>
      hasCapability(source.capabilities, "openaiResponses")
    ),
    claudeMessages: sources.some((source) => hasCapability(source.capabilities, "claudeMessages")),
    streaming: sources.some(
      (source) =>
        hasCapability(source.capabilities, "streaming") ||
        hasProbeStatus(source.verification, (key) => key.includes("stream"))
    ),
    tools: sources.some(
      (source) =>
        hasCapability(source.capabilities, "tools") ||
        hasProbeStatus(source.verification, (key) => key.includes("tools"))
    ),
  };
}

export function buildModelPoolOptions(
  models: ModelPoolSource[],
  client: ModelPoolClient = "all",
  options: BuildModelPoolOptionsOptions = {}
): ModelPoolOption[] {
  const groups = new Map<
    string,
    {
      family: string;
      displayName: string;
      sources: ModelPoolSource[];
    }
  >();

  for (const model of models) {
    if (options.requireVerified && !isVerifiedUsableSource(model)) continue;

    const bareModel = getBareModelId(model);
    if (!bareModel) continue;

    const family = classifyFamily(bareModel);
    const displayName = getDisplayName(bareModel);
    const key = `${family}:${normalizePoolKey(displayName || bareModel)}`;
    const existing = groups.get(key);
    if (existing) {
      existing.sources.push(model);
    } else {
      groups.set(key, {
        family,
        displayName,
        sources: [model],
      });
    }
  }

  return [...groups.entries()]
    .map(([poolId, group]) => {
      const primary = pickPrimarySource(group.sources, client);
      const bareModel = getBareModelId(primary);
      const familyLabel = FAMILY_LABELS[group.family] || FAMILY_LABELS.other;
      const suffix = group.sources.length > 1 ? ` · ${group.sources.length} 个来源` : "";
      const verification = getBestVerification(group.sources);
      const capabilities = aggregateCapabilities(group.sources);
      return {
        value: primary.value,
        label: `${group.displayName}${suffix}`,
        name: group.displayName,
        provider: `model-pool:${group.family}`,
        alias: familyLabel,
        connectionId: primary.connectionId,
        connectionName: primary.connectionName || "",
        modelId: bareModel,
        source: "model-pool" as const,
        poolId,
        poolFamily: group.family,
        poolFamilyLabel: familyLabel,
        poolDisplayName: group.displayName,
        sourceCount: group.sources.length,
        sources: group.sources,
        capabilities,
        ...(verification
          ? {
              verificationStatus: verification.status,
              verificationCheckedAt: verification.checkedAt,
              verificationMessage: verification.message,
            }
          : {}),
      };
    })
    .sort((a, b) => {
      const familyOrder = ["claude", "gpt", "deepseek", "qwen", "kimi", "glm", "other"];
      const familyDiff = familyOrder.indexOf(a.poolFamily) - familyOrder.indexOf(b.poolFamily);
      if (familyDiff !== 0) return familyDiff;
      return a.poolDisplayName.localeCompare(b.poolDisplayName);
    });
}
