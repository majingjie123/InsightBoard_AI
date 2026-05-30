import React, { useState, useRef, useEffect } from 'react';
import { useBoardStore } from '../../../stores/boardStore';
import { BoardComponent, ComponentType } from '../../../types/board';
import { Dataset } from '../../../types/dataset';
import { EChartComponent } from '../../../components/charts/EChartComponent';
import { DataTable } from '../../../components/charts/DataTable';
import { gridSnapper } from '../../../utils/gridSnap';
import { Lock, Unlock, Settings, Trash, Move, Maximize2 } from 'lucide-react';

interface BoardCanvasProps {
  spaceId: string;
  datasets: Dataset[];
  onOpenSettings: (component: BoardComponent) => void;
  isReadOnly?: boolean;
}

export const BoardCanvas: React.FC<BoardCanvasProps> = ({
  spaceId,
  datasets,
  onOpenSettings,
  isReadOnly = false
}) => {
  const {
    components,
    selectedComponentId,
    addComponent,
    updateComponentPosition,
    updateComponentSize,
    setComponentLock,
    deleteComponent,
    setSelectedComponentId,
    copyComponent,
    pasteComponent,
    updateComponent,
    undo,
    redo,
    canUndo,
    canRedo
  } = useBoardStore();

  const canvasRef = useRef<HTMLDivElement>(null);

  // 本地拖动/缩放的临时状态，避免实时更新 Zustand 触发过多重绘
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeResizeId, setActiveResizeId] = useState<string | null>(null);
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(null);
  const [tempPos, setTempPos] = useState<{ x: number; y: number } | null>(null);
  const [tempSize, setTempSize] = useState<{ width: number; height: number } | null>(null);

  // 1. 注册全局快捷键监听 (撤销重做、删除、复制粘贴)
  useEffect(() => {
    // 卫语句：只读模式拦截快捷键
    if (isReadOnly) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const activeEl = document.activeElement;
      
      // 卫语句：输入框聚焦时拦截快捷键
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
        return;
      }

      // Ctrl + Z 撤销
      if (isCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl + Y 重做
      if (isCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl + C 复制
      if (isCtrl && e.key.toLowerCase() === 'c' && selectedComponentId) {
        e.preventDefault();
        copyComponent(selectedComponentId);
        return;
      }

      // Ctrl + V 粘贴
      if (isCtrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteComponent(spaceId);
        return;
      }

      // Delete 删除组件
      if (e.key === 'Delete' && selectedComponentId) {
        const comp = components.find(c => c.id === selectedComponentId);
        // 卫语句：拦截锁定组件
        if (comp && !comp.locked) {
          e.preventDefault();
          deleteComponent(selectedComponentId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponentId, components, spaceId, undo, redo, copyComponent, pasteComponent, deleteComponent, isReadOnly]);

  // 2. 拖拽移动逻辑
  const startDrag = (e: React.MouseEvent, comp: BoardComponent) => {
    // 卫语句：只读或锁定组件拦截
    if (isReadOnly || comp.locked) return;
    
    e.preventDefault();
    e.stopPropagation();
    setSelectedComponentId(comp.id);
    setActiveDragId(comp.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = comp.position.x;
    const initY = comp.position.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      // 实时计算网格吸附
      const rawX = initX + deltaX;
      const rawY = initY + deltaY;
      const snapped = gridSnapper.snapPosition({ x: rawX, y: rawY });

      // 限制画布边界
      const boundedX = Math.max(0, snapped.x);
      const boundedY = Math.max(0, snapped.y);

      setTempPos({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      setActiveDragId(null);
      setTempPos(currentPos => {
        if (currentPos && (currentPos.x !== initX || currentPos.y !== initY)) {
          updateComponentPosition(comp.id, currentPos);
        }
        return null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 3. 拖拽拉伸尺寸逻辑
  const startResize = (e: React.MouseEvent, comp: BoardComponent, direction: string) => {
    // 卫语句：只读或锁定组件拦截
    if (isReadOnly || comp.locked) return;

    e.preventDefault();
    e.stopPropagation();
    
    // 立即选中，确保手柄保持显示
    setSelectedComponentId(comp.id);
    setActiveResizeId(comp.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = comp.position.x;
    const initY = comp.position.y;
    const initWidth = comp.size.width;
    const initHeight = comp.size.height;

    // 立即初始化临时状态，避免第一帧跳变
    setTempPos({ x: initX, y: initY });
    setTempSize({ width: initWidth, height: initHeight });

    // 记录最新状态供 MouseUp 使用
    let lastFinalPos = { x: initX, y: initY };
    let lastFinalSize = { width: initWidth, height: initHeight };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newX = initX;
      let newY = initY;
      let newW = initWidth;
      let newH = initHeight;

      // 1. 根据方向计算拉伸（仅对受影响的轴进行网格吸附）
      if (direction.includes('e')) {
        newW = Math.max(150, gridSnapper.snap(initWidth + deltaX));
      }
      if (direction.includes('w')) {
        const snappedW = gridSnapper.snap(initWidth - deltaX);
        newW = Math.max(150, snappedW);
        newX = initX + initWidth - newW;
      }
      if (direction.includes('s')) {
        newH = Math.max(150, gridSnapper.snap(initHeight + deltaY));
      }
      if (direction.includes('n')) {
        const snappedH = gridSnapper.snap(initHeight - deltaY);
        newH = Math.max(150, snappedH);
        newY = initY + initHeight - newH;
      }

      if (newX < 0) {
        newW = initX + initWidth;
        newX = 0;
      }
      if (newY < 0) {
        newH = initY + initHeight;
        newY = 0;
      }

      lastFinalPos = { x: newX, y: newY };
      lastFinalSize = { width: newW, height: newH };

      setTempPos(lastFinalPos);
      setTempSize(lastFinalSize);
    };

    const handleMouseUp = async () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      // 只有发生实际变化时才更新 Store
      if (lastFinalPos.x !== initX || lastFinalPos.y !== initY || 
          lastFinalSize.width !== initWidth || lastFinalSize.height !== initHeight) {
        // 关键：等待 Store 更新完成，防止本地状态过早清理导致回弹
        await updateComponent(comp.id, {
          position: lastFinalPos,
          size: lastFinalSize
        });
      }

      // 清理临时状态
      setActiveResizeId(null);
      setTempPos(null);
      setTempSize(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 点击画布空白处重置选中状态
  const handleCanvasClick = () => {
    setSelectedComponentId(null);
  };

  const getCanvasDropPosition = (event: React.DragEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 40, y: 40 };
    }

    const rawX = event.clientX - rect.left + (canvasRef.current?.scrollLeft || 0);
    const rawY = event.clientY - rect.top + (canvasRef.current?.scrollTop || 0);
    const snapped = gridSnapper.snapPosition({ x: rawX, y: rawY });

    return {
      x: Math.max(0, snapped.x),
      y: Math.max(0, snapped.y)
    };
  };

  const handleCanvasDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    if (isReadOnly) return;

    const componentType = event.dataTransfer.getData('application/x-insightboard-component') as ComponentType;
    if (!componentType) return;

    event.preventDefault();
    event.stopPropagation();
    await addComponent(spaceId, componentType, getCanvasDropPosition(event));
  };

  return (
    <div
      ref={canvasRef}
      onClick={handleCanvasClick}
      onDragOver={(event) => {
        if (!isReadOnly && event.dataTransfer.types.includes('application/x-insightboard-component')) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={handleCanvasDrop}
      className="relative flex-1 h-full bg-slate-50 overflow-auto select-none p-6"
      style={{
        backgroundImage: isReadOnly ? 'none' : 'radial-gradient(#e2e8f0 1.2px, transparent 1.2px)',
        backgroundSize: '20px 20px'
      }}
    >
      {components.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center text-slate-400">
          <Move size={36} className="text-slate-300 mb-2 animate-bounce" />
          <span className="text-xs">看板为空，从左上角拖拽或点击组件库加入组件</span>
        </div>
      ) : (
        components.map((comp) => {
          const isSelected = comp.id === selectedComponentId;
          const isDragging = comp.id === activeDragId;
          const isResizing = comp.id === activeResizeId;
          const isHovered = comp.id === hoveredComponentId;

          // 绝对定位坐标与高宽 (优先应用拖动/拉伸时的临时状态，保证 60fps 流程渲染)
          const x = (isDragging || isResizing) && tempPos ? tempPos.x : comp.position.x;
          const y = (isDragging || isResizing) && tempPos ? tempPos.y : comp.position.y;
          const width = isResizing && tempSize ? tempSize.width : comp.size.width;
          const height = isResizing && tempSize ? tempSize.height : comp.size.height;

          // 绑定的数据集
          const dataset = datasets.find(d => d.id === comp.config.dataSourceId) || null;

          return (
            <div
              key={comp.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedComponentId(comp.id);
              }}
              onMouseEnter={() => setHoveredComponentId(comp.id)}
              onMouseLeave={() => {
                if (!isResizing) {
                  setHoveredComponentId(null);
                }
              }}
              style={{
                position: 'absolute',
                top: y,
                left: x,
                width,
                height,
                zIndex: isSelected ? 30 : (isHovered ? 25 : 10)
              }}
              className={`bg-white border rounded shadow-sm hover:shadow-md transition-shadow flex flex-col group/comp overflow-visible ${
                isSelected ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-200'
              }`}
            >
              {/* 组件顶操作头部 */}
              {!isReadOnly && (
                <div
                  onMouseDown={(e) => startDrag(e, comp)}
                  className="h-7 border-b border-slate-100 bg-slate-50/65 flex items-center justify-between px-2 cursor-move select-none flex-shrink-0"
                >
                  {/* 左：拖拽移动图标及状态锁 */}
                  <div className="flex items-center gap-1.5 text-slate-400 group-hover/comp:text-slate-600">
                    <Move size={10} />
                    <span className="text-[10px] font-semibold truncate max-w-[120px] text-slate-500">
                      {comp.type === 'table' ? '表格' : '图表'}
                    </span>
                  </div>

                  {/* 右：操作图标栏 (锁定、配置、删除) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover/comp:opacity-100 transition-opacity">
                    {/* 锁图标：直接点击上锁/解锁 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setComponentLock(comp.id, !comp.locked);
                      }}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      title={comp.locked ? '解锁组件' : '锁定组件'}
                    >
                      {comp.locked ? <Lock size={10} className="text-amber-500" /> : <Unlock size={10} />}
                    </button>
                    
                    {/* 设置属性 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // 卫语句：锁定拦截
                        if (comp.locked) return;
                        onOpenSettings(comp);
                      }}
                      disabled={comp.locked}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      title="属性设置"
                    >
                      <Settings size={10} />
                    </button>

                    {/* 删除 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (comp.locked) return;
                        deleteComponent(comp.id);
                      }}
                      disabled={comp.locked}
                      className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 disabled:opacity-30"
                      title="删除组件"
                    >
                      <Trash size={10} />
                    </button>
                  </div>
                </div>
              )}

              {/* 核心展示区 */}
              <div className="flex-1 min-h-0 relative">
                {comp.type === 'table' ? (
                  <DataTable
                    config={comp.config as any}
                    dataset={dataset}
                    name={comp.name}
                    isReadOnly={isReadOnly}
                    onUpdateConfig={(newConfig) => updateComponent(comp.id, { config: { ...comp.config, ...newConfig } as any })}
                  />
                ) : (
                  <EChartComponent
                    config={comp.config as any}
                    dataset={dataset}
                    name={comp.name}
                  />
                )}

                {/* 锁定状态物理遮罩与闭合锁标志🔒 (锁定后禁止拖拽、缩放、删除、复制，配置项置灰) */}
                {comp.locked && !isReadOnly && (
                  <div className="absolute top-2 left-2 z-40 bg-amber-500/90 text-white p-1 rounded shadow cursor-pointer transition-transform hover:scale-105"
                       onClick={(e) => {
                         e.stopPropagation();
                         setComponentLock(comp.id, false); // 点击直接解锁
                       }}
                       title="组件已锁定，点击解锁"
                  >
                    <Lock size={10} />
                  </div>
                )}
              </div>

              {/* 缩放手柄 (8个方向) - 只要不锁定且未读，在选中或悬停时显示 */}
              {!isReadOnly && !comp.locked && (
                <>
                  {(() => {
                    const showHandles = isSelected || isResizing || isHovered;
                    // 提升 z-index 到 200，确保在任何内部组件之上
                    const handleBaseClass = `absolute z-[200] pointer-events-auto transition-opacity duration-150 ${showHandles ? 'opacity-100' : 'opacity-0 group-hover/comp:opacity-100'}`;
                    
                    return (
                      <>
                        {/* 四边热区：全长覆盖，厚度 16px (内外各 8px) */}
                        <div onMouseDown={(e) => startResize(e, comp, 'n')} className={`${handleBaseClass} -top-2 left-0 right-0 h-4 cursor-n-resize hover:bg-blue-500/10`} />
                        <div onMouseDown={(e) => startResize(e, comp, 's')} className={`${handleBaseClass} -bottom-2 left-0 right-0 h-4 cursor-s-resize hover:bg-blue-500/10`} />
                        <div onMouseDown={(e) => startResize(e, comp, 'w')} className={`${handleBaseClass} top-0 bottom-0 -left-2 w-4 cursor-w-resize hover:bg-blue-500/10`} />
                        <div onMouseDown={(e) => startResize(e, comp, 'e')} className={`${handleBaseClass} top-0 bottom-0 -right-2 w-4 cursor-e-resize hover:bg-blue-500/10`} />
                        
                        {/* 四角可见手柄：经典蓝色方块样式 */}
                        <div onMouseDown={(e) => startResize(e, comp, 'nw')} className={`${handleBaseClass} -top-1.5 -left-1.5 w-3 h-3 cursor-nw-resize bg-white border-2 border-blue-600 rounded-sm shadow-sm hover:scale-110`} />
                        <div onMouseDown={(e) => startResize(e, comp, 'ne')} className={`${handleBaseClass} -top-1.5 -right-1.5 w-3 h-3 cursor-ne-resize bg-white border-2 border-blue-600 rounded-sm shadow-sm hover:scale-110`} />
                        <div onMouseDown={(e) => startResize(e, comp, 'sw')} className={`${handleBaseClass} -bottom-1.5 -left-1.5 w-3 h-3 cursor-sw-resize bg-white border-2 border-blue-600 rounded-sm shadow-sm hover:scale-110`} />
                        <div onMouseDown={(e) => startResize(e, comp, 'se')} className={`${handleBaseClass} -bottom-1.5 -right-1.5 w-3 h-3 cursor-se-resize bg-white border-2 border-blue-600 rounded-sm shadow-sm hover:scale-110 flex items-center justify-center`}>
                          <div className="w-1.5 h-1.5 bg-blue-600" />
                        </div>

                        {/* 选中状态辅助高亮边框 */}
                        {isSelected && (
                          <div className="absolute -inset-[1px] border-2 border-blue-500/40 pointer-events-none rounded-[3px] z-[190]" />
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
export default BoardCanvas;
