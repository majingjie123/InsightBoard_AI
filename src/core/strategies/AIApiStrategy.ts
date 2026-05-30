import { ChatMessage, AIEndpoint } from '../../types/ai';

export interface AIApiStrategy {
  testConnection(endpoint: AIEndpoint): Promise<boolean>;
  chatStream(
    endpoint: AIEndpoint,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void>;
}

// 标准 OpenAI 协议实现
export class OpenAIApiStrategy implements AIApiStrategy {
  async testConnection(endpoint: AIEndpoint): Promise<boolean> {
    // 卫语句：基础配置校验
    if (!endpoint.url || !endpoint.apiKey) {
      return false;
    }

    try {
      // 保证 URL 规范性，拼装 /v1/models 或保持原样
      const baseUrl = endpoint.url.endsWith('/') ? endpoint.url.slice(0, -1) : endpoint.url;
      const testUrl = baseUrl.includes('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${endpoint.apiKey}`
        },
        signal: AbortSignal.timeout(endpoint.timeout || 5000)
      });

      // 卫语句：HTTP 状态码校验
      if (!response.ok) {
        return false;
      }

      const payload = await response.json();
      return Array.isArray(payload?.data) && payload.data.some((model: any) => typeof model?.id === 'string');
    } catch (error) {
      return false;
    }
  }

  async chatStream(
    endpoint: AIEndpoint,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<void> {
    // 卫语句：参数合法性校验
    if (!endpoint.url || !endpoint.apiKey) {
      throw new Error('AI 接口地址或 API Key 未配置');
    }

    const baseUrl = endpoint.url.endsWith('/') ? endpoint.url.slice(0, -1) : endpoint.url;
    const chatUrl = baseUrl.includes('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${endpoint.apiKey}`
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: true
      }),
      signal
    });

    // 卫语句：响应状态校验
    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`AI 请求失败: ${response.status} - ${errorMsg}`);
    }

    // 卫语句：检测响应体流式输出支持
    if (!response.body) {
      throw new Error('未获取到响应流');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      // 卫语句：流式读取完成，退出循环
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 最后一个可能不完整，放回 buffer

      for (const line of lines) {
        const cleanedLine = line.trim();
        // 卫语句：忽略空行
        if (!cleanedLine) {
          continue;
        }
        // 卫语句：忽略非 data 行
        if (!cleanedLine.startsWith('data:')) {
          continue;
        }

        const dataStr = cleanedLine.slice(5).trim();
        // 卫语句：结束标志
        if (dataStr === '[DONE]') {
          break;
        }

        try {
          const parsed = JSON.parse(dataStr);
          const chunkText = parsed.choices?.[0]?.delta?.content;
          // 卫语句：忽略没有文本的 chunk
          if (!chunkText) {
            continue;
          }
          onChunk(chunkText);
        } catch (e) {
          // 容错：解析失败跳过
          continue;
        }
      }
    }
  }
}

// 策略工厂/管理器
export class AIApiContext {
  private strategies: Map<string, AIApiStrategy> = new Map();

  constructor() {
    // 目前仅支持 OpenAI
    this.strategies.set('openai', new OpenAIApiStrategy());
  }

  getStrategy(protocolType: string): AIApiStrategy {
    const strategy = this.strategies.get(protocolType.toLowerCase());
    // 卫语句：找不到对应的协议实现则拦截
    if (!strategy) {
      throw new Error(`不支持的 AI 协议类型: ${protocolType}`);
    }
    return strategy;
  }
}

export const aiApiContext = new AIApiContext();
export default aiApiContext;
