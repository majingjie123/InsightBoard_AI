import React, { useEffect, useState } from 'react';
import { useSpaceStore } from './stores/spaceStore';
import { useAIConfigStore } from './stores/aiConfigStore';
import { useBoardStore } from './stores/boardStore';
import { useChatStore } from './stores/chatStore';
import db from './services/database';

// 页面组件
import { SpaceManager } from './pages/SpaceManager';
import { AIConfig } from './pages/AIConfig';
import { Workspace } from './pages/Workspace';

// 图标
import { Cpu, LayoutDashboard, Settings } from 'lucide-react';

export const App: React.FC = () => {
  const { currentSpaceId, init: initSpaces, setCurrentSpaceId, spaces } = useSpaceStore();
  const { init: initAI } = useAIConfigStore();
  const { loadSpaceBoard } = useBoardStore();
  const { initPanel } = useChatStore();

  const [activeMenu, setActiveMenu] = useState<'spaces' | 'ai-config'>('spaces');
  const [inWorkspace, setInWorkspace] = useState(false);

  // 初始化数据库状态与全局防拖放默认拦截
  useEffect(() => {
    initSpaces();
    initAI();

    const preventDragDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventDragDrop, false);
    window.addEventListener('drop', preventDragDrop, false);

    return () => {
      window.removeEventListener('dragover', preventDragDrop);
      window.removeEventListener('drop', preventDragDrop);
    };
  }, [initSpaces, initAI]);

  // 当工作空间改变且处于 workspace 状态下时加载看板和 AI 对话
  useEffect(() => {
    if (currentSpaceId && inWorkspace) {
      loadSpaceBoard(currentSpaceId);
      initPanel(currentSpaceId);
    }
  }, [currentSpaceId, inWorkspace, loadSpaceBoard, initPanel]);

  // 4. 监听主进程的发布快照请求，实现本机浏览器预览 (核心无缝桥接)
  useEffect(() => {
    const api = window.electronAPI;
    if (api) {
      api.onRequestSnapshotData(async (spaceId: string) => {
        try {
          // 在 IndexedDB 中获取该空间的最近一次发布快照
          const snapshots = await db.publishSnapshots
            .where('spaceId')
            .equals(spaceId)
            .sortBy('version');
          
          const lastSnapshot = snapshots.pop() || null;
          
          // 如果找到了快照，把空间名附带上去，供预览页展示
          if (lastSnapshot) {
            const space = await db.spaces.get(spaceId);
            const enrichedSnapshot = {
              ...lastSnapshot,
              spaceName: space?.name || '已发布看板'
            };
            api.responseSnapshotData(spaceId, enrichedSnapshot);
          } else {
            api.responseSnapshotData(spaceId, null);
          }
        } catch (e) {
          api.responseSnapshotData(spaceId, null);
        }
      });
    }
  }, []);

  // 返回看板编辑模式
  const handleBackToSpaces = () => {
    setInWorkspace(false);
    setActiveMenu('spaces');
  };

  const handleEnterWorkspace = () => {
    if (currentSpaceId) {
      setInWorkspace(true);
    }
  };

  // 卫语句：拦截进入看板编辑页
  if (inWorkspace && currentSpaceId) {
    return <Workspace onBack={handleBackToSpaces} />;
  }

  const currentSpaceName = spaces.find(s => s.id === currentSpaceId)?.name || '未选择空间';

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* 左侧全局导航菜单 (一级常驻) */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 shadow-lg">
        <div>
          {/* Logo & 头部 */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <LayoutDashboard className="h-6 w-6 text-blue-500 animate-pulse" />
            <h1 className="text-base font-bold text-white tracking-wide">本地 AI 看板展示平台</h1>
          </div>

          {/* 导航菜单列表 */}
          <nav className="p-4 space-y-2">
            <button
              onClick={() => {
                setActiveMenu('spaces');
                setInWorkspace(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded text-sm font-medium transition-all ${
                activeMenu === 'spaces'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard size={18} />
              <span>工作空间管理</span>
            </button>

            <button
              onClick={() => {
                setActiveMenu('ai-config');
                setInWorkspace(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded text-sm font-medium transition-all ${
                activeMenu === 'ai-config'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Cpu size={18} />
              <span>AI 配置管理</span>
            </button>
          </nav>
        </div>

        {/* 底部信息与当前空间快捷进入 */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          {currentSpaceId ? (
            <div className="space-y-2">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">当前打开空间</div>
              <div className="text-xs text-white font-medium truncate" title={currentSpaceName}>{currentSpaceName}</div>
              <button
                onClick={handleEnterWorkspace}
                className="w-full mt-2 bg-slate-800 hover:bg-blue-600 text-white py-1.5 px-3 rounded text-xs transition-all font-semibold active:scale-[0.98]"
              >
                进入看板编辑
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500 text-center py-2">暂无打开的看板</div>
          )}
          <div className="text-[9px] text-slate-600 mt-4 text-center">纯本地安全模式</div>
        </div>
      </aside>

      {/* 右侧主视口内容区 */}
      <main className="flex-1 h-full overflow-hidden relative">
        {activeMenu === 'spaces' ? (
          <SpaceManager onEnterWorkspace={handleEnterWorkspace} />
        ) : (
          <AIConfig />
        )}
      </main>
    </div>
  );
};
export default App;
