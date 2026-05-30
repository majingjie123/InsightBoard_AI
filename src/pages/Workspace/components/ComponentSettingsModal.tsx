import React, { useState, useEffect } from 'react';
import { BoardComponent, TableConfig, ChartConfig } from '../../../types/board';
import { Dataset } from '../../../types/dataset';
import { X, Plus, Trash2 } from 'lucide-react';

interface ComponentSettingsModalProps {
  component: BoardComponent;
  datasets: Dataset[];
  onClose: () => void;
  onSave: (config: any) => void;
}

export const ComponentSettingsModal: React.FC<ComponentSettingsModalProps> = ({
  component,
  datasets,
  onClose,
  onSave
}) => {
  const isTable = component.type === 'table';

  // 1. 数据集绑定
  const [dataSourceId, setDataSourceId] = useState('');

  // 2. 表格专有配置状态
  const [pageSize, setPageSize] = useState(20);
  const [stripe, setStripe] = useState(true);
  const [rowHeight, setRowHeight] = useState<'compact' | 'standard' | 'loose'>('standard');
  const [headerBg, setHeaderBg] = useState('#f8fafc');
  const [fontSize, setFontSize] = useState(14);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  // 列格式化器：字段名 -> { precision, useGrouping, dateFormat }
  const [columnFormatters, setColumnFormatters] = useState<Record<string, any>>({});

  // 3. 图表专有配置状态
  const [xField, setXField] = useState('');
  const [yField, setYField] = useState('');
  const [secondaryYField, setSecondaryYField] = useState('');
  const [seriesField, setSeriesField] = useState('');
  const [aggregation, setAggregation] = useState<'sum' | 'avg' | 'count' | 'max' | 'min'>('sum');
  const [chartType, setChartType] = useState<string>('bar');
  const [dualYAxis, setDualYAxis] = useState(false);
  const [showPieLabelLine, setShowPieLabelLine] = useState(true);
  const [legendPosition, setLegendPosition] = useState<'top' | 'bottom' | 'left' | 'right' | 'center'>('top');
  const [showLegend, setShowLegend] = useState(true);
  const [showDataLabel, setShowDataLabel] = useState(false);
  const [smoothLine, setSmoothLine] = useState(false);
  const [areaFill, setAreaFill] = useState(false);
  const [title, setTitle] = useState('');
  const [colors, setColors] = useState<string[]>([]);
  const [enableDownSampling, setEnableDownSampling] = useState(true);
  const [precision, setPrecision] = useState(2);
  const [showTotalLabel, setShowTotalLabel] = useState(false);
  const [maxCategories, setMaxCategories] = useState<number | undefined>(undefined);

  const selectedDataset = datasets.find(d => d.id === dataSourceId) || null;

  // 4. 初始化赋值
  useEffect(() => {
    const cfg = component.config;
    setDataSourceId(cfg.dataSourceId || (datasets[0]?.id || ''));

    if (isTable) {
      const tCfg = cfg as TableConfig;
      setPageSize(tCfg.pageSize || 20);
      setStripe(tCfg.style?.stripe !== false);
      setRowHeight(tCfg.style?.rowHeight || 'standard');
      setHeaderBg(tCfg.style?.headerBg || '#f8fafc');
      setFontSize(tCfg.style?.fontSize || 14);
      setHiddenColumns(tCfg.hiddenColumns || []);
      setColumnFormatters(tCfg.columnFormatters || {});
    } else {
      const cCfg = cfg as ChartConfig;
      setXField(cCfg.xField || '');
      setYField(cCfg.yField || '');
      setSecondaryYField(cCfg.secondaryYField || '');
      setSeriesField(cCfg.seriesField || '');
      setAggregation(cCfg.aggregation || 'sum');
      setChartType(cCfg.chartType || component.type);
      setDualYAxis(cCfg.dualYAxis || false);
      setShowPieLabelLine(cCfg.showPieLabelLine !== false);
      setLegendPosition(cCfg.legendPosition || 'top');
      setShowLegend(cCfg.showLegend !== false);
      setShowDataLabel(cCfg.showDataLabel || false);
      setSmoothLine(cCfg.smoothLine || false);
      setAreaFill(cCfg.areaFill || false);
      setTitle(cCfg.title || component.name);
      setColors(cCfg.colors || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']);
      setEnableDownSampling(cCfg.enableDownSampling !== false);
      setPrecision(cCfg.precision ?? 2);
      setShowTotalLabel(cCfg.showTotalLabel || false);
      setMaxCategories(cCfg.maxCategories);
    }
  }, [component, datasets, isTable]);

  // 提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTable) {
      const savedConfig: TableConfig = {
        dataSourceId,
        hiddenColumns,
        pageSize,
        style: {
          stripe,
          rowHeight,
          headerBg,
          fontSize
        },
        columnFormatters
      };
      onSave(savedConfig);
    } else {
      const savedConfig: ChartConfig = {
        dataSourceId,
        xField,
        yField,
        secondaryYField,
        aggregation,
        chartType: chartType as any,
        seriesField,
        dualYAxis,
        showPieLabelLine,
        legendPosition,
        showLegend,
        showDataLabel,
        smoothLine,
        areaFill,
        title,
        colors,
        enableDownSampling,
        precision,
        showTotalLabel,
        maxCategories
      };
      onSave(savedConfig);
    }
  };

  // 隐藏列控制
  const handleToggleColumnHide = (colName: string) => {
    setHiddenColumns(prev =>
      prev.includes(colName) ? prev.filter(c => c !== colName) : [...prev, colName]
    );
  };

  // 更新列格式化器
  const handleUpdateColumnFormatter = (colName: string, field: string, value: any) => {
    const current = columnFormatters[colName] || {};
    setColumnFormatters(prev => ({
      ...prev,
      [colName]: {
        ...current,
        [field]: value
      }
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto select-none"
      >
        {/* 头部 */}
        <div className="flex justify-between items-center mb-5 border-b pb-2 border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">
            组件属性设置 - {component.name}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 text-xs text-slate-600">
          {/* 通用：数据源数据集选择 */}
          <div>
            <label className="block font-semibold text-slate-500 mb-1.5">选择绑定数据集</label>
            <select
              required
              value={dataSourceId}
              onChange={(e) => {
                setDataSourceId(e.target.value);
                // 切换数据集时重置绑定的字段
                setXField('');
                setYField('');
                setSecondaryYField('');
                setSeriesField('');
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700 focus:outline-none"
            >
              <option value="" disabled>选择当前空间内的数据集</option>
              {datasets.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.fileName})</option>
              ))}
            </select>
          </div>

          {/* ======================= 表格配置 ======================= */}
          {isTable && selectedDataset && (
            <div className="space-y-4">
              {/* 展示列勾选 (隐藏列管理) */}
              <div>
                <span className="block font-semibold text-slate-500 mb-2">配置字段可见性</span>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded border border-slate-100 max-h-36 overflow-y-auto">
                  {selectedDataset.columns.map(col => {
                    const isVisible = !hiddenColumns.includes(col.name);
                    return (
                      <label key={col.name} className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => handleToggleColumnHide(col.name)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{col.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* 斑马纹 / 分页条数 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1.5">每页条数</label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                  >
                    <option value={10}>10 条/页</option>
                    <option value={20}>20 条/页</option>
                    <option value={50}>50 条/页</option>
                    <option value={100}>100 条/页</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 mb-1.5">行高风格</label>
                  <select
                    value={rowHeight}
                    onChange={(e) => setRowHeight(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                  >
                    <option value="compact">紧凑 (12px)</option>
                    <option value="standard">标准 (14px)</option>
                    <option value="loose">宽松 (16px)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 py-2">
                  <input
                    type="checkbox"
                    id="stripe-check"
                    checked={stripe}
                    onChange={(e) => setStripe(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  <label htmlFor="stripe-check" className="font-semibold text-slate-600 cursor-pointer">开启斑马纹</label>
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1.5">表头背景色</label>
                  <input
                    type="color"
                    value={headerBg}
                    onChange={(e) => setHeaderBg(e.target.value)}
                    className="w-full px-1 py-0.5 border border-slate-200 rounded h-8 bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              {/* 列格式化配置 */}
              <div>
                <span className="block font-semibold text-slate-500 mb-2">数值/日期列展示格式化</span>
                <div className="space-y-3 bg-slate-50 p-3 rounded border border-slate-100 max-h-48 overflow-y-auto">
                  {selectedDataset.columns
                    .filter(c => c.type === 'number' || c.type === 'date')
                    .map(col => {
                      const fmt = columnFormatters[col.name] || {};
                      
                      return (
                        <div key={col.name} className="flex flex-col gap-1.5 border-b border-slate-200/50 pb-2 last:border-b-0 last:pb-0">
                          <span className="font-medium text-slate-700">{col.name} ({col.type === 'number' ? '数值' : '日期'})</span>
                          
                          {col.type === 'number' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] text-slate-400">保留小数位</label>
                                <select
                                  value={fmt.precision ?? 2}
                                  onChange={(e) => handleUpdateColumnFormatter(col.name, 'precision', Number(e.target.value))}
                                  className="w-full py-1 px-2 border border-slate-200 rounded bg-white text-slate-700 text-[10px]"
                                >
                                  <option value={0}>0 位</option>
                                  <option value={1}>1 位</option>
                                  <option value={2}>2 位</option>
                                  <option value={3}>3 位</option>
                                  <option value={4}>4 位</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-1.5 mt-4">
                                <input
                                  type="checkbox"
                                  id={`group-${col.name}`}
                                  checked={fmt.useGrouping !== false}
                                  onChange={(e) => handleUpdateColumnFormatter(col.name, 'useGrouping', e.target.checked)}
                                  className="rounded text-blue-600 h-3 w-3"
                                />
                                <label htmlFor={`group-${col.name}`} className="text-[10px] text-slate-500 cursor-pointer">开启千分位</label>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-[10px] text-slate-400">日期展示格式</label>
                              <select
                                value={fmt.dateFormat || 'YYYY-MM-DD'}
                                onChange={(e) => handleUpdateColumnFormatter(col.name, 'dateFormat', e.target.value)}
                                className="w-full py-1 px-2 border border-slate-200 rounded bg-white text-slate-700 text-[10px]"
                              >
                                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-05-30)</option>
                                <option value="YYYYMMDD">YYYYMMDD (20260530)</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* ======================= 图表配置 ======================= */}
          {!isTable && selectedDataset && (
            <div className="space-y-4">
              {/* X轴/Y轴映射 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1.5">分类映射 (X 轴)</label>
                  <select
                    required
                    value={xField}
                    onChange={(e) => setXField(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                  >
                    <option value="" disabled>选择分类维度列</option>
                    {selectedDataset.columns.map(c => (
                      <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block font-semibold text-slate-500 mb-1.5">数值映射 (Y 轴)</label>
                  <select
                    required
                    value={yField}
                    onChange={(e) => setYField(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                  >
                    <option value="" disabled>选择指标数值列</option>
                    {/* 优选数值列，但允许选其他做计数 */}
                    {selectedDataset.columns.map(c => (
                      <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              {component.type === 'bar' && (
                <div>
                  <label className="block font-semibold text-slate-500 mb-1.5">系列字段（分组/堆叠）</label>
                  <select
                    value={seriesField}
                    onChange={(e) => setSeriesField(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                  >
                    <option value="">不使用系列分组</option>
                    {selectedDataset.columns.map(c => (
                      <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                    ))}
                  </select>
                </div>
              )}

              {component.type === 'line' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1.5">第二数值轴字段</label>
                    <select
                      value={secondaryYField}
                      onChange={(e) => setSecondaryYField(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                    >
                      <option value="">不使用第二 Y 轴</option>
                      {selectedDataset.columns.map(c => (
                        <option key={c.name} value={c.name}>{c.name} ({c.type})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 h-9 px-3 border border-slate-200 rounded w-full cursor-pointer bg-slate-50">
                      <input
                        type="checkbox"
                        checked={dualYAxis}
                        onChange={(e) => setDualYAxis(e.target.checked)}
                        className="rounded text-blue-600 h-3.5 w-3.5"
                      />
                      <span className="font-semibold text-slate-600">启用双 Y 轴</span>
                    </label>
                  </div>
                </div>
              )}

              {/* 聚合计算方式 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1.5">数值聚合计算</label>
                  <select
                    value={aggregation}
                    onChange={(e) => setAggregation(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                  >
                    <option value="sum">求和 (Sum)</option>
                    <option value="avg">平均值 (Average)</option>
                    <option value="count">计数 (Count)</option>
                    <option value="max">最大值 (Max)</option>
                    <option value="min">最小值 (Min)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1.5">保留小数位</label>
                  <select
                    value={precision}
                    onChange={(e) => setPrecision(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                  >
                    <option value={0}>0 位</option>
                    <option value={1}>1 位</option>
                    <option value={2}>2 位</option>
                    <option value={3}>3 位</option>
                    <option value={4}>4 位</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1.5">渲染子类型</label>
                  {component.type === 'pie' ? (
                    <select
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                    >
                      <option value="pie">标准饼图</option>
                      <option value="ring">环形饼图</option>
                      <option value="rose">南丁格尔玫瑰图</option>
                    </select>
                  ) : component.type === 'bar' ? (
                    <select
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                    >
                      <option value="bar">标准柱状图</option>
                      <option value="group">分组柱状图</option>
                      <option value="stack">堆叠柱状图</option>
                    </select>
                  ) : (
                    <select
                      value={chartType}
                      onChange={(e) => setChartType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded bg-white text-slate-700"
                      disabled
                    >
                      <option value="line">标准折线图</option>
                    </select>
                  )}
                </div>
              </div>

              {/* 图表定制标题 */}
              <div>
                <label className="block font-semibold text-slate-500 mb-1.5">图表自定义标题</label>
                <input
                  type="text"
                  placeholder="未填写则默认使用组件名"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded text-slate-700"
                />
              </div>

              {/* 开关：折线图专有面积填充、平滑 */}
              {component.type === 'line' && (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2.5 rounded border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="smooth-check"
                      checked={smoothLine}
                      onChange={(e) => setSmoothLine(e.target.checked)}
                      className="rounded text-blue-600 h-4 w-4"
                    />
                    <label htmlFor="smooth-check" className="font-semibold text-slate-600 cursor-pointer">平滑折线</label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="area-check"
                      checked={areaFill}
                      onChange={(e) => setAreaFill(e.target.checked)}
                      className="rounded text-blue-600 h-4 w-4"
                    />
                    <label htmlFor="area-check" className="font-semibold text-slate-600 cursor-pointer">填充下方面积</label>
                  </div>
                </div>
              )}

              {component.type === 'pie' && (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-2.5 rounded border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="pie-label-line-check"
                      checked={showPieLabelLine}
                      onChange={(e) => setShowPieLabelLine(e.target.checked)}
                      className="rounded text-blue-600 h-4 w-4"
                    />
                    <label htmlFor="pie-label-line-check" className="font-semibold text-slate-600 cursor-pointer">显示引导线</label>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">图例位置</label>
                    <select
                      value={legendPosition}
                      onChange={(e) => setLegendPosition(e.target.value as any)}
                      className="w-full py-1 px-2 border border-slate-200 rounded bg-white text-slate-700 text-[10px]"
                    >
                      <option value="top">上方</option>
                      <option value="bottom">下方</option>
                      <option value="left">左侧</option>
                      <option value="right">右侧</option>
                      <option value="center">居中</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 图例、标签、降采样 */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="legend-check"
                    checked={showLegend}
                    onChange={(e) => setShowLegend(e.target.checked)}
                    className="rounded text-blue-600 h-3.5 w-3.5"
                  />
                  <label htmlFor="legend-check" className="text-slate-500 cursor-pointer">显示图例</label>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="label-check"
                    checked={showDataLabel}
                    onChange={(e) => setShowDataLabel(e.target.checked)}
                    className="rounded text-blue-600 h-3.5 w-3.5"
                  />
                  <label htmlFor="label-check" className="text-slate-500 cursor-pointer">显示数值标签</label>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="sampling-check"
                    checked={enableDownSampling}
                    onChange={(e) => setEnableDownSampling(e.target.checked)}
                    className="rounded text-blue-600 h-3.5 w-3.5"
                  />
                  <label htmlFor="sampling-check" className="text-slate-500 cursor-pointer">大数据降采样</label>
                </div>
              </div>

              {/* 高级图表配置：显示总数、限制展示数量 */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-2.5 rounded border border-slate-100 mt-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="total-label-check"
                    checked={showTotalLabel}
                    onChange={(e) => setShowTotalLabel(e.target.checked)}
                    className="rounded text-blue-600 h-3.5 w-3.5"
                    disabled={chartType !== 'bar' && chartType !== 'group' && chartType !== 'stack'}
                  />
                  <label htmlFor="total-label-check" className="text-slate-500 cursor-pointer disabled:opacity-50">
                    显示柱体总数 (堆叠/柱图)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="max-categories-input" className="text-xs text-slate-500 whitespace-nowrap">最多显示分类数:</label>
                  <input
                    type="number"
                    id="max-categories-input"
                    value={maxCategories ?? ''}
                    placeholder="全部"
                    onChange={(e) => {
                      const valStr = e.target.value;
                      if (valStr === '') {
                        setMaxCategories(undefined);
                      } else {
                        const num = Number(valStr);
                        if (num > 0) setMaxCategories(num);
                      }
                    }}
                    className="flex-1 px-2 py-1 text-xs border rounded border-slate-200 outline-none focus:border-blue-500"
                    min={1}
                  />
                </div>
              </div>
            </div>
          )}

          {!selectedDataset && (
            <div className="text-center py-6 text-slate-400 bg-slate-50 border border-dashed rounded">
              请先选择上方的数据集以加载属性字段配置。
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-500 rounded text-xs hover:bg-slate-50"
          >
            关闭
          </button>
          <button
            type="submit"
            disabled={!dataSourceId}
            className="px-4 py-2 bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 text-white rounded text-xs font-semibold"
          >
            保存并应用
          </button>
        </div>
      </form>
    </div>
  );
};
export default ComponentSettingsModal;
