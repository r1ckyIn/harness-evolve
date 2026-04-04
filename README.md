<div align="center">

# harness-evolve

[![npm version](https://img.shields.io/npm/v/harness-evolve?style=flat-square)](https://www.npmjs.com/package/harness-evolve)
[![CI](https://img.shields.io/github/actions/workflow/status/r1ckyIn/harness-evolve/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/r1ckyIn/harness-evolve/actions/workflows/ci.yml)
[![Tests](https://img.shields.io/badge/Tests-336_passing-brightgreen?style=flat-square)](.)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**A self-iteration engine for Claude Code -- automatically detects usage patterns and routes optimization recommendations to the right configuration tool.**

[English](#english) | [中文](#中文)

</div>

---

## English

### Problem

Claude Code users accumulate inefficiencies over time -- typing the same commands repeatedly, approving the same tool permissions, and missing configuration optimizations. These patterns are invisible until you manually audit your workflow. harness-evolve makes the invisible visible by automatically detecting patterns and routing fixes to the right configuration target.

### Overview

harness-evolve observes how you interact with Claude Code, detects patterns, and outputs optimization recommendations routed to the most appropriate configuration tool -- hooks, skills, rules, CLAUDE.md, memory, settings, or permissions.

You shouldn't need to notice that you've typed the same command 20 times before creating a hook. The system surfaces that insight and suggests the fix.

### Installation

```bash
# Install from npm
npm install -g harness-evolve

# Or use locally in a project
npm install harness-evolve
```

### How It Works

```
Capture -> Store -> Pre-Process -> Classify -> Route -> Deliver -> Track Outcomes
```

1. **Capture** -- 5 lifecycle hooks silently record prompts, tool usage, permissions, and failures
2. **Store** -- JSONL logs with 14-pattern secret scrubbing and atomic counter
3. **Pre-Process** -- Cross-session aggregation compresses logs into <50KB summaries
4. **Classify** -- 8 classifiers detect patterns (repeated prompts, long workflows, permission habits, code corrections, personal info, config drift, ecosystem features, onboarding level)
5. **Route** -- Each pattern maps to the best config target via an extensible decision tree
6. **Deliver** -- Non-invasive notification + `/evolve` command + optional full-auto mode
7. **Track** -- Outcome tracking adjusts future recommendation confidence

### Routing Targets

| Pattern | Target | Example |
|---------|--------|---------|
| Same short command repeated 10+ times | **Hook** | Auto-create a shell hook |
| Long prompt (200+ words) repeated 3+ times | **Skill** | Suggest a reusable skill |
| Tool approved 15+ times across sessions | **Settings** | Add to `allowedTools` |
| Recurring code correction pattern | **Rule** | Create a `.claude/rules/` entry |
| Personal/contextual information | **Memory** | Suggest a memory entry |
| Project-level configuration pattern | **CLAUDE.md** | Update project CLAUDE.md |
| Config contradictions or redundancy | **Cleanup** | Flag drift for review |

### Key Features

- **Zero-config** -- works immediately with sensible defaults
- **Environment-agnostic** -- dynamically discovers installed tools (GSD, Cog, plugins) and adapts routing
- **Non-invasive** -- recommends at natural breakpoints, never interrupts active tasks
- **Full-auto mode** -- opt-in auto-apply for HIGH-confidence recommendations
- **Tiered onboarding** -- adapts to newcomers vs power users
- **Feedback loop** -- tracks whether recommendations persist or get reverted, adjusting future confidence
- **Secret scrubbing** -- 14-pattern detection ensures no sensitive data is logged

### Tech Stack

| Technology | Purpose |
|------------|---------|
| TypeScript 6.0 | Type safety with strict mode |
| Node.js 22 LTS | Runtime |
| Zod v4 | Schema validation (14x faster than v3) |
| tsup | Build & bundling |
| Vitest 4 | Testing framework |
| proper-lockfile | Cross-process file locking |

### Architecture

```
Claude Code Session
    |
    +-- 5 Lifecycle Hooks
    |       UserPromptSubmit, PreToolUse, PostToolUse
    |       PermissionRequest, Stop
    |
    +-- JSONL Event Store
    |       14-pattern secret scrubbing
    |       Atomic counter for ordering
    |       Cross-session aggregation -> <50KB summaries
    |
    +-- 8 Pattern Classifiers
    |       Repeated prompts, Long workflows
    |       Permission habits, Code corrections
    |       Personal info, Config drift
    |       Ecosystem features, Onboarding level
    |
    +-- Routing Decision Tree
    |       -> Hook, Skill, Rule, CLAUDE.md
    |       -> Memory, Settings, Permissions, Cleanup
    |
    +-- Delivery + Outcome Tracking
            Non-invasive notifications
            /evolve command
            Full-auto mode (opt-in)
```

### Quick Start

```bash
# Install globally
npm install -g harness-evolve

# Or clone for development
git clone git@github.com:r1ckyIn/harness-evolve.git
cd harness-evolve

# Install dependencies
npm install

# Build
npm run build

# Test
npm test
```

### Register Hooks

Add to your Claude Code `settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      { "type": "command", "command": "node /path/to/harness-evolve/dist/hooks/user-prompt-submit.js" }
    ],
    "PreToolUse": [
      { "type": "command", "command": "node /path/to/harness-evolve/dist/hooks/pre-tool-use.js" }
    ],
    "PostToolUse": [
      { "type": "command", "command": "node /path/to/harness-evolve/dist/hooks/post-tool-use.js" }
    ],
    "PermissionRequest": [
      { "type": "command", "command": "node /path/to/harness-evolve/dist/hooks/permission-request.js" }
    ],
    "Stop": [
      { "type": "command", "command": "node /path/to/harness-evolve/dist/hooks/stop.js" }
    ]
  }
}
```

### Project Stats

| Metric | Value |
|--------|-------|
| Source Code | 3,765 LOC TypeScript |
| Tests | 7,968 LOC across 37 test files |
| Test Count | 336 passing tests |
| Classifiers | 8 pattern classifiers |
| Routing Targets | 7+ configuration tools |
| Total Commits | 96 |

---

## 中文

### 问题背景

Claude Code 用户随时间积累低效操作 -- 反复输入相同命令、反复批准相同工具权限、遗漏配置优化。这些模式在手动审计工作流之前是不可见的。harness-evolve 通过自动检测模式并将修复路由到正确的配置目标，让不可见的变得可见。

### 项目概述

harness-evolve 是 Claude Code 的自迭代引擎。它观察用户与 Claude Code 的交互方式，检测使用模式，并将优化建议路由到最合适的配置工具 -- hooks、skills、rules、CLAUDE.md、memory、settings 或 permissions。

你不应该需要自己发现"我已经敲了同一条命令 20 次了，该建个 hook" -- 系统会自动捕捉到这个模式并建议修复方案。

### 安装

```bash
# 从 npm 安装
npm install -g harness-evolve

# 或在项目中本地安装
npm install harness-evolve
```

### 工作原理

```
捕获 -> 存储 -> 预处理 -> 分类 -> 路由 -> 交付 -> 跟踪结果
```

1. **捕获** -- 5 个生命周期 hooks 静默记录 prompts、工具使用、权限审批和失败
2. **存储** -- JSONL 日志，带 14 种模式的密钥擦除和原子计数器
3. **预处理** -- 跨 session 聚合，将日志压缩到 <50KB 摘要
4. **分类** -- 8 个分类器检测模式（重复 prompt、长工作流、权限习惯、代码纠正偏好、个人信息、配置漂移、生态系统特性、新手等级）
5. **路由** -- 每个模式通过可扩展决策树映射到最佳配置目标
6. **交付** -- 非侵入式通知 + `/evolve` 命令 + 可选全自动模式
7. **跟踪** -- 结果跟踪调整未来建议的置信度

### 功能特点

- **零配置** -- 开箱即用，无需手动设置
- **环境无关** -- 动态发现已安装工具（GSD、Cog、插件）并适配路由
- **非侵入式** -- 在自然间断点推荐，不中断活跃任务
- **全自动模式** -- 可选自动应用高置信度建议
- **分层引导** -- 适配新手和资深用户
- **反馈闭环** -- 跟踪建议是否被采纳或回退，调整未来置信度

### 快速开始

```bash
# 全局安装
npm install -g harness-evolve

# 或克隆开发
git clone git@github.com:r1ckyIn/harness-evolve.git
cd harness-evolve

# 安装依赖
npm install

# 构建
npm run build

# 运行测试
npm test
```

---

## License

MIT License

## Author

**Ricky Yuan** - CS + Mathematics @ University of Sydney

[![GitHub](https://img.shields.io/badge/GitHub-r1ckyIn-181717?style=flat-square&logo=github)](https://github.com/r1ckyIn)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-rickyyyyy-0A66C2?style=flat-square&logo=linkedin)](https://linkedin.com/in/rickyyyyy)
