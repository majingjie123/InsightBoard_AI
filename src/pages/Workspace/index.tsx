import React, { useState, useEffect, useCallback } from 'react';
import { useSpaceStore } from '../../stores/spaceStore';
import { useBoardStore } from '../../stores/boardStore';
import { useChatStore } from '../../stores/chatStore';
import { DatasetPanel } from './components/DatasetPanel';
import { BoardCanvas } from './components/BoardCanvas';
import { AIChatPanel } from './components/AIChatPanel';
import { ComponentSettingsModal } from './components/ComponentSettingsModal';
import { publishService } from '../../services/publishService';
import db from '../../services/database';
import { Dataset } from '../../types/dataset';
import { BoardComponent, ComponentType } from '../../types/board';
import {
  ArrowLeft,
  Plus,
  Table2,
  BarChart4,
  LineChart,
  PieChart,
  Undo2,
  Redo2,
  Globe,
  Loader2,
  Copy,
  Check,
  PanelRightClose,
  PanelRightOpen,
  X
} from 'lucide-react';

interface WorkspaceProps {
  onBack: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({ onBack }) => {
  const { currentSpaceId, spaces } = useSpaceStore();
  const {
    components,
    addComponent,
    updateComponent,
    loadSpaceBoard,
    canUndo,
    canRedo,
    undo,
    redo
  } = useBoardStore();

  const {
    panelCollapsed,
    setPanelCollapsed
  } = useChatStore();

  const spaceId = currentSpaceId || '';
  const currentSpaceName = spaces.find(s => s.id === spaceId)?.name || '看板编辑';
  const componentTools: Array<{
    type: ComponentType;
    label: string;
    icon: React.ElementType;
  }> = [
    { type: 'table', label: '数据表格', icon: Table2 },
    { type: 'bar', label: '柱状图表', icon: BarChart4 },
    { type: 'line', label: '趋势折线', icon: LineChart },
    { type: 'pie', label: '饼图/环形', icon: PieChart }
  ];

  // 数据集管理
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  // 设置模态框组件状态
  const [settingsComponent, setSettingsComponent] = useState<BoardComponent | null>(null);

  // 发布状态
  const [publishing, setPublishing] = useState(false);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 加载当前空间的数据集
  const loadDatasets = useCallback(async () => {
    // 卫语句：拦截空空间
    if (!spaceId) return;
    const list = await db.datasets.where('spaceId').equals(spaceId).toArray();
    setDatasets(list);
  }, [spaceId]);

  useEffect(() => {
    loadDatasets();
  }, [loadDatasets]);

  // 组件属性保存
  const handleSaveSettings = (savedConfig: any) => {
    if (settingsComponent) {
      updateComponent(settingsComponent.id, {
        config: savedConfig,
        // 如果图表标题为空，自动把标题设为图表名，或者更新为新标题
        name: savedConfig.title || settingsComponent.name
      });
      setSettingsComponent(null);
    }
  };

  // 执行发布
  const handlePublish = async () => {
    // 卫语句：拦截空组件
    if (components.length === 0) {
      alert('当前看板为空，无法发布看板！');
      return;
    }

    setPublishing(true);
    setPublishUrl(null);
    
    try {
      // 1. 保存快照
      await publishService.publish(spaceId, panelCollapsed);
      
      // 2. 构建预览 URL
      let localPort = 18080;
      if (window.electronAPI) {
        try {
          localPort = await window.electronAPI.getServerPort();
        } catch (err) {
          // 容错降级到默认端口
        }
      }
      const previewUrl = `http://127.0.0.1:${localPort}/preview/${spaceId}`;
      
      setPublishUrl(previewUrl);
    } catch (e: any) {
      alert(`发布失败: ${e.message || '未知错误'}`);
    } finally {
      setPublishing(false);
    }
  };

  // 拷贝链接
  const handleCopyLink = () => {
    if (publishUrl) {
      navigator.clipboard.writeText(publishUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-100 text-slate-800 overflow-hidden font-sans select-none">
      {/* 顶部工具操作栏 */}
      <header className="h-14 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between flex-shrink-0 z-40 shadow-sm">
        {/* 左: 返回空间与空间标题 */}
        <div className="flex items-center gap-3 truncate">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            title="返回空间列表"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="font-bold text-slate-800 text-sm truncate" title={currentSpaceName}>
            看板编辑: {currentSpaceName}
          </span>
        </div>

        {/* 中: 撤销重做快捷控制 */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 p-1 rounded border border-slate-200/50">
          <button
            onClick={undo}
            disabled={!canUndo()}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="重做 (Ctrl+Y)"
          >
            <Redo2 size={14} />
          </button>
        </div>

        {/* 右: 发布与 AI 折叠切换 */}
        <div className="flex items-center gap-2">
          {/* 发布看板 */}
          <button
            onClick={handlePublish}
            disabled={publishing || components.length === 0}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-1.5 px-4 rounded transition-all shadow-md shadow-blue-500/10 active:scale-[0.98]"
          >
            {publishing ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
            <span>发布看板</span>
          </button>

          {/* AI 面板一键切换折叠/展开 */}
          <button
            onClick={() => setPanelCollapsed(!panelCollapsed)}
            className="p-2 rounded border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-colors"
            title={panelCollapsed ? '展开AI面板' : '折叠AI面板'}
          >
            {panelCollapsed ? <PanelRightOpen size={15} /> : <PanelRightClose size={15} />}
          </button>
        </div>
      </header>

      {/* 看板画布编辑大区 */}
      <div className="flex-1 w-full flex min-h-0 overflow-hidden relative">
        {/* 左一：组件库 + 数据集管理 (固定宽度 240px) */}
        <div className="w-60 h-full border-r border-slate-200/80 bg-white flex flex-col flex-shrink-0">
          {/* 1. 内置组件库工具箱 (常驻画布侧边) */}
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/40">
            <span className="block font-bold text-slate-700 text-xs mb-3">看板内置组件库</span>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {componentTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.type}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/x-insightboard-component', tool.type);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => addComponent(spaceId, tool.type)}
                    className="flex flex-col items-center gap-1 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded p-2 transition-all hover:shadow-sm cursor-grab active:cursor-grabbing"
                    title={`拖拽添加${tool.label}`}
                  >
                    <Icon size={16} className="text-slate-500" />
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. 数据源专属空间数据集 (级联联动) */}
          <div className="flex-1 min-h-0 bg-slate-50/40">
            <DatasetPanel
              spaceId={spaceId}
              datasets={datasets}
              onRefreshDatasets={loadDatasets}
              onRefreshComponents={async () => {
                // 如果上传覆盖同名数据集，重载组件看板
                await loadSpaceBoard(spaceId);
              }}
            />
          </div>
        </div>

        {/* 左二：组件自由拖拽画布区 */}
        <div className="flex-1 h-full min-w-0 bg-slate-100 flex flex-col relative z-20">
          <BoardCanvas
            spaceId={spaceId}
            datasets={datasets}
            onOpenSettings={(comp) => setSettingsComponent(comp)}
          />
        </div>

        {/* 右一：AI 交互面板 (固定 320px 宽，折叠为 48px) */}
        <AIChatPanel
          spaceId={spaceId}
          datasets={datasets}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed(!panelCollapsed)}
        />
      </div>

      {/* ========================================================== */}
      {/* 弹窗：组件属性设置 */}
      {settingsComponent && (
        <ComponentSettingsModal
          component={settingsComponent}
          datasets={datasets}
          onClose={() => setSettingsComponent(null)}
          onSave={handleSaveSettings}
        />
      )}

      {/* 弹窗：发布成功预览弹层 */}
      {publishUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2 border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1 text-green-600">
                <Check size={16} />
                <span>发布成功！</span>
              </h3>
              <button
                onClick={() => setPublishUrl(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              当前看板内容、绑定的组件与数据源结构已成功截取快照发布。您可以通过内置的轻量服务直接访问预览：
            </p>

            {/* 一键复制 URL */}
            <div className="bg-slate-50 p-3 rounded border border-slate-200/80 flex items-center justify-between gap-2 mb-4">
              <span className="text-[10px] text-slate-600 select-all font-mono truncate flex-1">
                {publishUrl}
              </span>
              <button
                onClick={handleCopyLink}
                className="flex-shrink-0 flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-2.5 py-1 rounded text-[10px] font-semibold transition-all active:scale-95"
              >
                {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                <span>{copied ? '已复制' : '复制'}</span>
              </button>
            </div>

            <div className="text-[10px] text-slate-400 bg-amber-50 text-amber-700 p-2.5 rounded border border-amber-100 mb-6 flex items-start gap-1">
              <Check size={12} className="flex-shrink-0 mt-0.5" />
              <span>
                提示：预览服务仅本机可安全访问，随本桌面应用启动/关闭而启停。
              </span>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setPublishUrl(null)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold py-1.5 px-4 animate-hover"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Workspace;
