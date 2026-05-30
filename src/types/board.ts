import { Dataset } from './dataset';

export type ComponentType = 'table' | 'bar' | 'line' | 'pie';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TableConfig {
  dataSourceId: string;
  hiddenColumns: string[];
  pageSize: number;
  style: {
    rowHeight: 'compact' | 'standard' | 'loose';
    stripe: boolean;
    headerBg: string;
    fontSize: number;
  };
  columnFormatters: Record<string, {
    precision?: number;
    useGrouping?: boolean;
    dateFormat?: 'YYYY-MM-DD' | 'YYYYMMDD';
  }>;
  columnWidths?: Record<string, number>;
}

export interface ChartConfig {
  dataSourceId: string;
  xField: string;
  yField: string;
  secondaryYField?: string;
  aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min';
  chartType?: 'bar' | 'line' | 'pie' | 'ring' | 'rose' | 'group' | 'stack'; // ring:环形饼图, rose:南丁格尔玫瑰图, group:分组柱状图, stack:堆叠柱状图
  seriesField?: string; // 分组/堆叠柱状图的系列字段
  dualYAxis?: boolean; // 双 Y 轴开关
  showPieLabelLine?: boolean; // 饼图引导线开关
  legendPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  showLegend?: boolean;
  showDataLabel?: boolean;
  smoothLine?: boolean; // 平滑曲线
  areaFill?: boolean; // 面积填充
  title?: string;
  colors?: string[]; // 自定义颜色数组
  enableDownSampling?: boolean; // 是否启用大数据降采样
  precision?: number; // 数值保留小数位
}

export interface BoardComponent {
  id: string;
  spaceId: string;
  type: ComponentType;
  name: string;
  position: Position;
  size: Size;
  locked: boolean;
  config: TableConfig | ChartConfig;
  createdAt: Date;
  previewGrid?: {
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;
  };
}

export interface ChatHistoryItem {
  id: string;
  spaceId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface PublishSnapshot {
  id: string; // spaceId_vVersion
  spaceId: string;
  version: number;
  components: BoardComponent[];
  datasets: Dataset[];
  createdAt: Date;
  aiPanelCollapsed?: boolean;
  chatHistory?: ChatHistoryItem[];
}
