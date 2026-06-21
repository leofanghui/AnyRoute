import { describe, it, before } from "node:test";
import assert from "node:assert";
import * as toolDetector from "../../../src/lib/cli-helper/tool-detector.ts";

describe("tool-detector", () => {
  before(() => {
    // Install mock exec implementation for deterministic testing.
    // @ts-expect-error - internal test hook
    toolDetector.__setExecFileImpl(async (cmd) => {
      if (cmd === "opencode") {
        return { stdout: "v1.0.0\n" };
      }
      if (cmd === "codex") {
        return { stdout: "codex-cli 0.1.0\n" };
      }
      if (cmd === "which") {
        return { stdout: "/usr/local/bin/opencode\n" };
      }
      throw new Error("Command not found");
    });
  });

  describe("detectTool", () => {
    it("returns null for unknown tool id", async () => {
      const result = await toolDetector.detectTool("unknown-tool-xyz");
      assert.strictEqual(result, null);
    });

    it("returns DetectedTool object for OpenCode", async () => {
      const result = await toolDetector.detectTool("opencode");
      assert.ok(result !== null);
      assert.strictEqual(result!.id, "opencode");
      assert.strictEqual(result!.name, "OpenCode");
      assert.strictEqual(result!.installed, true);
      assert.strictEqual(result!.version, "1.0.0");
      assert.ok(result!.configPath.includes(".config/opencode"));
      assert.strictEqual(typeof result!.configured, "boolean");
    });

    it("returns DetectedTool object for Codex", async () => {
      const result = await toolDetector.detectTool("codex");
      assert.ok(result !== null);
      assert.strictEqual(result!.id, "codex");
      assert.strictEqual(result!.name, "Codex CLI");
      assert.strictEqual(result!.installed, true);
      assert.strictEqual(result!.version, "codex-cli 0.1.0");
      assert.ok(result!.configPath.includes(".codex/config.yaml"));
      assert.strictEqual(typeof result!.configured, "boolean");
    });
  });

  describe("detectAllTools", () => {
    it("returns only retained minimal config tools", async () => {
      const tools = await toolDetector.detectAllTools();
      assert.deepStrictEqual(tools.map((t) => t.id).sort(), ["codex", "opencode"]);
    });
  });
});
