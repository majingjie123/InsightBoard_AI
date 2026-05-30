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

    // 2.3 构建 ECharts Option
    let option: echarts.EChartsOption = {};

    const baseTitle = config.title || name;
    const colors = config.colors && config.colors.length > 0 ? config.colors : ['#3b82f6'];
    const precision = config.precision ?? 2;

    if (config.chartType === 'pie' || config.chartType === 'ring' || config.chartType === 'rose') {
      // 饼图/环形图/玫瑰图配置
      const pieData = xAxisData.map((x, index) => ({
        name: x,
        value: yAxisData[index]
      }));

      const legendPosition = config.legendPosition || 'top';
      const legendOption = legendPosition === 'center'
        ? { orient: 'horizontal' as const, left: 'center' as const, top: 'middle' as const, type: 'scroll' as const }
        : legendPosition === 'left' || legendPosition === 'right'
          ? { orient: 'vertical' as const, [legendPosition]: 0, top: 'middle' as const, type: 'scroll' as const }
          : { orient: 'horizontal' as const, left: 'center' as const, [legendPosition]: 0, type: 'scroll' as const };

      option = {
        title: { text: baseTitle, left: 'center', textStyle: { fontSize: 14, fontWeight: 'normal' } },
        tooltip: {
          trigger: 'item',
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
            }
          }
        ]
      };
    } else if (config.chartType === 'bar' || config.chartType === 'group' || config.chartType === 'stack') {
      // 柱状图配置
      const shouldUseSeries = Boolean(config.seriesField && (config.chartType === 'group' || config.chartType === 'stack'));
      let barSeries: any[] = [
        {
          name: config.yField,
          type: 'bar',
          data: yAxisData,
          large: useWebGL,
          label: config.showDataLabel ? {
            show: true,
            position: 'top',
            formatter: (params: any) => params.value.toFixed(precision)
          } : undefined
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

        barSeries = seriesNames.map(seriesName => ({
          name: seriesName,
          type: 'bar',
          stack: config.chartType === 'stack' ? 'total' : undefined,
          data: groupedXAxisData.map(x => getFinalValue(groupedStats.get(x)?.get(seriesName))),
          large: useWebGL,
          label: config.showDataLabel ? {
            show: true,
            position: 'top',
            formatter: (params: any) => params.value.toFixed(precision)
          } : undefined
        }));

        xAxisData.splice(0, xAxisData.length, ...groupedXAxisData);
      }

      option = {
        title: { text: baseTitle, textStyle: { fontSize: 14, fontWeight: 'normal' } },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            let res = `${params[0].name}`;
            params.forEach((item: any) => {
              res += `<br/>${item.marker} ${item.seriesName}: ${item.value.toFixed(precision)}`;
            });
            return res;
          }
        },
        legend: config.showLegend ? { top: 'top' } : undefined,
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        color: colors,
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisLabel: {
            rotate: 45, // 旋转标签，避免重叠
            interval: originalLength > 50 ? 'auto' : 0
          }
        },
        yAxis: { type: 'value' },
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
          label: config.showDataLabel ? {
            show: true,
            position: 'top',
            formatter: (params: any) => params.value.toFixed(precision)
          } : undefined
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
            label: config.showDataLabel ? {
              show: true,
              position: 'top',
              formatter: (params: any) => params.value.toFixed(precision)
            } : undefined
          }
        ];
      }

      option = {
        title: { text: baseTitle, textStyle: { fontSize: 14, fontWeight: 'normal' } },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            let res = `${params[0].name}`;
            params.forEach((item: any) => {
              res += `<br/>${item.marker} ${item.seriesName}: ${item.value.toFixed(precision)}`;
            });
            return res;
          }
        },
        legend: config.showLegend ? { top: 'top' } : undefined,
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        color: colors,
        xAxis: {
          type: 'category',
          data: xAxisData,
          axisLabel: {
            rotate: 45,
            interval: originalLength > 50 ? 'auto' : 0
          }
        },
        yAxis: config.dualYAxis && config.secondaryYField
          ? [
              { type: 'value', name: config.yField },
              { type: 'value', name: config.secondaryYField }
            ]
          : { type: 'value' },
        series: lineSeries
      };
    }

    chartInstanceRef.current.setOption(option);

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
      </div>
    </div>
  );
};
