# InsightBoard AI

本地 AI 数据看板 — 基于 Electron + React + TypeScript 构建的桌面端数据可视化与 AI 分析平台。数据完全本地存储（IndexedDB/Dexie），支持 Excel 导入、拖拽式看板布局、ECharts 图表渲染、OpenAI 协议 AI 对话，以及看板发布与本地 HTTP 预览。

## 项目概览

| 维度 | 说明 |
|------|------|
| 目标 | 在保障数据隐私的前提下，利用 AI 能力实现数据导入、清洗、分析及可视化 |
| 前端框架 | React 19 + TypeScript |
| 桌面壳 | Electron 28 |
| 构建工具 | Vite 8 |
| 状态管理 | Zustand |
| 数据库 | Dexie.js (IndexedDB) |
| 图表引擎 | ECharts 5 |
| 样式方案 | Tailwind CSS (纯 class-based，无 CSS Module) |
| 代码风格 | 卫语句（Guard Clause）优先，拒绝深层嵌套 |

## 项目结构

```
InsightBoard_AI/
├── electron/                    # Electron 主进程
│   ├── main.ts                  # 主进程入口：窗口创建、IPC、生命周期
│   ├── preload.ts               # 预加载脚本：contextBridge 暴露 electronAPI
│   ├── services/
│   │   └── httpServer.ts        # 内置 HTTP 预览服务器
│   └── dist/                    # Electron 编译产物
├── src/
│   ├── core/                    # 核心领域逻辑（设计模式实现）
│   │   ├── commands/            # 命令模式（撤销/重做）
│   │   │   ├── CommandManager.ts
│   │   │   └── BoardCommands.ts
│   │   ├── factories/           # 工厂模式（组件创建）
│   │   │   └── ComponentFactory.ts
│   │   ├── observers/           # 观察者模式（事件通知）
│   │   │   └── BoardObserver.ts
│   │   └── strategies/          # 策略模式
│   │       ├── AIApiStrategy.ts         # AI 协议策略（OpenAI）
│   │       ├── CellFormatterStrategy.ts # 单元格格式化策略
│   │       └── DataSamplingStrategy.ts  # 降采样策略
│   ├── components/              # 公共 UI 组件
│   │   ├── charts/              # EChartComponent, DataTable
│   │   └── ui/                  # Button, Modal, Select, Table, etc.
│   ├── pages/                   # 页面级组件
│   │   ├── SpaceManager/        # 工作空间管理页
│   │   ├── AIConfig/            # AI 配置管理页
│   │   └── Workspace/           # 看板编辑页（核心工作区）
│   │       └── components/      # 画布、数据集面板、AI 聊天、设置弹窗
│   ├── stores/                  # Zustand 状态管理
│   │   ├── boardStore.ts        # 看板组件 CRUD + 撤销/重做
│   │   ├── spaceStore.ts        # 工作空间管理
│   │   ├── aiConfigStore.ts     # AI 接口与助手配置
│   │   └── chatStore.ts         # AI 对话流式交互
│   ├── services/                # 服务层
│   │   ├── database.ts          # Dexie 数据库实例与表定义
│   │   └── publishService.ts    # 看板发布与快照管理
│   ├── types/                   # TypeScript 类型定义
│   │   ├── board.ts             # BoardComponent, ChartConfig, TableConfig
│   │   ├── dataset.ts           # Dataset, ColumnInfo
│   │   ├── ai.ts                # AIEndpoint, AIAssistant, ChatMessage
│   │   └── space.ts             # Space
│   └── utils/                   # 工具函数
│       ├── excelParser.ts       # Excel 解析器（Web Worker 分片读取）
│       ├── excel.worker.ts      # Web Worker 实现
│       └── gridSnap.ts          # 画布网格对齐
├── resources/icon.ico           # 应用图标
├── electron-builder.json        # Electron 打包配置
├── vite.config.ts               # Vite 配置
├── tsconfig.json                # TypeScript 项目引用
├── tsconfig.app.json            # 前端 TS 配置
├── tsconfig.node.json           # Node 端 TS 配置
└── eslint.config.js             # ESLint 扁平配置
```

## 构建与运行

```bash
# 安装依赖
npm install

# 开发模式：Vite + Electron 同时启动
npm run electron:dev

# 仅启动 Vite 前端（不启动 Electron）
npm run dev

# 代码检查
npm run lint

# 完整构建（TS 编译 + Vite 构建 + Electron 编译）
npm run build

# 打包 Windows 安装包（nsis + portable）
npm run build:win
```

**开发环境启动流程**：
1. Vite 开发服务器在 `localhost:5173` 启动
2. `wait-on` 等待 Vite 就绪后编译 `electron/` 下 TS 文件到 `electron/dist/`
3. Electron 加载 `localhost:5173` 并启动内置 HTTP 预览服务（端口 18080）

**构建流程**：
1. `tsc -b` 全量类型检查
2. `vite build` 打包前端资源到 `dist/`
3. `build:electron` 编译 Electron TS 到 `electron/dist/`
4. `electron-builder` 生成 NSIS 安装包和便携版

## 架构设计模式

项目在 `src/core/` 中严格遵循了四种经典设计模式：

### 策略模式 (`strategies/`)
- **AIApiStrategy**：抽象 AI 协议调用，当前实现 `OpenAIApiStrategy`，通过 `AIApiContext` 管理多协议策略
- **CellFormatterStrategy**：数值/日期/文本的格式化策略，通过 `CellFormatterContext` 按类型分发
- **DataSamplingStrategy**：大数据降采样，支持 `SystematicSampling` 和 `LTTB` 两种算法

### 工厂模式 (`factories/`)
- **ComponentFactory**：根据 `ComponentType`（table/bar/line/pie）创建带默认配置的组件实例，提供 `create`、`clone`、`validate` 方法

### 命令模式 (`commands/`)
- **CommandManager**：管理命令执行历史（最多 50 条），支持 undo/redo/jumpTo
- **BoardCommands**：具体命令实现（Add/Move/Resize/UpdateConfig/ToggleLock/Batch），操作 `BoardState` 接口

### 观察者模式 (`observers/`)
- **BoardSubject**：事件发布-订阅中心，支持优先级排序和事件队列异步处理
- 事件类型：componentAdded/Removed/Updated/Selected/Locked，layoutChanged，datasetChanged

## 状态管理（Zustand Stores）

### boardStore
管理看板组件集合。核心操作：`addComponent`、`updateComponent`、`deleteComponent`、`copyComponent`/`pasteComponent`、`undo`/`redo`。每次修改前调用 `saveHistory()` 保存快照到 past 栈。锁定组件（`locked: true`）禁止修改/移动/删除。

### spaceStore
管理工作空间列表。`init()` 从 IndexedDB 加载并恢复上次打开空间（localStorage 记录 `lastOpenedSpace`）。删除空间时级联删除其下的组件、数据集和发布快照。

### aiConfigStore
管理 AI 接口配置（`AIEndpoint`）和 AI 助手（`AIAssistant`）。删除接口时级联删除绑定助手。支持 `testConnection` 和 `fetchModels`。

### chatStore
管理 AI 对话流式交互。构建上下文时注入系统 Prompt + 关联数据集摘要（字段 + 前 5 行预览） + 最近 10 条历史。支持 `AbortController` 中止请求。

## 数据库（Dexie/IndexedDB）

数据库名 `InsightBoardDB`，当前版本 v2，包含 7 张表：

| 表名 | 索引键 |
|------|--------|
| `spaces` | `id`, `name`, `createdAt` |
| `datasets` | `id`, `spaceId`, `name` |
| `boardComponents` | `id`, `spaceId`, `type` |
| `publishSnapshots` | `id`, `spaceId`, `version` |
| `aiConfigs` | `id`, `name`, `enabled` |
| `aiAssistants` | `id`, `endpointId`, `name`, `isDefault` |
| `chatHistories` | `id`, `spaceId`, `timestamp` |

## Electron 主进程

### IPC 通道

| 通道 | 类型 | 用途 |
|------|------|------|
| `dialog:selectFile` | handle | 文件选择对话框 |
| `file:save` | handle | 文件保存 |
| `server:getPort` / `server:start` / `server:stop` | handle | HTTP 预览服务控制 |
| `config:get` / `config:set` | handle | 持久化配置读/写（`app-config.json`） |
| `window:minimize` / `window:maximize` / `window:close` | on | 窗口控制 |
| `ai:chat` / `ai:stream` | handle/on | AI 请求（当前为 mock 实现） |
| `request-snapshot-data` / `response-snapshot-data-*` | send/on | 发布预览数据桥接 |

### 内置 HTTP 预览服务器
`PreviewServer` 在 Electron 主进程启动本地 HTTP 服务，支持：
- `/preview/:spaceId` — 返回完整 HTML 预览页面（内嵌 ECharts CDN + 自渲染模板）
- `/api/preview/:spaceId` — 返回 JSON 格式的发布快照数据
- 端口从 18080 开始自动递增（端口被占用时）

## 看板发布流程

1. `PublishService.publish(spaceId)` 触发发布
2. 收集该空间所有组件 + 关联数据集 + 聊天历史
3. 深拷贝数据并计算版本号（最多保留 5 个版本）
4. 存入 `publishSnapshots` 表
5. 通过 Electron IPC 桥接，内置 HTTP 服务可按 `spaceId` 查询最新快照并渲染预览页

## 开发约定

- **卫语句优先**：所有函数/方法入口处使用卫语句提前 return，禁止深层 if-else 嵌套
- **Zustand Store 职责**：Store 只负责状态同步和 IndexedDB 持久化，核心业务逻辑应放在 `core/` 下
- **组件类型扩展**：新增图表类型需在 `src/types/board.ts` 的 `ComponentType` 中注册，在 `ComponentFactory` 中实现创建方法
- **锁定组件保护**：所有修改操作必须检查 `component.locked`，锁定状态下拦截修改/移动/删除
- **IPC 通信**：渲染进程通过 `window.electronAPI` 调用主进程能力（由 `preload.ts` 通过 `contextBridge` 暴露）
- **CSS 方案**：使用 Tailwind CSS class，`vite.config.ts` 中 `base: './'` 确保打包后资源路径正确
- **数据隔离**：所有数据按 `spaceId` 隔离，跨空间操作必须拦截（如复制粘贴）
