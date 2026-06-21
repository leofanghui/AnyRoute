// source.config.ts
import { defineDocs, defineConfig } from "fumadocs-mdx/config";
var docs = defineDocs({
  dir: "docs",
  docs: {
    files: [
      "./architecture/**/*.md",
      "./guides/**/*.md",
      "./reference/**/*.md",
      "./routing/**/*.md",
      "./security/**/*.md",
      "./ops/**/*.md",
    ],
  },
});
var source_config_default = defineConfig();
export { source_config_default as default, docs };
