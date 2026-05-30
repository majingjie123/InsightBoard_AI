# 开发任务清单

## Phase 1: 设计模式完善

- [x] 1.1 组件工厂模式 (ComponentFactory) - src/core/factories/ComponentFactory.ts (已实现：支持多组件动态工厂创建与类型推导)
- [x] 1.2 命令模式 (CommandManager + 具体命令) - src/core/commands/ (已实现：支持最多50次历史记录的撤销与重做操作)
- [x] 1.3 观察者模式 (BoardObserver) - src/core/observers/ (已实现：支持看板与数据源状态联动的订阅通知机制)

## Phase 2: UI组件库

- [x] 2.1 Button 组件 - src/components/ui/Button/ (已实现：纯本地 UI 按钮封装，支持 variants/loading)
- [x] 2.2 Input 组件 - src/components/ui/Input/ (已实现：支持 Label 标签与校验 Error 反馈的 Input 文本输入框)
- [x] 2.3 Modal 组件 - src/components/ui/Modal/ (已实现：轻量弹层支持 ESC 关闭与焦点隔离)
- [x] 2.4 Select 组件 - src/components/ui/Select/ (已实现：基于 React 下拉选单并支持 Placeholder 和异常状态反馈)
- [x] 2.5 Table 组件 - src/components/ui/Table/ (已实现：纯 UI 只读渲染表格，支持紧凑宽松行高与斑马纹)
- [x] 2.6 Dropdown 下拉菜单 - src/components/ui/Dropdown/ (已实现：支持点击外部区域自动收起的 Dropdown 下拉菜单)
- [x] 2.7 ContextMenu 右键菜单 - src/components/ui/ContextMenu/ (已实现：支持看板画布操作的右键菜单定位触发)
- [x] 2.8 Tooltip 提示 - src/components/ui/Tooltip/ (已实现：鼠标 hover 浮层文字提示)

## Phase 3: 核心服务

- [x] 3.1 Excel解析服务完善 - src/utils/excelParser.ts (已实现：使用 Web Worker 的异步分片加载与百分比进度提示)
- [x] 3.2 网格吸附工具 - src/utils/gridSnap.ts (已实现：基于画布 gridSize 的吸附对齐算法)
- [x] 3.3 本地HTTP服务 - electron/services/httpServer.ts (已实现：已合并入 electron/main.ts 安全隔离，并成功重构双栏流式渲染只读 AI 历史消息)

## Phase 4: 页面模块

- [x] 4.1 AI配置页面 - src/pages/AIConfig/ (已实现：新增/编辑 API 配置，支持 API 连通性测试与模型自动拉取，已落实接口启用禁用与助手级联过滤)
- [x] 4.2 空间管理页面 - src/pages/SpaceManager/ (已实现：空间新建/删除/编辑/进入等右键菜单操作与重名校验)
- [x] 4.3 看板编辑页面 - src/pages/Workspace/ (已实现：组件拖拽吸附、撤销重做、复制粘贴等交互，AI 面板展开折叠状态保持及自动中止处理)

## Phase 5: 图表组件

- [x] 5.1 柱状图组件 - src/components/charts/BarChart/ (已集成于 src/components/charts/EChartComponent.tsx 统一控制)
- [x] 5.2 折线图组件 - src/components/charts/LineChart/ (已集成于 src/components/charts/EChartComponent.tsx 统一控制)
- [x] 5.3 饼图组件 - src/components/charts/PieChart/ (已集成于 src/components/charts/EChartComponent.tsx 统一控制，支持环形与玫瑰图等多种变形)

## Phase 6: 状态管理

- [x] 6.1 完善 boardStore - src/stores/boardStore.ts (已实现：历史快照栈维护与跨空间防错处理)
- [x] 6.2 完善 chatStore - src/stores/chatStore.ts (已实现：打字机流式输出与 IndexedDB 对话历史本地存储)

## Phase 7: 功能补全与缺陷修复（基于 Prompt.txt 需求对照）

- [x] 7.1 AI配置接口列表分页
  - 描述：当前 AI 接口列表使用无分页卡片网格布局，接口数量多时页面无限延伸。需增加分页控制，默认每页展示 6 条。
  - 涉及文件：src/pages/AIConfig/index.tsx
  - 示例：接口列表底部增加分页栏「上一页 第[1]页/共3页 下一页」，切换时仅渲染当前页卡片。
  - 需求来源：Prompt.txt 三-3.3

- [x] 7.2 组件库支持拖拽添加到画布（而非点击）
  - 描述：当前组件库为点击按钮添加组件到固定位置，需求要求"拖拽组件即可添加到看板画布"。需实现从左侧组件库拖拽到画布指定位置释放。
  - 涉及文件：src/pages/Workspace/index.tsx, src/pages/Workspace/components/BoardCanvas.tsx
  - 示例：鼠标按住组件库中的"数据表格" → 拖拽到画布 (300, 200) 位置释放 → 组件在释放位置创建。
  - 需求来源：Prompt.txt 五-(二)-主文

- [x] 7.3 表格组件应用 fontSize 配置
  - 描述：ComponentSettingsModal 已可设置表格字体大小（10/12/14/16），但 DataTable.tsx 渲染时未读取和使用该值。
  - 涉及文件：src/components/charts/DataTable.tsx
  - 示例：在表格 `<table>` 或 `<tbody>` 上应用 `style={{ fontSize: config.style.fontSize + 'px' }}`。
  - 需求来源：Prompt.txt 五-(二)-2.1-④

- [x] 7.4 AI 协议合规性校验增强
  - 描述：当前仅校验 URL 前缀是否为 http/https，未真正验证接口是否遵循 OpenAI 协议。保存时应尝试请求 `/v1/models` 端点验证响应格式。
  - 涉及文件：src/pages/AIConfig/index.tsx, src/core/strategies/AIApiStrategy.ts
  - 示例：保存接口时发送 `GET /v1/models` → 若返回格式不符合 OpenAI 规范 → 提示"非标准 OpenAI 协议接口，禁止添加"。
  - 需求来源：Prompt.txt 三-2

- [x] 7.5 分组柱状图支持（Grouped Bar Chart）
  - 描述：ChartConfig 类型中定义了 `seriesField` 字段，但无 UI 配置和渲染逻辑。需增加"系列字段"下拉选择，根据该字段值分组渲染不同颜色的柱体。
  - 涉及文件：src/pages/Workspace/components/ComponentSettingsModal.tsx, src/components/charts/EChartComponent.tsx, src/types/board.ts
  - 示例：选择"区域"为系列字段 → 各区域在 X 轴每个分类下并排显示不同颜色柱体，图例显示区域名称。
  - 需求来源：Prompt.txt 五-(二)-2.2-⑤

- [x] 7.6 双Y轴支持（Dual Y-Axis）
  - 描述：ChartConfig 中定义了 `dualYAxis`，但无 UI 配置项且未实现。需在配置弹窗增加双Y轴开关，渲染时左右Y轴显示不同量纲。
  - 涉及文件：src/pages/Workspace/components/ComponentSettingsModal.tsx, src/components/charts/EChartComponent.tsx
  - 示例：选择"销售额"和"单量"两个 Y 轴字段 → 左侧Y轴显示销售额(万元)，右侧Y轴显示单量(笔)。
  - 需求来源：Prompt.txt 五-(二)-2.3-④

- [x] 7.7 饼图引导线开关
  - 描述：配置弹窗中缺少"引导线"开关选项，EChartComponent 默认显示引导线。需增加控制项。
  - 涉及文件：src/pages/Workspace/components/ComponentSettingsModal.tsx, src/components/charts/EChartComponent.tsx
  - 示例：关闭引导线后饼图扇形区块间不显示连接标签的折线，仅悬浮时展示数值。
  - 需求来源：Prompt.txt 五-(二)-2.4-③

- [x] 7.8 饼图图例位置可配置
  - 描述：当前饼图图例固定 `left: 'left'`，需求要求图例位置可选：上/下/左/右/居中。
  - 涉及文件：src/pages/Workspace/components/ComponentSettingsModal.tsx, src/components/charts/EChartComponent.tsx
  - 示例：配置弹窗增加"图例位置"单选组 → 选择"底部"后图例显示在图表下方。
  - 需求来源：Prompt.txt 五-(二)-2.4-③

## Phase 8: 图表大数据渲染增强

- [x] 8.1 WebGL 渲染降级（>10000 数据点）
  - 描述：需求要求数据点 >10000 时自动降级为 WebGL 渲染，不支持时提示用户。需引入 `echarts-gl` 插件。
  - 涉及文件：src/components/charts/EChartComponent.tsx, package.json
  - 示例：`npm install echarts-gl` → dataPoints > 10000 时 `echarts.init(dom, null, { renderer: 'webgl' })`。
  - 需求来源：Prompt.txt 五-(二)-2.5-②

- [x] 8.2 降采样提示文字优化
  - 描述：当前降采样提示位于图表右上角小字，需改为图表左下角更醒目的提示条，并允许用户点击关闭降采样。
  - 涉及文件：src/components/charts/EChartComponent.tsx
  - 示例：点击提示条"数据点过多(12000)，已自动简化" → 显示原始数据。
  - 需求来源：Prompt.txt 五-(二)-2.5-①

## Phase 9: 预览页面完善

- [x] 9.1 发布快照记录组件网格坐标与跨度
  - 描述：当前预览页面使用固定三档分类映射 Grid 跨度（width>800 span 4 等），未精确记录组件的网格坐标。
  - 涉及文件：src/services/publishService.ts, src/types/board.ts, electron/main.ts
  - 示例：组件 position(40,40) size(600,350) → 网格坐标 row=2 col=1 rowSpan=2 colSpan=3。
  - 需求来源：Prompt.txt 五-(四)-4.1

- [x] 9.2 预览页面窗口缩放等比适配
  - 描述：当前预览页面使用固定 px，需求要求浏览器缩放时组件按 vw/vh 等比例缩放。
  - 涉及文件：electron/main.ts（预览HTML）
  - 示例：Grid 容器宽度 `100vw`，组件宽高使用 `clamp()` 函数实现等比缩放。
  - 需求来源：Prompt.txt 五-(四)-4.2

## Phase 10: EXE 打包部署

- [x] 10.1 配置 electron-builder 打包参数
  - 描述：新建 `electron-builder.json` 配置文件，定义输出目录、应用名称、版本号、icon 路径。
  - 涉及文件：electron-builder.json（新建）
  - 示例配置：
    ```json
    {
      "appId": "com.insightboard.app",
      "productName": "InsightBoard",
      "directories": { "output": "release" },
      "win": {
        "target": ["nsis", "portable"],
        "icon": "resources/icon.ico"
      },
      "nsis": {
        "oneClick": false,
        "allowToChangeInstallationDirectory": true,
        "createDesktopShortcut": true
      }
    }
    ```
  - 需求来源：Prompt.txt 七

- [x] 10.2 添加打包脚本到 package.json
  - 描述：在 package.json 的 scripts 中添加构建与打包命令，验证两种产物正常。
  - 涉及文件：package.json
  - 示例：`"build:win": "vite build && electron-builder --win"`
  - 需求来源：Prompt.txt 七-1

- [x] 10.3 自定义软件图标与版本信息
  - 描述：准备 `resources/icon.ico`（至少 256x256），在 electron-builder 和 electron main.ts 中注册版本信息。
  - 涉及文件：resources/icon.ico（需准备）, electron-builder.json, electron/main.ts
  - 示例：EXE 文件属性 → 详细信息 → 显示"产品名称: InsightBoard, 版本: 1.0.0.0"。
  - 需求来源：Prompt.txt 七-3

---

任务更新时间: 2026-05-30
