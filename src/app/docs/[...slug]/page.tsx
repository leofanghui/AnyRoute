import { source } from "@/lib/source";
import { DocsBody, DocsPage } from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import { marked } from "marked";

function stripFrontmatter(raw: string): string {
  return raw.replace(/^---\s*[\s\S]*?^---\s*/m, "").trim();
}

export default async function Page(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const raw = fs.readFileSync(page.data.filePath, "utf8");
  const html = marked.parse(stripFrontmatter(raw)) as string;

  return (
    <DocsPage toc={page.data.toc as any} full={page.data.full}>
      <DocsBody>
        <div className="prose-content" dangerouslySetInnerHTML={{ __html: html }} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) return {};

  return {
    title: `${page.data.title} - OmniRoute Docs`,
    description: page.data.description ?? `OmniRoute documentation: ${page.data.title}`,
  };
}
