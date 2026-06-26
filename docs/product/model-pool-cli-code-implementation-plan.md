# 模型池与 Cli-code 简化接入开发落地计划

## 背景

当前项目已经具备将 Claude Code、Claude Desktop、Codex CLI、Codex Desktop 接入
AnyRoute 的基础能力，但用户在接入时仍会看到较多工程概念，例如 provider alias、
`alias/model`、`wire_api`、多模型映射、Gateway URL、API Key 选择等。

本计划的目标是将第一版产品心智收敛为：

> 一个路由连接接入一个渠道模型池。用户只填写渠道的 `baseURL` 和 `key`，系统自动识别
> 协议、发现模型、归类到统一模型池；用户配置 Claude 或 Codex 时，只需要从模型池中
> 选择归类后的模型，系统负责协议适配、配置写入、备份和可用性验证。

## 已验证的当前能力

以下能力已在当前分支源码中存在，后续开发应复用，不应另起一套并行体系：

- `Dashboard > Cli-code` 入口已存在，详情页由
  `src/app/(dashboard)/dashboard/cli-code/components/ToolDetailClient.tsx` 分发到不同工具卡片。
- 详情页当前会读取 `/api/providers`、`/api/cli-tools/keys`、`/v1/models`、
  `/api/provider-nodes`，并生成工具卡片可用的模型列表。
- Claude Code 配置写入由 `/api/cli-tools/claude-settings` 处理，写入
  `~/.claude/settings.json`，并已有备份和恢复逻辑。
- Codex CLI / Codex Desktop 配置写入由 `/api/cli-tools/codex-settings` 处理，写入
  `~/.codex/config.toml` 和必要的认证信息，并已有备份和恢复逻辑。
- Claude Desktop 配置写入由 `/api/cli-tools/claude-desktop-settings` 处理，走 3P Gateway
  profile。
- `/api/provider-nodes/validate` 已包含 OpenAI 兼容、Claude 兼容、Claude Code Compatible
  等连接探测逻辑。
- `src/lib/api/modelTestRunner.ts` 已存在模型真实请求测试能力，可作为写入后验证的基础。

## 第一版不做的事情

为保证第一版闭环足够轻，以下能力不进入首版主流程：

- OAuth 登录。
- 导入 Claude、Codex、Gemini 等本机账号。
- 扫描本机已有上游账号配置。
- 让用户手动选择 provider 类型作为默认流程。
- 让用户理解或手动编辑 `alias/model`。
- 默认展示 `wire_api`、`notice.model_migrations`、Claude 多 env 映射等高级配置。
- 做复杂成本优化、跨渠道评分、预算策略、账号级调度 UI。

这些能力可以保留在高级模式或后续版本中，但不能干扰第一版的主路径。

## 核心概念

### 路由连接

路由连接是用户添加的一个上游渠道入口。首版表单只保留两个必填字段：

- `baseURL`
- `key`

系统保存路由连接时自动完成：

- baseURL 清洗。
- 协议识别。
- 模型发现。
- 初步连通性验证。
- 将模型来源写入统一模型池。

### 模型池

模型池是面向用户的模型选择层。它不是简单地展示上游返回的原始模型 ID，而是将不同渠道、
不同协议、不同原始 ID 归类成用户能理解的模型项。

示例：

- `Claude Sonnet`
- `Claude Opus`
- `GPT Codex`
- `GPT`
- `DeepSeek`
- `Qwen Coder`
- `Kimi`
- `GLM`
- `其他模型`

每个模型池条目内部可以挂多个来源。用户默认只看到归类模型，详情或高级模式中再显示：

- 来源路由连接。
- 原始模型 ID。
- 支持的协议能力。
- 最后验证时间。
- 可用状态。
- 最近失败原因。

### 客户端接入

客户端接入仍使用当前 `Dashboard > Cli-code` 页面，不改成复制配置。

用户在 Claude 或 Codex 详情页只需要：

1. 查看本机客户端状态。
2. 从模型池选择模型。
3. 点击一键写入。
4. 等待系统验证。

系统负责：

- 自动选择 AnyRoute 本地 base URL。
- 自动选择或创建可用 API Key。
- 自动选择协议适配方式。
- 自动写入客户端配置。
- 自动备份旧配置。
- 自动验证目标客户端链路。

## 用户主流程

### 添加路由连接

1. 用户进入渠道接入页面。
2. 点击添加路由连接。
3. 输入 `baseURL` 和 `key`。
4. 系统自动识别渠道能力。
5. 系统展示识别结果：
   - 识别到的协议能力。
   - 发现的模型数量。
   - 可用模型分类。
   - 失败或警告原因。
6. 用户确认保存。
7. 模型进入统一模型池。

成功标准：

- 用户不需要选择 OpenAI 兼容还是 Claude 兼容。
- 用户不需要理解 `/v1/models`、`/chat/completions`、`/responses`、`/messages`。
- 识别失败时给出具体原因，而不是只显示保存失败。

### 配置 Claude Code

1. 用户进入 `Dashboard > Cli-code > Claude Code`。
2. 页面显示 Claude Code 是否安装、是否可运行、是否已接入 AnyRoute。
3. 用户选择主模型。
4. 用户可选快速模型。
5. 点击一键写入。
6. 系统写入 `~/.claude/settings.json`。
7. 系统验证 Claude 协议链路。
8. 页面显示可用、部分可用或不可用。

成功标准：

- 默认流程不展示 `ANTHROPIC_BASE_URL`、`ANTHROPIC_AUTH_TOKEN`、多 env 映射。
- 写入前自动备份。
- 写入后可以恢复。
- 如果模型不适合 Claude Code，写入后验证必须明确提示不可用或部分可用，不能静默标记成功。

### 配置 Claude Desktop

1. 用户进入 `Dashboard > Cli-code > Claude Desktop`。
2. 页面显示当前平台是否支持自动写入。
3. 用户从模型池选择目标模型。
4. 点击写入 Claude Desktop。
5. 系统写入 3P Gateway profile。
6. 系统验证 Gateway 链路。
7. 页面提示是否需要重启 Claude Desktop。

成功标准：

- 默认流程不展示 Gateway URL、API Key、三行模型映射。
- 不支持的平台给出明确说明。
- 写入失败时不破坏旧配置。

### 配置 Codex CLI / Codex Desktop

1. 用户进入对应工具详情页。
2. 页面显示 Codex 状态和当前接入状态。
3. 用户从模型池选择目标模型。
4. 点击一键写入。
5. 系统自动决定 Chat Completions 或 Responses 链路。
6. 系统写入 `~/.codex/config.toml`，必要时处理认证信息。
7. 系统验证 Codex 链路。

成功标准：

- 默认流程不展示 `wire_api`。
- 默认不覆盖用户已有 Codex 官方登录。
- Codex Desktop 和 Codex CLI 共用配置时，写入逻辑不能互相破坏。
- 如果 Responses 不可用但 Chat Completions 可用，系统能给出清晰状态。

## 开发阶段

### 阶段一：路由连接自动识别

目标：用户添加渠道时只填写 `baseURL + key`。

开发任务：

1. 收敛添加路由连接主表单，只保留 `baseURL` 和 `key`。
2. 复用现有 `/api/provider-nodes/validate` 的探测逻辑，补齐自动识别策略。
3. 清洗常见错误 baseURL：
   - 末尾带 `/models`。
   - 末尾带 `/chat/completions`。
   - 末尾带 `/responses`。
   - 末尾带 `/messages`。
   - 重复带 `/v1`。
4. 探测能力至少覆盖：
   - OpenAI models。
   - OpenAI Chat Completions。
   - OpenAI Responses。
   - Claude Messages。
   - Claude Code Compatible。
5. 保存识别结果和发现的模型。

验收：

- new-api 类渠道可以只填 `baseURL + key` 完成保存。
- sub2api 类渠道可以只填 `baseURL + key` 完成保存。
- Claude 兼容渠道无需用户手动选择类型。
- 错误 key、错误路径、网络不可达有明确错误分类。

### 阶段二：统一模型池

目标：把渠道模型归类成用户可选择的大池子。

开发任务：

1. 引入模型池数据结构。
2. 将路由连接发现的模型归入模型池。
3. 对同类模型做归并。
4. 为模型池条目维护来源列表。
5. 为模型池条目维护能力标记：
   - OpenAI Chat 可用。
   - OpenAI Responses 可用。
   - Claude Messages 可用。
   - Streaming 可用。
   - Tools 可用。
6. 设计模型池选择器，默认展示归类名称，不展示 `alias/model`。

验收：

- 多个渠道都有同类模型时，用户默认只看到一个归类模型。
- 模型详情能看到来源渠道和原始模型 ID。
- Claude / Codex 页面默认展示统一模型池，系统通过能力标记和写入后验证提示是否适配成功。

### 阶段三：改造 Cli-code 默认模式

目标：保留当前直接写配置能力，将默认 UI 从配置表单改成接入向导。

开发任务：

1. `Cli-code` 首页突出四个主工具：
   - Claude Code。
   - Claude Desktop。
   - Codex CLI。
   - Codex Desktop。
2. 工具详情页默认展示：
   - 本机状态。
   - 当前配置状态。
   - 模型池选择。
   - 一键写入。
   - 写后验证结果。
   - 恢复配置。
3. 将现有配置字段移动到高级模式。
4. Claude Code 默认只选择主模型和快速模型。
5. Claude Desktop 默认只选择目标 Claude 模型。
6. Codex 默认只选择目标模型。
7. API Key 选择默认隐藏，系统自动选择或创建。

验收：

- 新用户不需要理解 base URL、API Key、wire API、模型迁移表。
- 老用户仍可在高级模式中找到原有能力。
- 写入前后配置备份和恢复能力不退化。

### 阶段四：写入后验证

目标：把“写入成功”升级为“客户端链路可用”。

开发任务：

1. 复用 `src/lib/api/modelTestRunner.ts` 的模型真实请求能力。
2. 为 Claude 接入增加 Claude 协议最小验证。
3. 为 Codex 接入增加 Chat Completions 和 Responses 验证。
4. 增加 Streaming 轻量验证。
5. 增加 Tools 轻量验证。
6. 将验证结果写回模型池来源状态。
7. 在 Cli-code 页面展示验证结论。

验收：

- 写入 Claude Code 后能验证 Claude 侧链路是否可用。
- 写入 Codex 后能验证 Responses 或 Chat Completions 至少一种链路是否可用。
- 验证失败时能说明失败发生在模型池、AnyRoute 协议适配、上游渠道或本机客户端配置哪一层。

### 阶段五：高级模式与兼容迁移

目标：不破坏已有用户配置，同时让高级用户仍能控制细节。

开发任务：

1. 将现有高级配置折叠到高级模式：
   - 手动 base URL。
   - 手动 API Key。
   - Claude 多 env 模型映射。
   - Codex `wire_api`。
   - Codex reasoning effort。
   - Codex 模型迁移。
   - 手动配置文本。
   - profile 管理。
   - backup 详情。
2. 读取旧配置时尽量映射回模型池条目。
3. 旧配置无法映射时显示为自定义模型，但不强制覆盖。
4. 保留恢复旧配置入口。

验收：

- 已配置过 Claude / Codex 的用户升级后不丢配置。
- 旧 `alias/model` 配置能尽量映射到模型池。
- 无法识别的旧模型仍能保留和显示。

## 数据与状态设计

第一版建议维护四类状态。

### 路由连接状态

字段职责：

- 原始 baseURL。
- 清洗后的 baseURL。
- key 的安全引用。
- 自动识别出的协议能力。
- 最近检测时间。
- 最近检测结果。
- 最近错误原因。

### 模型来源状态

字段职责：

- 所属路由连接。
- 原始模型 ID。
- 归类后的模型池 ID。
- 支持的协议能力。
- 验证状态。
- 最近成功时间。
- 最近失败时间。
- 最近失败原因。

### 模型池条目状态

字段职责：

- 展示名称。
- 模型家族。
- 推荐用途。
- 可用于 Claude。
- 可用于 Codex。
- 来源列表。
- 默认来源选择策略。

### 客户端接入状态

字段职责：

- 工具 ID。
- 本机安装状态。
- 当前配置状态。
- 当前选择的模型池条目。
- 写入时间。
- 备份 ID。
- 验证结果。

## 失败分类

错误提示需要面向用户，而不是只暴露底层异常。

首版至少需要分类：

- baseURL 无法访问。
- key 无效。
- 没有发现模型。
- `/models` 可用但真实请求不可用。
- 模型不存在。
- 上游不支持 Claude 协议。
- 上游不支持 Responses。
- 上游不支持工具调用。
- 上游不支持流式输出。
- 上游限流。
- 本机客户端未安装。
- 本机客户端不可运行。
- 配置文件写入被系统禁止。
- 配置写入成功但需要重启客户端。

## 边界情况

实现时必须覆盖以下情况：

- 用户输入的 baseURL 已经包含具体 endpoint。
- 上游 `/models` 返回成功，但请求模型失败。
- 同一模型 ID 在不同渠道能力不一致。
- 同一渠道同时暴露 OpenAI 和 Claude 风格接口。
- 中转站返回模型名很混乱，无法可靠归类。
- 模型支持普通对话，但不支持工具调用。
- 模型支持非流式，但不支持流式。
- Responses 可用但 Chat Completions 不可用。
- Chat Completions 可用但 Responses 不可用。
- Claude Desktop 写入后需要重启。
- Codex CLI 和 Codex Desktop 共用同一个配置文件。
- 用户已有 Codex 官方登录，默认不能破坏。
- 用户删除某个路由连接后，模型池来源需要同步失效。
- 上游短期限流不能永久标记模型不可用。

## 最小可交付版本

第一版最小闭环如下：

1. 添加路由连接，只填 `baseURL + key`。
2. 系统自动识别协议并发现模型。
3. 模型进入统一模型池。
4. Claude Code 从模型池选择主模型和快速模型。
5. Codex Desktop 从模型池选择目标模型。
6. 系统一键写入配置。
7. 系统自动备份。
8. 系统写入后验证。
9. 页面显示可用、部分可用或不可用。
10. 用户可以恢复旧配置。

Claude Desktop、Codex CLI、多来源自动优选、健康评分可以作为第一版后的增强项，但不应阻塞
上述闭环。

## 推荐实施顺序

1. 先完成路由连接自动识别。
2. 再完成模型池数据归类。
3. 再改造 Claude Code 默认模式。
4. 再改造 Codex Desktop 默认模式。
5. 再补写入后验证。
6. 最后收纳高级模式和旧配置迁移。

这样可以每一步都有可验证产物，避免一开始就同时改渠道、模型、Cli-code 和验证链路。

## 验收清单

- 用户能用 new-api 地址和 key 完成路由连接添加。
- 用户能用 sub2api 地址和 key 完成路由连接添加。
- 用户能看到归类后的模型池，而不是默认看到 `alias/model`。
- 用户能在 Claude Code 页面选择模型并一键写入。
- 用户能在 Codex Desktop 页面选择模型并一键写入。
- 写入前有备份。
- 写入后有验证。
- 验证失败有可理解原因。
- 高级模式仍保留现有配置能力。
- 旧配置不会被无提示覆盖。
