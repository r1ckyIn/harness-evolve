# Requirements — harness-evolve v2.0

## Core Value

Make Claude Code harnesses self-improving without manual analysis — now with Day 0 value and full auto-generation.

---

## v2.0 Requirements

### Deep Scan (初始化深度配置扫描)

- [x] **SCN-01**: `harness-evolve init` 扫描用户现有的 CLAUDE.md、.claude/rules/、settings.json、.claude/commands/ 配置，生成配置质量报告
- [x] **SCN-02**: 深度扫描检测冗余规则（多个文件定义相同约束）、缺失机械化（应为 hook 但写在 rules 里的操作）、过时配置（引用不存在的文件或命令）
- [x] **SCN-03**: 扫描结果以结构化推荐输出，复用现有 recommendation 格式和 delivery pipeline
- [ ] **SCN-04**: `/evolve:scan` 斜杠命令支持随时手动触发深度扫描（不限于 init 时）

### Auto-Generation (自动生成能力)

- [ ] **GEN-01**: 检测到重复长提示词模式时，自动生成 `.claude/commands/<name>.md` skill 文件草稿
- [x] **GEN-02**: 检测到应机械化的操作模式时，自动生成 hook 脚本草稿（shell command 类型）
- [x] **GEN-03**: 检测到项目级配置建议时，自动生成 CLAUDE.md 补丁（diff 格式，用户确认后应用）
- [ ] **GEN-04**: HOOK auto-applier 注册到策略模式 applier registry，HIGH 置信度推荐可自动应用
- [ ] **GEN-05**: CLAUDE_MD auto-applier 注册到策略模式 applier registry，HIGH 置信度推荐可自动应用

### Slash Commands (斜杠命令体系)

- [ ] **CMD-01**: `harness-evolve init` 安装 `/evolve:scan`、`/evolve:apply` 等斜杠命令到项目的 `.claude/commands/` 目录
- [ ] **CMD-02**: `/evolve:apply` 逐条展示待处理推荐，用户选择应用/跳过/永久忽略
- [ ] **CMD-03**: `harness-evolve uninstall` 同时清理安装的斜杠命令文件

### UX Polish (体验优化)

- [ ] **UX-01**: 分析完成后下次 UserPromptSubmit 时简洁通知（"发现 N 条新建议，/evolve:apply 查看"），不再灌长文本
- [ ] **UX-02**: `harness-evolve init` 每个 hook 旁显示一句话用途说明
- [ ] **UX-03**: 推荐按影响度排序（HIGH 在前），不再平铺

---

## Future Requirements (v3.0+)

- 跨项目模式聚合（用户级别而非项目级别）
- 配置健康评分（0-100 分 + Top 3 改进项）
- 漂移检测（已应用推荐被撤回时告警）
- Hook 跨 Claude Code 版本可靠性测试套件
- 社区共享路由规则市场
- 插件格式分发（.claude-plugin/）

---

## Out of Scope

- Web 可视化仪表盘 — CLI-native 定位不变
- 新分类器（语义相似度、提示词聚类）— 先补全现有分类器的自动应用闭环
- 跨项目聚合 — 延迟到 v3.0，先做好单项目体验
- 多语言推荐文本 — 英文优先，用户群体为开发者

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SCN-01 | Phase 12 | Planned |
| SCN-02 | Phase 12 | Planned |
| SCN-03 | Phase 12 | Planned |
| SCN-04 | Phase 15 | Planned |
| GEN-01 | Phase 13 | Planned |
| GEN-02 | Phase 13 | Planned |
| GEN-03 | Phase 13 | Planned |
| GEN-04 | Phase 14 | Planned |
| GEN-05 | Phase 14 | Planned |
| CMD-01 | Phase 15 | Planned |
| CMD-02 | Phase 15 | Planned |
| CMD-03 | Phase 15 | Planned |
| UX-01 | Phase 16 | Planned |
| UX-02 | Phase 16 | Planned |
| UX-03 | Phase 16 | Planned |

---
*Last updated: 2026-04-04 — v2.0 roadmap created, all 15 requirements mapped*
