import { create } from 'zustand';
import db from '../services/database';
import { BoardComponent, ComponentType } from '../types/board';

interface BoardState {
  components: BoardComponent[];
  selectedComponentId: string | null;
  copiedComponent: BoardComponent | null;
  loading: boolean;

  // 撤销/重做栈
  past: BoardComponent[][];
  future: BoardComponent[][];

  // 初始化
  loadSpaceBoard(spaceId: string): Promise<void>;

  // 画布组件基本操作
  addComponent(spaceId: string, type: ComponentType, position?: { x: number; y: number }): Promise<void>;
  updateComponent(id: string, updateData: Partial<BoardComponent>): Promise<void>;
  deleteComponent(id: string): Promise<void>;
  updateComponentPosition(id: string, pos: { x: number; y: number }): Promise<void>;
  updateComponentSize(id: string, size: { width: number; height: number }): Promise<void>;
  setComponentLock(id: string, locked: boolean): Promise<void>;
  setSelectedComponentId(id: string | null): void;

  // 复制/粘贴
  copyComponent(id: string): void;
  pasteComponent(spaceId: string): Promise<void>;

  // 撤销/重做
  undo(): Promise<void>;
  redo(): Promise<void>;
  canUndo(): boolean;
  canRedo(): boolean;
  saveHistory(): void;
}

// 辅助方法：深拷贝组件数组
const cloneComponents = (comps: BoardComponent[]): BoardComponent[] => {
  return JSON.parse(JSON.stringify(comps));
};

export const useBoardStore = create<BoardState>((set, get) => ({
  components: [],
  selectedComponentId: null,
  copiedComponent: null,
  loading: false,
  past: [],
  future: [],

  async loadSpaceBoard(spaceId) {
    set({ loading: true, selectedComponentId: null, past: [], future: [] });
    try {
      const components = await db.boardComponents
        .where('spaceId')
        .equals(spaceId)
        .toArray();
      set({ components, loading: false });
    } catch (e) {
      set({ loading: false });
    }
  },

  // 保存历史状态快照到 past 栈，并清空 future 栈
  saveHistory() {
    const { components, past } = get();
    const newPast = [...past, cloneComponents(components)];
    // 最大历史限制 50 次
    if (newPast.length > 50) {
      newPast.shift();
    }
    set({
      past: newPast,
      future: []
    });
  },

  async addComponent(spaceId, type, position) {
    get().saveHistory();

    const id = crypto.randomUUID();
    const defaultNames: Record<ComponentType, string> = {
      table: '基础数据表格',
      bar: '基础柱状图',
      line: '趋势折线图',
      pie: '环形饼图'
    };

    // 默认配置
    const defaultConfig = type === 'table' ? {
      dataSourceId: '',
      hiddenColumns: [],
      pageSize: 20,
      style: {
        rowHeight: 'standard',
        stripe: true,
        headerBg: '#f8fafc',
        fontSize: 14
      },
      columnFormatters: {}
    } : {
      dataSourceId: '',
      xField: '',
      yField: '',
      secondaryYField: '',
      aggregation: 'sum',
      chartType: type === 'pie' ? 'ring' : type,
      seriesField: '',
      dualYAxis: false,
      showPieLabelLine: true,
      legendPosition: 'top',
      showLegend: true,
      showDataLabel: false,
      smoothLine: false,
      areaFill: false,
      title: defaultNames[type],
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#64748b'],
      enableDownSampling: true,
      showTotalLabel: false,
      maxCategories: undefined
    };

    const newComponent: BoardComponent = {
      id,
      spaceId,
      type,
      name: `${defaultNames[type]}`,
      position: position || { x: 40, y: 40 },
      size: type === 'table' ? { width: 600, height: 350 } : { width: 480, height: 320 },
      locked: false,
      config: defaultConfig as any,
      createdAt: new Date()
    };

    await db.boardComponents.put(newComponent);
    set(state => ({
      components: [...state.components, newComponent],
      selectedComponentId: id
    }));
  },

  async updateComponent(id, updateData) {
    // 卫语句：拦截锁定组件的修改
    const component = get().components.find(c => c.id === id);
    if (!component || component.locked) {
      return;
    }

    get().saveHistory();

    const updated = { ...component, ...updateData };
    await db.boardComponents.put(updated);

    set(state => ({
      components: state.components.map(c => c.id === id ? updated : c)
    }));
  },

  async deleteComponent(id) {
    // 卫语句：拦截锁定组件的删除
    const component = get().components.find(c => c.id === id);
    if (!component || component.locked) {
      return;
    }

    get().saveHistory();

    await db.boardComponents.delete(id);
    set(state => ({
      components: state.components.filter(c => c.id !== id),
      selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId
    }));
  },

  async updateComponentPosition(id, pos) {
    const component = get().components.find(c => c.id === id);
    // 卫语句：锁定组件禁止移动
    if (!component || component.locked) {
      return;
    }

    // 只有位置发生实质性变化才计入历史
    if (component.position.x === pos.x && component.position.y === pos.y) {
      return;
    }

    get().saveHistory();

    const updated = { ...component, position: pos };
    await db.boardComponents.put(updated);

    set(state => ({
      components: state.components.map(c => c.id === id ? updated : c)
    }));
  },

  async updateComponentSize(id, size) {
    const component = get().components.find(c => c.id === id);
    // 卫语句：锁定组件禁止调整尺寸
    if (!component || component.locked) {
      return;
    }

    // 只有尺寸发生实质性变化才计入历史
    if (component.size.width === size.width && component.size.height === size.height) {
      return;
    }

    get().saveHistory();

    const updated = { ...component, size };
    await db.boardComponents.put(updated);

    set(state => ({
      components: state.components.map(c => c.id === id ? updated : c)
    }));
  },

  async setComponentLock(id, locked) {
    const component = get().components.find(c => c.id === id);
    if (!component) {
      return;
    }

    const updated = { ...component, locked };
    await db.boardComponents.put(updated);

    set(state => ({
      components: state.components.map(c => c.id === id ? updated : c)
    }));
  },

  setSelectedComponentId(id) {
    set({ selectedComponentId: id });
  },

  copyComponent(id) {
    const comp = get().components.find(c => c.id === id);
    // 卫语句：拦截未知组件与已锁定组件的复制
    if (!comp || comp.locked) {
      return;
    }
    set({ copiedComponent: cloneComponents([comp])[0] });
  },

  async pasteComponent(spaceId) {
    const source = get().copiedComponent;
    // 卫语句：无复制内容，直接拦截
    if (!source) {
      return;
    }

    // 卫语句：强约束禁止跨空间复制粘贴组件
    if (source.spaceId !== spaceId) {
      return;
    }

    get().saveHistory();

    const newId = crypto.randomUUID();
    const pasted: BoardComponent = {
      ...cloneComponents([source])[0],
      id: newId,
      spaceId,
      name: `${source.name} - 副本`,
      position: {
        x: source.position.x + 20,
        y: source.position.y + 20
      },
      locked: false, // 粘贴出的组件默认解锁
      createdAt: new Date()
    };

    await db.boardComponents.put(pasted);
    set(state => ({
      components: [...state.components, pasted],
      selectedComponentId: newId
    }));
  },

  async undo() {
    const { past, components, future } = get();
    // 卫语句：past 栈为空，不可撤销
    if (past.length === 0) {
      return;
    }

    const prev = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    const newFuture = [cloneComponents(components), ...future];

    // 同步 IndexedDB
    // 1. 清空当前空间的 IndexedDB 组件
    const spaceId = components[0]?.spaceId || (prev[0]?.spaceId || null);
    if (spaceId) {
      await db.boardComponents.where('spaceId').equals(spaceId).delete();
      // 2. 批量写入前一状态
      for (const c of prev) {
        await db.boardComponents.put(c);
      }
    }

    set({
      components: prev,
      past: newPast,
      future: newFuture,
      selectedComponentId: null
    });
  },

  async redo() {
    const { past, components, future } = get();
    // 卫语句：future 栈为空，不可重做
    if (future.length === 0) {
      return;
    }

    const next = future[0];
    const newFuture = future.slice(1);
    const newPast = [...past, cloneComponents(components)];

    // 同步 IndexedDB
    const spaceId = components[0]?.spaceId || (next[0]?.spaceId || null);
    if (spaceId) {
      await db.boardComponents.where('spaceId').equals(spaceId).delete();
      for (const c of next) {
        await db.boardComponents.put(c);
      }
    }

    set({
      components: next,
      past: newPast,
      future: newFuture,
      selectedComponentId: null
    });
  },

  canUndo() {
    return get().past.length > 0;
  },

  canRedo() {
    return get().future.length > 0;
  }
}));
