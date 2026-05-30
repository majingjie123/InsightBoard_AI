import { create } from 'zustand';
import db from '../services/database';
import { ChatHistoryItem } from '../types/board';
import { ChatMessage, AIEndpoint } from '../types/ai';
import { aiApiContext } from '../core/strategies/AIApiStrategy';
import { useAIConfigStore } from './aiConfigStore';

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  selectedAssistantId: string | null;
  selectedDatasetId: string | null;
  panelCollapsed: boolean;
  continueOnCollapse: boolean; // 是否在折叠后继续接收消息

  // 接口/请求控制
  abortController: AbortController | null;

  // 初始化与操作
  initPanel(spaceId: string): Promise<void>;
  sendMessage(spaceId: string, content: string): Promise<void>;
  clearHistory(spaceId: string): Promise<void>;
  setPanelCollapsed(collapsed: boolean): void;
  setContinueOnCollapse(continueOn: boolean): void;
  setSelectedAssistantId(id: string | null): void;
  setSelectedDatasetId(id: string | null): void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,
  selectedAssistantId: null,
  selectedDatasetId: null,
  panelCollapsed: localStorage.getItem('aiPanelCollapsed') === 'true',
  continueOnCollapse: localStorage.getItem('aiPanelContinueOnCollapse') === 'true',
  abortController: null,

  async initPanel(spaceId) {
    // 卫语句：拦截空空间
    if (!spaceId) {
      set({ messages: [] });
      return;
    }

    // 从 IndexedDB 加载历史消息
    const history = await db.chatHistories
      .where('spaceId')
      .equals(spaceId)
      .sortBy('timestamp');

    const messages: ChatMessage[] = history.map(item => ({
      id: item.id,
      role: item.role,
      content: item.content,
      timestamp: item.timestamp
    }));

    // 获取 AI 默认助手
    const defaultAsstId = useAIConfigStore.getState().defaultAssistantId;

    set({
      messages,
      selectedAssistantId: get().selectedAssistantId || defaultAsstId,
      loading: false
    });
  },

  async sendMessage(spaceId, content) {
    const trimmed = content.trim();
    // 卫语句：内容为空则拦截
    if (!trimmed) return;

    // 1. 获取选中的助手配置
    const { selectedAssistantId, selectedDatasetId, messages } = get();
    const assistant = useAIConfigStore.getState().assistants.find(a => a.id === selectedAssistantId);
    
    // 卫语句：无可用助手拦截
    if (!assistant) {
      throw new Error('当前未选中任何 AI 助手，请先配置或选择助手。');
    }

    const endpoint = useAIConfigStore.getState().endpoints.find(e => e.id === assistant.endpointId);
    // 卫语句：接口配置被删拦截
    if (!endpoint || !endpoint.enabled) {
      throw new Error('关联的 AI 接口不存在或已被禁用，请检查 AI 配置。');
    }

    // 2. 插入用户消息并存入 IndexedDB
    const userMsgId = crypto.randomUUID();
    const userTimestamp = Date.now();
    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: trimmed,
      timestamp: userTimestamp
    };

    const newMessages = [...messages, userMessage];
    set({ messages: newMessages, loading: true });

    await db.chatHistories.put({
      id: userMsgId,
      spaceId,
      role: 'user',
      content: trimmed,
      timestamp: userTimestamp
    });

    // 3. 构建发送给大模型的上下文 (系统 Prompt + 数据集摘要 + 历史对话)
    const apiMessages: ChatMessage[] = [];
    
    // 3.1 注入助理 System Prompt
    let systemPrompt = assistant.prompt || '你是一个专业的数据分析助手，能帮我分析看板上的数据。';

    // 3.2 注入关联数据集结构信息 (如果选了数据集)
    if (selectedDatasetId) {
      const dataset = await db.datasets.get(selectedDatasetId);
      if (dataset) {
        const columnsInfo = dataset.columns.map(c => `${c.name}(${c.type})`).join(', ');
        // 提取前 5 行作为数据预览样例
        const sampleData = JSON.stringify(dataset.data.slice(0, 5), null, 2);
        systemPrompt += `\n\n当前关联的数据集为: "${dataset.name}" (文件名: ${dataset.fileName})。\n含有字段: [${columnsInfo}]。\n数据集前5行样例数据如下:\n\`\`\`json\n${sampleData}\n\`\`\`\n请基于该数据集的特征回答用户的分析提问。`;
      }
    }

    apiMessages.push({
      id: 'system',
      role: 'user', // 用 user 发送提示，或根据标准 OpenAI api 使用 system 角色，大部分接口支持 system
      content: systemPrompt,
      timestamp: Date.now()
    });

    // 3.3 压入历史消息 (最近 10 条)
    const recentMessages = newMessages.slice(-10);
    apiMessages.push(...recentMessages);

    // 4. 发送流式请求
    const ctrl = new AbortController();
    set({ abortController: ctrl });

    const assistantMsgId = crypto.randomUUID();
    const assistantTimestamp = Date.now();

    // 插入一个空白的 AI 消息占位
    const assistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: assistantTimestamp,
      streaming: true
    };

    set(state => ({
      messages: [...state.messages, assistantMessage]
    }));

    try {
      const strategy = aiApiContext.getStrategy('openai');
      let responseContent = '';

      await strategy.chatStream(
        endpoint,
        apiMessages,
        (chunk) => {
          responseContent += chunk;
          set(state => ({
            messages: state.messages.map(m =>
              m.id === assistantMsgId ? { ...m, content: responseContent } : m
            )
          }));
        },
        ctrl.signal
      );

      // 请求圆满结束，移除流式标志，写入数据库持久化
      set(state => ({
        messages: state.messages.map(m =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m
        ),
        loading: false,
        abortController: null
      }));

      await db.chatHistories.put({
        id: assistantMsgId,
        spaceId,
        role: 'assistant',
        content: responseContent,
        timestamp: assistantTimestamp
      });

    } catch (err: any) {
      // 卫语句：拦截 Abort 主动中止
      if (err.name === 'AbortError') {
        set(state => ({
          messages: state.messages.map(m =>
            m.id === assistantMsgId ? { ...m, content: m.content + ' [对话已中止]', streaming: false } : m
          ),
          loading: false,
          abortController: null
        }));
        
        const partialMsg = get().messages.find(m => m.id === assistantMsgId);
        await db.chatHistories.put({
          id: assistantMsgId,
          spaceId,
          role: 'assistant',
          content: (partialMsg?.content || '') + ' [对话已中止]',
          timestamp: assistantTimestamp
        });
        return;
      }

      // 异常拦截
      set(state => ({
        messages: state.messages.map(m =>
          m.id === assistantMsgId ? { ...m, content: m.content + `\n[请求出错: ${err.message}]`, streaming: false } : m
        ),
        loading: false,
        abortController: null
      }));

      const partialMsg = get().messages.find(m => m.id === assistantMsgId);
      await db.chatHistories.put({
        id: assistantMsgId,
        spaceId,
        role: 'assistant',
        content: (partialMsg?.content || '') + `\n[请求出错: ${err.message}]`,
        timestamp: assistantTimestamp
      });
    }
  },

  async clearHistory(spaceId) {
    await db.chatHistories.where('spaceId').equals(spaceId).delete();
    set({ messages: [] });
  },

  setPanelCollapsed(collapsed) {
    localStorage.setItem('aiPanelCollapsed', String(collapsed));
    set({ panelCollapsed: collapsed });

    // 折叠 AI 面板时，若存在未完成请求且未设置后台继续，默认自动取消请求以节省资源
    if (collapsed && get().loading && !get().continueOnCollapse) {
      if (get().abortController) {
        get().abortController?.abort();
      }
    }
  },

  setContinueOnCollapse(continueOn) {
    localStorage.setItem('aiPanelContinueOnCollapse', String(continueOn));
    set({ continueOnCollapse: continueOn });
  },

  setSelectedAssistantId(id) {
    set({ selectedAssistantId: id });
  },

  setSelectedDatasetId(id) {
    set({ selectedDatasetId: id });
  }
}));
