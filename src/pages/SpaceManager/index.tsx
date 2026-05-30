import React, { useState, useEffect, useRef } from 'react';
import { useSpaceStore } from '../../stores/spaceStore';
import { Space } from '../../types/space';
import { Plus, Trash2, Edit, Play, Folder, Clock, MoreVertical, X } from 'lucide-react';

interface SpaceManagerProps {
  onEnterWorkspace: () => void;
}

export const SpaceManager: React.FC<SpaceManagerProps> = ({ onEnterWorkspace }) => {
  const {
    spaces,
    currentSpaceId,
    createSpace,
    renameSpace,
    deleteSpace,
    setCurrentSpaceId
  } = useSpaceStore();

  // 弹窗状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [spaceNameInput, setSpaceNameInput] = useState('');
  const [targetSpace, setTargetSpace] = useState<Space | null>(null);
  const [errorText, setErrorText] = useState('');

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    space: Space | null; // null 表示在空白处右键
  } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // 点击其他区域关闭右键菜单
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 空白区域右键触发
  const handleBlankContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      space: null
    });
  };

  // 空间条目右键触发
  const handleItemContextMenu = (e: React.MouseEvent, space: Space) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      space
    });
  };

  // 双击空间条目
  const handleItemDoubleClick = (space: Space) => {
    setCurrentSpaceId(space.id);
    onEnterWorkspace();
  };

  // 新建工作空间提交
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    try {
      const id = await createSpace(spaceNameInput);
      setCurrentSpaceId(id);
      setSpaceNameInput('');
      setShowCreateModal(false);
      // 自动进入看板
      onEnterWorkspace();
    } catch (err: any) {
      setErrorText(err.message || '创建工作空间失败');
    }
  };

  // 重命名提交
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // 卫语句：安全校验
    if (!targetSpace) return;
    setErrorText('');
    try {
      await renameSpace(targetSpace.id, spaceNameInput);
      setSpaceNameInput('');
      setTargetSpace(null);
      setShowRenameModal(false);
    } catch (err: any) {
      setErrorText(err.message || '重命名失败');
    }
  };

  // 删除空间提交
  const handleDeleteSubmit = async () => {
    // 卫语句：安全校验
    if (!targetSpace) return;
    try {
      await deleteSpace(targetSpace.id);
      setTargetSpace(null);
      setShowDeleteConfirm(false);
    } catch (e) {
      // 容错
    }
  };

  return (
    <div
      className="w-full h-full p-8 flex flex-col select-none"
      onContextMenu={handleBlankContextMenu}
    >
      {/* 顶部标题栏 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">工作空间管理</h2>
          <p className="text-xs text-slate-400 mt-1">每个工作空间独立绑定一个可视化看板及专属的数据集。</p>
        </div>
        <button
          onClick={() => {
            setSpaceNameInput('');
            setErrorText('');
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs py-2 px-4 rounded transition-all active:scale-[0.98] shadow-md shadow-blue-500/10"
        >
          <Plus size={14} />
          <span>新建工作空间</span>
        </button>
      </div>

      {/* 空间卡片列表 */}
      {spaces.length === 0 ? (
        <div className="flex-1 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center text-slate-400 p-8">
          <Folder size={48} className="text-slate-300 mb-3" />
          <p className="text-sm font-medium">还没有任何工作空间</p>
          <p className="text-xs text-slate-400 mt-1">鼠标右键点击空白区域或点击右上角按钮新建一个空间吧</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 align-content-start pb-8">
          {spaces.map((space) => {
            const isSelected = space.id === currentSpaceId;
            return (
              <div
                key={space.id}
                onContextMenu={(e) => handleItemContextMenu(e, space)}
                onDoubleClick={() => handleItemDoubleClick(space)}
                onClick={() => setCurrentSpaceId(space.id)}
                className={`relative bg-white border rounded-lg p-5 flex flex-col justify-between cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all group ${
                  isSelected
                    ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-sm shadow-blue-500/5'
                    : 'border-slate-200/80'
                }`}
              >
                <div>
                  {/* 卡片头部 */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 truncate">
                      <Folder className={`h-5 w-5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`} />
                      <span className="font-semibold text-slate-700 text-sm truncate" title={space.name}>
                        {space.name}
                      </span>
                    </div>
                    {/* 右上角操作图标 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          space
                        });
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>

                  {/* 附加信息 */}
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                    <Clock size={10} />
                    <span>创建于: {new Date(space.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* 卡片底部操作 */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleItemDoubleClick(space);
                    }}
                    className="flex items-center gap-1 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 hover:border-blue-200 text-slate-600 py-1.5 px-3 rounded text-[11px] font-semibold transition-all"
                  >
                    <Play size={10} />
                    <span>进入看板</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================== */}
      {/* 弹窗：新建工作空间 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <form onSubmit={handleCreateSubmit} className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative">
            <h3 className="text-base font-bold text-slate-800 mb-4">新建工作空间</h3>
            
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">空间名称</label>
              <input
                type="text"
                autoFocus
                required
                placeholder="例如: 2026年度销售业绩看板"
                value={spaceNameInput}
                onChange={(e) => setSpaceNameInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
              />
              {errorText && <div className="text-[11px] text-red-500">{errorText}</div>}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded text-xs hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
              >
                创建并进入
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 弹窗：重命名 */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <form onSubmit={handleRenameSubmit} className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 relative">
            <h3 className="text-base font-bold text-slate-800 mb-4">编辑工作空间名称</h3>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-500">新名称</label>
              <input
                type="text"
                autoFocus
                required
                value={spaceNameInput}
                onChange={(e) => setSpaceNameInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700"
              />
              {errorText && <div className="text-[11px] text-red-500">{errorText}</div>}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded text-xs hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
              >
                保存修改
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 二次确认弹窗：删除 */}
      {showDeleteConfirm && targetSpace && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-2 text-red-600 mb-3">
              <Trash2 size={20} />
              <h3 className="text-base font-bold text-slate-800">确认删除工作空间？</h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed">
              确定要删除工作空间 <span className="font-semibold text-slate-700">“{targetSpace.name}”</span> 吗？
              删除后将<span className="font-semibold text-red-600">永久清除该空间绑定的看板画布、上传的所有Excel数据集、图表配置及全量发布快照</span>，此操作不可逆！
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded text-xs hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold"
              >
                确认彻底删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 绝对定位的自定义右键菜单 */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed bg-white border border-slate-200/80 rounded-md shadow-lg py-1.5 min-w-[140px] z-50 text-xs text-slate-600"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.space ? (
            // 条目右键菜单
            <>
              <button
                onClick={() => {
                  handleItemDoubleClick(contextMenu.space!);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                <Play size={12} className="text-blue-500" />
                <span>进入工作空间</span>
              </button>
              <button
                onClick={() => {
                  setTargetSpace(contextMenu.space);
                  setSpaceNameInput(contextMenu.space!.name);
                  setErrorText('');
                  setShowRenameModal(true);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                <Edit size={12} className="text-slate-400" />
                <span>重命名</span>
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={() => {
                  setTargetSpace(contextMenu.space);
                  setShowDeleteConfirm(true);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-red-50 text-red-600 transition-colors"
              >
                <Trash2 size={12} />
                <span>删除空间</span>
              </button>
            </>
          ) : (
            // 空白处右键菜单
            <button
              onClick={() => {
                setSpaceNameInput('');
                setErrorText('');
                setShowCreateModal(true);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              <Plus size={12} className="text-blue-500" />
              <span>新建工作空间</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
export default SpaceManager;
