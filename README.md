# InsightBoard AI (本地AI看板)

InsightBoard AI 是一款基于 Electron + React + TypeScript 构建的高性能、私密性强的**本地 AI 数据看板**。它旨在帮助用户在保障数据隐私的前提下，利用 AI 能力快速实现数据导入、清洗、分析及可视化。

## 🌟 核心特性

- **本地优先 & 隐私安全**：所有数据均存储在本地 IndexedDB（通过 Dexie 管理），不上传云端，确保敏感数据不出本地环境。
- **AI 赋能看板**：内置 AI 助手，支持通过 OpenAI 标准协议对接各类大模型，辅助进行数据解释、图表建议及自动化分析。
- **动态组件系统**：提供丰富的可视化组件，包括数据表格、柱状图、折线图、饼图、南丁格尔玫瑰图等。
- **灵活的数据导入**：支持 Excel 文件本地解析，实时预览并快速生成数据集。
- **拖拽式布局**：支持画布组件自由布局、缩放及对齐辅助。
- **工程化架构**：严格遵循设计模式与工程化标准，代码结构清晰，易于扩展。

## 🛠️ 技术栈

- **前端框架**：React 19, TypeScript
- **跨平台壳**：Electron
- **构建工具**：Vite 8
- **状态管理**：Zustand
- **数据库**：Dexie.js (IndexedDB)
- **图表引擎**：ECharts 5
- **图标库**：Lucide React
- **数据处理**：XLSX (SheetJS)

## 🏗️ 架构设计与设计模式

项目在核心逻辑中广泛应用了经典设计模式，以确保系统的灵活性与可维护性：

1.  **策略模式 (Strategy Pattern)**：
    - `AIApiStrategy`：统一不同 AI 厂商/协议的调用接口。
    - `CellFormatterStrategy`：灵活处理表格数据的格式化输出。
    - `DataSamplingStrategy`：针对大数据量的降采样算法策略。
2.  **工厂模式 (Factory Pattern)**：
    - `ComponentFactory`：根据配置动态生成不同类型的看板组件（图表、表格等）。
3.  **命令模式 (Command Pattern)**：
    - `BoardCommands` & `CommandManager`：封装看板操作（移动、缩放、删除），支持后续扩展撤销/重做功能。
4.  **观察者模式 (Observer Pattern)**：
    - `BoardObserver`：监听看板状态变化，协调多个侧边栏与画布的实时响应。

## 📂 目录结构预览

```text
D:\code\other\InsightBoard_AI\
├── electron/               # Electron 主进程与 Preload 脚本
├── src/
│   ├── core/               # 核心领域逻辑（模式实现）
│   │   ├── commands/       # 命令模式实现
│   │   ├── factories/      # 工厂模式实现
│   │   ├── observers/      # 观察者模式实现
│   │   └── strategies/     # 策略模式实现
│   ├── components/         # 公共 UI 组件与图表组件
│   ├── pages/              # 页面级组件（工作区、设置、空间管理）
│   ├── stores/             # Zustand 状态存储
│   ├── services/           # 数据库、文件等服务层
│   ├── types/              # TypeScript 类型定义
│   └── utils/              # 工具函数与 Web Workers
└── package.json            # 项目配置与脚本
```

## 🚀 快速开始

### 前提条件

- 已安装 [Node.js](https://nodejs.org/) (建议 v18+)
- 已安装 [npm](https://www.npmjs.com/) 或 [yarn](https://yarnpkg.com/)

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
# 同时启动 Vite 开发服务与 Electron 窗口
npm run electron:dev
```

### 项目打包

```bash
# 构建 Windows 安装包
npm run build:win
```

## 📝 开发者指南

1.  **代码风格**：本项目严格执行“卫语句”准则，逻辑平铺，拒绝深层嵌套。
2.  **状态管理**：业务逻辑应尽量解耦在 `core/` 下的模式实现中，Store 仅负责状态同步。
3.  **图表扩展**：如需新增图表类型，请在 `src/types/board.ts` 中扩展类型定义，并在 `ComponentFactory` 中注册对应的处理逻辑。

## 📄 开源协议

MIT License
