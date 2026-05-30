import React, { useState, useEffect, useRef } from 'react';
import db from '../../../services/database';
import { Dataset } from '../../../types/dataset';
import { excelParser } from '../../../utils/excelParser';
import { Upload, Trash2, Eye, Edit3, Loader2, AlertCircle, X, ChevronDown, Check } from 'lucide-react';

interface DatasetPanelProps {
  spaceId: string;
  datasets: Dataset[];
  onRefreshDatasets: () => void;
  onRefreshComponents?: () => void; // 让组件也刷新
}

export const DatasetPanel: React.FC<DatasetPanelProps> = ({
  spaceId,
  datasets,
  onRefreshDatasets,
  onRefreshComponents
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 解析进度与状态
  const [parsing, setParsing] = useState(false);
  const [percent, setPercent] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);
  const [lastUploadFile, setLastUploadFile] = useState<File | null>(null);

  // 预览模态框状态
  const [previewDataset, setPreviewDataset] = useState<Dataset | null>(null);
  const [previewLimit, setPreviewLimit] = useState(100);

  // 重命名状态
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // 1. 上传 Excel 解析处理 (Web Worker 异步分片版)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 卫语句：拦截取消选择
    if (!file) return;

    // 卫语句：校验文件类型
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setParseError('仅支持上传 .xlsx 或 .xls 格式的 Excel 文件');
      e.target.value = '';
      return;
    }

    // 卫语句：校验单空间 20 个数据集的上限
    if (datasets.length >= 20) {
      setParseError('已达当前空间数据集数量上限 (20个)，禁止上传');
      e.target.value = '';
      return;
    }

    setLastUploadFile(file);
    await startParse(file);
    e.target.value = '';
  };

  // 封装解析核心，支持重试
  const startParse = async (file: File) => {
    setParsing(true);
    setPercent(0);
    setParseError(null);

    try {
      // 启动 Web Worker 异步分片解析
      const result = await excelParser.parse(file, (p) => {
        setPercent(p);
      });

      // 2. 检查同名文件覆盖与字段对比
      const existing = datasets.find(d => d.name === file.name);
      
      const newDatasetId = existing ? existing.id : crypto.randomUUID();
      
      const newDataset: Dataset = {
        id: newDatasetId,
        spaceId,
        name: file.name,
        fileName: file.name,
        sheetName: result.sheets[0] || 'Sheet1',
        rowCount: result.data.length,
        columns: result.columns,
        data: result.data,
        createdAt: existing ? existing.createdAt : new Date()
      };

      // 写入 IndexedDB
      await db.datasets.put(newDataset);

      // 同名文件字段结构对比提示
      if (existing) {
        // 对比列名是否一致
        const oldCols = existing.columns.map(c => c.name).sort().join(',');
        const newCols = result.columns.map(c => c.name).sort().join(',');
        
        if (oldCols !== newCols) {
          // 字段变更，原有组件自动进入“字段缺失”状态 (EChart/Table 会自动触发红色缺失警告)
          setParseError(`同名数据集 "${file.name}" 覆盖成功，但检测到字段结构已发生变更！原绑定组件可能会提示字段缺失。`);
        }
      }

      onRefreshDatasets();
      if (onRefreshComponents) {
        onRefreshComponents();
      }
      setParsing(false);
    } catch (err: any) {
      setParseError(`解析失败: ${err.message || '未知原因'}`);
      setParsing(false);
    }
  };

  // 取消解析任务
  const handleCancelParse = () => {
    excelParser.cancel();
    setParsing(false);
    setPercent(0);
    setParseError('解析已被手动取消。');
  };

  // 删除数据集
  const handleDeleteDataset = async (id: string, name: string) => {
    const confirm = window.confirm(`确定要删除数据集 “${name}” 吗？删除后所有绑定此数据集的图表表格组件均会失效！`);
    // 卫语句：取消删除
    if (!confirm) return;

    await db.datasets.delete(id);
    onRefreshDatasets();
    if (onRefreshComponents) {
      onRefreshComponents();
    }
  };

  // 预览加载更多
  const handleLoadMorePreview = () => {
    setPreviewLimit(prev => prev + 100);
  };

  // 重命名提交
  const handleRenameSubmit = async (id: string) => {
    const trimmed = renameInput.trim();
    // 卫语句：拦截空名
    if (!trimmed) {
      setRenamingId(null);
      return;
    }

    await db.datasets.update(id, { name: trimmed });
    setRenamingId(null);
    onRefreshDatasets();
  };

  return (
    <div className="w-full flex flex-col h-full bg-slate-50 border-r border-slate-200/80 p-4 text-xs select-none">
      {/* 头部上传栏 */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="font-bold text-slate-700">数据源管理 ({datasets.length}/20)</span>
          <span className="text-[10px] text-slate-400">仅限 Excel</span>
        </div>

        {/* 隐藏的文件 File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          className="hidden"
          disabled={datasets.length >= 20 || parsing}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={datasets.length >= 20 || parsing}
          className="w-full bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded flex items-center justify-center gap-1.5 transition-all shadow shadow-blue-500/15"
        >
          <Upload size={14} />
          <span>上传 Excel 数据集</span>
        </button>
      </div>

      {/* 异步解析进度条与错误提示 (亮点设计) */}
      {(parsing || parseError) && (
        <div className="bg-white border border-slate-200/80 rounded p-3 mb-4 space-y-2">
          {parsing && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-semibold text-slate-600">
                <span className="flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin text-blue-500" />
                  <span>分片读取解析中...</span>
                </span>
                <span>{percent}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-full transition-all duration-150" style={{ width: `${percent}%` }} />
              </div>
              <button
                type="button"
                onClick={handleCancelParse}
                className="w-full mt-2 text-center text-[10px] text-red-500 hover:underline hover:bg-red-50 py-0.5 rounded border border-red-100"
              >
                取消上传
              </button>
            </div>
          )}

          {parseError && (
            <div className="space-y-1.5">
              <div className="text-red-600 font-semibold flex items-start gap-1 text-[10px] leading-relaxed">
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
              {lastUploadFile && !parsing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => startParse(lastUploadFile)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1 rounded text-[10px] font-semibold"
                  >
                    重试解析
                  </button>
                  <button
                    onClick={() => setParseError(null)}
                    className="px-2 bg-slate-100 hover:bg-slate-200 text-slate-400 py-1 rounded text-[10px]"
                  >
                    忽略
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 数据集卡片列表 */}
      <div className="flex-1 overflow-auto space-y-3 min-h-0">
        {datasets.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded">
            暂无数据集，请先上传 Excel
          </div>
        ) : (
          datasets.map((ds) => (
            <div
              key={ds.id}
              className="bg-white border border-slate-200/80 rounded p-3 hover:shadow-sm transition-all group/dataset relative flex flex-col justify-between"
            >
              <div>
                {/* 标题 & 操作 */}
                <div className="flex justify-between items-start gap-2 mb-2">
                  {renamingId === ds.id ? (
                    <input
                      type="text"
                      autoFocus
                      value={renameInput}
                      onChange={(e) => setRenameInput(e.target.value)}
                      onBlur={() => handleRenameSubmit(ds.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(ds.id)}
                      className="border border-slate-300 rounded px-1 py-0.5 text-xs text-slate-700 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="font-semibold text-slate-700 truncate max-w-[140px]" title={ds.name}>
                      {ds.name}
                    </span>
                  )}

                  {/* 悬浮操作图标 */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover/dataset:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setPreviewDataset(ds);
                        setPreviewLimit(100);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      title="预览原始数据"
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      onClick={() => {
                        setRenamingId(ds.id);
                        setRenameInput(ds.name);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                      title="重命名"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => handleDeleteDataset(ds.id, ds.name)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-slate-50"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 space-y-0.5">
                  <div>总行数: <strong className="text-slate-600">{ds.rowCount} 行</strong></div>
                  <div>字段数: <strong className="text-slate-600">{ds.columns.length} 个</strong></div>
                </div>
              </div>

              {/* 字段小气泡预览 */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1">
                {ds.columns.slice(0, 4).map(c => (
                  <span key={c.name} className="bg-slate-100 text-slate-500 text-[8px] px-1 py-0.5 rounded truncate max-w-[80px]" title={c.name}>
                    {c.name}
                  </span>
                ))}
                {ds.columns.length > 4 && (
                  <span className="bg-slate-100 text-slate-400 text-[8px] px-1 py-0.5 rounded font-bold">
                    +{ds.columns.length - 4}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ========================================================== */}
      {/* 弹窗：原始数据集只读数据预览 (亮点大文件解析功能) */}
      {previewDataset && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 flex flex-col max-h-[85vh]">
            {/* 头部 */}
            <div className="flex justify-between items-center mb-4 border-b pb-2 border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  数据集预览 - {previewDataset.name}
                </h3>
                <span className="text-[10px] text-slate-400">只读表格 · 共 {previewDataset.rowCount} 行</span>
              </div>
              <button
                onClick={() => setPreviewDataset(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* 表格容器 */}
            <div className="flex-1 overflow-auto border border-slate-200 rounded min-h-0 bg-slate-50">
              <table className="w-full text-left border-collapse table-auto text-xs bg-white">
                <thead className="sticky top-0 bg-slate-100 text-slate-600 font-semibold z-10">
                  <tr>
                    {previewDataset.columns.map((c) => (
                      <th key={c.name} className="p-2.5 border-b border-slate-200 bg-slate-100 text-slate-600 font-semibold">
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewDataset.data.slice(0, previewLimit).map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      {previewDataset.columns.map((c) => (
                        <td key={c.name} className="p-2 text-slate-700 max-w-xs truncate" title={String(row[c.name] ?? '')}>
                          {row[c.name] === null || row[c.name] === undefined ? '-' : String(row[c.name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 底部加载更多 */}
            <div className="mt-4 flex justify-between items-center flex-shrink-0">
              <span className="text-[10px] text-slate-400">
                当前加载: 前 {Math.min(previewLimit, previewDataset.rowCount)} 行
              </span>

              <div className="flex gap-2">
                {previewLimit < previewDataset.rowCount && (
                  <button
                    onClick={handleLoadMorePreview}
                    className="flex items-center gap-1 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold py-1.5 px-3 rounded text-[11px]"
                  >
                    <ChevronDown size={12} />
                    <span>加载更多 (100行)</span>
                  </button>
                )}
                {previewLimit < previewDataset.rowCount && (
                  <button
                    onClick={() => setPreviewLimit(previewDataset.rowCount)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-1.5 px-3 rounded text-[11px]"
                  >
                    全部加载
                  </button>
                )}
                <button
                  onClick={() => setPreviewDataset(null)}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded py-1.5 px-4 text-[11px] font-semibold"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DatasetPanel;
