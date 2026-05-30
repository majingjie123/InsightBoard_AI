export interface AIEndpoint {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  timeout: number; // 毫秒
  model: string;
  description: string;
  enabled: boolean;
}

export interface AIAssistant {
  id: string;
  name: string;
  endpointId: string;
  model: string;
  prompt: string;
  description: string;
  isDefault: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  streaming?: boolean;
}
