import fs from "fs/promises";
import os from "os";
import path from "path";

import { getClaudeCodeDefaultModels } from "@omniroute/open-sse/config/providerRegistry";
import { getDbInstance, isBuildPhase, isCloud } from "@/lib/db/core";

const PROFILE_ID = "00000000-0000-4000-8000-000000201280";
const PROFILE_NAME = "AnyRoute";
const CONFIG_FILE = "claude_desktop_config.json";
const CONFIG_LIBRARY_DIR = "configLibrary";
const DB_NAMESPACE = "claudeDesktopGateway";
const DB_MAPPINGS_KEY = "modelMappings";

const claudeDefaults = getClaudeCodeDefaultModels();

export type ClaudeDesktopModelMapping = {
  id: string;
  name: string;
  targetModel: string;
  supports1m: boolean;
};

export const CLAUDE_DESKTOP_DEFAULT_MAPPINGS: ClaudeDesktopModelMapping[] = [
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    targetModel: claudeDefaults.sonnet
      ? `cc/${claudeDefaults.sonnet}`
      : "cc/claude-sonnet-4-5-20250929",
    supports1m: true,
  },
  {
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    targetModel: claudeDefaults.opus ? `cc/${claudeDefaults.opus}` : "cc/claude-opus-4-5-20251101",
    supports1m: true,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    targetModel: claudeDefaults.haiku
      ? `cc/${claudeDefaults.haiku}`
      : "cc/claude-haiku-4-5-20251001",
    supports1m: true,
  },
];

type JsonRecord = Record<string, any>;
type MetaEntry = { id: string; name: string };

interface StatementLike<TRow = unknown> {
  get: (...params: unknown[]) => TRow | undefined;
  run: (...params: unknown[]) => unknown;
}

interface DbLike {
  prepare: <TRow = unknown>(sql: string) => StatementLike<TRow>;
}

export type ClaudeDesktopPaths = {
  supported: boolean;
  reason?: string;
  claudeDir: string | null;
  claude3pDir: string | null;
  normalConfigPath: string | null;
  threePConfigPath: string | null;
  configLibraryPath: string | null;
  profilePath: string | null;
  metaPath: string | null;
};

export type ClaudeDesktopStatus = ClaudeDesktopPaths & {
  configured: boolean;
  deploymentMode: string | null;
  profile: JsonRecord | null;
  gatewayBaseUrl: string | null;
  mappings: ClaudeDesktopModelMapping[];
};

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeMetaEntries(value: unknown): MetaEntry[] {
  const rawEntries = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.values(value as Record<string, unknown>)
      : [];

  const entries: MetaEntry[] = [];
  const seen = new Set<string>();
  for (const entry of rawEntries) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!id || seen.has(id) || id === PROFILE_ID) continue;
    entries.push({ id, name: name || id });
    seen.add(id);
  }
  return entries;
}

function getAppliedProfileId(meta: JsonRecord | null): string | null {
  return typeof meta?.appliedId === "string" && meta.appliedId.trim()
    ? meta.appliedId.trim()
    : null;
}

export function resolveClaudeDesktopPaths(): ClaudeDesktopPaths {
  const home = os.homedir();

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    const claudeDir = path.join(localAppData, "Claude");
    const claude3pDir = path.join(localAppData, "Claude-3p");
    const configLibraryPath = path.join(claude3pDir, CONFIG_LIBRARY_DIR);
    return {
      supported: true,
      claudeDir,
      claude3pDir,
      normalConfigPath: path.join(claudeDir, CONFIG_FILE),
      threePConfigPath: path.join(claude3pDir, CONFIG_FILE),
      configLibraryPath,
      profilePath: path.join(configLibraryPath, `${PROFILE_ID}.json`),
      metaPath: path.join(configLibraryPath, "_meta.json"),
    };
  }

  if (process.platform === "darwin") {
    const appSupport = path.join(home, "Library", "Application Support");
    const claudeDir = path.join(appSupport, "Claude");
    const claude3pDir = path.join(appSupport, "Claude-3p");
    const configLibraryPath = path.join(claude3pDir, CONFIG_LIBRARY_DIR);
    return {
      supported: true,
      claudeDir,
      claude3pDir,
      normalConfigPath: path.join(claudeDir, CONFIG_FILE),
      threePConfigPath: path.join(claude3pDir, CONFIG_FILE),
      configLibraryPath,
      profilePath: path.join(configLibraryPath, `${PROFILE_ID}.json`),
      metaPath: path.join(configLibraryPath, "_meta.json"),
    };
  }

  return {
    supported: false,
    reason: "Claude Desktop 3P profile writing is only supported on Windows and macOS.",
    claudeDir: null,
    claude3pDir: null,
    normalConfigPath: null,
    threePConfigPath: null,
    configLibraryPath: null,
    profilePath: null,
    metaPath: null,
  };
}

async function readJson(filePath: string | null): Promise<JsonRecord | null> {
  if (!filePath) return null;
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return toRecord(JSON.parse(raw));
  } catch (error: any) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJson(filePath: string, value: JsonRecord) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function normalizeMappings(value: unknown): ClaudeDesktopModelMapping[] {
  const byId = new Map(CLAUDE_DESKTOP_DEFAULT_MAPPINGS.map((mapping) => [mapping.id, mapping]));
  const incoming = Array.isArray(value) ? value : [];

  for (const item of incoming) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const targetModel = typeof record.targetModel === "string" ? record.targetModel.trim() : "";
    if (!id || !targetModel || !byId.has(id)) continue;
    const current = byId.get(id) as ClaudeDesktopModelMapping;
    byId.set(id, { ...current, targetModel });
  }

  return CLAUDE_DESKTOP_DEFAULT_MAPPINGS.map((mapping) => byId.get(mapping.id) || mapping);
}

function readStoredMappings(): ClaudeDesktopModelMapping[] | null {
  if (isBuildPhase || isCloud) return null;
  try {
    const db = getDbInstance() as unknown as DbLike;
    const row = db
      .prepare<{ value: string }>("SELECT value FROM key_value WHERE namespace = ? AND key = ?")
      .get(DB_NAMESPACE, DB_MAPPINGS_KEY);
    if (!row?.value) return null;
    return normalizeMappings(JSON.parse(row.value));
  } catch {
    return null;
  }
}

function saveStoredMappings(mappings: ClaudeDesktopModelMapping[]) {
  if (isBuildPhase || isCloud) return;
  try {
    const db = getDbInstance() as unknown as DbLike;
    db.prepare("INSERT OR REPLACE INTO key_value (namespace, key, value) VALUES (?, ?, ?)").run(
      DB_NAMESPACE,
      DB_MAPPINGS_KEY,
      JSON.stringify(mappings)
    );
  } catch {
    /* non-critical: profile still writes successfully */
  }
}

function deleteStoredMappings() {
  if (isBuildPhase || isCloud) return;
  try {
    const db = getDbInstance() as unknown as DbLike;
    db.prepare("DELETE FROM key_value WHERE namespace = ? AND key = ?").run(
      DB_NAMESPACE,
      DB_MAPPINGS_KEY
    );
  } catch {
    /* non-critical */
  }
}

export async function getClaudeDesktopStatus(): Promise<ClaudeDesktopStatus> {
  const paths = resolveClaudeDesktopPaths();
  if (!paths.supported) {
    return {
      ...paths,
      configured: false,
      deploymentMode: null,
      profile: null,
      gatewayBaseUrl: null,
      mappings: CLAUDE_DESKTOP_DEFAULT_MAPPINGS,
    };
  }

  const normalConfig = await readJson(paths.normalConfigPath);
  const profile = await readJson(paths.profilePath);
  const meta = await readJson(paths.metaPath);
  const deploymentMode =
    typeof normalConfig?.deploymentMode === "string" ? normalConfig.deploymentMode : null;
  const appliedId = getAppliedProfileId(meta);
  const gatewayBaseUrl =
    typeof profile?.inferenceGatewayBaseUrl === "string" ? profile.inferenceGatewayBaseUrl : null;
  const mappings = readStoredMappings() || normalizeMappings(profile?.omnirouteModelMappings);

  return {
    ...paths,
    configured: deploymentMode === "3p" && appliedId === PROFILE_ID && !!gatewayBaseUrl,
    deploymentMode,
    profile,
    gatewayBaseUrl,
    mappings,
  };
}

export async function writeClaudeDesktopProfile({
  apiKey,
  gatewayBaseUrl,
  mappings,
}: {
  apiKey: string;
  gatewayBaseUrl: string;
  mappings: ClaudeDesktopModelMapping[];
}) {
  const paths = resolveClaudeDesktopPaths();
  if (
    !paths.supported ||
    !paths.normalConfigPath ||
    !paths.threePConfigPath ||
    !paths.profilePath
  ) {
    throw new Error(paths.reason || "Claude Desktop is not supported on this platform.");
  }

  const normalizedBaseUrl = normalizeBaseUrl(gatewayBaseUrl);
  const nextMappings = normalizeMappings(mappings);

  const normalConfig = (await readJson(paths.normalConfigPath)) || {};
  await writeJson(paths.normalConfigPath, {
    ...normalConfig,
    deploymentMode: "3p",
  });

  const threePConfig = (await readJson(paths.threePConfigPath)) || {};
  await writeJson(paths.threePConfigPath, {
    ...threePConfig,
    deploymentMode: "3p",
  });

  const profile = {
    coworkEgressAllowedHosts: ["*"],
    disableDeploymentModeChooser: true,
    inferenceGatewayApiKey: apiKey,
    inferenceGatewayAuthScheme: "bearer",
    inferenceGatewayBaseUrl: normalizedBaseUrl,
    inferenceProvider: "gateway",
    inferenceModels: nextMappings.map((mapping) => ({
      name: mapping.id,
      labelOverride: mapping.targetModel,
      supports1m: mapping.supports1m,
    })),
  };
  await writeJson(paths.profilePath, profile);
  saveStoredMappings(nextMappings);

  if (paths.metaPath) {
    const meta = (await readJson(paths.metaPath)) || {};
    const entries = normalizeMetaEntries(meta.entries);
    await writeJson(paths.metaPath, {
      ...meta,
      appliedId: PROFILE_ID,
      entries: [
        ...entries,
        {
          id: PROFILE_ID,
          name: PROFILE_NAME,
        },
      ],
    });
  }

  return getClaudeDesktopStatus();
}

export async function resetClaudeDesktopProfile() {
  const paths = resolveClaudeDesktopPaths();
  if (!paths.supported) return getClaudeDesktopStatus();

  if (paths.normalConfigPath) {
    const normalConfig = (await readJson(paths.normalConfigPath)) || {};
    if (normalConfig.deploymentMode === "3p") {
      delete normalConfig.deploymentMode;
      await writeJson(paths.normalConfigPath, normalConfig);
    }
  }

  if (paths.threePConfigPath) {
    const threePConfig = (await readJson(paths.threePConfigPath)) || {};
    if (threePConfig.deploymentMode === "3p") {
      delete threePConfig.deploymentMode;
      await writeJson(paths.threePConfigPath, threePConfig);
    }
  }

  if (paths.profilePath) {
    await fs.rm(paths.profilePath, { force: true });
  }
  deleteStoredMappings();

  if (paths.metaPath) {
    const meta = await readJson(paths.metaPath);
    if (!meta) return getClaudeDesktopStatus();
    const entries = normalizeMetaEntries(meta.entries);
    const nextMeta = { ...meta, entries };
    if (nextMeta.appliedId === PROFILE_ID) {
      const nextAppliedId = entries[0]?.id;
      if (nextAppliedId) {
        nextMeta.appliedId = nextAppliedId;
      } else {
        delete nextMeta.appliedId;
      }
    }
    await writeJson(paths.metaPath, nextMeta);
  }

  return getClaudeDesktopStatus();
}

export async function resolveClaudeDesktopModel(clientModel: string): Promise<string> {
  const status = await getClaudeDesktopStatus();
  const match = status.mappings.find((mapping) => mapping.id === clientModel);
  return match?.targetModel || clientModel;
}
