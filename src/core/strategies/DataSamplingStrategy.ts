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
      const avgRangeLength = avgRangeEnd - avgRangeStart;

      // 卫语句：避免除以 0 导致 NaN 错误
      if (avgRangeLength > 0) {
        for (let idx = avgRangeStart; idx < avgRangeEnd; idx++) {
          avgX += idx; // 使用索引作为 X 轴时间代理值
          avgY += Number(data[idx][yField]) || 0;
        }
        avgX /= avgRangeLength;
        avgY /= avgRangeLength;
      }

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

export const dataSampler = new DataSampler();
export default dataSampler;
