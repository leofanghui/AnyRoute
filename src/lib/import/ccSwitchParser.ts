import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DANGEROUS_PATH_CHARS = ["&", "|", ";", "<", ">", "(", ")", "`", "$", "^", "%", "!"];

const CC_SWITCH_SQL_HEADER = "-- CC Switch SQLite";

export type CcSwitchProvider = {
  id: string;
  appType: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  apiKeyMasked: string;
  protocol: "anthropic" | "openai";
  apiType?: "chat" | "responses";
  category?: string;
  iconColor?: string;
};

export type CcSwitchPreviewProvider = Omit<CcSwitchProvider, "apiKey">;

function maskApiKey(key: string): string {
  if (key.length <= 8) return "***";
  return key.slice(0, 3) + "..." + key.slice(-3);
}

function isPathWithin(childPath: string, parentPath: string): boolean {
  const normalize = (p: string) => path.normalize(p).toLowerCase().replace(/\\/g, "/");
  const normalizedChild = normalize(childPath);
  const normalizedParent = normalize(parentPath);
  if (normalizedChild === normalizedParent) return true;
  const parentWithSep = normalizedParent.endsWith("/") ? normalizedParent : normalizedParent + "/";
  return normalizedChild.startsWith(parentWithSep);
}

export function getCcSwitchDbPath(): string {
  const override = String(process.env.CC_SWITCH_DB_PATH || "").trim();
  if (override) {
    if (!path.isAbsolute(override)) return defaultDbPath();
    if (DANGEROUS_PATH_CHARS.some((c) => override.includes(c))) return defaultDbPath();
    if (path.normalize(override).includes("..")) return defaultDbPath();
    const home = os.homedir();
    if (!isPathWithin(path.normalize(override), home)) return defaultDbPath();
    return path.normalize(override);
  }
  return defaultDbPath();
}

function defaultDbPath(): string {
  return path.join(os.homedir(), ".cc-switch", "cc-switch.db");
}

async function loadSqlJsLib() {
  const initSqlJs = ((await import("sql.js")) as { default: (typeof import("sql.js"))["default"] })
    .default;

  const candidatePaths = [
    path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
    path.join(
      process.cwd(),
      ".next",
      "standalone",
      "node_modules",
      "sql.js",
      "dist",
      "sql-wasm.wasm"
    ),
  ];
  let wasmPath = candidatePaths[0];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      wasmPath = p;
      break;
    }
  }

  return initSqlJs({
    locateFile(fileName) {
      if (fileName === "sql-wasm.wasm") return wasmPath;
      return fileName;
    },
  });
}

function queryProviders(db: any): any[] {
  const results = db.exec(
    "SELECT id, app_type, name, settings_config, category, icon_color, meta FROM providers WHERE app_type IN ('claude', 'codex')"
  );
  if (!results.length || !results[0].values) return [];
  const columns: string[] = results[0].columns;
  return results[0].values.map((row: any[]) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

function safeJsonParse(text: unknown): Record<string, unknown> | null {
  if (typeof text !== "string" || !text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function extractClaudeProvider(row: Record<string, unknown>): CcSwitchProvider | null {
  const settingsConfig = safeJsonParse(row.settings_config as string);
  if (!settingsConfig) return null;

  const env = settingsConfig.env as Record<string, unknown> | undefined;
  if (!env || typeof env !== "object") return null;

  const baseUrl = String(env.ANTHROPIC_BASE_URL || "").trim();
  if (!baseUrl) return null;

  const meta = safeJsonParse(row.meta as string);
  const apiKeyField =
    meta && (meta as Record<string, unknown>).apiKeyField === "ANTHROPIC_API_KEY"
      ? "ANTHROPIC_API_KEY"
      : "ANTHROPIC_AUTH_TOKEN";

  const apiKey = String(env[apiKeyField] || "").trim();
  if (!apiKey) return null;

  return {
    id: String(row.id || ""),
    appType: "claude",
    name: String(row.name || ""),
    baseUrl,
    apiKey,
    apiKeyMasked: maskApiKey(apiKey),
    protocol: "anthropic",
    category: row.category ? String(row.category) : undefined,
    iconColor: row.icon_color ? String(row.icon_color) : undefined,
  };
}

function extractCodexProvider(row: Record<string, unknown>): CcSwitchProvider | null {
  const settingsConfig = safeJsonParse(row.settings_config as string);
  if (!settingsConfig) return null;

  const auth = settingsConfig.auth as Record<string, unknown> | undefined;
  const apiKey = String(auth?.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;

  const configToml = String(settingsConfig.config || "").trim();
  const baseUrlMatch = configToml.match(/base_url\s*=\s*"([^"]+)"/);
  const baseUrl = baseUrlMatch ? baseUrlMatch[1].trim() : "";
  if (!baseUrl) return null;

  const wireApiMatch = configToml.match(/wire_api\s*=\s*"([^"]+)"/);
  const wireApi = wireApiMatch ? wireApiMatch[1].trim() : "responses";
  const apiType: "chat" | "responses" = wireApi === "chat" ? "chat" : "responses";

  return {
    id: String(row.id || ""),
    appType: "codex",
    name: String(row.name || ""),
    baseUrl,
    apiKey,
    apiKeyMasked: maskApiKey(apiKey),
    protocol: "openai",
    apiType,
    category: row.category ? String(row.category) : undefined,
    iconColor: row.icon_color ? String(row.icon_color) : undefined,
  };
}

function extractProvider(row: Record<string, unknown>): CcSwitchProvider | null {
  const appType = String(row.app_type || "");
  if (appType === "claude") return extractClaudeProvider(row);
  if (appType === "codex") return extractCodexProvider(row);
  return null;
}

export async function parseCcSwitchDb(buffer: Buffer): Promise<CcSwitchProvider[]> {
  const SQL = await loadSqlJsLib();
  const db = new SQL.Database(new Uint8Array(buffer));
  try {
    const rows = queryProviders(db);
    return rows.map(extractProvider).filter(Boolean) as CcSwitchProvider[];
  } finally {
    db.close();
  }
}

export async function parseCcSwitchSql(sqlText: string): Promise<CcSwitchProvider[]> {
  if (!sqlText.trimStart().startsWith(CC_SWITCH_SQL_HEADER)) {
    throw new Error("Invalid cc-switch export file: missing header");
  }

  const SQL = await loadSqlJsLib();
  const db = new SQL.Database();
  try {
    db.run(sqlText);
    const rows = queryProviders(db);
    return rows.map(extractProvider).filter(Boolean) as CcSwitchProvider[];
  } finally {
    db.close();
  }
}

export function stripApiKeys(providers: CcSwitchProvider[]): CcSwitchPreviewProvider[] {
  return providers.map(({ apiKey: _apiKey, ...rest }) => rest);
}
