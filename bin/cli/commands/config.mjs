import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { resolveDataDir } from "../data-dir.mjs";
import { t } from "../i18n.mjs";
import { registerContexts } from "./contexts.mjs";

function loadI18nLocales() {
  const cfgPath = path.join(
    path.dirname(path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))))),
    "config",
    "i18n.json"
  );
  try {
    return JSON.parse(fs.readFileSync(cfgPath, "utf8")).locales || [];
  } catch {
    return [];
  }
}

function getCliEnvPath() {
  return path.join(resolveDataDir(), ".env");
}

function upsertEnvLine(envPath, key, value) {
  let content = "";
  if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, "utf8");
  const lines = content.split("\n");
  const idx = lines.findIndex((line) => line.trimStart().startsWith(`${key}=`));
  const newLine = `${key}=${value}`;
  if (idx >= 0) {
    lines[idx] = newLine;
  } else {
    if (content && !content.endsWith("\n")) lines.push("");
    lines.push(newLine);
  }
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${envPath}.tmp`;
  fs.writeFileSync(tmp, lines.join("\n"), "utf8");
  fs.renameSync(tmp, envPath);
}

export async function runConfigLangGetCommand(opts = {}) {
  const { getLocale } = await import("../i18n.mjs");
  const code = getLocale();
  const locales = loadI18nLocales();
  const entry = locales.find((locale) => locale.code === code);
  const name = entry ? entry.english : code;
  if (opts.output === "json" || opts.json) {
    console.log(JSON.stringify({ code, name }, null, 2));
  } else {
    console.log(t("config.lang.current", { code, name }));
  }
  return 0;
}

export async function runConfigLangSetCommand(code, opts = {}) {
  if (!code) {
    console.error(t("config.lang.noCode"));
    return 1;
  }
  const locales = loadI18nLocales();
  const entry = locales.find((locale) => locale.code === code);
  if (!entry) {
    console.error(t("config.lang.unknown", { code }));
    return 1;
  }
  const { getLocale, setLocale } = await import("../i18n.mjs");
  const current = getLocale();
  if (current === code && !opts.force) {
    console.log(t("config.lang.alreadySet", { code }));
    return 0;
  }
  const envPath = getCliEnvPath();
  upsertEnvLine(envPath, "OMNIROUTE_LANG", code);
  setLocale(code);
  console.log(t("config.lang.saved", { code, name: entry.english }));
  console.log(t("config.lang.envHint", { code }));
  return 0;
}

export async function runConfigLangListCommand(opts = {}) {
  const { getLocale } = await import("../i18n.mjs");
  const current = getLocale();
  const locales = loadI18nLocales();
  if (opts.output === "json" || opts.json) {
    console.log(
      JSON.stringify(
        locales.map((locale) => ({ ...locale, active: locale.code === current })),
        null,
        2
      )
    );
    return 0;
  }
  console.log(`\n\x1b[1m\x1b[36m${t("config.lang.listTitle")}\x1b[0m\n`);
  for (const locale of locales) {
    const active = locale.code === current ? " \x1b[32m* active\x1b[0m" : "";
    console.log(
      `  ${locale.flag}  ${locale.code.padEnd(8)} ${locale.english.padEnd(28)} ${
        locale.native
      }${active}`
    );
  }
  console.log("");
  return 0;
}

export function registerConfig(program) {
  const config = program.command("config").description("Show or update CLI configuration");

  const lang = config.command("lang").description(t("config.lang.description"));
  lang
    .command("get")
    .description(t("config.lang.getDescription"))
    .option("--json", t("common.jsonOpt"))
    .action(async (opts, cmd) => {
      const globalOpts = cmd.parent.parent.optsWithGlobals();
      const exitCode = await runConfigLangGetCommand({ ...opts, output: globalOpts.output });
      if (exitCode !== 0) process.exit(exitCode);
    });
  lang
    .command("set <code>")
    .description(t("config.lang.setDescription"))
    .option("--force", "Set even if already active")
    .action(async (code, opts) => {
      const exitCode = await runConfigLangSetCommand(code, opts);
      if (exitCode !== 0) process.exit(exitCode);
    });
  lang
    .command("list")
    .description(t("config.lang.listDescription"))
    .option("--json", t("common.jsonOpt"))
    .action(async (opts, cmd) => {
      const globalOpts = cmd.parent.parent.optsWithGlobals();
      const exitCode = await runConfigLangListCommand({ ...opts, output: globalOpts.output });
      if (exitCode !== 0) process.exit(exitCode);
    });

  registerContexts(config);
}
