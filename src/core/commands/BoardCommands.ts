import { Command } from './CommandManager';
import { BoardComponent } from '../../types/board';

/**
 * 看板状态存储接口
 * 命令需要通过此接口操作看板状态
 */
export interface BoardState {
  components: BoardComponent[];
  addComponent(component: BoardComponent): void;
  removeComponent(id: string): void;
  updateComponent(id: string, updates: Partial<BoardComponent>): void;
  getComponent(id: string): BoardComponent | undefined;
}

/**
 * 添加组件命令
 */
export class AddComponentCommand implements Command {
  constructor(
    private board: BoardState,
    private component: BoardComponent
  ) {}

  execute(): void {
    this.board.addComponent(this.component);
  }

  undo(): void {
    this.board.removeComponent(this.component.id);
  }

  redo(): void {
    this.board.addComponent(this.component);
  }

  getDescription(): string {
    return `添加组件: ${this.component.name}`;
  }
}

/**
 * 删除组件命令
 */
export class RemoveComponentCommand implements Command {
  private removedComponent?: BoardComponent;
  private index: number = -1;

  constructor(
    private board: BoardState,
    private componentId: string
  ) {}

  execute(): void {
    const component = this.board.getComponent(this.componentId);
    if (component) {
      this.removedComponent = { ...component };
      this.index = this.board.components.findIndex(c => c.id === this.componentId);
      this.board.removeComponent(this.componentId);
    }
  }

  undo(): void {
    if (this.removedComponent) {
      if (this.index >= 0 && this.index <= this.board.components.length) {
        this.board.components.splice(this.index, 0, this.removedComponent);
      } else {
        this.board.addComponent(this.removedComponent);
      }
    }
  }

  redo(): void {
    this.board.removeComponent(this.componentId);
  }

  getDescription(): string {
    return `删除组件: ${this.removedComponent?.name || this.componentId}`;
  }
}

/**
 * 移动组件命令
 */
export class MoveComponentCommand implements Command {
  private previousPosition: { x: number; y: number };
  private newPosition: { x: number; y: number };

  constructor(
    private board: BoardState,
    private componentId: string,
    newPosition: { x: number; y: number }
  ) {
    const component = board.getComponent(componentId);
    this.previousPosition = component?.position || { x: 0, y: 0 };
    this.newPosition = newPosition;
  }

  execute(): void {
    this.board.updateComponent(this.componentId, {
      position: this.newPosition
    });
  }

  undo(): void {
    this.board.updateComponent(this.componentId, {
      position: this.previousPosition
    });
  }

  redo(): void {
    this.board.updateComponent(this.componentId, {
      position: this.newPosition
    });
  }

  getDescription(): string {
    return `移动组件位置`;
  }
}

/**
 * 调整组件尺寸命令
 */
export class ResizeComponentCommand implements Command {
  private previousSize: { width: number; height: number };
  private newSize: { width: number; height: number };

  constructor(
    private board: BoardState,
    private componentId: string,
    newSize: { width: number; height: number }
  ) {
    const component = board.getComponent(componentId);
    this.previousSize = component?.size || { width: 0, height: 0 };
    this.newSize = newSize;
  }

  execute(): void {
    this.board.updateComponent(this.componentId, {
      size: this.newSize
    });
  }

  undo(): void {
    this.board.updateComponent(this.componentId, {
      size: this.previousSize
    });
  }

  redo(): void {
    this.board.updateComponent(this.componentId, {
      size: this.newSize
    });
  }

  getDescription(): string {
    return `调整组件尺寸`;
  }
}

/**
 * 更新组件配置命令
 */
export class UpdateConfigCommand implements Command {
  private previousConfig: any;
  private newConfig: any;

  constructor(
    private board: BoardState,
    private componentId: string,
    newConfig: Partial<BoardComponent['config']>
  ) {
    const component = board.getComponent(componentId);
    this.previousConfig = component?.config;
    this.newConfig = { ...this.previousConfig, ...newConfig };
  }

  execute(): void {
    this.board.updateComponent(this.componentId, {
      config: this.newConfig
    });
  }

  undo(): void {
    this.board.updateComponent(this.componentId, {
      config: this.previousConfig
    });
  }

  redo(): void {
    this.board.updateComponent(this.componentId, {
      config: this.newConfig
    });
  }

  getDescription(): string {
    return `更新组件配置`;
  }
}

/**
 * 锁定/解锁组件命令
 */
export class ToggleLockCommand implements Command {
  private previousLocked: boolean;

  constructor(
    private board: BoardState,
    private componentId: string
  ) {
    const component = board.getComponent(componentId);
    this.previousLocked = component?.locked || false;
  }

  execute(): void {
    this.board.updateComponent(this.componentId, {
      locked: !this.previousLocked
    });
  }

  undo(): void {
    this.board.updateComponent(this.componentId, {
      locked: this.previousLocked
    });
  }

  redo(): void {
    this.board.updateComponent(this.componentId, {
      locked: !this.previousLocked
    });
  }

  getDescription(): string {
    return this.previousLocked ? `解锁组件` : `锁定组件`;
  }
}

/**
 * 批量操作命令
 * 用于组合多个命令为一个原子操作
 */
export class BatchCommand implements Command {
  private commands: Command[];

  constructor(commands: Command[]) {
    this.commands = commands;
  }

  execute(): void {
    this.commands.forEach(cmd => cmd.execute());
  }

  undo(): void {
    // 逆向执行撤销
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }

  redo(): void {
    // 正向执行重做
    this.commands.forEach(cmd => cmd.redo());
  }

  getDescription(): string {
    return `批量操作 (${this.commands.length} 个操作)`;
  }

  /**
   * 添加命令到批量操作
   */
  addCommand(command: Command): void {
    this.commands.push(command);
  }
}