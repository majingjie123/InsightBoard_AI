import { create } from 'zustand';
import db from '../services/database';
import { AIEndpoint, AIAssistant } from '../types/ai';
import { OpenAIApiStrategy } from '../core/strategies/AIApiStrategy';

interface AIConfigState {
  endpoints: AIEndpoint[];
  assistants: AIAssistant[];
  defaultAssistantId: string | null;
  loading: boolean;

  // 初始化
  init(): Promise<void>;

  // 接口操作
  addEndpoint(endpoint: Omit<AIEndpoint, 'id'>): Promise<void>;
  updateEndpoint(id: string, endpoint: Partial<AIEndpoint>): Promise<void>;
  deleteEndpoint(id: string): Promise<void>;
  testConnection(endpoint: AIEndpoint): Promise<boolean>;
  fetchModels(endpointId: string): Promise<string[]>;

  // 助手操作
  addAssistant(assistant: Omit<AIAssistant, 'id' | 'isDefault'>): Promise<void>;
  updateAssistant(id: string, assistant: Partial<AIAssistant>): Promise<void>;
  deleteAssistant(id: string): Promise<void>;
  setDefaultAssistant(id: string): Promise<void>;
}

export const useAIConfigStore = create<AIConfigState>((set, get) => ({
  endpoints: [],
  assistants: [],
  defaultAssistantId: null,
  loading: false,

  async init() {
    set({ loading: true });
    try {
      const endpoints = await db.aiConfigs.toArray();
      const assistants = await db.aiAssistants.toArray();
      
      // 寻找默认助手
      const defaultAsst = assistants.find(a => a.isDefault);
      const defaultId = defaultAsst ? defaultAsst.id : (assistants[0]?.id || null);

      set({
        endpoints,
        assistants,
        defaultAssistantId: defaultId,
        loading: false
      });
    } catch (e) {
      set({ loading: false });
    }
  },

  async addEndpoint(endpointData) {
    const id = crypto.randomUUID();
    const newEndpoint: AIEndpoint = {
      ...endpointData,
      id,
      enabled: endpointData.enabled ?? true
    };
    await db.aiConfigs.put(newEndpoint);
    set(state => ({ endpoints: [...state.endpoints, newEndpoint] }));
  },

  async updateEndpoint(id, updateData) {
    await db.aiConfigs.update(id, updateData);
    set(state => ({
      endpoints: state.endpoints.map(ep => ep.id === id ? { ...ep, ...updateData } : ep)
    }));
  },

  async deleteEndpoint(id) {
    // 级联删除绑定了此接口的助手
    const assistantsToDelete = get().assistants.filter(a => a.endpointId === id);
    for (const a of assistantsToDelete) {
      await db.aiAssistants.delete(a.id);
    }
    
    await db.aiConfigs.delete(id);
    
    const updatedAssistants = get().assistants.filter(a => a.endpointId !== id);
    let newDefaultId = get().defaultAssistantId;
    if (newDefaultId && assistantsToDelete.some(a => a.id === newDefaultId)) {
      newDefaultId = updatedAssistants[0]?.id || null;
      if (newDefaultId) {
        await db.aiAssistants.update(newDefaultId, { isDefault: true });
      }
    }

    set(state => ({
      endpoints: state.endpoints.filter(ep => ep.id !== id),
      assistants: updatedAssistants,
      defaultAssistantId: newDefaultId
    }));
  },

  async testConnection(endpoint) {
    const strategy = new OpenAIApiStrategy();
    return strategy.testConnection(endpoint);
  },

  async fetchModels(endpointId) {
    const endpoint = get().endpoints.find(ep => ep.id === endpointId);
    // 卫语句：拦截未知接口
    if (!endpoint) {
      throw new Error('未找到接口配置');
    }

    // 卫语句：基本校验
    if (!endpoint.url || !endpoint.apiKey) {
      throw new Error('未填写接口请求地址或API Key');
    }

    const baseUrl = endpoint.url.endsWith('/') ? endpoint.url.slice(0, -1) : endpoint.url;
    const testUrl = baseUrl.includes('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${endpoint.apiKey}`
      },
      signal: AbortSignal.timeout(endpoint.timeout || 8000)
    });

    // 卫语句：拦截请求失败
    if (!response.ok) {
      throw new Error(`获取模型列表失败，HTTP状态码: ${response.status}`);
    }

    const resJson = await response.json();
    const models = resJson.data || [];
    const modelNames = models.map((m: any) => m.id);

    // 卫语句：空列表防错
    if (modelNames.length === 0) {
      return [endpoint.model];
    }

    return modelNames;
  },

  async addAssistant(assistantData) {
    const id = crypto.randomUUID();
    const isFirst = get().assistants.length === 0;
    const newAssistant: AIAssistant = {
      ...assistantData,
      id,
      isDefault: isFirst
    };
    
    await db.aiAssistants.put(newAssistant);
    
    set(state => ({
      assistants: [...state.assistants, newAssistant],
      defaultAssistantId: isFirst ? id : state.defaultAssistantId
    }));
  },

  async updateAssistant(id, updateData) {
    await db.aiAssistants.update(id, updateData);
    set(state => ({
      assistants: state.assistants.map(ast => ast.id === id ? { ...ast, ...updateData } : ast)
    }));
  },

  async deleteAssistant(id) {
    await db.aiAssistants.delete(id);
    const updatedAssistants = get().assistants.filter(ast => ast.id !== id);
    
    let newDefaultId = get().defaultAssistantId;
    if (newDefaultId === id) {
      newDefaultId = updatedAssistants[0]?.id || null;
      if (newDefaultId) {
        await db.aiAssistants.update(newDefaultId, { isDefault: true });
        // 更新本地状态列表
        updatedAssistants[0].isDefault = true;
      }
    }

    set({
      assistants: updatedAssistants,
      defaultAssistantId: newDefaultId
    });
  },

  async setDefaultAssistant(id) {
    const assistants = get().assistants;
    for (const ast of assistants) {
      const isTarget = ast.id === id;
      await db.aiAssistants.update(ast.id, { isDefault: isTarget });
    }

    set(state => ({
      defaultAssistantId: id,
      assistants: state.assistants.map(ast => ({ ...ast, isDefault: ast.id === id }))
    }));
  }
}));
