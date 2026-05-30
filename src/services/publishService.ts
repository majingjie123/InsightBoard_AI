import { db } from './database';
import { Dataset } from '../types/dataset';
import { BoardComponent, PublishSnapshot } from '../types/board';

export class PublishService {
  private readonly MAX_SNAPSHOTS = 5;
  private readonly PREVIEW_GRID_CELL_WIDTH = 80;
  private readonly PREVIEW_GRID_CELL_HEIGHT = 80;
  private readonly PREVIEW_GRID_COLUMNS = 12;

  private buildPreviewGrid(component: BoardComponent) {
    const col = Math.max(1, Math.floor(component.position.x / this.PREVIEW_GRID_CELL_WIDTH) + 1);
    const row = Math.max(1, Math.floor(component.position.y / this.PREVIEW_GRID_CELL_HEIGHT) + 1);
    const colSpan = Math.max(1, Math.min(this.PREVIEW_GRID_COLUMNS, Math.ceil(component.size.width / this.PREVIEW_GRID_CELL_WIDTH)));
    const rowSpan = Math.max(2, Math.ceil(component.size.height / this.PREVIEW_GRID_CELL_HEIGHT));

    return {
      row,
      col: Math.min(col, this.PREVIEW_GRID_COLUMNS),
      rowSpan,
      colSpan: Math.min(colSpan, this.PREVIEW_GRID_COLUMNS - Math.min(col, this.PREVIEW_GRID_COLUMNS) + 1)
    };
  }

  /**
   * 发布空间看板并截取当前状态快照
   * @param spaceId 工作空间ID
   * @returns 生成的快照 ID
   */
  async publish(spaceId: string, aiPanelCollapsed?: boolean): Promise<string> {
    // 卫语句：校验空间合法性
    const space = await db.spaces.get(spaceId);
    if (!space) {
      throw new Error('未找到当前工作空间');
    }

    // 1. 获取该空间下所有看板组件
    const components = await db.boardComponents
      .where('spaceId')
      .equals(spaceId)
      .toArray();

    // 卫语句：如果没有任何组件，拦截发布
    if (components.length === 0) {
      throw new Error('当前看板为空，无法发布');
    }

    // 2. 收集各组件关联的数据集ID并深拷贝结构化数据
    const datasetIds = Array.from(
      new Set(
        components
          .map(c => c.config?.dataSourceId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    );

    const datasetsSnapshot: Dataset[] = [];
    for (const datasetId of datasetIds) {
      const originalDataset = await db.datasets.get(datasetId);
      // 卫语句：关联的数据集若丢失，中断发布以保证快照完整性
      if (!originalDataset) {
        throw new Error(`关联的数据集 "${datasetId}" 丢失，发布失败`);
      }

      // 执行深拷贝以实现数据源隔离
      datasetsSnapshot.push({
        ...originalDataset,
        data: JSON.parse(JSON.stringify(originalDataset.data))
      });
    }

    // 收集聊天对话历史
    const chatHistory = await db.chatHistories
      .where('spaceId')
      .equals(spaceId)
      .sortBy('timestamp');

    // 3. 计算发布版本号
    const lastSnapshot = await db.publishSnapshots
      .where('spaceId')
      .equals(spaceId)
      .last();
    const nextVersion = lastSnapshot ? lastSnapshot.version + 1 : 1;

    // 4. 创建发布版本快照
    const newSnapshotId = `${spaceId}_v${nextVersion}`;
    const componentsSnapshot = JSON.parse(JSON.stringify(components)).map((component: BoardComponent) => ({
      ...component,
      previewGrid: this.buildPreviewGrid(component)
    }));

    const newSnapshot: PublishSnapshot = {
      id: newSnapshotId,
      spaceId,
      version: nextVersion,
      components: componentsSnapshot,
      datasets: datasetsSnapshot,
      createdAt: new Date(),
      aiPanelCollapsed: !!aiPanelCollapsed,
      chatHistory: JSON.parse(JSON.stringify(chatHistory))
    };

    await db.publishSnapshots.put(newSnapshot);

    // 5. 版本数剪枝控制 (保留最近5个)
    await this.pruneOldSnapshots(spaceId);

    return newSnapshotId;
  }

  private async pruneOldSnapshots(spaceId: string): Promise<void> {
    const snapshots = await db.publishSnapshots
      .where('spaceId')
      .equals(spaceId)
      .sortBy('version');

    // 卫语句：未达快照上限则无需清理
    if (snapshots.length <= this.MAX_SNAPSHOTS) {
      return;
    }

    const toDeleteCount = snapshots.length - this.MAX_SNAPSHOTS;
    const deletePromises = snapshots
      .slice(0, toDeleteCount)
      .map(s => db.publishSnapshots.delete(s.id));

    await Promise.all(deletePromises);
  }
}

export const publishService = new PublishService();
export default publishService;
