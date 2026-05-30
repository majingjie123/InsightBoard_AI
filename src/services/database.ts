import Dexie, { Table } from 'dexie';
import { Space } from '../types/space';
import { Dataset } from '../types/dataset';
import { BoardComponent, PublishSnapshot, ChatHistoryItem } from '../types/board';
import { AIEndpoint, AIAssistant, ChatMessage } from '../types/ai';

export class AppDatabase extends Dexie {
  spaces!: Table<Space>;
  datasets!: Table<Dataset>;
  boardComponents!: Table<BoardComponent>;
  publishSnapshots!: Table<PublishSnapshot>;
  aiConfigs!: Table<AIEndpoint>;
  aiAssistants!: Table<AIAssistant>;
  chatHistories!: Table<ChatHistoryItem>;

  constructor() {
    super('InsightBoardDB');
    this.version(2).stores({
      spaces: 'id, name, createdAt',
      datasets: 'id, spaceId, name',
      boardComponents: 'id, spaceId, type',
      publishSnapshots: 'id, spaceId, version',
      aiConfigs: 'id, name, enabled',
      aiAssistants: 'id, endpointId, name, isDefault',
      chatHistories: 'id, spaceId, timestamp'
    });
  }
}

export const db = new AppDatabase();
export default db;

