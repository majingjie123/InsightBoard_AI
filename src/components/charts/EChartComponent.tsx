import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import 'echarts-gl';
import { ChartConfig } from '../../types/board';
import { Dataset } from '../../types/dataset';
import { dataSampler, LttbSamplingStrategy, SystematicSamplingStrategy } from '../../core/strategies/DataSamplingStrategy';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface EChartComponentProps {
  config: ChartConfig;
  dataset: Dataset | null;
  name: string;
}

export const EChartComponent: React.FC<EChartComponentProps> = ({ config, dataset, name }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [errorState, setErrorState] = useState<'none' | 'no-source' | 'missing-fields'>('none');
  const [sampledTip, setSampledTip] = useState<string | null>(null);
  const [webglFallbackTip, setWebglFallbackTip] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [disableSamplingForCurrentChart, setDisableSamplingForCurrentChart] = useState(false);
  const [hasNoData, setHasNoData] = useState(false);

  // 1. 字段及数据源正确性校验
  useEffect(() => {
    // 卫语句：无数据集
    if (!dataset) {
      setErrorState('no-source');
      return;
    }

    // 卫语句：校验字段是否存在于数据集中
    const hasX = dataset.columns.some(c => c.name === config.xField);
    const hasY = dataset.columns.some(c => c.name === config.yField);
    const hasSecondaryY = !config.dualYAxis || !config.secondaryYField || dataset.columns.some(c => c.name === config.secondaryYField);
    
    // 如果是柱状图或折线图且没有配置 X/Y 轴，或者饼图没有配置对应字段，视为缺失字段
    if (!config.xField || !config.yField || !hasX || !hasY || !hasSecondaryY) {
      setErrorState('missing-fields');
      return;
    }

    setErrorState('none');
  }, [dataset, config.xField, config.yField, config.secondaryYField, config.dualYAxis]);

  // 2. 核心图表数据聚合处理与渲染
  useEffect(() => {
    // 卫语句：有错误状态或图表 DOM 未就绪，拦截渲染
    if (errorState !== 'none' || !chartRef.current || !dataset) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
      return;
    }

    // 初始化图表实例
    const dataPointsCount = dataset.data.length;
    const useWebGL = dataPointsCount > 10000;

    if (!chartInstanceRef.current) {
      try {
        chartInstanceRef.current = echarts.init(chartRef.current, undefined, {
          renderer: useWebGL ? ('webgl' as any) : 'svg'
        });
        setWebglFallbackTip(null);
      } catch (error) {
        chartInstanceRef.current = echarts.init(chartRef.current, undefined, {
          renderer: 'canvas'
        });
        if (useWebGL) {
          setWebglFallbackTip('当前环境不支持 WebGL 图表渲染，已自动回退 Canvas');
        }
      }
    }

    // 2.1 聚合计算 (流式计算：对 X 轴重复的项即时累加，避免创建巨大的中间数组)
    const rawData = dataset.data;
    const statsMap = new Map<string, { sum: number; count: number; max: number; min: number }>();

    for (const row of rawData) {
      const xVal = String(row[config.xField] ?? '');
      if (xVal === '') continue;

      const yVal = Number(row[config.yField]);
      const val = isNaN(yVal) ? 0 : yVal;
      
      const stats = statsMap.get(xVal) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
      stats.sum += val;
      stats.count += 1;
      stats.max = Math.max(stats.max, val);
      stats.min = Math.min(stats.min, val);
      statsMap.set(xVal, stats);
    }

    // 将统计结果转为 ECharts 绘图点
    let aggregatedList = Array.from(statsMap.entries()).map(([x, stats]) => {
      let finalVal = 0;
      switch (config.aggregation) {
        case 'sum': finalVal = stats.sum; break;
        case 'avg': finalVal = stats.count > 0 ? stats.sum / stats.count : 0; break;
        case 'count': finalVal = stats.count; break;
        case 'max': finalVal = stats.max === -Infinity ? 0 : stats.max; break;
        case 'min': finalVal = stats.min === Infinity ? 0 : stats.min; break;
        default: finalVal = stats.sum;
      }
      return { x, y: finalVal };
    });

    // 智能过滤：只保留数值不为 0 且有效的分类，剔除无数据的类别占位
    aggregatedList = aggregatedList.filter(item => item.y !== 0 && item.y !== null && item.y !== undefined && !isNaN(item.y));

    // 限制分类最多显示个数 (Top N)
    if (config.maxCategories && config.maxCategories > 0) {
      aggregatedList = aggregatedList.slice(0, config.maxCategories);
    }

    // 2.2 大数据降采样控制
    const originalLength = aggregatedList.length;
    let isSampled = false;

    if (config.enableDownSampling !== false && !disableSamplingForCurrentChart && originalLength > 5000) {
      // 大于 5000 点开启等间隔降采样（对于时序折线使用 LTTB，普通图表使用等间隔）
      isSampled = true;
      if (config.chartType === 'line') {
        dataSampler.setStrategy(new LttbSamplingStrategy());
      } else {
        dataSampler.setStrategy(new SystematicSamplingStrategy());
      }
      
      // 降采样至 1000 点
      aggregatedList = dataSampler.execute(aggregatedList, 1000, 'x', 'y');
      setSampledTip(`数据点过多 (${originalLength})，已自动简化渲染`);
    } else {
      setSampledTip(null);
    }

    const xAxisData = aggregatedList.map(item => item.x);
    const yAxisData = aggregatedList.map(item => item.y);

    // 2.2.5 智能 dataZoom 滚动条控制（当数据点超过 30 个时启用，只默认展示前 30 个）
    const totalPoints = xAxisData.length;
    const enableDataZoom = totalPoints > 30;
    const dataZoomPercent = enableDataZoom ? Math.min(100, Math.ceil(30 / totalPoints * 100)) : 100;
    const dataZoomOption = enableDataZoom ? [
      {
        type: 'slider' as const,
        show: true,
        xAxisIndex: [0],
        start: 0,
        end: dataZoomPercent,
        height: 18,
        bottom: 30,
        textStyle: { fontSize: 10 }
      },
      {
        type: 'inside' as const,
        xAxisIndex: [0],
        start: 0,
        end: dataZoomPercent
      }
    ] : undefined;

    // 计算自适应 X 轴标签旋转角度
    const xLabelRotate = originalLength > 30 ? 45 : (originalLength > 10 ? 30 : 0);

    // 数据项过多（大于 30）时，强制隐藏柱顶数值标签以规避数值重叠，靠 hover tooltip 查看
    const autoShowLabel = config.showDataLabel && originalLength <= 30;

    // 柱体自适应宽度及组间间距（分类多则收窄，分类少则加宽）
    const dynamicBarWidth = originalLength > 50 ? '30%' : (originalLength > 20 ? '45%' : '60%');
    const dynamicBarCategoryGap = originalLength > 50 ? '35%' : '20%';

    // 2.3 构建 ECharts Option
    let option: echarts.EChartsOption = {};

    const baseTitle = config.title || name;
    const colors = config.colors && config.colors.length > 0 ? config.colors : ['#3b82f6'];
    const precision = config.precision ?? 2;

    if (config.chartType === 'pie' || config.chartType === 'ring' || config.chartType === 'rose') {
      // 饼图/环形图/玫瑰图配置
      let pieData = xAxisData.map((x, index) => ({
        name: x,
        value: yAxisData[index]
      }));

      // 对小占比的饼图扇区合并为“其他”
      const totalSum = yAxisData.reduce((a, b) => a + b, 0);
      if (pieData.length > 8 && totalSum > 0) {
        const threshold = totalSum * 0.02; // 占比小于 2% 合并
        let otherSum = 0;
        const mainData = [];
        for (const item of pieData) {
          if (item.value < threshold) {
            otherSum += item.value;
          } else {
            mainData.push(item);
          }
        }
        if (otherSum > 0) {
          mainData.push({ name: '其他', value: otherSum });
          pieData = mainData;
        }
      }

      const legendPosition = config.legendPosition || 'bottom';
      const legendOption = legendPosition === 'center'
        ? { orient: 'horizontal' as const, left: 'center' as const, top: 'middle' as const, type: 'scroll' as const }
        : legendPosition === 'left' || legendPosition === 'right'
          ? { orient: 'vertical' as const, [legendPosition]: 0, top: 'middle' as const, type: 'scroll' as const }
          : { orient: 'horizontal' as const, left: 'center' as const, [legendPosition]: 0, type: 'scroll' as const };

      option = {
        title: { text: baseTitle, left: 'center', textStyle: { fontSize: 14, fontWeight: 'normal' } },
        tooltip: {
          trigger: 'item',
          confine: true,
          formatter: (params: any) => {
            return `${params.seriesName} <br/>${params.name} : ${params.value.toFixed(precision)} (${params.percent}%)`;
          }
        },
        legend: config.showLegend !== false ? legendOption : undefined,
        color: colors,
        series: [
          {
            name: config.yField,
            type: 'pie',
            radius: config.chartType === 'ring' ? ['40%', '70%'] : '70%',
            roseType: config.chartType === 'rose' ? 'radius' : undefined,
            data: pieData,
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            },
            label: {
              show: config.showDataLabel !== false,
              formatter: (params: any) => {
                return `${params.name}: ${params.percent}%`;
              }
            },
            labelLine: {
              show: config.showPieLabelLine !== false
            },
            labelLayout: {
              hideOverlap: true
            }
          }
        ]
      };
    } else if (config.chartType === 'bar' || config.chartType === 'group' || config.chartType === 'stack') {
      // 柱状图配置
      const shouldUseSeries = Boolean(config.seriesField && (config.chartType === 'group' || config.chartType === 'stack'));
      let activeSeriesNames: string[] = [];
      let barSeries: any[] = [
        {
          name: config.yField,
          type: 'bar',
          data: yAxisData,
          large: useWebGL,
          barWidth: dynamicBarWidth,
          label: autoShowLabel ? {
            show: true,
            position: config.chartType === 'stack' ? 'inside' : 'top',
            formatter: (params: any) => {
              const val = Number(params.value);
              return val === 0 ? '' : val.toFixed(precision);
            }
          } : undefined,
          labelLayout: { hideOverlap: true }
        }
      ];

      if (shouldUseSeries) {
        const xSet = new Set<string>();
        const seriesSet = new Set<string>();
        // 使用统计对象替代数组列表：Map<xValue, Map<seriesName, Stats>>
        const groupedStats = new Map<string, Map<string, { sum: number; count: number; max: number; min: number }>>();

        for (const row of rawData) {
          const xVal = String(row[config.xField] ?? '');
          const seriesVal = String(row[config.seriesField || ''] ?? '');
          const yVal = Number(row[config.yField]);
          if (!xVal || !seriesVal) continue;

          xSet.add(xVal);
          seriesSet.add(seriesVal);

          const xMap = groupedStats.get(xVal) || new Map();
          const stats = xMap.get(seriesVal) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
          
          const val = isNaN(yVal) ? 0 : yVal;
          stats.sum += val;
          stats.count += 1;
          stats.max = Math.max(stats.max, val);
          stats.min = Math.min(stats.min, val);

          xMap.set(seriesVal, stats);
          groupedStats.set(xVal, xMap);
        }

        const groupedXAxisData = Array.from(xSet);
        const seriesNames = Array.from(seriesSet);

        const getFinalValue = (stats: { sum: number; count: number; max: number; min: number } | undefined) => {
          if (!stats) return 0;
          switch (config.aggregation) {
            case 'sum': return stats.sum;
            case 'avg': return stats.count > 0 ? stats.sum / stats.count : 0;
            case 'count': return stats.count;
            case 'max': return stats.max === -Infinity ? 0 : stats.max;
            case 'min': return stats.min === Infinity ? 0 : stats.min;
            default: return stats.sum;
          }
        };

        // 智能过滤：过滤并移去无有效数据的系列
        activeSeriesNames = seriesNames.filter(seriesName => {
          let hasData = false;
          for (const x of groupedXAxisData) {
            const val = getFinalValue(groupedStats.get(x)?.get(seriesName));
            if (val !== 0 && val !== null && val !== undefined && !isNaN(val)) {
              hasData = true;
              break;
            }
          }
          return hasData;
        });

        // 智能过滤：过滤并移去该分类下全系列均无数据的 X 轴目
        let activeXAxisData = groupedXAxisData.filter(x => {
          let hasData = false;
          for (const seriesName of activeSeriesNames) {
            const val = getFinalValue(groupedStats.get(x)?.get(seriesName));
            if (val !== 0 && val !== null && val !== undefined && !isNaN(val)) {
              hasData = true;
              break;
            }
          }
          return hasData;
        });

        // 限制分类最多显示个数 (Top N)
        if (config.maxCategories && config.maxCategories > 0) {
          activeXAxisData = activeXAxisData.slice(0, config.maxCategories);
        }

        barSeries = activeSeriesNames.map(seriesName => ({
          name: seriesName,
          type: 'bar',
          stack: config.chartType === 'stack' ? 'total' : undefined,
          data: activeXAxisData.map(x => getFinalValue(groupedStats.get(x)?.get(seriesName))),
          large: useWebGL,
          barWidth: dynamicBarWidth,
          barGap: '10%',
          label: autoShowLabel ? {
            show: true,
            position: config.chartType === 'stack' ? 'inside' : 'top',
            formatter: (params: any) => {
              const val = Number(params.value);
              return val === 0 ? '' : val.toFixed(precision);
            }
          } : undefined,
          labelLayout: { hideOverlap: true }
        }));

        if (config.dualYAxis && config.secondaryYField) {
          // 仅在启用双 Y 轴时，才把原有的柱子系列绑定到主数值轴
          barSeries = barSeries.map(s => ({ ...s, yAxisIndex: 0 }));

          // 计算并加入副数值轴折线系列
          const secondaryStats = new Map<string, { sum: number; count: number; max: number; min: number }>();
          for (const row of rawData) {
            const xVal = String(row[config.xField] ?? '');
            const yVal = Number(row[config.secondaryYField]);
            if (!xVal) continue;

            const val = isNaN(yVal) ? 0 : yVal;
            const stats = secondaryStats.get(xVal) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
            stats.sum += val;
            stats.count += 1;
            stats.max = Math.max(stats.max, val);
            stats.min = Math.min(stats.min, val);
            secondaryStats.set(xVal, stats);
          }

          const getFinalValue = (stats: { sum: number; count: number; max: number; min: number } | undefined) => {
            if (!stats) return 0;
            switch (config.aggregation) {
              case 'sum': return stats.sum;
              case 'avg': return stats.count > 0 ? stats.sum / stats.count : 0;
              case 'count': return stats.count;
              case 'max': return stats.max === -Infinity ? 0 : stats.max;
              case 'min': return stats.min === Infinity ? 0 : stats.min;
              default: return stats.sum;
            }
          };

          const secondaryYData = activeXAxisData.map(x => getFinalValue(secondaryStats.get(x)));

          barSeries.push({
            name: config.secondaryYField,
            type: 'line',
            yAxisIndex: 1,
            data: secondaryYData,
            smooth: config.smoothLine || false,
            label: autoShowLabel ? {
              show: true,
              position: 'top',
              formatter: (params: any) => {
                const val = Number(params.value);
                return val === 0 ? '' : val.toFixed(precision);
              }
            } : undefined,
            labelLayout: { hideOverlap: true }
          });
        }

        // 开启了“显示柱体总数”且是堆叠图，增加用于在顶部渲染总数的透明辅助系列
        if (config.chartType === 'stack' && config.showTotalLabel) {
          const totalData = activeXAxisData.map(x => {
            let sum = 0;
            for (const seriesName of activeSeriesNames) {
              sum += getFinalValue(groupedStats.get(x)?.get(seriesName));
            }
            return sum;
          });

          barSeries.push({
            name: '总计',
            type: 'bar',
            stack: 'total',
            yAxisIndex: 0,
            data: totalData,
            itemStyle: { color: 'rgba(0,0,0,0)' },
            label: {
              show: true,
              position: 'top',
              formatter: (params: any) => {
                const val = Number(params.value);
                return val === 0 ? '' : val.toFixed(precision);
              },
              textStyle: { color: '#475569', fontWeight: 'bold', fontSize: 11 }
            },
            tooltip: { show: false }
          });
        }

        xAxisData.splice(0, xAxisData.length, ...activeXAxisData);
      } else if (config.dualYAxis && config.secondaryYField) {
        // 双 Y 轴混合图（柱状 + 折线）
        const secondaryStats = new Map<string, { sum: number; count: number; max: number; min: number }>();
        for (const row of rawData) {
          const xVal = String(row[config.xField] ?? '');
          const yVal = Number(row[config.secondaryYField]);
          if (!xVal) continue;

          const val = isNaN(yVal) ? 0 : yVal;
          const stats = secondaryStats.get(xVal) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
          stats.sum += val;
          stats.count += 1;
          stats.max = Math.max(stats.max, val);
          stats.min = Math.min(stats.min, val);
          secondaryStats.set(xVal, stats);
        }

        const getFinalValue = (stats: { sum: number; count: number; max: number; min: number } | undefined) => {
          if (!stats) return 0;
          switch (config.aggregation) {
            case 'sum': return stats.sum;
            case 'avg': return stats.count > 0 ? stats.sum / stats.count : 0;
            case 'count': return stats.count;
            case 'max': return stats.max === -Infinity ? 0 : stats.max;
            case 'min': return stats.min === Infinity ? 0 : stats.min;
            default: return stats.sum;
          }
        };

        const secondaryYData = xAxisData.map(x => getFinalValue(secondaryStats.get(x)));

        barSeries = [
          { ...barSeries[0], yAxisIndex: 0 },
          {
            name: config.secondaryYField,
            type: 'line',
            yAxisIndex: 1,
            data: secondaryYData,
            smooth: config.smoothLine || false,
            label: autoShowLabel ? {
              show: true,
              position: 'top',
              formatter: (params: any) => {
                const val = Number(params.value);
                return val === 0 ? '' : val.toFixed(precision);
              }
            } : undefined,
            labelLayout: { hideOverlap: true }
          }
        ];
      }

      option = {
        title: { text: baseTitle, textStyle: { fontSize: 14, fontWeight: 'normal' } },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          confine: true,
          formatter: (params: any) => {
            let res = `${params[0].name}`;
            params.forEach((item: any) => {
              res += `<br/>${item.marker} ${item.seriesName}: ${item.value.toFixed(precision)}`;
            });
            return res;
          }
        },
        legend: config.showLegend ? { data: shouldUseSeries ? activeSeriesNames : undefined, bottom: 0, left: 'center', type: 'scroll' as const, orient: 'horizontal' as const } : undefined,
        grid: { left: '3%', right: '4%', bottom: enableDataZoom ? 75 : 40, containLabel: true },
        color: colors,
        dataZoom: dataZoomOption,
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisLabel: {
            rotate: xLabelRotate,
            interval: originalLength > 50 ? 'auto' : 0,
            formatter: (val: string) => {
              if (typeof val === 'string' && val.length > 8) {
                return val.substring(0, 8) + '...';
              }
              return val;
            }
          }
        },
        yAxis: config.dualYAxis && config.secondaryYField
          ? [
              { 
                type: 'value', 
                name: config.yField,
                axisLabel: {
                  formatter: (val: number) => {
                    if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
                    if (val >= 10000) return (val / 10000).toFixed(1) + '万';
                    return new Intl.NumberFormat('zh-CN').format(val);
                  }
                }
              },
              { 
                type: 'value', 
                name: config.secondaryYField,
                axisLabel: {
                  formatter: (val: number) => {
                    if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
                    if (val >= 10000) return (val / 10000).toFixed(1) + '万';
                    return new Intl.NumberFormat('zh-CN').format(val);
                  }
                }
              }
            ]
          : { 
              type: 'value',
              axisLabel: {
                formatter: (val: number) => {
                  if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
                  if (val >= 10000) return (val / 10000).toFixed(1) + '万';
                  return new Intl.NumberFormat('zh-CN').format(val);
                }
              }
            },
        series: barSeries
      };
    } else {
      // 折线图配置 (线形图)
      let lineSeries: any[] = [
        {
          name: config.yField,
          type: 'line',
          data: yAxisData,
          smooth: config.smoothLine || false,
          large: useWebGL,
          areaStyle: config.areaFill ? { opacity: 0.3 } : undefined,
          label: autoShowLabel ? {
            show: true,
            position: 'top',
            formatter: (params: any) => params.value.toFixed(precision)
          } : undefined,
          labelLayout: { hideOverlap: true }
        }
      ];

      if (config.dualYAxis && config.secondaryYField) {
        const secondaryStats = new Map<string, { sum: number; count: number; max: number; min: number }>();
        for (const row of rawData) {
          const xVal = String(row[config.xField] ?? '');
          const yVal = Number(row[config.secondaryYField]);
          if (!xVal) continue;

          const val = isNaN(yVal) ? 0 : yVal;
          const stats = secondaryStats.get(xVal) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
          stats.sum += val;
          stats.count += 1;
          stats.max = Math.max(stats.max, val);
          stats.min = Math.min(stats.min, val);
          secondaryStats.set(xVal, stats);
        }

        const getFinalValue = (stats: { sum: number; count: number; max: number; min: number } | undefined) => {
          if (!stats) return 0;
          switch (config.aggregation) {
            case 'sum': return stats.sum;
            case 'avg': return stats.count > 0 ? stats.sum / stats.count : 0;
            case 'count': return stats.count;
            case 'max': return stats.max === -Infinity ? 0 : stats.max;
            case 'min': return stats.min === Infinity ? 0 : stats.min;
            default: return stats.sum;
          }
        };

        lineSeries = [
          { ...lineSeries[0], yAxisIndex: 0 },
          {
            name: config.secondaryYField,
            type: 'line',
            yAxisIndex: 1,
            data: xAxisData.map(x => getFinalValue(secondaryStats.get(x))),
            smooth: config.smoothLine || false,
            large: useWebGL,
            label: autoShowLabel ? {
              show: true,
              position: 'top',
              formatter: (params: any) => params.value.toFixed(precision)
            } : undefined,
            labelLayout: { hideOverlap: true }
          }
        ];
      }

      option = {
        title: { text: baseTitle, textStyle: { fontSize: 14, fontWeight: 'normal' } },
        tooltip: {
          trigger: 'axis',
          confine: true,
          formatter: (params: any) => {
            let res = `${params[0].name}`;
            params.forEach((item: any) => {
              res += `<br/>${item.marker} ${item.seriesName}: ${item.value.toFixed(precision)}`;
            });
            return res;
          }
        },
        legend: config.showLegend ? { bottom: 0, left: 'center', type: 'scroll' as const, orient: 'horizontal' as const } : undefined,
        grid: { left: '3%', right: '4%', bottom: enableDataZoom ? 75 : 40, containLabel: true },
        color: colors,
        dataZoom: dataZoomOption,
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisLabel: {
            rotate: xLabelRotate,
            interval: originalLength > 50 ? 'auto' : 0,
            formatter: (val: string) => {
              if (typeof val === 'string' && val.length > 8) {
                return val.substring(0, 8) + '...';
              }
              return val;
            }
          }
        },
        yAxis: config.dualYAxis && config.secondaryYField
          ? [
              { 
                type: 'value', 
                name: config.yField,
                axisLabel: {
                  formatter: (val: number) => {
                    if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
                    if (val >= 10000) return (val / 10000).toFixed(1) + '万';
                    return new Intl.NumberFormat('zh-CN').format(val);
                  }
                }
              },
              { 
                type: 'value', 
                name: config.secondaryYField,
                axisLabel: {
                  formatter: (val: number) => {
                    if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
                    if (val >= 10000) return (val / 10000).toFixed(1) + '万';
                    return new Intl.NumberFormat('zh-CN').format(val);
                  }
                }
              }
            ]
          : { 
              type: 'value',
              axisLabel: {
                formatter: (val: number) => {
                  if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
                  if (val >= 10000) return (val / 10000).toFixed(1) + '万';
                  return new Intl.NumberFormat('zh-CN').format(val);
                }
              }
            },
        series: lineSeries
      };
    }

    // 智能兜底：全部数据均为 0/空时展示「暂无有效数据」而不渲染任何图表轴线
    const isDataEmpty = xAxisData.length === 0;

    if (isDataEmpty) {
      setHasNoData(true);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
      return;
    } else {
      setHasNoData(false);
    }

    chartInstanceRef.current.setOption(option, { notMerge: true });

    // 使用 ResizeObserver 监听容器尺寸变化，实现真正的动态缩放
    const resizeObserver = new ResizeObserver(() => {
      chartInstanceRef.current?.resize();
    });

    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [dataset, config, errorState, refreshKey, disableSamplingForCurrentChart]);

  // 处理刷新按钮
  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRefreshKey(prev => prev + 1);
  };

  // 3. UI 渲染与异常状态遮罩
  return (
    <div className="relative w-full h-full bg-white rounded flex flex-col p-3 group/chart">
      {/* 头部标题与控制栏 */}
      <div className="flex justify-between items-center mb-1 border-b pb-1 border-slate-100">
        <span className="text-sm font-semibold text-slate-700 truncate max-w-[200px]" title={config.title || name}>
          {config.title || name}
        </span>
        <button
          onClick={handleRefresh}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100 opacity-0 group-hover/chart:opacity-100"
          title="重新计算并刷新"
        >
          <RefreshCw size={14} className="animate-hover" />
        </button>
      </div>

      {/* 图表渲染容器 */}
      <div className="flex-1 w-full relative min-h-0">
        <div ref={chartRef} className="w-full h-full" />

        {/* 降采样简易提示 */}
        {sampledTip && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDisableSamplingForCurrentChart(true);
              setSampledTip(null);
            }}
            className="absolute left-2 bottom-2 text-[10px] bg-amber-50 text-amber-700 px-2.5 py-1.5 rounded border border-amber-200 shadow-sm hover:bg-amber-100 transition-colors text-left"
            title="点击后使用原始数据渲染"
          >
            {sampledTip}
          </button>
        )}

        {webglFallbackTip && (
          <div className="absolute left-2 bottom-9 text-[10px] bg-slate-900/85 text-white px-2.5 py-1.5 rounded shadow-sm">
            {webglFallbackTip}
          </div>
        )}

        {/* 数据源被删除遮罩 */}
        {errorState === 'no-source' && (
          <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4">
            <AlertCircle size={28} className="text-slate-400 mb-2" />
            <span className="text-sm font-medium text-slate-600">数据源已失效</span>
            <span className="text-xs text-slate-400 mt-1">关联的数据集可能已被整体删除</span>
          </div>
        )}

        {/* 字段缺失红色图标警告 */}
        {errorState === 'missing-fields' && (
          <div className="absolute inset-0 bg-red-50/90 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4">
            <AlertCircle size={28} className="text-red-400 mb-2" />
            <span className="text-sm font-medium text-red-700">配置字段缺失</span>
            <span className="text-xs text-red-500 mt-1">数据集可能发生变更，请点击“设置”重新绑定</span>
          </div>
        )}

        {/* 全部数据均为0/空：暂无有效数据遮罩 */}
        {hasNoData && errorState === 'none' && (
          <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4">
            <AlertCircle size={28} className="text-slate-400 mb-2" />
            <span className="text-sm font-medium text-slate-600">暂无有效数据</span>
            <span className="text-xs text-slate-400 mt-1">图表数据已被过滤或数值全部为零/空</span>
          </div>
        )}
      </div>
    </div>
  );
};
