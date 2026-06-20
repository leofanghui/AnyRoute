# Lean Profile (chat-only) — 实施进度账本

Branch: `feat/lean-profile-chat-only` (base: origin/main)

## 任务进度

- Task 1: complete (commit de3cb51 — 空起点 chore)
- Task 2: complete (commit dfbb3e6 — leanProfile.ts 配置 + 5 谓词)
- Task 3: complete (commit e6eaaf1 — executor 注册过滤)
- Task 4: complete (commit 8cbb9de — disabledRoute 410 helper)
- Task 5: complete (commit 1de2565 — 18 个媒体 v1 路由挂守卫)
- Task 6: complete (commit ce2a665 — 308 个旁支 API 路由挂守卫)
- Task 7: complete (commit 9bb3379 — combo 策略 normalize 过滤)
- Task 8: complete (commit 33084b0 — 侧边栏隐藏集合并 + .env.example)
- Task 9: complete (commit 85ac41e — CLI banner + LEAN_PROFILE.md)
- Task 10: in progress — 验收 + PR

## 整体改动

- 9 commits
- 334 files changed, +2171/-9
- 新建：leanProfile.ts (168 行), disabledRoute.ts (61 行), LEAN_PROFILE.md (113 行)
- 改造 326 个 route.ts（机械加守卫）

## 与 plan 的偏离

- 跳过所有 *.test.ts 文件创建（用户明确要求）
- 跳过 typecheck:core / lint sanity check（无 node_modules）
- 跳过 CLAUDE.md 引用表更新（用户选择"跳过这步"）
- 全程使用 --no-verify（Husky 钩子在无 node_modules 环境下不可用）
- 任务 6 范围扩展：`/api/admin` 和 `/api/internal` 按用户选择保留（默认在 LEAN_ALLOWED_API_PREFIXES 白名单）

## 注意

- 未跑测试 = 功能正确性靠后续手动验证
- 不应跑 husky pre-commit/pre-push（用户授权 --no-verify 是有意识决策）
- 推荐先在主 checkout 装好 node_modules 再 npm run typecheck:core 验一次后再 push
