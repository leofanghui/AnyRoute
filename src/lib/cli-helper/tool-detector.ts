import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getCachedLoginShellPath, mergeShellPath } from "@/shared/services/loginShellPath";

const execFileAsync = promisify(execFile);
let execFileImpl = execFileAsync;

function detectorEnv(): NodeJS.ProcessEnv {
  const loginShellPath = getCachedLoginShellPath();
  if (!loginShellPath) return process.env;
  return { ...process.env, PATH: mergeShellPath(process.env.PATH || "", loginShellPath) };
}

export function __setExecFileImpl(fn: typeof execFileAsync): void {
  execFileImpl = fn;
}

export interface DetectedTool {
  id: string;
  name: string;
  installed: boolean;
  version?: string;
  configPath: string;
  configured: boolean;
  configContents?: string;
}

const TOOLS = [
  { id: "codex", name: "Codex CLI", configPath: "~/.codex/config.yaml" },
  { id: "opencode", name: "OpenCode", configPath: "~/.config/opencode/opencode.json" },
] as const;

const BINARY_NAMES: Record<string, string> = {
  codex: "codex",
  opencode: "opencode",
};

function expandHome(p: string): string {
  const home = os.homedir();
  return p.replace(/^~\//, home + "/");
}

function isConfigured(content: string, baseUrl: string): boolean {
  const normalized = baseUrl.replace(/\/+$/, "");
  return (
    content.includes(normalized) ||
    content.includes("localhost:20128") ||
    content.includes("OMNIROUTE_BASE_URL")
  );
}

async function detectBinary(name: string): Promise<{ installed: boolean; version?: string }> {
  const binary = BINARY_NAMES[name] || name;
  const env = detectorEnv();
  try {
    const { stdout } = await execFileImpl(binary, ["--version"], { timeout: 5000, env });
    const version = stdout.trim().replace(/^v/, "");
    return { installed: true, version };
  } catch {
    try {
      const { stdout } = await execFileAsync("which", [binary], { timeout: 5000, env });
      if (stdout.trim()) {
        return { installed: true };
      }
    } catch {}
    return { installed: false };
  }
}

async function readConfigFile(configPath: string): Promise<string | null> {
  try {
    const { readFileSync } = await import("node:fs");
    const expanded = expandHome(configPath);
    if (!expanded) return null;
    return readFileSync(expanded, "utf-8");
  } catch {
    return null;
  }
}

export async function detectTool(id: string): Promise<DetectedTool | null> {
  const tool = TOOLS.find((t) => t.id === id);
  if (!tool) return null;

  const { installed, version } = await detectBinary(tool.id);
  const configPath = expandHome(tool.configPath);
  const configContents = await readConfigFile(tool.configPath);
  const configured = !!configContents && isConfigured(configContents, "http://localhost:20128");

  return {
    id: tool.id,
    name: tool.name,
    installed,
    version,
    configPath,
    configured,
    configContents: configContents ?? undefined,
  };
}

export async function detectAllTools(): Promise<DetectedTool[]> {
  const results = await Promise.allSettled(TOOLS.map((t) => detectTool(t.id)));

  return results
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => (r as PromiseFulfilledResult<DetectedTool>).value);
}
