import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
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

export default defineConfig();
