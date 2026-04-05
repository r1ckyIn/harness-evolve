# Requirements — harness-evolve v3.0

## Core Value

Make Claude Code harnesses self-improving without manual analysis — now reliable, accurate, and globally accessible.

---

## v3.0 Requirements

### Bug Fixes (v2.0 dogfooding)

- [x] **FIX-01**: 斜杠命令安装到全局 `~/.claude/commands/evolve/` 而非项目级 `.claude/commands/evolve/`，确保在任何目录启动的 Claude Code session 都能使用 `/evolve:scan` 和 `/evolve:apply` -- Validated in Phase 17 Plan 01
- [x] **FIX-02**: Stale reference scanner 过滤 npm scoped 包名（`@scope/package`）和 URL 中的用户路径（`@user/path`），只对真实的 Claude Code 文件引用（`@docs/xxx.md`）报告 stale reference -- Validated in Phase 17 Plan 01
- [x] **FIX-03**: `apply-one` CLI 子命令在用户主动选择应用时跳过 confidence 门槛检查，不再限制为 HIGH-only -- Validated in Phase 17 Plan 02
- [x] **FIX-04**: Stop hook 分析完成后自动设置通知标记（`has-pending-notifications`），下次 UserPromptSubmit 时通知用户，不再依赖用户手动运行 `/evolve` -- Validated in Phase 17 Plan 02

### Config Audit (全面配置审计)

- [x] **AUD-01**: Scanner 全面分析 Claude Code 配置质量：CLAUDE.md 规则冲突检测、rules 目录结构审计、settings.json hooks 冗余分析、commands 目录规范检查
- [ ] **AUD-02**: 配置审计输出包含具体的优化建议和预期效果，用户确认后才应用变更
- [x] **AUD-03**: Scanner 结果区分 "问题"（需要修复）和 "优化建议"（可选改进），不混为一谈

### Workflow Docs (GSD 风格命令规范)

- [ ] **WFL-01**: 每个斜杠命令（/evolve:scan、/evolve:apply）有对应的 workflow .md 文档，完整定义 Claude 的行为流程，解决上下文污染问题
- [ ] **WFL-02**: Workflow 文档通过斜杠命令模板自动注入 Claude 上下文，而非依赖 CLAUDE.md 预加载

---

## Future Requirements (v4.0+)

- 跨项目模式聚合（用户级别而非项目级别）
- 配置健康评分（0-100 分 + Top 3 改进项）
- 漂移检测（已应用推荐被撤回时告警）
- 社区共享路由规则市场

---

## Out of Scope

- Web 可视化仪表盘 — CLI-native 定位不变
- 新分类器（语义相似度、提示词聚类）— 先修好现有功能
- 多语言推荐文本 — 英文优先
- 支持非 Claude Code 的 AI coding agents — Claude Code 专用

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| FIX-01 | Phase 17 | Complete |
| FIX-02 | Phase 17 | Complete |
| FIX-03 | Phase 17 | Complete |
| FIX-04 | Phase 17 | Complete |
| AUD-01 | Phase 18 | Planned |
| AUD-02 | Phase 18 | Planned |
| AUD-03 | Phase 18 | Planned |
| WFL-01 | Phase 19 | Planned |
| WFL-02 | Phase 19 | Planned |

---
*Last updated: 2026-04-05 — All FIX-01 through FIX-04 completed in Phase 17*
