// Provider definitions

/**
 * Service kind for the minimal source profile.
 * Future specialty modules can extend this union when their handlers return.
 */
export type ServiceKind = "llm";

export type RiskNoticeVariant = "oauth" | "webCookie" | "deprecated";

export interface ProviderRiskNoticeFields {
  subscriptionRisk?: boolean;
  riskNoticeVariant?: RiskNoticeVariant;
}

export const FREE_PROVIDERS = {};

// No-auth Providers
export const NOAUTH_PROVIDERS = {
  opencode: {
    id: "opencode",
    alias: "oc",
    name: "OpenCode Free",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OC",
    website: "https://opencode.ai",
    noAuth: true,
    hasFree: true,
    serviceKinds: ["llm"],
    authHint: "No API key required — uses OpenCode's public free endpoint.",
    freeNote:
      "No API key required — public OpenCode endpoint with Kimi, GLM, Qwen, MiMo, MiniMax models.",
    notice: {
      text: "OpenCode Free uses the public OpenCode endpoint (https://opencode.ai/zen/v1). No signup or API key needed. Rate limits apply.",
    },
  },
  "duckduckgo-web": {
    id: "duckduckgo-web",
    alias: "ddgw",
    name: "DuckDuckGo AI Chat",
    icon: "auto_awesome",
    color: "#DE5833",
    textIcon: "DDG",
    website: "https://duckduckgo.com/duckchat",
    noAuth: true,
    hasFree: true,
    serviceKinds: ["llm"],
    freeNote: "Free — anonymous access to multiple AI models via DuckDuckGo.",
    authHint: "No credentials required — DuckDuckGo AI Chat is anonymous and free.",
  },
  theoldllm: {
    id: "theoldllm",
    alias: "tllm",
    name: "The Old LLM (Free)",
    icon: "auto_awesome",
    color: "#8B5CF6",
    textIcon: "TL",
    website: "https://theoldllm.vercel.app",
    noAuth: true,
    hasFree: true,
    serviceKinds: ["llm"],
    freeNote:
      "Free — GPT-5.4, Claude 4.6 Opus/Sonnet/Haiku, + more. No API key — tokens auto-generated via browser.",
    authHint:
      "No credentials required. The executor auto-generates access tokens via an embedded Playwright browser instance.",
  },
  chipotle: {
    id: "chipotle",
    alias: "pepper",
    name: "Chipotle Pepper AI (Free)",
    icon: "restaurant",
    color: "#C41230",
    textIcon: "🌯",
    website: "https://amelia.chipotle.com",
    noAuth: true,
    hasFree: true,
    serviceKinds: ["llm"],
    freeNote:
      "Free — Chipotle's Pepper AI (IPsoft Amelia). Anonymous sessions, no API key. Rate-limited.",
    authHint:
      "No credentials required. Uses Chipotle's public support chatbot via reverse-engineered SockJS/STOMP protocol.",
  },
  mimocode: {
    id: "mimocode",
    alias: "mcode",
    name: "MiMoCode (Free)",
    icon: "devices",
    color: "#FF6B35",
    textIcon: "MC",
    website: "https://mimo.mi.com",
    noAuth: true,
    hasFree: true,
    serviceKinds: ["llm"],
    freeNote:
      "Free — Xiaomi MiMo models via bootstrap JWT auth. No API key required. Supports streaming.",
    authHint:
      "No API key required. The executor auto-generates JWT tokens via device fingerprint bootstrap.",
    notice: {
      text: "MiMoCode uses Xiaomi's public free AI endpoint with bootstrap-based JWT authentication. No signup needed. Rate limits apply.",
    },
  },
};

export const FREE_APIKEY_PROVIDER_IDS = new Set(["qoder", "mimocode", "opencode"]);

export function supportsApiKeyOnFreeProvider(providerId: unknown): boolean {
  return typeof providerId === "string" && FREE_APIKEY_PROVIDER_IDS.has(providerId);
}

// OAuth Providers
export const OAUTH_PROVIDERS = {
  qoder: {
    id: "qoder",
    alias: "if",
    name: "Qoder AI",
    icon: "water_drop",
    color: "#6366F1",
    subscriptionRisk: true,
    riskNoticeVariant: "oauth",
    hasFree: true,
  },
  agy: {
    id: "agy",
    alias: "agy",
    name: "Antigravity CLI",
    icon: "terminal",
    color: "#F59E0B",
    textIcon: "AGY",
    website: "https://antigravity.google",
    subscriptionRisk: true,
    riskNoticeVariant: "oauth",
    hasFree: true,
    authHint:
      "Import your Antigravity CLI (`agy`) login (paste/upload its token file), auto-detect a local CLI login, or sign in with Google. Shares the Antigravity backend (incl. Claude models).",
  },
  antigravity: {
    id: "antigravity",
    alias: undefined,
    name: "Antigravity",
    icon: "rocket_launch",
    color: "#F59E0B",
    subscriptionRisk: true,
    riskNoticeVariant: "oauth",
  },
  kiro: {
    id: "kiro",
    alias: "kr",
    name: "Kiro AI",
    icon: "psychology_alt",
    color: "#FF6B35",
    subscriptionRisk: true,
    riskNoticeVariant: "deprecated",
    hasFree: true,
    freeNote:
      "Free tier: 50 credits/month (~25K–100K tokens). ⚠️ Kiro ToS prohibits third-party proxy/harness use.",
  },
  claude: {
    id: "claude",
    alias: "cc",
    name: "Claude Code",
    icon: "smart_toy",
    color: "#D97757",
    subscriptionRisk: true,
    riskNoticeVariant: "oauth",
  },

  codex: {
    id: "codex",
    alias: "cx",
    name: "OpenAI Codex",
    icon: "code",
    color: "#3B82F6",
    subscriptionRisk: true,
    riskNoticeVariant: "oauth",
  },
  github: {
    id: "github",
    alias: "gh",
    name: "GitHub Copilot",
    icon: "code",
    color: "#333333",
  },
  cursor: {
    id: "cursor",
    alias: "cu",
    name: "Cursor IDE",
    icon: "edit_note",
    color: "#00D4AA",
    subscriptionRisk: true,
    riskNoticeVariant: "oauth",
  },
  zed: {
    id: "zed",
    alias: "zd",
    name: "Zed IDE",
    icon: "code",
    color: "#084CCF",
    textIcon: "ZD",
    website: "https://zed.dev",
    authHint:
      "Zed stores LLM provider credentials (OpenAI, Anthropic, Google, Mistral, xAI) in the OS keychain. Use the Import button below to discover and import them automatically.",
  },
  trae: {
    id: "trae",
    alias: "tr",
    name: "Trae",
    icon: "edit_square",
    color: "#FF7849",
    textIcon: "TR",
    website: "https://trae.ai",
    authHint:
      "Trae is an AI-native IDE by ByteDance (SOLO remote agent). Authorize via trae.ai in the popup, or sign in at solo.trae.ai and paste the Cloud-IDE-JWT (sent as 'Authorization: Cloud-IDE-JWT <token>', ~14-day lifetime) as the access token; web_id/biz_user_id/user_unique_id/scope/tenant/region propagate via providerSpecificData. No headless refresh for pasted tokens — re-paste on expiry.",
  },
  "kimi-coding": {
    id: "kimi-coding",
    alias: "kmc",
    name: "Kimi Coding",
    icon: "psychology",
    color: "#1E40AF",
    textIcon: "KC",
    subscriptionRisk: true,
    riskNoticeVariant: "oauth",
  },
  cline: {
    id: "cline",
    alias: "cl",
    name: "Cline",
    icon: "smart_toy",
    color: "#5B9BD5",
    textIcon: "CL",
    subscriptionRisk: true,
    riskNoticeVariant: "oauth",
  },
  windsurf: {
    id: "windsurf",
    alias: "ws",
    name: "Windsurf (Devin CLI)",
    icon: "air",
    color: "#00C5A0",
    textIcon: "WS",
    subscriptionRisk: true,
    riskNoticeVariant: "oauth",
    authHint:
      'In the Windsurf / VS Code IDE, open the command palette and run `Windsurf: Provide Auth Token` (or click the Jupyter "Get Windsurf Authentication Token" button), then copy the shown token and paste it here. Note: opening windsurf.com/show-auth-token directly only renders a "Redirecting" page — the IDE must initiate the flow (it adds a `?state=...` param) for the token to appear.',
    website: "https://windsurf.com",
  },
};

// Web / Cookie Providers
export const WEB_COOKIE_PROVIDERS = {
  "chatgpt-web": {
    id: "chatgpt-web",
    alias: "cgpt-web",
    name: "ChatGPT Web (Plus/Pro)",
    icon: "auto_awesome",
    color: "#10A37F",
    textIcon: "CG",
    website: "https://chatgpt.com",
    authHint: "Paste your __Secure-next-auth.session-token cookie value from chatgpt.com",
    subscriptionRisk: true,
    riskNoticeVariant: "webCookie",
  },
  // "grok-web": {
  //   id: "grok-web",
  //   alias: "gw",
  //   name: "Grok Web (Subscription)",
  //   icon: "auto_awesome",
  //   color: "#1DA1F2",
  //   textIcon: "GW",
  //   website: "https://grok.com",
  //   authHint:
  //     "Paste the full grok.com cookie line from DevTools → Application → Cookies. Include both `sso` and `sso-rw` (e.g. `sso=...; sso-rw=...`) — Grok's anti-bot rejects `sso` on its own.",
  //   subscriptionRisk: true,
  //   riskNoticeVariant: "webCookie",
  // },
  "gemini-web": {
    id: "gemini-web",
    alias: "gweb",
    name: "Gemini Web (Free)",
    icon: "auto_awesome",
    color: "#4285F4",
    textIcon: "GWeb",
    website: "https://gemini.google.com",
    authHint:
      "Paste your __Secure-1PSID cookie value from gemini.google.com. Optionally add __Secure-1PSIDTS separated by semicolon.",
    subscriptionRisk: true,
    riskNoticeVariant: "webCookie",
  },
  "claude-web": {
    id: "claude-web",
    alias: "cw",
    name: "Claude Web",
    icon: "auto_awesome",
    color: "#D97757",
    textIcon: "CW",
    website: "https://claude.ai",
    authHint: "Paste your session cookie from claude.ai",
    subscriptionRisk: true,
    riskNoticeVariant: "webCookie",
  },
  "deepseek-web": {
    id: "deepseek-web",
    alias: "ds-web",
    name: "DeepSeek Web",
    icon: "auto_awesome",
    color: "#4D6BFE",
    textIcon: "DS",
    website: "https://chat.deepseek.com",
    authHint:
      "Paste your userToken from chat.deepseek.com — DevTools → Application → Local Storage → userToken",
    subscriptionRisk: true,
    riskNoticeVariant: "webCookie",
  },
  "kimi-web": {
    id: "kimi-web",
    // Primary "kimi" provider keeps the short alias; web variant uses its own id.
    alias: "kimi-web",
    name: "Kimi Web",
    icon: "auto_awesome",
    color: "#2563EB",
    textIcon: "KW",
    website: "https://kimi.moonshot.cn",
    authHint: "Paste your session cookie from kimi.moonshot.cn (DevTools → Application → Cookies)",
    subscriptionRisk: true,
    riskNoticeVariant: "webCookie",
  },
  "doubao-web": {
    id: "doubao-web",
    alias: "db",
    name: "豆包",
    icon: "auto_awesome",
    color: "#3B82F6",
    textIcon: "DW",
    website: "https://www.doubao.com",
    authHint: "Paste your session cookie from doubao.com (DevTools → Application → Cookies)",
    subscriptionRisk: true,
    riskNoticeVariant: "webCookie",
  },
  "qwen-web": {
    id: "qwen-web",
    // Primary "qwen" provider keeps the short alias; web variant uses its own id.
    alias: "qwen-web",
    name: "千问",
    icon: "auto_awesome",
    color: "#10B981",
    textIcon: "QW",
    website: "https://chat.qwen.ai",
    hasFree: true,
    freeNote: "Free — Qwen models via chat.qwen.ai with login token. No subscription required.",
    authHint:
      "Open chat.qwen.ai, log in, then open DevTools → Application → Local Storage → " +
      'copy the "token" value (or use tongyi_sso_ticket cookie as Bearer token).',
  },
  // "gemini-business": {
  //   id: "gemini-business",
  //   alias: "gembiz",
  //   name: "Gemini Business (Enterprise)",
  //   icon: "business_center",
  //   color: "#4285F4",
  //   textIcon: "GB",
  //   website: "https://business.gemini.google",
  //   hasFree: true,
  //   freeNote:
  //     "Free for Google Workspace enterprise accounts — enterprise Gemini models (Pro, Flash, image, video) via direct StreamGenerate HTTP API. No subscription required, just enterprise SSO.",
  //   authHint:
  //     "From your enterprise account: open business.gemini.google/home/cid/{your-cid}, then copy __Secure-1PSID and __Secure-1PSIDTS cookies from DevTools → Application → Cookies. Paste as a cookie header below.",
  // },
};

// API Key Providers
export const APIKEY_PROVIDERS = {
  openai: {
    id: "openai",
    alias: "openai",
    name: "OpenAI",
    icon: "auto_awesome",
    color: "#10A37F",
    textIcon: "OA",
    website: "https://platform.openai.com",
  },
  anthropic: {
    id: "anthropic",
    alias: "anthropic",
    name: "Anthropic",
    icon: "smart_toy",
    color: "#D97757",
    textIcon: "AN",
    website: "https://platform.claude.com",
  },
  agentrouter: {
    id: "agentrouter",
    alias: "agentrouter",
    name: "AgentRouter",
    icon: "router",
    color: "#10B981",
    textIcon: "AR",
    passthroughModels: true,
    website: "https://agentrouter.org",
    hasFree: true,
    freeNote: "$200 free credits on signup - multi-model routing gateway",
    apiHint: "Get $200 free credits at https://agentrouter.org/register — no credit card required.",
  },
  openrouter: {
    id: "openrouter",
    alias: "openrouter",
    name: "OpenRouter",
    icon: "router",
    color: "#F97316",
    textIcon: "OR",
    passthroughModels: true,
    website: "https://openrouter.ai",
    hasFree: true,
    freeNote: "Free models at $0/token with :free suffix - 20 RPM / 200 RPD",
  },
  // qianfan: {
  //   id: "qianfan",
  //   alias: "qianfan",
  //   name: "Baidu Qianfan",
  //   icon: "cloud",
  //   color: "#2468F2",
  //   textIcon: "BD",
  //   website: "https://cloud.baidu.com/product/wenxinworkshop",
  //   apiHint:
  //     "Use a Qianfan API key from Baidu AI Cloud. The default endpoint is OpenAI-compatible v2.",
  // },
  // glm: {
  //   id: "glm",
  //   alias: "glm",
  //   name: "GLM Coding",
  //   icon: "code",
  //   color: "#2563EB",
  //   textIcon: "GL",
  //   website: "https://z.ai/subscribe",
  // },
  "glm-cn": {
    id: "glm-cn",
    alias: "glmcn",
    name: "GLM Coding",
    icon: "code",
    color: "#DC2626",
    textIcon: "GC",
    website: "https://open.bigmodel.cn",
  },
  // "bailian-coding-plan": {
  //   id: "bailian-coding-plan",
  //   alias: "bcp",
  //   name: "Alibaba Coding Plan",
  //   icon: "code",
  //   color: "#FF6A00",
  //   textIcon: "BCP",
  //   website: "https://www.alibabacloud.com/help/en/model-studio/coding-plan",
  // },
  // kimi: {
  //   id: "kimi",
  //   alias: "kimi（国际）",
  //   name: "Kimi",
  //   icon: "psychology",
  //   color: "#1E3A8A",
  //   textIcon: "KM",
  //   website: "https://platform.moonshot.ai",
  // },
  "kimi-coding": {
    id: "kimi-coding",
    alias: "kmca",
    name: "Kimi Coding",
    icon: "psychology",
    color: "#1E40AF",
    textIcon: "KC",
    website: "https://www.kimi.com/code",
  },
  // minimax: {
  //   id: "minimax",
  //   alias: "minimax",
  //   name: "Minimax Coding",
  //   icon: "memory",
  //   color: "#7C3AED",
  //   textIcon: "MM",
  //   website: "https://www.minimax.io",
  // },
  "minimax-cn": {
    id: "minimax-cn",
    alias: "minimax-cn",
    name: "Minimax (China)",
    icon: "memory",
    color: "#DC2626",
    textIcon: "MC",
    website: "https://www.minimaxi.com",
  },
  gemini: {
    id: "gemini",
    alias: "gemini",
    name: "Gemini (Google AI Studio)",
    icon: "diamond",
    color: "#4285F4",
    textIcon: "GE",
    website: "https://aistudio.google.com",
    freeNote:
      "Free forever: 1,500 req/day for Gemini 2.5 Flash — no credit card, get key at aistudio.google.com",
  },
  deepseek: {
    id: "deepseek",
    alias: "ds",
    name: "DeepSeek",
    icon: "bolt",
    color: "#4D6BFE",
    textIcon: "DS",
    website: "https://platform.deepseek.com",
    freeNote: "5M free tokens on signup - no credit card required",
  },
  "opencode-zen": {
    id: "opencode-zen",
    alias: "opencode-zen",
    name: "OpenCode Zen",
    icon: "opencode",
    color: "#6366f1",
    website: "https://opencode.ai/zen",
    anonymousFallback: true,
  },
  "opencode-go": {
    id: "opencode-go",
    alias: "opencode-go",
    name: "OpenCode Go",
    icon: "opencode",
    color: "#6366f1",
    website: "https://opencode.ai/go",
    anonymousFallback: true,
  },
  "xiaomi-mimo": {
    id: "xiaomi-mimo",
    alias: "mimo",
    name: "Xiaomi MiMo",
    icon: "devices",
    color: "#EA580C",
    textIcon: "MM",
    website: "https://mimo.mi.com",
  },

  // 免费==========================================================================
  // gitlawb: {
  //   id: "gitlawb",
  //   alias: "glb",
  //   name: "Gitlawb Opengateway (MiMo)",
  //   icon: "hub",
  //   color: "#10B981",
  //   textIcon: "GLB",
  //   website: "https://opengateway.gitlawb.com",
  //   hasFree: false,
  //   freeNote:
  //     "Free MiMo (xiaomi/mimo-v2.5) revoked 2026-05 — Opengateway is now a pay-as-you-go credit gateway; no recurring free model.",
  //   apiHint: "Get your API key from Gitlawb Opengateway dashboard.",
  // },
  "gitlawb-gmi": {
    id: "gitlawb-gmi",
    alias: "glb-gmi",
    name: "Gitlawb Opengateway (GMI Cloud)",
    icon: "hub",
    color: "#10B981",
    textIcon: "GMI",
    website: "https://opengateway.gitlawb.com",
    hasFree: false,
    freeNote:
      "Free Nemotron promo ended 2026-06 — the GMI Cloud route is now pay-as-you-go credit only.",
    apiHint: "Get your API key from Gitlawb Opengateway dashboard.",
  },
};

// Sub-categories within APIKEY_PROVIDERS (used by dashboard and catalog views).
export const IMAGE_ONLY_PROVIDER_IDS = new Set<string>();

export const AGGREGATOR_PROVIDER_IDS = new Set([
  "openrouter",
  "synthetic",
  "kilo-gateway",
  "aimlapi",
  "novita",
  "piapi",
  "getgoapi",
  "laozhang",
  "vercel-ai-gateway",
  "agentrouter",
  "glhf",
  "cablyai",
  "thebai",
  "fenayai",
  "empower",
  "poe",
  "chutes",
  "hackclub",
]);

export const ENTERPRISE_CLOUD_PROVIDER_IDS = new Set([
  "azure-openai",
  "azure-ai",
  "bedrock",
  "watsonx",
  "oci",
  "sap",
  "vertex",
  "vertex-partner",
  "databricks",
  "datarobot",
  "clarifai",
  "snowflake",
  "heroku",
  "modal",
]);

export const VIDEO_PROVIDER_IDS = new Set<string>();

// IDE Providers: editors with built-in AI subscription (separate section in UI).
// These providers live in OAUTH_PROVIDERS but render under "IDE Providers"
// instead of "OAuth Providers" to avoid visual duplication.
export const IDE_PROVIDER_IDS = new Set(["cursor", "zed", "trae"]);

export const EMBEDDING_RERANK_PROVIDER_IDS = new Set<string>();

// Local / Self-Hosted Providers
export const LOCAL_PROVIDERS = {
  "lm-studio": {
    id: "lm-studio",
    alias: "lmstudio",
    name: "LM Studio",
    icon: "server",
    color: "#4A148C",
    textIcon: "LM",
    website: "https://lmstudio.ai",
    authHint:
      "API key optional. Configure the local LM Studio OpenAI-compatible base URL (default: http://localhost:1234/v1).",
    localDefault: "http://localhost:1234/v1",
    passthroughModels: true,
  },
  vllm: {
    id: "vllm",
    alias: "vllm",
    name: "vLLM",
    icon: "memory",
    color: "#0F766E",
    textIcon: "VL",
    website: "https://github.com/vllm-project/vllm",
    authHint:
      "API key optional. Configure the local vLLM OpenAI-compatible base URL (default: http://localhost:8000/v1).",
    localDefault: "http://localhost:8000/v1",
    passthroughModels: true,
  },
  lemonade: {
    id: "lemonade",
    alias: "lemonade",
    name: "Lemonade Server",
    icon: "bolt",
    color: "#F59E0B",
    textIcon: "LM",
    website: "https://lemonade-server.ai",
    authHint:
      "API key optional. Configure the local Lemonade OpenAI-compatible base URL (default: http://localhost:13305/api/v1).",
    localDefault: "http://localhost:13305/api/v1",
    passthroughModels: true,
  },
  llamafile: {
    id: "llamafile",
    alias: "llamafile",
    name: "Llamafile",
    icon: "article",
    color: "#EA580C",
    textIcon: "LF",
    website: "https://github.com/Mozilla-Ocho/llamafile",
    authHint:
      "API key optional. Configure the local Llamafile OpenAI-compatible base URL (default: http://127.0.0.1:8080/v1).",
    localDefault: "http://127.0.0.1:8080/v1",
    passthroughModels: true,
  },
  "llama-cpp": {
    id: "llama-cpp",
    alias: "llamacpp",
    name: "llama.cpp",
    icon: "memory",
    color: "#795548",
    textIcon: "LC",
    website: "https://github.com/ggml-org/llama.cpp",
    authHint:
      "API key optional (use any value, e.g. sk-no-key-required). Configure the llama-server OpenAI-compatible base URL (default: http://127.0.0.1:8080/v1). Note: if Llamafile is also installed, both default to port 8080 — run only one at a time or override the port.",
    localDefault: "http://127.0.0.1:8080/v1",
    passthroughModels: true,
  },
  triton: {
    id: "triton",
    alias: "triton",
    name: "NVIDIA Triton",
    icon: "developer_board",
    color: "#76B900",
    textIcon: "TR",
    website: "https://developer.nvidia.com/triton-inference-server",
    authHint:
      "API key optional. Configure the Triton OpenAI-compatible base URL (default: http://localhost:8000/v1).",
    localDefault: "http://localhost:8000/v1",
    passthroughModels: true,
  },
  "docker-model-runner": {
    id: "docker-model-runner",
    alias: "dmr",
    name: "Docker Model Runner",
    icon: "inventory_2",
    color: "#2496ED",
    textIcon: "DM",
    website: "https://docs.docker.com/ai/model-runner/",
    authHint:
      "API key optional. Configure the local Docker Model Runner OpenAI-compatible base URL (default: http://localhost:12434/v1).",
    localDefault: "http://localhost:12434/v1",
    passthroughModels: true,
  },
  xinference: {
    id: "xinference",
    alias: "xinference",
    name: "XInference",
    icon: "hub",
    color: "#DC2626",
    textIcon: "XI",
    website: "https://inference.readthedocs.io",
    authHint:
      "API key optional. Configure the local XInference OpenAI-compatible base URL (default: http://localhost:9997/v1).",
    localDefault: "http://localhost:9997/v1",
    passthroughModels: true,
  },
  oobabooga: {
    id: "oobabooga",
    alias: "ooba",
    name: "oobabooga",
    icon: "dns",
    color: "#8B5CF6",
    textIcon: "OO",
    website: "https://github.com/oobabooga/text-generation-webui",
    authHint:
      "API key optional. Configure the local oobabooga OpenAI-compatible base URL (default: http://localhost:5000/v1).",
    localDefault: "http://localhost:5000/v1",
    passthroughModels: true,
  },
};

// Search providers are not included in the minimal source profile.
export const SEARCH_PROVIDERS = {};

// Audio providers are not included in the minimal source profile.
export const AUDIO_ONLY_PROVIDERS = {};

export const OPENAI_COMPATIBLE_PREFIX = "openai-compatible-";
export const ANTHROPIC_COMPATIBLE_PREFIX = "anthropic-compatible-";
export const CLAUDE_CODE_COMPATIBLE_PREFIX = "anthropic-compatible-cc-";

export function isOpenAICompatibleProvider(providerId: unknown): providerId is string {
  return typeof providerId === "string" && providerId.startsWith(OPENAI_COMPATIBLE_PREFIX);
}

export function isAnthropicCompatibleProvider(providerId: unknown): providerId is string {
  return typeof providerId === "string" && providerId.startsWith(ANTHROPIC_COMPATIBLE_PREFIX);
}

export const UPSTREAM_PROXY_PROVIDERS = {
  cliproxyapi: {
    id: "cliproxyapi",
    alias: "cpa",
    name: "CLIProxyAPI",
    icon: "proxy",
    color: "#6366F1",
    textIcon: "CPA",
    website: "https://github.com/router-for-me/CLIProxyAPI",
    defaultPort: 8317,
    healthEndpoint: "/v1/models",
    managementPrefix: "/v0/management",
    configDir: "~/.cli-proxy-api",
    binaryName: "cli-proxy-api",
    githubRepo: "router-for-me/CLIProxyAPI",
  },
};

export const CLOUD_AGENT_PROVIDERS = {};

export function isClaudeCodeCompatibleProvider(providerId: unknown): providerId is string {
  return typeof providerId === "string" && providerId.startsWith(CLAUDE_CODE_COMPATIBLE_PREFIX);
}

export function isLocalProvider(providerId: unknown): boolean {
  return (
    typeof providerId === "string" &&
    Object.prototype.hasOwnProperty.call(LOCAL_PROVIDERS, providerId)
  );
}

export const SELF_HOSTED_CHAT_PROVIDER_IDS = new Set([
  "lm-studio",
  "vllm",
  "lemonade",
  "llamafile",
  "llama-cpp",
  "triton",
  "docker-model-runner",
  "xinference",
  "oobabooga",
]);

export function isSelfHostedChatProvider(providerId: unknown): boolean {
  return typeof providerId === "string" && SELF_HOSTED_CHAT_PROVIDER_IDS.has(providerId);
}

export function providerAllowsOptionalApiKey(providerId: unknown): boolean {
  return (
    providerId === "pollinations" ||
    providerId === "copilot-web" ||
    providerId === "duckduckgo-web" ||
    providerId === "hackclub" ||
    providerId === "huggingchat" ||
    providerId === "gitlawb" ||
    providerId === "gitlawb-gmi" ||
    providerId === "mimocode" ||
    providerId === "opencode" ||
    isLocalProvider(providerId) ||
    isSelfHostedChatProvider(providerId) ||
    isOpenAICompatibleProvider(providerId) ||
    isAnthropicCompatibleProvider(providerId)
  );
}

/**
 * Providers explicitly excluded from bulk API key add — auth is heterogeneous,
 * OAuth-based, multi-field, or requires manual setup per connection.
 */
const BULK_API_KEY_EXCLUDED = new Set([
  "vertex",
  "vertex-partner",
  "ollama-local",
  "grok-web",
  "perplexity-web",
  "blackbox-web",
  "muse-spark-web",
  "deepseek-web",
  "inner-ai",
  "qoder",
  "command-code",
  "azure",
  "cloudflare-ai",
]);

export function supportsBulkApiKey(providerId: unknown): boolean {
  if (typeof providerId !== "string" || !providerId) return false;
  if (BULK_API_KEY_EXCLUDED.has(providerId)) return false;
  if (isLocalProvider(providerId)) return false;
  if (isSelfHostedChatProvider(providerId)) return false;
  if (isClaudeCodeCompatibleProvider(providerId)) return false;
  return true;
}

// ── System Providers (virtual, not user-connectable) ──────────────────────────
export const SYSTEM_PROVIDERS = {
  auto: {
    id: "auto",
    alias: "auto",
    name: "Auto (Zero-Config)",
    icon: "auto_awesome",
    color: "#6366F1",
    textIcon: "Auto",
    systemOnly: true,
    description: "Zero-config auto-routing with LKGP across all connected providers",
  },
};

const _PROVIDER_SECTIONS = [
  NOAUTH_PROVIDERS,
  OAUTH_PROVIDERS,
  APIKEY_PROVIDERS,
  WEB_COOKIE_PROVIDERS,
  LOCAL_PROVIDERS,
  SEARCH_PROVIDERS,
  AUDIO_ONLY_PROVIDERS,
  UPSTREAM_PROXY_PROVIDERS,
  CLOUD_AGENT_PROVIDERS,
  SYSTEM_PROVIDERS,
] as const;

let _aiProviders: Record<string, any> | null = null;

function getOrCreateAiProviders(): Record<string, any> {
  if (!_aiProviders) {
    _aiProviders = {};
    for (const section of _PROVIDER_SECTIONS) {
      Object.assign(_aiProviders, section);
    }
  }
  return _aiProviders;
}

let _ALIAS_TO_ID: Record<string, string> | null = null;

function getOrCreateAliasToId(): Record<string, string> {
  if (!_ALIAS_TO_ID) {
    _ALIAS_TO_ID = {};
    for (const section of _PROVIDER_SECTIONS) {
      for (const p of Object.values(section)) {
        if ((p as any).alias) _ALIAS_TO_ID[(p as any).alias] = (p as any).id;
      }
    }
  }
  return _ALIAS_TO_ID;
}

let _ID_TO_ALIAS: Record<string, string> | null = null;

function getOrCreateIdToAlias(): Record<string, string> {
  if (!_ID_TO_ALIAS) {
    _ID_TO_ALIAS = {};
    for (const section of _PROVIDER_SECTIONS) {
      for (const p of Object.values(section)) {
        _ID_TO_ALIAS[(p as any).id] = (p as any).alias || (p as any).id;
      }
    }
  }
  return _ID_TO_ALIAS;
}

export function getProviderById(id: string) {
  return (
    (NOAUTH_PROVIDERS as Record<string, any>)[id] ??
    (OAUTH_PROVIDERS as Record<string, any>)[id] ??
    (APIKEY_PROVIDERS as Record<string, any>)[id] ??
    (WEB_COOKIE_PROVIDERS as Record<string, any>)[id] ??
    (LOCAL_PROVIDERS as Record<string, any>)[id] ??
    (SEARCH_PROVIDERS as Record<string, any>)[id] ??
    (AUDIO_ONLY_PROVIDERS as Record<string, any>)[id] ??
    (UPSTREAM_PROXY_PROVIDERS as Record<string, any>)[id] ??
    (CLOUD_AGENT_PROVIDERS as Record<string, any>)[id] ??
    (SYSTEM_PROVIDERS as Record<string, any>)[id] ??
    undefined
  );
}

export const AI_PROVIDERS = new Proxy({} as Record<string, any>, {
  get(_, key) {
    if (key === "then") return undefined;
    return typeof key === "string" ? getOrCreateAiProviders()[key] : undefined;
  },
  ownKeys() {
    return Reflect.ownKeys(getOrCreateAiProviders());
  },
  has(_, key) {
    return key in getOrCreateAiProviders();
  },
  getOwnPropertyDescriptor(_, key) {
    const obj = getOrCreateAiProviders();
    if (typeof key === "string" && key in obj) {
      return { configurable: true, enumerable: true, value: obj[key] };
    }
    return undefined;
  },
});

export type AiProviderId =
  | keyof typeof NOAUTH_PROVIDERS
  | keyof typeof OAUTH_PROVIDERS
  | keyof typeof APIKEY_PROVIDERS
  | keyof typeof WEB_COOKIE_PROVIDERS
  | keyof typeof LOCAL_PROVIDERS
  | keyof typeof SEARCH_PROVIDERS
  | keyof typeof AUDIO_ONLY_PROVIDERS
  | keyof typeof UPSTREAM_PROXY_PROVIDERS
  | keyof typeof CLOUD_AGENT_PROVIDERS
  | keyof typeof SYSTEM_PROVIDERS;

export type AiProviderDefinition =
  | (typeof NOAUTH_PROVIDERS)[keyof typeof NOAUTH_PROVIDERS]
  | (typeof OAUTH_PROVIDERS)[keyof typeof OAUTH_PROVIDERS]
  | (typeof APIKEY_PROVIDERS)[keyof typeof APIKEY_PROVIDERS]
  | (typeof WEB_COOKIE_PROVIDERS)[keyof typeof WEB_COOKIE_PROVIDERS]
  | (typeof LOCAL_PROVIDERS)[keyof typeof LOCAL_PROVIDERS]
  | (typeof SEARCH_PROVIDERS)[keyof typeof SEARCH_PROVIDERS]
  | (typeof AUDIO_ONLY_PROVIDERS)[keyof typeof AUDIO_ONLY_PROVIDERS]
  | (typeof UPSTREAM_PROXY_PROVIDERS)[keyof typeof UPSTREAM_PROXY_PROVIDERS]
  | (typeof CLOUD_AGENT_PROVIDERS)[keyof typeof CLOUD_AGENT_PROVIDERS]
  | (typeof SYSTEM_PROVIDERS)[keyof typeof SYSTEM_PROVIDERS];

// Auth methods
export const AUTH_METHODS = {
  oauth: { id: "oauth", name: "OAuth", icon: "lock" },
  apikey: { id: "apikey", name: "API Key", icon: "key" },
};

export function getProviderByAlias(alias: string): AiProviderDefinition | null {
  for (const section of _PROVIDER_SECTIONS) {
    for (const provider of Object.values(section)) {
      if (provider.alias === alias || provider.id === alias) {
        return provider as AiProviderDefinition;
      }
    }
  }
  return null;
}

// Helper: Get provider ID from alias
export function resolveProviderId(aliasOrId: string): string {
  const provider = getProviderByAlias(aliasOrId);
  return provider?.id || aliasOrId;
}

export function getProviderAlias(providerId: string): string {
  const provider = getProviderById(providerId);
  return provider?.alias || providerId;
}

export const ALIAS_TO_ID = new Proxy({} as Record<string, string>, {
  get(_, key) {
    return typeof key === "string" ? getOrCreateAliasToId()[key] : undefined;
  },
  ownKeys() {
    return Reflect.ownKeys(getOrCreateAliasToId());
  },
  has(_, key) {
    return key in getOrCreateAliasToId();
  },
  getOwnPropertyDescriptor(_, key) {
    const obj = getOrCreateAliasToId();
    if (typeof key === "string" && key in obj) {
      return { configurable: true, enumerable: true, value: obj[key] };
    }
    return undefined;
  },
});

export const ID_TO_ALIAS = new Proxy({} as Record<string, string>, {
  get(_, key) {
    return typeof key === "string" ? getOrCreateIdToAlias()[key] : undefined;
  },
  ownKeys() {
    return Reflect.ownKeys(getOrCreateIdToAlias());
  },
  has(_, key) {
    return key in getOrCreateIdToAlias();
  },
  getOwnPropertyDescriptor(_, key) {
    const obj = getOrCreateIdToAlias();
    if (typeof key === "string" && key in obj) {
      return { configurable: true, enumerable: true, value: obj[key] };
    }
    return undefined;
  },
});

// Providers that support usage/quota API
export const USAGE_SUPPORTED_PROVIDERS = [
  "antigravity",
  "agy",
  "gemini-cli",
  "kiro",
  "amazon-q",
  "github",
  "codex",
  "claude",
  "cursor",
  "kimi-coding",
  "glm",
  "glm-cn",
  "zai",
  "glmt",
  "opencode-go",
  "minimax",
  "minimax-cn",
  "crof",
  "nanogpt",
  "deepseek",
  "xiaomi-mimo",
  "vertex",
  "vertex-partner",
];

// ── Zod validation at module load (Phase 7.2) ──
import { validateProviders } from "../validation/providerSchema";

validateProviders(NOAUTH_PROVIDERS, "NOAUTH_PROVIDERS");
validateProviders(OAUTH_PROVIDERS, "OAUTH_PROVIDERS");
validateProviders(APIKEY_PROVIDERS, "APIKEY_PROVIDERS");
validateProviders(WEB_COOKIE_PROVIDERS, "WEB_COOKIE_PROVIDERS");
validateProviders(LOCAL_PROVIDERS, "LOCAL_PROVIDERS");
validateProviders(SEARCH_PROVIDERS, "SEARCH_PROVIDERS");
validateProviders(AUDIO_ONLY_PROVIDERS, "AUDIO_ONLY_PROVIDERS");
validateProviders(UPSTREAM_PROXY_PROVIDERS, "UPSTREAM_PROXY_PROVIDERS");
validateProviders(CLOUD_AGENT_PROVIDERS, "CLOUD_AGENT_PROVIDERS");
