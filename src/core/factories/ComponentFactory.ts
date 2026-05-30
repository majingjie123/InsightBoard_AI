import { BoardComponent, ComponentType, TableConfig, ChartConfig } from '../../types/board';

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 获取组件默认名称
 */
function getDefaultName(type: ComponentType): string {
  const names: Record<ComponentType, string> = {
    table: '基础数据表格',
    bar: '基础柱状图',
    line: '趋势折线图',
    pie: '环形饼图'
  };
  return names[type];
}

/**
 * 默认表格配置
 */
function getDefaultTableConfig(): TableConfig {
  return {
    dataSourceId: '',
    hiddenColumns: [],
    pageSize: 20,
    style: {
      rowHeight: 'standard',
      stripe: true,
      headerBg: '#f8f9fa',
      fontSize: 14
    },
    columnFormatters: {}
  };
}

/**
 * 默认图表配置
 */
function getDefaultChartConfig(type: ComponentType): ChartConfig {
  const baseConfig: ChartConfig = {
    dataSourceId: '',
    xField: '',
    yField: '',
    aggregation: 'sum',
    showLegend: true,
    showDataLabel: false,
    enableDownSampling: true
  };

  switch (type) {
    case 'bar':
      return {
        ...baseConfig,
        chartType: 'bar',
        title: '',
        colors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de']
      };
    case 'line':
      return {
        ...baseConfig,
        chartType: 'line',
        smoothLine: false,
        areaFill: false,
        title: ''
      };
    case 'pie':
      return {
        ...baseConfig,
        chartType: 'ring',
        title: ''
      };
    default:
      return baseConfig;
  }
}

/**
 * 组件工厂接口
 */
export interface ComponentFactoryOptions {
  spaceId: string;
  name?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

/**
 * 组件工厂类
 * 用于创建不同类型的看板组件，支持默认配置
 */
export class ComponentFactory {
  /**
   * 创建组件实例
   * @param type 组件类型
   * @param options 创建选项
   */
  create(type: ComponentType, options: ComponentFactoryOptions): BoardComponent {
    const { spaceId, name, position, size } = options;

    const baseComponent: BoardComponent = {
      id: generateId(),
      spaceId,
      type,
      name: name || `${getDefaultName(type)} - ${Date.now()}`,
      locked: false,
      createdAt: new Date(),
      position: position || { x: 0, y: 0 },
      size: size || this.getDefaultSize(type),
      config: {} as any
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
        throw new Error(`未知组件类型: ${type}`);
    }
  }

  /**
   * 创建表格组件
   */
  private createTableComponent(base: BoardComponent): BoardComponent {
    return {
      ...base,
      config: getDefaultTableConfig()
    };
  }

  /**
   * 创建柱状图组件
   */
  private createBarComponent(base: BoardComponent): BoardComponent {
    return {
      ...base,
      config: getDefaultChartConfig('bar')
    };
  }

  /**
   * 创建折线图组件
   */
  private createLineComponent(base: BoardComponent): BoardComponent {
    return {
      ...base,
      config: getDefaultChartConfig('line')
    };
  }

  /**
   * 创建饼图组件
   */
  private createPieComponent(base: BoardComponent): BoardComponent {
    return {
      ...base,
      config: getDefaultChartConfig('pie')
    };
  }

  /**
   * 获取组件默认尺寸
   */
  private getDefaultSize(type: ComponentType): { width: number; height: number } {
    switch (type) {
      case 'table':
        return { width: 600, height: 400 };
      case 'bar':
        return { width: 500, height: 350 };
      case 'line':
        return { width: 500, height: 350 };
      case 'pie':
        return { width: 400, height: 350 };
      default:
        return { width: 400, height: 300 };
    }
  }

  /**
   * 克隆组件
   * @param component 源组件
   * @param offset 偏移量
   */
  clone(component: BoardComponent, offset: { x: number; y: number } = { x: 20, y: 20 }): BoardComponent {
    return {
      ...component,
      id: generateId(),
      name: `${component.name} - 副本`,
      position: {
        x: component.position.x + offset.x,
        y: component.position.y + offset.y
      },
      createdAt: new Date()
    };
  }

  /**
   * 验证组件配置是否有效
   */
  validate(component: BoardComponent): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 表格组件验证
    if (component.type === 'table') {
      const config = component.config as TableConfig;
      if (!config.dataSourceId) {
        errors.push('请选择数据源');
      }
    }
    // 图表组件验证
    else {
      const config = component.config as ChartConfig;
      if (!config.dataSourceId) {
        errors.push('请选择数据源');
      }
      if (!config.xField) {
        errors.push('请选择X轴字段');
      }
      if (!config.yField) {
        errors.push('请选择Y轴字段');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// 导出单例
export const componentFactory = new ComponentFactory();
export default componentFactory;