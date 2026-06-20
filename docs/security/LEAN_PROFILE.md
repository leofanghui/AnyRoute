# Lean Profile（chat-only 路由器主线模式）

> 通过 `OMNIROUTE_LEAN_MODE=1` 一键收敛到主线版本。所有旁支模块**源代码原样保留**，可通过反向操作恢复。
> 设计目标：本地路由器只做"连接所有 provider 的 chat 接口"这一件事。

## 启用

```bash
# 服务端
export OMNIROUTE_LEAN_MODE=1
# 浏览器端镜像（Dashboard 侧边栏读取）
export NEXT_PUBLIC_OMNIROUTE_LEAN_MODE=1
npm run dev
```

启动时 stderr 会出现 `[OmniRoute] LEAN MODE 已启用` banner。

## 主线包含

- **协议**：`/v1/chat/completions`、`/v1/messages`、`/v1/responses`、`/v1/completions`、`/v1/models`、`/v1/me`
- **鉴权**：完整 JWT + API Key + 注入守卫 + 速率限制（不降级）
- **管理**：`/api/auth`、`/api/init`、`/api/health`、`/api/monitoring`、`/api/providers`、`/api/keys`、`/api/models`、`/api/settings`、`/api/oauth`、`/api/admin`、`/api/internal`
- **Provider**：API Key 类（OpenAI / Anthropic API / DeepSeek API / Groq / Mistral / Together / Fireworks / OpenRouter / Cohere 等通过 DefaultExecutor）+ 专用 executor `bedrock` / `vertex` / `gemini-business` / `azure-openai` / `cloudflare-ai` + OAuth 类仅 **Codex / Claude**
- **combo 路由策略**：13 个非 web 依赖策略（priority / weighted / round-robin / fill-first / p2c / random / least-used / cost-optimized / reset-aware / reset-window / strict-random / auto / lkgp）
- **Dashboard**：home / endpoints / api-manager / providers / settings 一类核心入口

## 已被禁用

| 模块 | 启用方法 |
|---|---|
| 媒体类（image / video / audio / music / embeddings / rerank / moderations / files / batches / search） | `LEAN_ALLOWED_V1_SUBPATHS` 加该子路径 |
| 协议生态（MCP / A2A / ACP / Cloud Agents / Agent Skills / Skills / Plugins / Webhooks / Embedded Services） | `LEAN_ALLOWED_API_PREFIXES` 加该前缀 |
| 数据 / 智能（Memory / Notion / Obsidian / Gamification / Evals / Inspector / Tunnels / Copilot / 等） | 同上 |
| Web 派 + CLI 派 provider（54 家） | `LEAN_ALLOWED_EXECUTORS` 加该 executor key |
| combo 策略 `context-relay` / `context-optimized` | `LEAN_ALLOWED_ROUTING_STRATEGIES` 加该策略 |
| 旁支 Dashboard tab | 从 `LEAN_HIDDEN_SIDEBAR_ITEMS` 移除该 ID |

## 部分恢复示例 — 加回 MCP server

只需改一份配置：`src/lib/config/leanProfile.ts`。

```typescript
// 1) /api/mcp/* 不再返 410
export const LEAN_ALLOWED_API_PREFIXES = new Set([
  "v1", "auth", "init", "health", "monitoring",
  "providers", "keys", "models", "settings", "oauth",
  "admin", "internal",
  "mcp",  // ← 新增这一行
]);

// 2) Dashboard 侧边栏不再隐藏 MCP tab
//    把 "mcp" 这一行从下面的 Set 里删除/注释
export const LEAN_HIDDEN_SIDEBAR_ITEMS = new Set([
  /* …其他… */
  // "mcp",  ← 注释掉
]);
```

restart 后，`/api/mcp/*` 与侧边栏 MCP tab 在 lean 模式下也可见。

## 完整恢复

```bash
unset OMNIROUTE_LEAN_MODE
unset NEXT_PUBLIC_OMNIROUTE_LEAN_MODE
npm run dev
```

无需改任何代码——所有谓词函数在 `isLeanMode()` 返回 false 时直接放行，与 lean 模式从未存在过等价。

## 实现原理（5 个集中开关）

| 文件 | 职责 |
|---|---|
| `src/lib/config/leanProfile.ts` | 中心配置：5 个白名单 Set + 5 个谓词函数 + `isLeanMode()` |
| `src/lib/api/disabledRoute.ts` | `disabledRouteIfLean(req)` / `disabledV1RouteIfLean(req)` 短路 helper（返 410 + `X-Feature-Disabled: 1`） |
| `open-sse/executors/index.ts` | `getExecutor()` 在 lean 时对非白名单 key 回落到 `DefaultExecutor` |
| `src/shared/constants/routingStrategies.ts` | `normalizeRoutingStrategy()` 在 lean 时对非白名单策略回退到 `priority` |
| `src/shared/components/Sidebar.tsx` | 侧边栏在 lean 客户端合并 `LEAN_HIDDEN_SIDEBAR_ITEMS` 进隐藏集 |

## 新增非主线模块的开发约定

新加的旁支 API 路由 / dashboard tab / executor / combo 策略 / handler，应：

1. 路由层在 `GET/POST/PUT/PATCH/DELETE` 入口调用 `disabledRouteIfLean(request)` 或 `disabledV1RouteIfLean(request)`
2. 默认**不进** `LEAN_ALLOWED_*` 白名单
3. 在本文档"已被禁用"表追加一行说明

## 验证

启用 lean 后预期：

| 请求 | 状态码 |
|---|---|
| `POST /api/v1/chat/completions` | **200/400/401/422**（业务正常处理，不是 410） |
| `POST /api/v1/audio/speech` | **410** + `X-Feature-Disabled: 1` |
| `GET /api/memory` | **410** + `X-Feature-Disabled: 1` |
| `GET /api/mcp/tools` | **410** + `X-Feature-Disabled: 1` |
| `GET /api/health` | 200（主线保留） |
| `GET /api/providers` | 200（主线保留） |

关闭 lean 后所有 410 路由恢复正常业务行为。
