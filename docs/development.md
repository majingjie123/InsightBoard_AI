# 本地AI看板展示平台 - 开发技术文档

## 1. 技术栈选型

### 1.1 核心技术栈

| 层次 | 技术选型 | 版本 | 说明 |
|------|---------|------|------|
| 桌面框架 | Electron | ^28.0.0 | 成熟稳定，EXE打包首选 |
| 前端框架 | React | ^18.2.0 | 组件化开发，生态丰富 |
| 语言 | TypeScript | ^5.3.0 | 类型安全，提升代码质量 |
| 构建工具 | Vite | ^5.0.0 | 快速构建，热更新 |
| 状态管理 | Zustand | ^4.4.0 | 轻量级，API简洁 |
| 图表库 | ECharts | ^5.4.0 | 功能强大，支持大数据 |
| Excel解析 | xlsx | ^0.18.5 | 完整Excel支持 |
| 本地存储 | electron-store | ^8.1.0 | 配置文件存储 |
| 本地数据库 | Dexie.js | ^3.2.0 | IndexedDB封装 |
| UI组件 | 自定义 + Radix UI | - | 轻量、可定制 |

### 1.2 技术架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│   窗口管理   │ 本地HTTP服务 │  文件系统   │  IPC通信        │
│  (BrowserWindow) │ (Express) │  (fs)      │  (ipcMain)      │
└─────────────┴─────────────┴─────────────┴──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Electron Renderer Process                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    React Application                     │ │
│  ├─────────────┬─────────────┬─────────────┬──────────────┤ │
│  │  AI配置模块  │  空间管理模块 │  看板编辑模块 │  数据集模块  │ │
│  └─────────────┴─────────────┴─────────────┴──────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  公共层: 状态管理 | 工具库 | 组件库 | 路由 | 权限        │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 项目目录结构

```
InsightBoard_AI/
├── electron/
│   ├── main.ts                 # Electron主进程入口
│   ├── preload.ts              # 预加载脚本
│   └── services/
│       ├── httpServer.ts       # 本地HTTP服务(预览服务)
│       ├── fileService.ts      # 文件系统服务
│       └── windowManager.ts    # 窗口管理服务
├── src/
│   ├── main.tsx                # React入口
│   ├── App.tsx                 # 根组件
│   ├── pages/
│   │   ├── AIConfig/           # AI配置管理页面
│   │   │   ├── components/     # 页面私有组件
│   │   │   ├── hooks/          # 页面私有hooks
│   │   │   └── index.tsx
│   │   ├── SpaceManager/       # 空间管理页面
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── index.tsx
│   │   └── Workspace/          # 工作空间(看板编辑)
│   │       ├── components/
│   │       │   ├── BoardEditor/    # 看板编辑区
│   │       │   ├── AIChatPanel/    # AI交互面板
│   │       │   ├── DatasetPanel/   # 数据集面板
│   │       │   └── Toolbar/        # 顶部工具栏
│   │       ├── hooks/
│   │       └── index.tsx
│   ├── components/
│   │   ├── ui/                 # 基础UI组件
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   ├── Select/
│   │   │   ├── Table/
│   │   │   └── ...
│   │   └── charts/             # 图表组件
│   │       ├── BarChart/
│   │       ├── LineChart/
│   │       ├── PieChart/
│   │       └── DataTable/
│   ├── core/
│   │   ├── strategies/         # 策略模式实现
│   │   │   ├── ChartStrategy/  # 图表渲染策略
│   │   │   ├── DataStrategy/   # 数据处理策略
│   │   │   ├── ExportStrategy/ # 导出策略
│   │   │   └── ValidationStrategy/ # 校验策略
│   │   ├── factories/          # 工厂模式
│   │   │   ├── ComponentFactory.ts
│   │   │   └── DataSourceFactory.ts
│   │   ├── observers/          # 观察者模式
│   │   │   ├── BoardObserver.ts
│   │   │   └── DataObserver.ts
│   │   └── commands/           # 命令模式
│   │       ├── CommandManager.ts
│   │       └── commands/
│   │           ├── AddComponentCommand.ts
│   │           ├── MoveComponentCommand.ts
│   │           └── ...
│   ├── hooks/                  # 全局Hooks
│   │   ├── useStore.ts         # Zustand store
│   │   ├── useHistory.ts       # 撤销/重做
│   │   ├── useAIChat.ts        # AI对话
│   │   └── useExcelParser.ts   # Excel解析
│   ├── stores/                 # 状态管理
│   │   ├── aiConfigStore.ts
│   │   ├── spaceStore.ts
│   │   ├── boardStore.ts
│   │   └── chatStore.ts
│   ├── services/               # 业务服务
│   │   ├── aiService.ts        # AI接口服务
│   │   ├── datasetService.ts   # 数据集服务
│   │   ├── publishService.ts   # 发布服务
│   │   └── storageService.ts   # 存储服务
│   ├── utils/                  # 工具函数
│   │   ├── excelParser.ts      # Excel解析工具
│   │   ├── validators.ts       # 校验工具
│   │   ├── formatters.ts       # 格式化工具
│   │   └── constants.ts        # 常量定义
│   ├── types/                  # TypeScript类型
│   │   ├── ai.ts
│   │   ├── board.ts
│   │   ├── dataset.ts
│   │   └── space.ts
│   └── styles/                 # 全局样式
│       ├── variables.css
│       └── global.css
├── resources/                  # 静态资源
│   └── icon.ico
├── package.json
├── electron-builder.json       # 打包配置
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## 3. 设计模式应用

### 3.1 策略模式 (Strategy Pattern)

**应用场景1: 图表渲染策略**

```typescript
// src/core/strategies/ChartStrategy/types.ts
export interface ChartConfig {
  type: 'bar' | 'line' | 'pie';
  dataSource: string;
  xField: string;
  yField: string;
  options: ChartOptions;
}

export interface ChartRenderer {
  render(config: ChartConfig): void;
  updateData(data: any[]): void;
  resize(): void;
  destroy(): void;
}

// src/core/strategies/ChartStrategy/index.ts
import { BarChartRenderer } from './renderers/BarChartRenderer';
import { LineChartRenderer } from './renderers/LineChartRenderer';
import { PieChartRenderer } from './renderers/PieChartRenderer';

export class ChartRenderStrategy {
  private renderers: Map<string, ChartRenderer> = new Map();

  constructor() {
    this.registerRenderer('bar', new BarChartRenderer());
    this.registerRenderer('line', new LineChartRenderer());
    this.registerRenderer('pie', new PieChartRenderer());
  }

  registerRenderer(type: string, renderer: ChartRenderer): void {
    this.renderers.set(type, renderer);
  }

  getRenderer(type: string): ChartRenderer {
    const renderer = this.renderers.get(type);
    if (!renderer) {
      throw new Error(`Chart renderer for type "${type}" not found`);
    }
    return renderer;
  }
}

// 使用示例
const strategy = new ChartRenderStrategy();
const barRenderer = strategy.getRenderer('bar');
barRenderer.render(config);
```

**应用场景2: 数据处理策略**

```typescript
// src/core/strategies/DataStrategy/types.ts
export interface DataProcessor {
  process(rawData: any[]): ProcessedData;
  aggregate(data: any[], field: string, method: AggregationMethod): any[];
  filter(data: any[], conditions: FilterCondition[]): any[];
  sort(data: any[], field: string, order: SortOrder): any[];
}

export type AggregationMethod = 'sum' | 'avg' | 'count' | 'max' | 'min';
export type SortOrder = 'asc' | 'desc';

export interface ProcessedData {
  rows: any[];
  columns: ColumnInfo[];
  total: number;
}

// src/core/strategies/DataStrategy/TableDataProcessor.ts
export class TableDataProcessor implements DataProcessor {
  process(rawData: any[]): ProcessedData {
    // 处理Excel原始数据
    return {
      rows: rawData,
      columns: this.inferColumns(rawData[0]),
      total: rawData.length
    };
  }

  aggregate(data: any[], field: string, method: AggregationMethod): any[] {
    const values = data.map(row => row[field]);
    switch (method) {
      case 'sum': return values.reduce((a, b) => a + (Number(b) || 0), 0);
      case 'avg': return values.reduce((a, b) => a + (Number(b) || 0), 0) / values.length;
      case 'count': return values.length;
      case 'max': return Math.max(...values.map(v => Number(v) || 0));
      case 'min': return Math.min(...values.map(v => Number(v) || 0));
    }
  }
  // ...
}

// src/core/strategies/DataStrategy/ChartDataProcessor.ts
export class ChartDataProcessor implements DataProcessor {
  process(rawData: any[]): ProcessedData {
    // 图表数据处理
  }

  aggregate(data: any[], field: string, method: AggregationMethod): any[] {
    // 按字段分组聚合
    const grouped = this.groupBy(data, field);
    return Object.entries(grouped).map(([key, rows]) => ({
      category: key,
      value: this.calculate(rows, method)
    }));
  }
  // ...
}
```

**应用场景3: 验证策略**

```typescript
// src/core/strategies/ValidationStrategy/index.ts
export interface ValidationRule {
  validate(value: any): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export class URLValidationRule implements ValidationRule {
  validate(value: string): ValidationResult {
    const urlPattern = /^https?:\/\/.+/;
    return {
      valid: urlPattern.test(value),
      message: '请输入有效的URL地址'
    };
  }
}

export class APIKeyValidationRule implements ValidationRule {
  validate(value: string): ValidationResult {
    return {
      valid: value.length > 0 && value.startsWith('sk-'),
      message: 'API Key格式不正确'
    };
  }
}

export class ValidationStrategy {
  private rules: Map<string, ValidationRule[]> = new Map();

  registerRule(field: string, rule: ValidationRule): void {
    const rules = this.rules.get(field) || [];
    rules.push(rule);
    this.rules.set(field, rules);
  }

  validate(field: string, value: any): ValidationResult {
    const rules = this.rules.get(field) || [];
    for (const rule of rules) {
      const result = rule.validate(value);
      if (!result.valid) return result;
    }
    return { valid: true };
  }
}
```

**应用场景4: 列格式化策略 (CellFormatterStrategy)**

- **适用场景**：在数据表格中，不同的列需要不同的格式化展示方式（例如：数值需要千分位、限制小数位数；日期需要转化为 YYYY-MM-DD 或 YYYYMMDD 格式；空值需要特殊显示；错误值如 `#DIV0!` 需要友好显示）。
- **结构解释**：定义统一的格式化接口 `FormatterStrategy`，不同的数据类型实现各自的格式化逻辑。通过 `FormatterContext` 来动态获取格式化器并执行，使用卫语句做快速拦截。

```typescript
// 定义格式化上下文与配置类型
export interface FormatterConfig {
  type: 'number' | 'date' | 'text';
  precision?: number; // 小数位数
  useGrouping?: boolean; // 千分位
  dateFormat?: 'YYYY-MM-DD' | 'YYYYMMDD';
}

export interface FormatterStrategy {
  format(value: any, config: FormatterConfig): string;
}

// 数值格式化具体策略实现
export class NumberFormatter implements FormatterStrategy {
  format(value: any, config: FormatterConfig): string {
    // 卫语句：拦截空值与异常值
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    const num = Number(value);
    if (isNaN(num)) {
      return '错误'; // 对应 Excel 异常值
    }

    const options: Intl.NumberFormatOptions = {
      minimumFractionDigits: config.precision ?? 0,
      maximumFractionDigits: config.precision ?? 0,
      useGrouping: config.useGrouping ?? true
    };

    return new Intl.NumberFormat('zh-CN', options).format(num);
  }
}

// 日期格式化具体策略实现
export class DateFormatter implements FormatterStrategy {
  format(value: any, config: FormatterConfig): string {
    // 卫语句：拦截空值
    if (!value) {
      return '-';
    }

    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else {
      date = new Date(value);
    }

    // 卫语句：拦截无效日期
    if (isNaN(date.getTime())) {
      return '错误';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    // 卫语句：根据格式返回
    if (config.dateFormat === 'YYYYMMDD') {
      return `${year}${month}${day}`;
    }

    return `${year}-${month}-${day}`;
  }
}

// 普通文本格式化具体策略实现
export class TextFormatter implements FormatterStrategy {
  format(value: any, config: FormatterConfig): string {
    // 卫语句：拦截空值
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    return String(value);
  }
}

// 策略上下文管理器
export class CellFormatterContext {
  private strategies: Map<string, FormatterStrategy> = new Map();

  constructor() {
    this.strategies.set('number', new NumberFormatter());
    this.strategies.set('date', new DateFormatter());
    this.strategies.set('text', new TextFormatter());
  }

  format(value: any, config: FormatterConfig): string {
    const strategy = this.strategies.get(config.type);
    // 卫语句：防错处理
    if (!strategy) {
      return String(value ?? '-');
    }
    return strategy.format(value, config);
  }
}
```

**应用场景5: AI协议对接与连通性策略 (AIApiStrategy)**

- **适用场景**：AI 对话模块目前仅支持标准 OpenAI 协议。但在大型系统架构中，为了日后拓展对接其他主流协议（如 Anthropic Claude, 百度千帆, 阿里通义千问等），使用策略模式可以将协议的有效性验证与流式请求处理机制统一封装。
- **结构解释**：定义 `AIApiStrategy` 接口，包含 `testConnection` 和 `chatStream` 方法。实现 `OpenAIApiStrategy` 执行标准 OpenAI 交互。使用 `AIApiContext` 统一管理。

```typescript
import { ChatMessage, AIEndpoint } from '../../types/ai';

export interface AIApiStrategy {
  testConnection(endpoint: AIEndpoint): Promise<boolean>;
  chatStream(
    endpoint: AIEndpoint, 
    messages: ChatMessage[], 
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void>;
}

// 标准 OpenAI 协议实现
export class OpenAIApiStrategy implements AIApiStrategy {
  async testConnection(endpoint: AIEndpoint): Promise<boolean> {
    // 卫语句：基础配置校验
    if (!endpoint.url || !endpoint.apiKey) {
      return false;
    }
    
    try {
      const response = await fetch(`${endpoint.url}/v1/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${endpoint.apiKey}`
        },
        signal: AbortSignal.timeout(endpoint.timeout ?? 5000)
      });
      
      // 卫语句：HTTP 状态码校验
      if (!response.ok) {
        return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  async chatStream(
    endpoint: AIEndpoint,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    // 卫语句：参数合法性校验
    if (!endpoint.url || !endpoint.apiKey) {
      throw new Error('AI接口地址或 API Key 未配置');
    }

    const response = await fetch(`${endpoint.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${endpoint.apiKey}`
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: true
      }),
      signal
    });

    // 卫语句：响应状态校验
    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`AI请求失败: ${response.status} - ${errorMsg}`);
    }

    // 卫语句：检测响应体流式输出支持
    if (!response.body) {
      throw new Error('未获取到响应流');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      // 卫语句：流式读取完成，退出循环
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 最后一个可能不完整，放回 buffer

      for (const line of lines) {
        const cleanedLine = line.trim();
        // 卫语句：忽略空行
        if (!cleanedLine) {
          continue;
        }
        // 卫语句：忽略非 data 行
        if (!cleanedLine.startsWith('data:')) {
          continue;
        }

        const dataStr = cleanedLine.slice(5).trim();
        // 卫语句：结束标志
        if (dataStr === '[DONE]') {
          break;
        }

        try {
          const parsed = JSON.parse(dataStr);
          const chunkText = parsed.choices?.[0]?.delta?.content;
          // 卫语句：忽略没有文本的 chunk
          if (!chunkText) {
            continue;
          }
          onChunk(chunkText);
        } catch (e) {
          // 容错：解析失败跳过
          continue;
        }
      }
    }
  }
}

// 策略工厂/管理器
export class AIApiContext {
  private strategies: Map<string, AIApiStrategy> = new Map();

  constructor() {
    // 目前仅支持 OpenAI
    this.strategies.set('openai', new OpenAIApiStrategy());
  }

  getStrategy(protocolType: string): AIApiStrategy {
    const strategy = this.strategies.get(protocolType.toLowerCase());
    // 卫语句：找不到对应的协议实现则拦截
    if (!strategy) {
      throw new Error(`不支持的 AI 协议类型: ${protocolType}`);
    }
    return strategy;
  }
}
```

**应用场景6: 数据降采样策略 (DataSamplingStrategy)**

- **适用场景**：图表展示的大数据渲染场景下，当数据点多于 5000 时，直接全部渲染可能造成系统卡团和图形重叠，需要降采样处理。
- **性能优化：流式聚合引擎**：针对 100k+ 级别的大数据集，系统不再为每个分组创建中间数值数组，而是采用“流式聚合”模式。在一次遍历中即时计算 `Sum`, `Avg`, `Max`, `Min`, `Count` 指标。这极大地降低了内存峰值占用，避免了因 V8 垃圾回收导致的打字机动效卡顿。

**应用场景7: 真·等比例缩放布局系统**

- **适用场景**：发布后的看板在不同尺寸的浏览器窗口中需保持视觉一致性（WYSIWYG）。
- **实现方案**：
  1. **设计基准**：以 1200px 宽度为设计基准，发布版根据 `availableWidth / 1200` 计算 `ratio` 比例。
  2. **动态响应**：通过 `ResizeObserver` 监控容器宽度，实时更新 `ratio`。
  3. **级联缩放**：组件的 `left`, `top`, `width`, `height`, `fontSize`, `titleSize` 均乘以 `ratio`。
  4. **图表适配**：在 `ratio` 更新后同步调用 ECharts 的 `resize()` 方法，确保图表清晰度与容器匹配。

```typescript
// 发布版核心缩放逻辑片段
function updateLayout(containerWidth) {
  const availableWidth = Math.max(1200, containerWidth - 48);
  const ratio = availableWidth / 1200; // 缩放比例
  
  components.forEach(comp => {
    const el = document.getElementById(comp.id);
    el.style.left = (comp.x * ratio) + 'px';
    el.style.fontSize = (baseSize * ratio) + 'px';
    // ... 调用 echarts.resize()
  });
}
```

```typescript
// 定义采样策略接口
export interface SamplingStrategy {
  sample(data: any[], targetSize: number, xField: string, yField: string): any[];
}

// 等间隔降采样策略 (Systematic Sampling)
export class SystematicSamplingStrategy implements SamplingStrategy {
  sample(data: any[], targetSize: number): any[] {
    // 卫语句：若数据量小于目标大小，无需降采样
    if (data.length <= targetSize) {
      return data;
    }

    const step = data.length / targetSize;
    const sampled: any[] = [];
    
    for (let i = 0; i < targetSize; i++) {
      const index = Math.min(Math.floor(i * step), data.length - 1);
      sampled.push(data[index]);
    }

    return sampled;
  }
}

// 三点最大面积降采样策略 (Largest Triangle Three Buckets, LTTB)
export class LttbSamplingStrategy implements SamplingStrategy {
  sample(data: any[], targetSize: number, xField: string, yField: string): any[] {
    // 卫语句：边界校验
    if (data.length <= targetSize || targetSize <= 2) {
      return data;
    }

    const sampled: any[] = [];
    sampled.push(data[0]); // 始终保留首点

    // 桶大小计算（排除首尾点）
    const bucketSize = (data.length - 2) / (targetSize - 2);

    let a = 0; // 当前选中的点索引

    for (let i = 0; i < targetSize - 2; i++) {
      // 计算下一个桶的平均点 B，用作三角形的第三个点参考
      const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
      const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);

      let avgX = 0;
      let avgY = 0;
      let avgRangeLength = avgRangeEnd - avgRangeStart;

      for (let idx = avgRangeStart; idx < avgRangeEnd; idx++) {
        avgX += idx; // 使用索引作为 X 轴时间代理值
        avgY += Number(data[idx][yField]) || 0;
      }
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;

      // 寻找当前桶中与 a 和平均点 B 构成的三角形面积最大的点
      const rangeStart = Math.floor(i * bucketSize) + 1;
      const rangeEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length);

      const pointAX = a;
      const pointAY = Number(data[a][yField]) || 0;

      let maxArea = -1;
      let maxAreaIndex = rangeStart;

      for (let idx = rangeStart; idx < rangeEnd; idx++) {
        const area = Math.abs(
          (pointAX - avgX) * (Number(data[idx][yField]) - pointAY) -
          (pointAX - idx) * (avgY - pointAY)
        ) * 0.5;

        // 卫语句：发现更大面积则更新
        if (area > maxArea) {
          maxArea = area;
          maxAreaIndex = idx;
        }
      }

      sampled.push(data[maxAreaIndex]);
      a = maxAreaIndex; // 移动基点到新选中的点
    }

    sampled.push(data[data.length - 1]); // 始终保留尾点
    return sampled;
  }
}

// 降采样执行管理器
export class DataSampler {
  private strategy: SamplingStrategy;

  constructor(strategy: SamplingStrategy = new SystematicSamplingStrategy()) {
    this.strategy = strategy;
  }

  setStrategy(strategy: SamplingStrategy): void {
    this.strategy = strategy;
  }

  execute(data: any[], targetSize: number, xField: string, yField: string): any[] {
    // 卫语句：校验输入数据
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }
    return this.strategy.sample(data, targetSize, xField, yField);
  }
}
```

### 3.2 工厂模式 (Factory Pattern)

```typescript
// src/core/factories/ComponentFactory.ts
export type ComponentType = 'table' | 'bar' | 'line' | 'pie';

export interface BoardComponent {
  id: string;
  type: ComponentType;
  config: ComponentConfig;
  position: Position;
  size: Size;
  locked: boolean;
  name: string;
}

export class ComponentFactory {
  create(type: ComponentType, options: Partial<BoardComponent> = {}): BoardComponent {
    const baseComponent = {
      id: generateId(),
      type,
      locked: false,
      name: `${this.getDefaultName(type)} - ${Date.now()}`,
      position: { x: 0, y: 0 },
      size: { width: 400, height: 300 },
      ...options
    };

    switch (type) {
      case 'table':
        return this.createTableComponent(baseComponent);
      case 'bar':
        return this.createBarComponent(baseComponent);
      case 'line':
        return this.createLineComponent(baseComponent);
      case 'pie':
        return this.createPieComponent(baseComponent);
      default:
        throw new Error(`Unknown component type: ${type}`);
    }
  }

  private createTableComponent(base: BoardComponent): BoardComponent {
    return {
      ...base,
      config: {
        dataSourceId: '',
        columns: [],
        pageSize: 20,
        style: {
          rowHeight: 'standard',
          stripe: true,
          headerBg: '#f5f5f5',
          fontSize: 14
        }
      }
    };
  }

  private createBarComponent(base: BoardComponent): BoardComponent {
    return {
      ...base,
      config: {
        dataSourceId: '',
        xField: '',
        yField: '',
        aggregation: 'sum',
        style: {
          title: '',
          colors: ['#5470c6'],
          showLegend: true,
          showDataLabel: false
        }
      }
    };
  }

  private getDefaultName(type: ComponentType): string {
    const names: Record<ComponentType, string> = {
      table: '基础数据表格',
      bar: '基础柱状图',
      line: '趋势折线图',
      pie: '环形饼图'
    };
    return names[type];
  }
}
```

### 3.3 命令模式 (撤销/重做)

```typescript
// src/core/commands/CommandManager.ts
export interface Command {
  execute(): void;
  undo(): void;
  redo(): void;
}

export class CommandManager {
  private history: Command[] = [];
  private currentIndex: number = -1;
  private maxHistory: number = 50;

  execute(command: Command): void {
    command.execute();
    // 移除当前索引之后的所有命令
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(command);
    this.currentIndex++;

    // 限制历史记录数量
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  undo(): void {
    if (this.canUndo()) {
      this.history[this.currentIndex].undo();
      this.currentIndex--;
    }
  }

  redo(): void {
    if (this.canRedo()) {
      this.currentIndex++;
      this.history[this.currentIndex].redo();
    }
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
}

// src/core/commands/commands/AddComponentCommand.ts
export class AddComponentCommand implements Command {
  constructor(
    private board: BoardStore,
    private component: BoardComponent
  ) {}

  execute(): void {
    this.board.addComponent(this.component);
  }

  undo(): void {
    this.board.removeComponent(this.component.id);
  }

  redo(): void {
    this.board.addComponent(this.component);
  }
}
```

### 3.4 观察者模式 (组件状态同步)

```typescript
// src/core/observers/BoardObserver.ts
export type BoardEvent = 'componentAdded' | 'componentRemoved' | 'componentUpdated' | 'layoutChanged';

export interface BoardObserver {
  onEvent(event: BoardEvent, data: any): void;
}

export class BoardSubject {
  private observers: Map<BoardEvent, BoardObserver[]> = new Map();

  subscribe(event: BoardEvent, observer: BoardObserver): void {
    const observers = this.observers.get(event) || [];
    observers.push(observer);
    this.observers.set(event, observers);
  }

  unsubscribe(event: BoardEvent, observer: BoardObserver): void {
    const observers = this.observors.get(event) || [];
    const index = observers.indexOf(observer);
    if (index > -1) {
      observers.splice(index, 1);
    }
  }

  notify(event: BoardEvent, data: any): void {
    const observers = this.observers.get(event) || [];
    observers.forEach(observer => observer.onEvent(event, data));
  }
}
```

---

## 4. 数据模型设计

### 4.1 数据库结构 (IndexedDB via Dexie.js)

```typescript
// src/services/database.ts
import Dexie, { Table } from 'dexie';

export interface AIConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  timeout: number;
  model: string;
  description: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIAssistant {
  id: string;
  name: string;
  configId: string;
  model: string;
  prompt: string;
  description: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface Space {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dataset {
  id: string;
  spaceId: string;
  name: string;
  fileName: string;
  sheetName: string;
  rowCount: number;
  columns: ColumnInfo[];
  data: any[];  // 结构化数据
  createdAt: Date;
}

export interface BoardComponent {
  id: string;
  spaceId: string;
  type: 'table' | 'bar' | 'line' | 'pie';
  name: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: any;
  locked: boolean;
  createdAt: Date;
}

export interface PublishSnapshot {
  id: string;
  spaceId: string;
  version: number;
  components: BoardComponent[];
  datasets: Dataset[];
  createdAt: Date;
}

export class AppDatabase extends Dexie {
  aiConfigs!: Table<AIConfig>;
  aiAssistants!: Table<AIAssistant>;
  spaces!: Table<Space>;
  datasets!: Table<Dataset>;
  boardComponents!: Table<BoardComponent>;
  publishSnapshots!: Table<PublishSnapshot>;

  constructor() {
    super('InsightBoardDB');
    this.version(1).stores({
      aiConfigs: 'id, name, enabled',
      aiAssistants: 'id, configId, isDefault',
      spaces: 'id, name, createdAt',
      datasets: 'id, spaceId, name',
      boardComponents: 'id, spaceId, type',
      publishSnapshots: 'id, spaceId, version'
    });
  }
}

export const db = new AppDatabase();
```

### 4.2 轻量配置存储 (electron-store)

```typescript
// src/services/configStore.ts
import Store from 'electron-store';

interface AppConfig {
  defaultAI: string | null;
  aiPanelCollapsed: boolean;
  lastOpenedSpace: string | null;
  windowState: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    maximized: boolean;
  };
}

export const configStore = new Store<AppConfig>({
  defaults: {
    defaultAI: null,
    aiPanelCollapsed: false,
    lastOpenedSpace: null,
    windowState: {
      width: 1280,
      height: 800,
      maximized: false
    }
  }
});
```

---

## 5. 核心模块设计

### 5.1 AI配置模块

```
AIConfig/
├── components/
│   ├── ConfigList.tsx          # 配置列表
│   ├── ConfigForm.tsx          # 配置表单
│   ├── TestConnection.tsx      # 连通性测试
│   └── ModelSelector.tsx       # 模型选择器
├── hooks/
│   ├── useAIConfigs.ts         # AI配置CRUD
│   ├── useModelList.ts         # 拉取模型列表
│   └── useConnectionTest.ts    # 连接测试
└── index.tsx
```

**核心类型定义:**
```typescript
// src/types/ai.ts
export interface AIEndpoint {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  timeout: number;  // 毫秒
  model: string;
  description: string;
  enabled: boolean;
}

export interface AIAssistant {
  id: string;
  name: string;
  endpointId: string;
  model: string;
  prompt: string;
  description: string;
  isDefault: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
}
```

### 5.2 空间管理模块

```
SpaceManager/
├── components/
│   ├── SpaceList.tsx           # 空间列表
│   ├── SpaceItem.tsx           # 空间项(右键菜单)
│   ├── CreateSpaceModal.tsx    # 创建弹窗
│   ├── RenameSpaceModal.tsx    # 重命名弹窗
│   └── DeleteConfirmModal.tsx  # 删除确认
└── index.tsx
```

### 5.3 看板编辑模块

```
Workspace/
├── components/
│   ├── BoardEditor/            # 看板编辑区
│   │   ├── Canvas.tsx          # 画布(拖拽区域)
│   │   ├── Grid.tsx            # 网格吸附
│   │   ├── ComponentWrapper.tsx # 组件包装器
│   │   └── ResizeHandle.tsx    # 缩放手柄
│   ├── AIChatPanel/            # AI交互面板
│   │   ├── PanelHeader.tsx     # 头部(折叠按钮)
│   │   ├── AISelector.tsx      # AI选择
│   │   ├── DatasetSelector.tsx # 数据集选择
│   │   ├── ChatList.tsx        # 对话列表
│   │   └── ChatInput.tsx       # 输入框
│   ├── DatasetPanel/           # 数据集面板
│   │   ├── DatasetList.tsx     # 数据集列表
│   │   ├── UploadButton.tsx    # 上传按钮
│   │   └── PreviewModal.tsx    # 预览弹窗
│   └── Toolbar/                # 顶部工具栏
│       ├── SpaceName.tsx       # 空间名称
│       └── PublishButton.tsx   # 发布按钮
├── hooks/
│   ├── useBoardEditor.ts       # 看板编辑状态
│   ├── useDragDrop.ts          # 拖拽逻辑
│   ├── useAIChat.ts            # AI对话
│   └── useDatasets.ts          # 数据集管理
└── index.tsx
```

### 5.4 组件配置弹窗

每个组件的设置按钮打开对应的配置弹窗:

```
components/settings/
├── TableSettings.tsx           # 表格配置
├── BarChartSettings.tsx        # 柱状图配置
├── LineChartSettings.tsx       # 折线图配置
└── PieChartSettings.tsx        # 饼图配置
```

---

## 6. 关键算法与逻辑

### 6.1 Excel解析 (Web Worker 异步分片与取消机制)

为了避免超大 Excel 文件（万行及以上）在主线程中解析导致客户端界面卡死（如影响 AI 流式输出打字机动效、拖拽卡顿等），项目采用 Web Worker 异步分片处理方案，支持进度百分比反馈以及中途取消。

```typescript
// src/utils/excelParser.ts
import { ColumnInfo } from '../types/dataset';

export interface ParseProgressEvent {
  type: 'progress';
  percent: number;
}

export interface ParseSuccessEvent {
  type: 'success';
  sheets: string[];
  data: any[];
  columns: ColumnInfo[];
}

export interface ParseErrorEvent {
  type: 'error';
  message: string;
}

export type ParseEvent = ParseProgressEvent | ParseSuccessEvent | ParseErrorEvent;

export class ExcelParser {
  private worker: Worker | null = null;

  /**
   * 异步分片解析 Excel 文件
   * @param file Excel 文件对象
   * @param onProgress 进度回调函数 (0 - 100)
   */
  async parse(
    file: File,
    onProgress: (percent: number) => void
  ): Promise<Omit<ParseSuccessEvent, 'type'>> {
    // 卫语句：校验文件后缀格式
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      throw new Error('仅支持上传 .xlsx 或 .xls 格式的 Excel 文件');
    }

    return new Promise((resolve, reject) => {
      // 卫语句：若已存在解析任务，先终止以释放资源
      if (this.worker) {
        this.worker.terminate();
      }

      // 通过 Blob 动态封装 Worker 运行逻辑
      const workerCode = `
        importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');

        self.onmessage = async (e) => {
          const { fileBuffer } = e.data;
          try {
            const workbook = XLSX.read(fileBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // 卫语句：校验工作表内容是否存在
            const ref = worksheet['!ref'];
            if (!ref) {
              self.postMessage({ type: 'error', message: 'Excel工作表为空' });
              return;
            }
            const range = XLSX.utils.decode_range(ref);
            const totalRows = range.e.r - range.s.r;

            const batchSize = 1000; // 每批分片读取 1000 行
            const rawData = [];

            for (let i = 1; i <= totalRows; i += batchSize) {
              const currentRange = {
                s: { c: range.s.c, r: i },
                e: { c: range.e.c, r: Math.min(i + batchSize - 1, totalRows) }
              };
              const subSheet = {};
              Object.assign(subSheet, worksheet, {
                '!ref': XLSX.utils.encode_range(currentRange)
              });

              const chunk = XLSX.utils.sheet_to_json(subSheet, { header: 1 });
              
              for (const row of chunk) {
                if (row && Object.keys(row).length > 0) {
                  rawData.push(row);
                }
              }

              // 计算进度百分比并推送
              const percent = Math.min(Math.round((i / totalRows) * 100), 99);
              self.postMessage({ type: 'progress', percent });
              
              // 释放 CPU 阻塞
              await new Promise(r => setTimeout(r, 10));
            }

            const headerRow = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] || [];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const inferType = (val) => {
              if (val === null || val === undefined) return 'string';
              if (typeof val === 'number') return 'number';
              if (val instanceof Date) return 'date';
              if (typeof val === 'string' && /^\\d{4}-\\d{2}-\\d{2}$/.test(val)) return 'date';
              return 'string';
            };

            const columns = headerRow.map(key => {
              const sampleRow = jsonData[0] || {};
              return {
                name: String(key),
                type: inferType(sampleRow[key])
              };
            });

            self.postMessage({
              type: 'success',
              sheets: workbook.SheetNames,
              data: jsonData,
              columns
            });
          } catch (err) {
            self.postMessage({ type: 'error', message: err.message || '文件解析发生未知错误' });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (event: MessageEvent<ParseEvent>) => {
        const msg = event.data;

        // 卫语句：进度变更回调
        if (msg.type === 'progress') {
          onProgress(msg.percent);
          return;
        }

        // 卫语句：错误捕获
        if (msg.type === 'error') {
          this.terminate();
          reject(new Error(msg.message));
          return;
        }

        // 卫语句：解析完成返回
        if (msg.type === 'success') {
          this.terminate();
          resolve({
            sheets: msg.sheets,
            data: msg.data,
            columns: msg.columns
          });
        }
      };

      const reader = new FileReader();
      reader.onload = (e) => {
        // 卫语句：检验读取内容
        if (!e.target?.result) {
          reject(new Error('无法读取文件内容'));
          return;
        }
        this.worker?.postMessage({ fileBuffer: e.target.result });
      };
      reader.onerror = () => reject(new Error('文件读取出错'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 中止当前解析任务
   */
  cancel(): void {
    // 卫语句：未在解析中则直接返回
    if (!this.worker) {
      return;
    }
    this.terminate();
  }

  private terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
```

### 6.2 网格吸附算法

```typescript
// src/utils/gridSnap.ts
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class GridSnapper {
  constructor(
    private gridSize: number = 20,
    private snapThreshold: number = 10
  ) {}

  snap(value: number): number {
    const remainder = value % this.gridSize;
    if (remainder < this.snapThreshold) {
      return value - remainder;
    }
    if (this.gridSize - remainder < this.snapThreshold) {
      return value + (this.gridSize - remainder);
    }
    return value;
  }

  snapPosition(pos: Point): Point {
    return {
      x: this.snap(pos.x),
      y: this.snap(pos.y)
    };
  }

  snapSize(size: { width: number; height: number }): { width: number; height: number } {
    return {
      width: Math.max(this.gridSize, this.snap(size.width)),
      height: Math.max(this.gridSize, this.snap(size.height))
    };
  }
}
```

### 6.3 组件拖拽逻辑

```typescript
// src/hooks/useDragDrop.ts
export function useDragDrop() {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  const onDragStart = (componentId: string, event: MouseEvent) => {
    setDragging(componentId);
    setDragOffset({
      x: event.clientX,
      y: event.clientY
    });
  };

  const onDragMove = useCallback((event: MouseEvent) => {
    if (!dragging) return;

    const deltaX = event.clientX - dragOffset.x;
    const deltaY = event.clientY - dragOffset.y;

    const newPosition = {
      x: currentPosition.x + deltaX,
      y: currentPosition.y + deltaY
    };

    // 应用网格吸附
    const snapped = gridSnapper.snapPosition(newPosition);
    setDragPosition(snapped);
  }, [dragging, dragOffset]);

  const onDragEnd = useCallback(() => {
    if (dragging) {
      boardStore.updateComponentPosition(dragging, dragPosition);
      setDragging(null);
    }
  }, [dragging, dragPosition]);

  return { dragging, onDragStart, onDragMove, onDragEnd };
}
```

### 6.4 看板发布快照与隔离算法

发布过程需深拷贝看板组件及所绑定数据集的结构化数据，断开与原始编辑态数据源的关联。系统保证仅保留最近 5 次的发布快照版本，防范硬盘爆满。

```typescript
// src/services/publishService.ts
import { db, PublishSnapshot, BoardComponent, Dataset } from './database';

export class PublishService {
  private readonly MAX_SNAPSHOTS = 5;

  /**
   * 发布空间看板并截取当前状态快照
   * @param spaceId 工作空间ID
   * @returns 生成的快照 ID
   */
  async publish(spaceId: string): Promise<string> {
    // 卫语句：校验空间合法性
    const space = await db.spaces.get(spaceId);
    if (!space) {
      throw new Error('未找到当前工作空间');
    }

    // 1. 获取该空间下所有看板组件
    const components = await db.boardComponents
      .where('spaceId')
      .equals(spaceId)
      .toArray();

    // 卫语句：如果没有任何组件，拦截发布
    if (components.length === 0) {
      throw new Error('当前看板为空，无法发布');
    }

    // 2. 收集各组件关联的数据集ID并深拷贝结构化数据
    const datasetIds = Array.from(
      new Set(
        components
          .map(c => c.config?.dataSourceId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    const datasetsSnapshot: Dataset[] = [];
    for (const datasetId of datasetIds) {
      const originalDataset = await db.datasets.get(datasetId);
      // 卫语句：关联的数据集若丢失，中断发布以保证快照完整性
      if (!originalDataset) {
        throw new Error(`关联的数据集 "${datasetId}" 丢失，发布失败`);
      }
      
      // 执行深拷贝以实现数据源隔离
      datasetsSnapshot.push({
        ...originalDataset,
        data: JSON.parse(JSON.stringify(originalDataset.data))
      });
    }

    // 3. 计算发布版本号
    const lastSnapshot = await db.publishSnapshots
      .where('spaceId')
      .equals(spaceId)
      .last();
    const nextVersion = lastSnapshot ? lastSnapshot.version + 1 : 1;

    // 4. 创建发布版本快照
    const newSnapshotId = `${spaceId}_v${nextVersion}`;
    const newSnapshot: PublishSnapshot = {
      id: newSnapshotId,
      spaceId,
      version: nextVersion,
      components: JSON.parse(JSON.stringify(components)),
      datasets: datasetsSnapshot,
      createdAt: new Date()
    };

    await db.publishSnapshots.put(newSnapshot);

    // 5. 版本数剪枝控制 (保留最近5个)
    await this.pruneOldSnapshots(spaceId);

    return newSnapshotId;
  }

  private async pruneOldSnapshots(spaceId: string): Promise<void> {
    const snapshots = await db.publishSnapshots
      .where('spaceId')
      .equals(spaceId)
      .sortBy('version');

    // 卫语句：未达快照上限则无需清理
    if (snapshots.length <= this.MAX_SNAPSHOTS) {
      return;
    }

    const toDeleteCount = snapshots.length - this.MAX_SNAPSHOTS;
    const deletePromises = snapshots
      .slice(0, toDeleteCount)
      .map(s => db.publishSnapshots.delete(s.id));

    await Promise.all(deletePromises);
  }
}
```

### 6.5 快捷键及联动逻辑卫语句实现

用于拦截键盘快捷键，并对输入校验及锁定状态做细致把控，使用扁平的卫语句结构防止逻辑嵌套。

```typescript
// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { CommandManager } from '../core/commands/CommandManager';

export function useKeyboardShortcuts(
  commandManager: CommandManager,
  selectedComponentId: string | null,
  onDeleteComponent: (id: string) => void,
  isLocked: boolean
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrl = event.ctrlKey || event.metaKey;

      // 卫语句：若当前光标聚焦于输入域中，拦截快捷键操作，避免干扰文本打字
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      // 1. 撤销指令 (Ctrl + Z)
      if (isCtrl && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        commandManager.undo();
        return;
      }

      // 2. 重做指令 (Ctrl + Y)
      if (isCtrl && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        commandManager.redo();
        return;
      }

      // 卫语句：如果没有选中的组件，不响应删除等快捷操作
      if (!selectedComponentId) {
        return;
      }

      // 3. 删除组件 (Delete)
      if (event.key === 'Delete') {
        // 卫语句：如果组件被锁定，禁止删除
        if (isLocked) {
          return;
        }
        event.preventDefault();
        onDeleteComponent(selectedComponentId);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandManager, selectedComponentId, onDeleteComponent, isLocked]);
}

// 页面表单输入卫语句校验
export class FormInputValidator {
  /**
   * 校验表格分页跳转输入，并做越界修正
   * @param inputPageText 输入框文本内容
   * @param totalPages 总页数
   * @param onAlert 界面提示气泡回调
   */
  static validateAndCorrectPage(
    inputPageText: string,
    totalPages: number,
    onAlert: (msg: string) => void
  ): number {
    const pageNum = parseInt(inputPageText, 10);

    // 卫语句：拦截非数字非法输入，重置为第1页
    if (isNaN(pageNum)) {
      onAlert('请输入有效的页码');
      return 1;
    }

    // 卫语句：数值超下界修正
    if (pageNum < 1) {
      onAlert('页码超出范围，已自动调整');
      return 1;
    }

    // 卫语句：数值超上界修正
    if (pageNum > totalPages) {
      onAlert('页码超出范围，已自动调整');
      return totalPages;
    }

    return pageNum;
  }
}
```

---

## 7. API接口设计

### 7.1 Electron IPC 通信

```typescript
// preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  selectFile: (filters: FileFilter[]) => ipcRenderer.invoke('dialog:selectFile', filters),
  saveFile: (data: Buffer, path: string) => ipcRenderer.invoke('file:save', { data, path }),

  // 存储操作
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: any) => ipcRenderer.invoke('config:set', { key, value }),

  // 窗口操作
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // HTTP服务
  startServer: () => ipcRenderer.invoke('server:start'),
  stopServer: () => ipcRenderer.invoke('server:stop'),

  // AI请求
  chat: (endpoint: string, messages: Message[]) => ipcRenderer.invoke('ai:chat', { endpoint, messages }),
  streamChat: (endpoint: string, messages: Message[], onChunk: (chunk: string) => void) => {
    const channel = 'ai:stream';
    ipcRenderer.send(channel, { endpoint, messages });
    ipcRenderer.on(channel, (_, chunk) => onChunk(chunk));
  }
});
```

### 7.2 本地HTTP服务 (预览)

```typescript
// electron/services/httpServer.ts
import express from 'express';
import cors from 'cors';

export class PreviewServer {
  private app = express();
  private server: http.Server | null = null;
  private port = 18080;

  async start(spaceId: string): Promise<string> {
    this.app.use(cors());
    this.app.use(express.json());

    // 获取发布快照
    this.app.get('/api/preview/:spaceId', async (req, res) => {
      const snapshot = await db.publishSnapshots
        .where('spaceId')
        .equals(spaceId)
        .last();

      if (!snapshot) {
        return res.status(404).json({ error: '看板不存在或已被删除' });
      }

      res.json(snapshot);
    });

    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        resolve(`http://127.0.0.1:${this.port}/preview/${spaceId}`);
      });
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }
}
```

---

## 8. 打包配置

```json
// electron-builder.json
{
  "appId": "com.insightboard.ai",
  "productName": "本地AI看板",
  "directories": {
    "output": "dist-electron"
  },
  "files": [
    "dist/**/*",
    "package.json"
  ],
  "win": {
    "target": [
      {
        "target": "nsis",
        "arch": ["x64"]
      },
      {
        "target": "portable",
        "arch": ["x64"]
      }
    ],
    "icon": "resources/icon.ico"
  },
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  },
  "portable": {
    "artifactName": "${productName}-${version}-portable.${ext}"
  }
}
```

---

## 9. 开发规范

### 9.1 命名规范

| 类型 | 规则 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `BoardEditor.tsx` |
| 工具文件 | camelCase | `excelParser.ts` |
| 类型文件 | camelCase | `aiConfig.ts` |
| 常量 | UPPER_SNAKE_CASE | `MAX_DATASET_COUNT` |
| CSS类 | kebab-case | `.board-canvas` |

### 9.2 目录规范

- 每个模块一个目录
- 组件/hooks/utils 放在一起
- 页面组件以 `index.tsx` 导出
- 私有组件放 `components/` 子目录

### 9.3 代码质量

- 使用 TypeScript 严格模式
- 所有API使用 async/await
- 错误需要 try/catch 并给出友好提示
- 关键逻辑需要注释
- 避免魔法数字，使用常量

---

## 10. 版本规划

### Phase 1: 基础框架
- [x] Electron 项目搭建
- [x] React + TypeScript 配置
- [x] 基础 UI 组件库
- [x] 路由与状态管理

### Phase 2: 核心功能
- [x] AI 配置管理
- [x] 空间管理
- [x] 数据集上传解析
- [x] 基础表格组件

### Phase 3: 看板编辑
- [x] 组件拖拽
- [x] 网格吸附
- [x] 撤销/重做
- [x] 图表组件

### Phase 4: AI对话
- [x] AI面板
- [x] 流式输出
- [x] 对话历史

### Phase 5: 发布预览
- [x] 快照保存
- [x] 本地HTTP服务
- [x] 浏览器预览

### Phase 6: 优化与打包
- [x] 性能优化
- [x] EXE 打包
- [x] 测试与修复