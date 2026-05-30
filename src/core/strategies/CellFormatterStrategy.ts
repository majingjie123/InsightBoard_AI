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
      minimumFractionDigits: config.precision ?? 2,
      maximumFractionDigits: config.precision ?? 2,
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

export const cellFormatter = new CellFormatterContext();
export default cellFormatter;
