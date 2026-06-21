import { RootProvider } from "fumadocs-ui/provider/next";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import type { ReactNode } from "react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Suspense } from "react";
import LanguageSelector from "@/shared/components/LanguageSelector";

export const metadata = {
  title: {
    template: "%s - OmniRoute Docs",
    default: "OmniRoute Documentation",
  },
  description:
    "Documentation for the minimal OmniRoute AI gateway: setup, providers, routing, API, and deployment.",
  robots: {
    index: true,
    follow: true,
  },
};

const docsLayoutOptions: BaseLayoutProps = {
  nav: {
    title: "OmniRoute Docs",
    url: "/docs",
    children: (
      <Suspense fallback={<div className="w-24 h-8" />}>
        <LanguageSelector />
      </Suspense>
    ),
  },
  links: [
    {
      text: "Docs Home",
      url: "/docs",
    },
    {
      text: "\u2190 Back to Dashboard",
      url: "/dashboard",
      secondary: true,
    },
  ],
  githubUrl: "https://github.com/diegosouzapw/OmniRoute",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      theme={{
        defaultTheme: "dark",
        attribute: "class",
      }}
    >
      <DocsLayout tree={source.pageTree as any} {...docsLayoutOptions}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
