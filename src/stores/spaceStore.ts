import { create } from 'zustand';
import db from '../services/database';
import { Space } from '../types/space';

interface SpaceState {
  spaces: Space[];
  currentSpaceId: string | null;
  loading: boolean;

  init(): Promise<void>;
  createSpace(name: string): Promise<string>;
  renameSpace(id: string, name: string): Promise<void>;
  deleteSpace(id: string): Promise<void>;
  setCurrentSpaceId(id: string | null): void;
}

export const useSpaceStore = create<SpaceState>((set, get) => ({
  spaces: [],
  currentSpaceId: null,
  loading: false,

  async init() {
    set({ loading: true });
    try {
      const spaces = await db.spaces.orderBy('createdAt').toArray();
      const lastOpened = localStorage.getItem('lastOpenedSpace');
      const validLastOpened = lastOpened && spaces.some(s => s.id === lastOpened) ? lastOpened : null;
      
      set({
        spaces,
        currentSpaceId: validLastOpened || spaces[0]?.id || null,
        loading: false
      });
    } catch (e) {
      set({ loading: false });
    }
  },

  async createSpace(name) {
    const trimmed = name.trim();
    // 卫语句：基本空校验
    if (!trimmed) {
      throw new Error('空间名称不能为空');
    }

    // 卫语句：重名校验
    const isDuplicate = get().spaces.some(s => s.name === trimmed);
    if (isDuplicate) {
      throw new Error('已存在同名工作空间');
    }

    const id = crypto.randomUUID();
    const newSpace: Space = {
      id,
      name: trimmed,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.spaces.put(newSpace);
    set(state => ({ spaces: [...state.spaces, newSpace], currentSpaceId: id }));
    localStorage.setItem('lastOpenedSpace', id);
    return id;
  },

  async renameSpace(id, name) {
    const trimmed = name.trim();
    // 卫语句：基本空校验
    if (!trimmed) {
      throw new Error('空间名称不能为空');
    }

    // 卫语句：重名校验（排除自己）
    const isDuplicate = get().spaces.some(s => s.name === trimmed && s.id !== id);
    if (isDuplicate) {
      throw new Error('已存在同名工作空间');
    }

    const now = new Date();
    await db.spaces.update(id, { name: trimmed, updatedAt: now });

    set(state => ({
      spaces: state.spaces.map(s => s.id === id ? { ...s, name: trimmed, updatedAt: now } : s)
    }));
  },

  async deleteSpace(id) {
    // 强制级联删除约束：删除空间 -> 删除看板组件、数据集、发布快照数据
    // 1. 删除看板组件
    await db.boardComponents.where('spaceId').equals(id).delete();
    
    // 2. 删除数据集
    await db.datasets.where('spaceId').equals(id).delete();

    // 3. 删除发布快照
    await db.publishSnapshots.where('spaceId').equals(id).delete();

    // 4. 删除空间本身
    await db.spaces.delete(id);

    const updatedSpaces = get().spaces.filter(s => s.id !== id);
    let nextCurrent = get().currentSpaceId;

    if (nextCurrent === id) {
      nextCurrent = updatedSpaces[0]?.id || null;
      if (nextCurrent) {
        localStorage.setItem('lastOpenedSpace', nextCurrent);
      } else {
        localStorage.removeItem('lastOpenedSpace');
      }
    }

    set({
      spaces: updatedSpaces,
      currentSpaceId: nextCurrent
    });
  },

  setCurrentSpaceId(id) {
    if (id) {
      localStorage.setItem('lastOpenedSpace', id);
    } else {
      localStorage.removeItem('lastOpenedSpace');
    }
    set({ currentSpaceId: id });
  }
}));
