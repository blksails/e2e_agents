# E2E Agents

智能浏览器自动化测试代理系统 - 基于 TypeScript + LangChain + Playwright

## 快速上手

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置 QWEN_API_KEY 或其他 LLM API 密钥

# 构建项目
npm run build

# 运行完整工作流
e2e-agents run -u https://example.com

# 或使用 npx (无需全局安装)
npx . run -u https://example.com
```

## 项目概述

这是一个具备自我批判能力的多阶段浏览器自动化测试代理系统，能够：

- **扫描**：自动探索网站页面功能并截图保存
- **解读**：理解业务功能，生成结构化 metadata (JSON Schema)
- **编排**：生成 SOP 操作流程（Markdown 格式，人类可读 + 机器可执行）
- **执行**：根据 SOP 执行测试工作流，支持用户数据和 faker 自动生成数据
- **派生**：三级策略生成变异测试以主动发现潜在 bug

### 核心特性

- ✅ **5 阶段闭环工作流**：扫描 → 解读 → 流程编排 → 执行 → 派生 → [循环回执行]
- ✅ **自我批判机制**：每个阶段自动验证输出质量和置信度评分
- ✅ **认知象限配置**：可配置的人类介入级别 (自主/监督/协作/人工)
- ✅ **多模型支持**：Qwen (生产)、OpenAI/Claude (实验/开发)
- ✅ **记忆与演进**：通过 diff 检测页面/流程变更，支持版本控制
- ✅ **文件系统存储**：所有数据持久化到本地，时间戳版本管理

## 架构设计

### 5 阶段工作流详解

```
┌────────────────────────────────────────────────────────────────┐
│                     AgentOrchestrator                          │
│                      (总协调器)                                 │
└────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────┐
│  Phase A: Scan → Phase B: Interpret → Phase C: Orchestrate   │
│       ↓              ↓                    ↓                    │
│  Phase D: Execute → Phase E: Derive → [Loop back to D]        │
└────────────────────────────────────────────────────────────────┘
```

#### 阶段 A: 扫描 (Scanning)
- **ScanAgent**: 探索网站路由和页面结构
- **RouteDiscovery**: 发现内部链接
- **ElementExtractor**: 提取可交互元素（按钮、输入框、链接等）
- **输出**: 页面截图 + 元素信息 + 网络请求

#### 阶段 B: 解读 (Interpretation)
- **InterpretAgent**: 通过 LLM 理解页面业务功能
- **输出**: 结构化 metadata (JSON)
  - 页面类型、主要功能
  - 业务流程、数据依赖
  - 关键元素和操作

#### 阶段 C: 编排 (Orchestration)
- **OrchestrateAgent**: 生成标准操作流程
- **SOPFormatter**: 输出 Markdown 格式 SOP
- **SOPParser**: 解析 Markdown 为可执行结构
- **输出**: 双格式 SOP (Markdown + JSON)

#### 阶段 D: 执行 (Execution)
- **ExecuteAgent**: 工作流执行管理
- **WorkflowExecutor**: 核心执行引擎
- **支持 10 种动作类型**:
  - navigate, click, input, select
  - wait, verify, screenshot, extract
  - conditional, loop
- **输出**: 执行结果 + 截图 + 状态快照

#### 阶段 E: 派生 (Derivation)
- **三级派生策略**:
  1. **Level 1**: ErrorPatternLibrary - 基于常见错误模式
     - 边界值、无效输入、SQL 注入、XSS 测试
  2. **Level 2**: MutationEngine - 随机变异现有流程
     - 步骤顺序、跳过步骤、重复步骤、延迟注入
  3. **Level 3**: LLM 推理潜在边界情况
     - 业务逻辑推断、领域特定场景
- **输出**: 派生测试用例 (DerivedTestCase)

### 自我批判机制

每个阶段都配备质量验证：

```typescript
CritiqueEngine → ConfidenceScorer → DecisionEngine
    ↓                  ↓                   ↓
 验证规则        4维度置信度评分      [自动修正/升级人类/批准]
```

**置信度 4 维度**:
- 完整性 (30%): 是否捕获所有必要信息
- 准确性 (30%): 提取的数据是否正确
- 可行性 (25%): 能否成功执行
- 覆盖率 (15%): 分析是否全面

**人类升级触发条件**:
- 总体置信度 < 阈值 (默认 0.6)
- 检测到关键问题
- 准确性或可行性维度 < 0.5
- 认知象限模式要求

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置 API 密钥：

```env
# 生产环境使用 Qwen
LLM_PROVIDER=qwen
QWEN_API_KEY=your-qwen-api-key
QWEN_MODEL=qwen-turbo

# 或使用 OpenAI (实验)
# LLM_PROVIDER=openai
# OPENAI_API_KEY=your-openai-api-key
# OPENAI_MODEL=gpt-4o

# 或使用 Claude (实验)
# LLM_PROVIDER=claude
# ANTHROPIC_API_KEY=your-claude-api-key
# ANTHROPIC_MODEL=claude-sonnet-4-5-20241022

# Playwright 配置
HEADLESS=false
BROWSER_TYPE=chromium

# 数据存储目录
DATA_DIR=./data
```

### 构建项目

```bash
npm run build
```

### 安装和使用方式

#### 方式 1: 本地开发使用

```bash
# 使用 npm scripts
npm run cli -- --help
npm run cli -- run -u https://example.com
```

#### 方式 2: 全局安装

```bash
# 全局安装
npm install -g .

# 直接使用命令
e2e-agents --help
e2e-agents run -u https://example.com
```

#### 方式 3: 使用 npx (推荐)

```bash
# 无需安装，直接使用
npx @blacksail/e2e-agents --help
npx @blacksail/e2e-agents run -u https://example.com

# 或使用本地版本
npx . --help
npx . run -u https://example.com
```

### 使用 CLI

#### 查看帮助

```bash
# 方式 1: npm scripts
npm run cli -- --help

# 方式 2: 全局命令
e2e-agents --help

# 方式 3: npx
npx . --help
```

#### 运行完整 5 阶段工作流

```bash
# 使用 Qwen (生产环境推荐)
e2e-agents run -u https://example.com

# 使用 OpenAI
e2e-agents run -u https://example.com -p openai -m gpt-4o

# 使用 Claude
e2e-agents run -u https://example.com -p claude -m claude-sonnet-4-5-20241022

# 使用 npx
npx . run -u https://example.com

# 自定义配置
e2e-agents run \
  -u https://example.com \
  -p qwen \
  --max-pages 20 \
  --max-depth 5 \
  --headless \
  --cognitive-mode autonomous \
  --derive-level1 15 \
  --derive-level2 10 \
  --derive-level3 5
```

#### 运行单个阶段

```bash
# 阶段 A: 扫描
e2e-agents scan -u https://example.com --max-pages 10

# 阶段 B: 解读
e2e-agents interpret -p qwen

# 阶段 C: 编排
e2e-agents orchestrate -p qwen

# 阶段 D: 执行
e2e-agents execute --headless

# 阶段 E: 派生
e2e-agents derive -p qwen --level1 10 --level2 5 --level3 3
```

#### 生成报告

```bash
e2e-agents report
```

### CLI 参数说明

**全局参数**:
- `-u, --url <url>`: 起始 URL 地址 (必需)
- `-d, --data-dir <dir>`: 数据存储目录 (默认: ./data)
- `-p, --provider <provider>`: LLM 提供商 (qwen/openai/claude)
- `-m, --model <model>`: LLM 模型名称
- `--api-key <key>`: LLM API 密钥 (可通过环境变量配置)

**扫描参数**:
- `--max-pages <number>`: 最大扫描页面数 (默认: 10)
- `--max-depth <number>`: 最大扫描深度 (默认: 3)
- `--headless`: 无头模式运行浏览器
- `--browser <browser>`: 浏览器类型 (chromium/firefox/webkit)

**认知象限参数**:
- `--cognitive-mode <mode>`: 认知模式 (autonomous/supervised/collaborative/manual，默认: supervised)
- `--auto-approve-threshold <number>`: 自动批准阈值 (0-1，默认: 0.8)
- `--require-review-threshold <number>`: 需要审核阈值 (0-1，默认: 0.6)

**派生测试参数**:
- `--derive-level1 <number>`: Level 1 测试数量 (默认: 10)
- `--derive-level2 <number>`: Level 2 测试数量 (默认: 5)
- `--derive-level3 <number>`: Level 3 测试数量 (默认: 3)

## 项目结构

```
e2e_agents/
├── src/
│   ├── core/                          # 核心基础设施
│   │   ├── orchestration/
│   │   │   └── AgentOrchestrator.ts   # ✅ 总协调器
│   │   ├── self-critique/
│   │   │   ├── CritiqueEngine.ts      # ✅ 批判引擎
│   │   │   ├── ConfidenceCalculator.ts # ✅ 置信度计算
│   │   │   └── validators/            # ✅ 各阶段验证器
│   │   ├── cognitive/
│   │   │   └── CognitiveQuadrantManager.ts # ✅ 认知象限管理
│   │   ├── storage/
│   │   │   ├── StorageManager.ts      # ✅ 文件系统存储
│   │   │   └── DiffEngine.ts          # ✅ 差异检测
│   │   ├── llm/
│   │   │   ├── LLMProviderManager.ts  # ✅ LLM 管理
│   │   │   └── providers/             # ✅ 多提供商支持
│   │   └── playwright/
│   │       └── PlaywrightManager.ts   # ✅ 浏览器控制
│   ├── phases/
│   │   ├── phase-a-scan/              # ✅ 阶段 A: 扫描
│   │   │   ├── ScanAgent.ts
│   │   │   ├── RouteDiscovery.ts
│   │   │   └── ElementExtractor.ts
│   │   ├── phase-b-interpret/         # ✅ 阶段 B: 解读
│   │   │   └── InterpretAgent.ts
│   │   ├── phase-c-orchestrate/       # ✅ 阶段 C: 编排
│   │   │   ├── OrchestrateAgent.ts
│   │   │   ├── SOPFormatter.ts
│   │   │   └── SOPParser.ts
│   │   ├── phase-d-execute/           # ✅ 阶段 D: 执行
│   │   │   ├── ExecuteAgent.ts
│   │   │   └── WorkflowExecutor.ts
│   │   └── phase-e-derive/            # ✅ 阶段 E: 派生
│   │       ├── DeriveAgent.ts
│   │       ├── level1/ErrorPatternLibrary.ts
│   │       ├── level2/MutationEngine.ts
│   │       └── level3/              # LLM 推理 (集成在 DeriveAgent)
│   └── types/
│       └── schemas.ts                 # ✅ Zod 类型定义
├── data/                              # 运行时数据（自动生成）
│   ├── scan/                          # 扫描结果
│   ├── interpret/                     # 页面元数据
│   ├── orchestrate/                   # SOP 工作流
│   ├── execute/                       # 执行结果
│   ├── derive/                        # 派生测试
│   ├── diffs/                         # 变更检测
│   ├── reviews/                       # 人类审核请求
│   └── state/                         # 全局状态
├── examples/                          # 使用示例
│   ├── simple-scan.ts
│   ├── full-workflow.ts
│   └── derive-tests.ts
└── tests/                             # 测试文件
```

## 实现状态

### ✅ 已完成 (完整实现)

#### 核心基础设施
- [x] TypeScript 项目初始化
- [x] 所有 Zod Schema 定义 (schemas.ts)
- [x] StorageManager (文件系统持久化)
- [x] LLMProviderManager (Qwen/OpenAI/Claude)
- [x] PlaywrightManager (浏览器控制)
- [x] CritiqueEngine (自我批判引擎)
- [x] CognitiveQuadrantManager (认知象限)
- [x] DiffEngine (变更检测)

#### 5 阶段代理
- [x] 阶段 A: ScanAgent + RouteDiscovery + ElementExtractor
- [x] 阶段 B: InterpretAgent
- [x] 阶段 C: OrchestrateAgent + SOPFormatter + SOPParser
- [x] 阶段 D: ExecuteAgent + WorkflowExecutor (支持 10 种动作类型)
- [x] 阶段 E: DeriveAgent (三级策略完整实现)

#### 总协调
- [x] AgentOrchestrator (总协调器)

#### CLI 命令行工具
- [x] `run` - 完整 5 阶段工作流
- [x] `scan` - 仅运行扫描阶段
- [x] `interpret` - 仅运行解读阶段
- [x] `orchestrate` - 仅运行编排阶段
- [x] `execute` - 仅运行执行阶段
- [x] `derive` - 仅运行派生阶段
- [x] `report` - 生成报告
- [x] 完整的参数配置支持

### 🚧 待完善功能

- [ ] 示例代码 (examples/)
- [ ] 集成测试
- [ ] 端到端测试场景
- [ ] 性能优化
- [ ] 详细使用文档

## 数据格式

### Metadata (JSON with TypeScript Schema)

```typescript
{
  id: string,
  url: string,
  pageType: "landing" | "form" | "dashboard" | ...,
  primaryPurpose: string,
  businessFlows: Array<{
    name: string,
    steps: string[],
    requiredData: Record<string, string>
  }>,
  keyElements: Array<{
    selector: string,
    purpose: string,
    businessMeaning: string
  }>,
  // ...
}
```

### SOP (Markdown + JSON)

```markdown
# SOP: 用户登录流程

> **Generated**: 2026-01-11T10:40:00Z
> **ID**: `550e8400-e29b-41d4-a716-446655440000`
> **Complexity**: Medium

## Required Inputs
| Field | Type | Required |
|-------|------|----------|
| username | string | Yes |
| password | string | Yes |

## Workflow Steps

### Step 1: 导航到登录页面
**Action**: `navigate`
**Target**: `https://example.com/login`

```json
{
  "action": "navigate",
  "target": { "url": "https://example.com/login" }
}
```

### Step 2: 输入用户名
**Action**: `input`
...
```

## 技术栈

- **TypeScript 5.x**: 类型安全的开发体验
- **LangChain 0.3.x**: AI 代理编排框架
- **Playwright 1.40.x**: 浏览器自动化
- **Zod 3.22.x**: 运行时类型验证和 Schema 定义
- **Winston 3.11.x**: 日志记录
- **Faker.js 8.3.x**: 测试数据生成

## 支持的 LLM

| 提供商 | 推荐场景 | 模型示例 | API 端点 |
|--------|----------|----------|----------|
| **Qwen** | 生产环境 | qwen-turbo, qwen-plus | DashScope API |
| **OpenAI** | 实验/开发 | gpt-4o, gpt-4o-mini | OpenAI API |
| **Claude** | 实验/开发 | claude-sonnet-4-5 | Anthropic API |

### Qwen 配置示例

```typescript
import { ChatOpenAI } from '@langchain/openai';

const qwen = new ChatOpenAI({
  configuration: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: process.env.QWEN_API_KEY,
  },
  model: 'qwen-turbo',
});
```

## 关键设计决策

### 为什么选择文件系统而非数据库？

- ✅ 更易于调试和人工检查
- ✅ 天然支持版本控制 (通过时间戳目录)
- ✅ 截图和 HTML 快照自然存储为文件
- ✅ 简化部署 (无需数据库依赖)

### 为什么 Markdown + JSON 双格式存储 SOP？

- **Markdown**: 人类可读，方便审核和手动修改
- **JSON**: 机器执行，结构化数据便于程序解析
- 两者保持同步，各取所长

### 为什么需要自我批判机制？

- LLM 输出不稳定，需要质量保证
- 自动化程度高，减少人工介入
- 但保留人类审核通道，确保关键决策正确

### 为什么采用阶段式架构？

- 清晰的关注点分离
- 每个阶段可独立测试和优化
- 便于调试和追溯问题
- 支持部分执行和断点恢复

## 使用示例

### 运行完整工作流

```typescript
import { AgentOrchestrator } from './core/orchestration/AgentOrchestrator';
import { StorageManager } from './core/storage/StorageManager';
import { LLMProviderManager } from './core/llm/LLMProviderManager';
import { PlaywrightManager } from './core/playwright/PlaywrightManager';
import { CritiqueEngine } from './core/self-critique/CritiqueEngine';
import { CognitiveQuadrantManager } from './core/cognitive/CognitiveQuadrantManager';

async function main() {
  // 初始化基础设施
  const storage = new StorageManager('./data');
  const llm = new LLMProviderManager({
    provider: 'qwen',
    apiKey: process.env.QWEN_API_KEY!,
    model: 'qwen-turbo',
  });
  const playwright = new PlaywrightManager();
  const critique = new CritiqueEngine();
  const cognitive = new CognitiveQuadrantManager({
    mode: 'supervised',
    thresholds: {
      autoApprove: 0.8,
      requireReview: 0.6,
      autoCorrect: 0.7,
    },
  });

  // 创建总协调器
  const orchestrator = new AgentOrchestrator(
    storage,
    llm,
    playwright,
    critique,
    cognitive,
  );

  // 运行完整 5 阶段工作流
  const session = await orchestrator.run({
    startUrl: 'https://example.com',
    maxPages: 10,
    phaseOptions: {
      scan: { maxDepth: 3 },
      derive: {
        level1Count: 10,
        level2Count: 5,
        level3Count: 3,
      },
    },
  });

  // 生成报告
  const report = await orchestrator.generateReport();
  console.log(report);

  // 清理资源
  await orchestrator.cleanup();
}

main().catch(console.error);
```

## 编译和测试

### 编译项目

```bash
npm run build
```

### 运行测试

```bash
npm test
```

### 类型检查

```bash
npm run type-check
```

### 代码格式化

```bash
npm run format
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 路线图

查看 [实施路线图](/Users/hysios/.claude/plans/goofy-cooking-blum.md) 了解详细的开发计划。

## 联系方式

- Issue Tracker: [GitHub Issues](https://github.com/your-org/e2e_agents/issues)
- 文档: [Documentation](./docs/)

## 致谢

感谢以下开源项目：

- [LangChain](https://github.com/langchain-ai/langchainjs) - AI 代理框架
- [Playwright](https://github.com/microsoft/playwright) - 浏览器自动化
- [Zod](https://github.com/colinhacks/zod) - TypeScript Schema 验证
- [Faker.js](https://github.com/faker-js/faker) - 测试数据生成
