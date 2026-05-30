/**
 * 观察者模式 - 看板事件观察者
 * 用于组件状态同步、事件通知
 */

import { BoardComponent } from '../../types/board';

/**
 * 看板事件类型
 */
export type BoardEventType =
  | 'componentAdded'
  | 'componentRemoved'
  | 'componentUpdated'
  | 'componentSelected'
  | 'componentLocked'
  | 'layoutChanged'
  | 'datasetChanged';

/**
 * 事件数据接口
 */
export interface BoardEventData {
  componentAdded?: {
    component: BoardComponent;
  };
  componentRemoved?: {
    componentId: string;
    component?: BoardComponent;
  };
  componentUpdated?: {
    componentId: string;
    updates: Partial<BoardComponent>;
    previousData?: BoardComponent;
  };
  componentSelected?: {
    componentId: string | null;
  };
  componentLocked?: {
    componentId: string;
    locked: boolean;
  };
  layoutChanged?: {
    components: BoardComponent[];
  };
  datasetChanged?: {
    datasetId: string;
    action: 'add' | 'update' | 'remove';
  };
}

/**
 * 观察者接口
 */
export interface BoardObserver {
  /** 观察者名称（用于调试） */
  name?: string;

  /**
   * 处理事件
   * @param event 事件类型
   * @param data 事件数据
   */
  onEvent(event: BoardEventType, data: BoardEventData): void;

  /**
   * 优先级（数值越小越先执行）
   * 默认 100
   */
  priority?: number;
}

/**
 * 看板主题（被观察者）
 * 管理所有观察者并分发事件
 */
export class BoardSubject {
  private observers: Map<BoardEventType, BoardObserver[]> = new Map();
  private eventQueue: Array<{ event: BoardEventType; data: BoardEventData }> = [];
  private isNotifying: boolean = false;

  /**
   * 订阅事件
   * @param event 事件类型
   * @param observer 观察者
   */
  subscribe(event: BoardEventType, observer: BoardObserver): void {
    const observers = this.observers.get(event) || [];
    observers.push(observer);
    // 按优先级排序
    observers.sort((a, b) => (a.priority || 100) - (b.priority || 100));
    this.observers.set(event, observers);
  }

  /**
   * 取消订阅
   * @param event 事件类型
   * @param observer 观察者
   */
  unsubscribe(event: BoardEventType, observer: BoardObserver): void {
    const observers = this.observers.get(event) || [];
    const index = observers.indexOf(observer);
    if (index > -1) {
      observers.splice(index, 1);
    }
  }

  /**
   * 取消订阅所有事件
   * @param observer 观察者
   */
  unsubscribeAll(observer: BoardObserver): void {
    this.observers.forEach((observers, event) => {
      const index = observers.indexOf(observer);
      if (index > -1) {
        observers.splice(index, 1);
      }
    });
  }

  /**
   * 通知观察者
   * @param event 事件类型
   * @param data 事件数据
   */
  notify(event: BoardEventType, data: BoardEventData): void {
    // 将事件加入队列，避免在通知过程中修改观察者列表
    this.eventQueue.push({ event, data });

    // 如果不在通知过程中，立即处理队列
    if (!this.isNotifying) {
      this.processEventQueue();
    }
  }

  /**
   * 处理事件队列
   */
  private processEventQueue(): void {
    this.isNotifying = true;

    while (this.eventQueue.length > 0) {
      const { event, data } = this.eventQueue.shift()!;
      const observers = this.observers.get(event) || [];

      for (const observer of observers) {
        try {
          observer.onEvent(event, data);
        } catch (error) {
          console.error(`[BoardObserver] Observer ${observer.name || 'anonymous'} error:`, error);
        }
      }
    }

    this.isNotifying = false;
  }

  /**
   * 获取指定事件的观察者数量
   */
  getObserverCount(event?: BoardEventType): number {
    if (event) {
      return this.observers.get(event)?.length || 0;
    }
    let total = 0;
    this.observers.forEach(observers => {
      total += observers.length;
    });
    return total;
  }

  /**
   * 清空所有观察者
   */
  clear(): void {
    this.observers.clear();
    this.eventQueue = [];
  }

  /**
   * 清空指定事件的观察者
   */
  clearEvent(event: BoardEventType): void {
    this.observers.delete(event);
  }
}

/**
 * 快捷方法：创建事件数据
 */
export const BoardEvent = {
  componentAdded: (component: BoardComponent): BoardEventData => ({
    componentAdded: { component }
  }),

  componentRemoved: (componentId: string, component?: BoardComponent): BoardEventData => ({
    componentRemoved: { componentId, component }
  }),

  componentUpdated: (
    componentId: string,
    updates: Partial<BoardComponent>,
    previousData?: BoardComponent
  ): BoardEventData => ({
    componentUpdated: { componentId, updates, previousData }
  }),

  componentSelected: (componentId: string | null): BoardEventData => ({
    componentSelected: { componentId }
  }),

  componentLocked: (componentId: string, locked: boolean): BoardEventData => ({
    componentLocked: { componentId, locked }
  }),

  layoutChanged: (components: BoardComponent[]): BoardEventData => ({
    layoutChanged: { components }
  }),

  datasetChanged: (datasetId: string, action: 'add' | 'update' | 'remove'): BoardEventData => ({
    datasetChanged: { datasetId, action }
  })
};

// 导出单例
export const boardSubject = new BoardSubject();
export default boardSubject;