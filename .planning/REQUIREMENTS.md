# Requirements -- harness-evolve

## Core Value

Make Claude Code harnesses self-improving without manual analysis -- now with intelligent, model-driven config analysis.

---

## v4.0 Requirements

### Bug 修复与基础设施 (INFRA)

- [x] **INFRA-01**: context-builder 正确解析 Claude Code 嵌套 hooks 格式 `{matcher, hooks: [{type, command}]}`，扫描真实用户配置零误报
- [ ] **INFRA-02**: `harness-evolve scan-context` CLI 子命令输出结构化 JSON 配置上下文，供用户模型直接消费
- [ ] **INFRA-03**: `harness-evolve store-findings` CLI 子命令接收模型生成的 findings 并持久化到 apply 管道，通过 Recommendation schema 验证
- [ ] **INFRA-04**: 用户首次安装后无需手动运行 `harness-evolve init` 即可使用斜杠命令，或 init 流程有明确的自动化引导

### Scanner 架构 (SCAN)

- [ ] **SCAN-01**: `/evolve:scan` 模板包含完整的分析指导文档，指导用户当前模型执行配置审查（而非展示 CLI 预计算结果）
- [ ] **SCAN-02**: 指导文档定义 7 个分析领域的检查清单、严重性分类规则、输出格式规范和边界条件
- [x] **SCAN-03**: 模型驱动方案验证通过后，移除 7 个旧 TypeScript scanner 函数及相关代码

### 模型驱动能力 (MODEL)

- [x] **MODEL-01**: 模型能检测语义级配置冲突（如"use ESM" vs "use CommonJS"），不依赖正则模式匹配
- [x] **MODEL-02**: 模型能评估 CLAUDE.md + rules + settings + commands 的跨文件一致性，发现矛盾或冗余
- [x] **MODEL-03**: 模型能用任意自然语言措辞识别可 hook 化的操作，不限于固定关键词
- [x] **MODEL-04**: 用户通过编辑指导文档 .md 即可添加新的扫描领域，无需修改 TypeScript 代码

### 生态学习 (ECO)

- [ ] **ECO-01**: 逆向分析 GSD 的 workflow .md 行为规范模式，将适用的结构化约束模式应用到 scan/apply 模板
- [ ] **ECO-02**: 研究同类优秀开源项目，提取并采纳至少 3 个适合 harness-evolve 的设计模式或功能

---

## v3.0 Requirements (Completed)

### Bug Fixes (v2.0 dogfooding)

- [x] **FIX-01**: 斜杠命令安装到全局 `~/.claude/commands/evolve/` -- Validated in Phase 17
- [x] **FIX-02**: Stale reference scanner 过滤 npm scoped 包名和 URL 用户路径 -- Validated in Phase 17
- [x] **FIX-03**: `apply-one` 跳过 confidence 门槛 -- Validated in Phase 17
- [x] **FIX-04**: Stop hook 自动设置通知标记 -- Validated in Phase 17

### Config Audit

- [x] **AUD-01**: Scanner 全面分析配置质量 -- Validated in Phase 18
- [x] **AUD-02**: 审计输出包含具体优化建议和预期效果 -- Validated in Phase 18
- [x] **AUD-03**: 结果区分问题和优化建议 -- Validated in Phase 18

### Workflow Docs

- [x] **WFL-01**: 每个斜杠命令有 workflow .md 文档 -- Validated in Phase 19
- [x] **WFL-02**: Workflow 通过模板自动注入 -- Validated in Phase 19

---

## Future Requirements (v5.0+)

- 跨项目模式聚合（用户级别而非项目级别）
- 配置健康评分（0-100 分 + Top 3 改进项）
- 漂移检测（已应用推荐被撤回时告警）
- 社区共享路由规则市场

---

## Out of Scope

- Web 可视化仪表盘 -- CLI-native 定位不变
- 直接调用 Anthropic API -- harness-evolve 不调用 API，由用户的 Claude Code session 提供模型
- 支持非 Claude Code 的 AI coding agents -- Claude Code 专用
- NLP 库做语义分析 -- 模型本身就是 NLP 引擎

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| FIX-01 | Phase 17 | Complete |
| FIX-02 | Phase 17 | Complete |
| FIX-03 | Phase 17 | Complete |
| FIX-04 | Phase 17 | Complete |
| AUD-01 | Phase 18 | Complete |
| AUD-02 | Phase 18 | Complete |
| AUD-03 | Phase 18 | Complete |
| WFL-01 | Phase 19 | Complete |
| WFL-02 | Phase 19 | Complete |
| INFRA-01 | Phase 21 | Complete |
| INFRA-02 | Phase 21 | Pending |
| INFRA-03 | Phase 21 | Pending |
| INFRA-04 | Phase 21 | Pending |
| SCAN-01 | Phase 22 | Pending |
| SCAN-02 | Phase 22 | Pending |
| SCAN-03 | Phase 23 | Complete |
| MODEL-01 | Phase 23 | Complete |
| MODEL-02 | Phase 23 | Complete |
| MODEL-03 | Phase 23 | Complete |
| MODEL-04 | Phase 23 | Complete |
| ECO-01 | Phase 22 | Pending |
| ECO-02 | Phase 22 | Pending |

---
*Last updated: 2026-04-06 -- v4.0 roadmap created, all 13 requirements mapped to phases 21-23*
