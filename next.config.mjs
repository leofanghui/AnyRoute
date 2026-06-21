import createNextIntlPlugin from "next-intl/plugin";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const distDir = process.env.NEXT_DIST_DIR || ".build/next";
const projectRoot = dirname(fileURLToPath(import.meta.url));
const scriptSrc =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

function isNextIntlExtractorDynamicImportWarning(warning) {
  const message = typeof warning === "string" ? warning : warning?.message || "";
  const resource = warning?.module?.resource || warning?.file || "";
  const target = "next-intl/dist/esm/production/extractor/format/index.js";
  return (
    resource.includes(target) &&
    (message.includes("import(t)") || message.includes("dependency is an expression"))
  );
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  // Turbopack config root is explicit so workspace imports resolve consistently.
  turbopack: {
    root: projectRoot,
    resolveAlias: {},
  },
  output: "standalone",
  // OmniRoute is a proxy for AI APIs — request bodies routinely include
  // multi-MB payloads (vision models, image edits, base64-encoded files,
  // long chat histories with embedded images). Next.js's Server Action
  // handler intercepts POSTs with multipart/form-data or
  // x-www-form-urlencoded content-types and enforces a 1 MB cap that
  // surfaces as a 413 with a confusing "Server Actions" hint, even on
  // pure route handlers. 50 MB matches what most upstream LLM providers
  // accept for image-bearing requests; tune via env if a deployment needs
  // more.
  experimental: {
    serverActions: {
      bodySizeLimit: process.env.OMNIROUTE_SERVER_ACTIONS_BODY_LIMIT || "50mb",
    },
    // Next.js proxy (middleware) has a default 10MB body clone limit. File
    // uploads (OpenAI-compatible /v1/files) routinely exceed this. Match the
    // 512 MB server-side cap; tune via env if needed.
    proxyClientMaxBodySize: process.env.NEXT_PROXY_BODY_LIMIT || "512mb",
  },
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: {
    // Migration SQL and native helper files are read via fs at runtime and are
    // NOT always auto-traced by webpack/turbopack.
    "/*": [
      "./src/lib/db/migrations/**/*",
      "./open-sse/lib/sha3_wasm_bg.wasm",
      "./open-sse/lib/deepseek-pow-solver.cjs",
    ],
  },
  outputFileTracingExcludes: {
    // Planning/task docs are not runtime assets and can break standalone copies
    // when broad fs/path tracing pulls the whole repository into the NFT graph.
    "/*": [
      "./.git/**/*",
      "./_tasks/**/*",
      "./_references/**/*",
      "./_ideia/**/*",
      "./_mono_repo/**/*",
      "./coverage/**/*",
      "./test-results/**/*",
      "./playwright-report/**/*",
      "./app.__qa_backup/**/*",
      "./tests/**/*",
      "./logs/**/*",
    ],
  },
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "thread-stream",
    "pino-abstract-transport",
    "better-sqlite3",
    "node-machine-id",
    "wreq-js",
    "zod",
    "tls-client-node",
    "koffi",
    "tough-cookie",
    "child_process",
    "fs",
    "path",
    "os",
    "crypto",
    "net",
    "tls",
    "http",
    "https",
    "stream",
    "buffer",
    "util",
    "process",
  ],
  transpilePackages: ["@omniroute/open-sse", "@lobehub/icons", "fumadocs-ui", "fumadocs-core"],
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.0.250"],
  typescript: {
    // TODO: Re-enable after fixing all sub-component useTranslations scope issues
    ignoreBuildErrors: true,
  },
  webpack(config) {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      isNextIntlExtractorDynamicImportWarning,
    ];

    return config;
  },
  images: {
    unoptimized: true,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  async redirects() {
    return [
      // Architecture
      {
        source: "/docs/resilience-guide",
        destination: "/docs/architecture/resilience-guide",
        permanent: true,
      },
      // Getting started
      {
        source: "/docs/quick-start",
        destination: "/docs/getting-started/quick-start",
        permanent: true,
      },
      {
        source: "/docs/providers-guide",
        destination: "/docs/getting-started/providers-guide",
        permanent: true,
      },
      {
        source: "/docs/auto-combo-guide",
        destination: "/docs/getting-started/auto-combo-guide",
        permanent: true,
      },
      {
        source: "/docs/troubleshooting",
        destination: "/docs/getting-started/troubleshooting",
        permanent: true,
      },
      // Guides
      {
        source: "/docs/electron-guide",
        destination: "/docs/guides/electron-guide",
        permanent: true,
      },
      { source: "/docs/i18n", destination: "/docs/guides/i18n", permanent: true },
      { source: "/docs/kiro-setup", destination: "/docs/guides/kiro-setup", permanent: true },
      { source: "/docs/pwa-guide", destination: "/docs/guides/pwa-guide", permanent: true },
      {
        source: "/docs/codex-cli-configuration",
        destination: "/docs/guides/codex-cli-configuration",
        permanent: true,
      },
      { source: "/docs/uninstall", destination: "/docs/guides/uninstall", permanent: true },
      // Routing
      { source: "/docs/auto-combo", destination: "/docs/routing/auto-combo", permanent: true },
      // Security
      { source: "/docs/cli-token", destination: "/docs/security/cli-token", permanent: true },
      {
        source: "/docs/cli-token-auth",
        destination: "/docs/security/cli-token-auth",
        permanent: true,
      },
      {
        source: "/docs/egress-policy",
        destination: "/docs/security/egress-policy",
        permanent: true,
      },
      {
        source: "/docs/error-sanitization",
        destination: "/docs/security/error-sanitization",
        permanent: true,
      },
      { source: "/docs/public-creds", destination: "/docs/security/public-creds", permanent: true },
      {
        source: "/docs/supply-chain",
        destination: "/docs/security/supply-chain",
        permanent: true,
      },
      // Ops
      {
        source: "/docs/fly-io-deployment-guide",
        destination: "/docs/ops/fly-io-deployment-guide",
        permanent: true,
      },
      { source: "/docs/sqlite-runtime", destination: "/docs/ops/sqlite-runtime", permanent: true },
      {
        source: "/docs/vm-deployment-guide",
        destination: "/docs/ops/vm-deployment-guide",
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/chat/completions",
        destination: "/api/v1/chat/completions",
      },
      {
        source: "/responses",
        destination: "/api/v1/responses",
      },
      {
        source: "/responses/:path*",
        destination: "/api/v1/responses/:path*",
      },
      {
        source: "/models",
        destination: "/api/v1/models",
      },
      {
        source: "/v1/v1/:path*",
        destination: "/api/v1/:path*",
      },
      {
        source: "/v1/v1",
        destination: "/api/v1",
      },
      {
        source: "/codex/:path*",
        destination: "/api/v1/responses",
      },
      {
        source: "/v1/:path*",
        destination: "/api/v1/:path*",
      },
      {
        source: "/v1",
        destination: "/api/v1",
      },
      {
        source: "/v1beta/:path*",
        destination: "/api/v1beta/:path*",
      },
      {
        source: "/v1beta",
        destination: "/api/v1beta",
      },
    ];
  },
};

export default withNextIntl(nextConfig);
