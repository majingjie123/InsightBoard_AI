/**
 * 命令模式 - 命令管理器
 * 用于实现撤销/重做功能
 */

/**
 * 命令接口
 * 所有命令实现此接口
 */
export interface Command {
  /** 执行命令 */
  execute(): void;
  /** 撤销命令 */
  undo(): void;
  /** 重做命令 */
  redo(): void;
  /** 获取命令描述 */
  getDescription(): string;
}

/**
 * 命令历史记录项
 */
interface HistoryItem {
  command: Command;
  description: string;
  timestamp: number;
}

/**
 * 命令管理器
 * 管理命令的执行、撤销、重做
 */
export class CommandManager {
  private history: HistoryItem[] = [];
  private currentIndex: number = -1;
  private maxHistory: number = 50;
  private isExecuting: boolean = false;

  /**
   * 执行命令
   * @param command 要执行的命令
   */
  execute(command: Command): void {
    // 卫语句：防止在执行过程中重复触发
    if (this.isExecuting) {
      return;
    }

    this.isExecuting = true;

    try {
      command.execute();

      // 移除当前索引之后的所有命令（清除未来历史）
      if (this.currentIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.currentIndex + 1);
      }

      // 添加新命令到历史
      this.history.push({
        command,
        description: command.getDescription(),
        timestamp: Date.now()
      });

      this.currentIndex++;

      // 限制历史记录数量
      if (this.history.length > this.maxHistory) {
        this.history.shift();
        this.currentIndex--;
      }
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * 撤销上一步命令
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    const item = this.history[this.currentIndex];
    item.command.undo();
    this.currentIndex--;

    return true;
  }

  /**
   * 重做上一步撤销的命令
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    this.currentIndex++;
    const item = this.history[this.currentIndex];
    item.command.redo();

    return true;
  }

  /**
   * 检查是否可以撤销
   */
  canUndo(): boolean {
    return this.currentIndex >= 0 && this.history.length > 0;
  }

  /**
   * 检查是否可以重做
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * 获取当前可撤销次数
   */
  getUndoCount(): number {
    return this.currentIndex + 1;
  }

  /**
   * 获取当前可重做次数
   */
  getRedoCount(): number {
    return this.history.length - this.currentIndex - 1;
  }

  /**
   * 获取当前历史描述列表（用于UI展示）
   */
  getHistoryDescriptions(): string[] {
    return this.history.map((item, index) => {
      const marker = index <= this.currentIndex ? '✓ ' : '  ';
      return `${marker}${item.description}`;
    });
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * 跳转到指定历史位置
   * @param index 目标历史索引
   */
  jumpTo(index: number): void {
    if (index < 0 || index >= this.history.length) {
      return;
    }

    if (index < this.currentIndex) {
      // 需要撤销
      while (this.currentIndex > index) {
        this.history[this.currentIndex].command.undo();
        this.currentIndex--;
      }
    } else if (index > this.currentIndex) {
      // 需要重做
      while (this.currentIndex < index) {
        this.currentIndex++;
        this.history[this.currentIndex].command.redo();
      }
    }
  }
}

// 导出单例
export const commandManager = new CommandManager();
export default commandManager;