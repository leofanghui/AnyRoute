import fs from "node:fs";
import path from "node:path";
import type { ComponentType } from "react";

const DOCS_ROOT = path.join(process.cwd(), "docs");
const INCLUDED_DIRS = new Set([
  "architecture",
  "getting-started",
  "guides",
  "ops",
  "reference",
  "routing",
  "security",
]);

type DocsPage = {
  url: string;
  slugs: string[];
  data: {
    title: string;
    description?: string;
    toc: unknown[];
    full?: boolean;
    filePath: string;
    body: ComponentType<Record<string, unknown>>;
  };
};

function slugify(value: string): string {
  return value
    .replace(/\.(md|mdx)$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromMarkdown(filePath: string): string {
  const fallback = path
    .basename(filePath)
    .replace(/\.(md|mdx)$/i, "")
    .replace(/[-_]+/g, " ");
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const heading = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
    return heading || fallback;
  } catch {
    return fallback;
  }
}

function collectPages(): DocsPage[] {
  const pages: DocsPage[] = [];

  function walk(dir: string, segments: string[]): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "meta.json" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (segments.length === 0 && !INCLUDED_DIRS.has(entry.name)) continue;
        walk(full, [...segments, slugify(entry.name)]);
        continue;
      }
      if (!entry.isFile() || !/\.(md|mdx)$/i.test(entry.name)) continue;
      const slugs = [...segments, slugify(entry.name)];
      pages.push({
        url: `/docs/${slugs.join("/")}`,
        slugs,
        data: {
          title: titleFromMarkdown(full),
          toc: [],
          filePath: full,
          body: function EmptyDocBody() {
            return null;
          },
        },
      });
    }
  }

  walk(DOCS_ROOT, []);
  return pages.sort((a, b) => a.url.localeCompare(b.url));
}

function labelFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildPageTree(pages: DocsPage[]) {
  const folders = new Map<string, DocsPage[]>();
  for (const page of pages) {
    const folder = page.slugs[0] ?? "docs";
    const group = folders.get(folder) ?? [];
    group.push(page);
    folders.set(folder, group);
  }

  return {
    name: "OmniRoute Docs",
    children: [...folders.entries()].map(([folder, group]) => ({
      type: "folder",
      name: labelFromSlug(folder),
      children: group.map((page) => ({
        type: "page",
        name: page.data.title,
        url: page.url,
      })),
    })),
  };
}

const pages = collectPages();

export const source = {
  pageTree: buildPageTree(pages),
  getPages() {
    return pages;
  },
  getPage(slugs: string[]) {
    const key = slugs.map(slugify).join("/");
    return pages.find((page) => page.slugs.join("/") === key) ?? null;
  },
  generateParams() {
    return pages.map((page) => ({ slug: page.slugs }));
  },
};
