import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../../stores/chatStore';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { Dataset } from '../../../types/dataset';
import { MessageSquare, Send, Trash2, ChevronLeft, ChevronRight, Cpu, Database, AlertCircle, Bot, User } from 'lucide-react';

interface AIChatPanelProps {
  spaceId: string;
  datasets: Dataset[];
  onToggleCollapse: () => void;
  collapsed: boolean;
}

export const AIChatPanel: React.FC<AIChatPanelProps> = ({
  spaceId,
  datasets,
  onToggleCollapse,
  collapsed
}) => {
  const {
    messages,
    loading,
    selectedAssistantId,
    selectedDatasetId,
    continueOnCollapse,
    sendMessage,
    clearHistory,
    setContinueOnCollapse,
    setSelectedAssistantId,
    setSelectedDatasetId
  } = useChatStore();

  const { assistants, endpoints } = useAIConfigStore();

  const [inputVal, setInputVal] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messageListEndRef = useRef<HTMLDivElement>(null);

  // 1. 自动滚动到最新消息
  useEffect(() => {
    messageListEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 2. 发送消息
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = inputVal.trim();
    // 卫语句：拦截空发送
    if (!trimmed || loading) return;

    setErrorMsg(null);
    setInputVal('');

    try {
      await sendMessage(spaceId, trimmed);
    } catch (err: any) {
      setErrorMsg(err.message || '发送失败，请检查 AI 配置或网络');
    }
  };

  // 监听 Ctrl+Enter 快捷键发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 卫语句：非 Ctrl+Enter 拦截
    if (!(e.ctrlKey && e.key === 'Enter')) {
      return;
    }
    handleSend();
  };

  // 清除历史对话
  const handleClear = () => {
    const confirm = window.confirm('确认清空当前空间下的 AI 历史对话记录？');
    if (confirm) {
      clearHistory(spaceId);
    }
  };

  // 卫语句：折叠状态下，缩回窄边悬浮栏，隐藏所有组件内容
  if (collapsed) {
    return (
      <div className="w-12 h-full bg-slate-900 flex flex-col items-center py-4 border-l border-slate-800 flex-shrink-0 transition-all select-none">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors mb-6"
          title="展开 AI 交互面板"
        >
          <ChevronLeft size={16} />
        </button>
        
        {/* 窄边状态悬浮小标题 */}
        <div className="writing-mode-vertical text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
          <Cpu size={12} className="text-blue-500 animate-spin" style={{ animationDuration: '4s' }} />
          <span>AI 交互面板</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col flex-shrink-0 transition-all text-xs text-slate-300 select-none overflow-hidden">
      {/* 头部控制栏 */}
      <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-blue-500" />
          <span className="font-bold text-white">AI 智能分析助理</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            disabled={messages.length === 0}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
            title="清空当前对话历史"
          >
            <Trash2 size={13} />
          </button>
          
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="折叠面板"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 绑定助手与数据集设置 */}
      <div className="p-3 bg-slate-950/20 border-b border-slate-800 space-y-2.5 flex-shrink-0">
        {/* 选择 AI 助手 */}
        <div className="flex items-center gap-1.5">
          <Bot size={12} className="text-slate-400 flex-shrink-0" />
          <select
            value={selectedAssistantId || ''}
            onChange={(e) => setSelectedAssistantId(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 focus:outline-none text-white text-[11px]"
          >
            <option value="" disabled>切换 AI 助手...</option>
            {assistants.map(ast => {
              const boundEp = endpoints.find(e => e.id === ast.endpointId);
              return (
                <option key={ast.id} value={ast.id}>
                  {ast.name} ({boundEp?.name || '未知'})
                </option>
              );
            })}
          </select>
        </div>

        {/* 关联数据集 */}
        <div className="flex items-center gap-1.5">
          <Database size={12} className="text-slate-400 flex-shrink-0" />
          <select
            value={selectedDatasetId || ''}
            onChange={(e) => setSelectedDatasetId(e.target.value || null)}
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 focus:outline-none text-white text-[11px]"
          >
            <option value="">不关联数据集 (纯问答)</option>
            {datasets.map(d => (
              <option key={d.id} value={d.id}>
                数据: {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* 折叠后台接收配置 */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/40 justify-between">
          <span className="text-[10px] text-slate-500">折叠后继续接收回复:</span>
          <input
            type="checkbox"
            checked={continueOnCollapse}
            onChange={(e) => setContinueOnCollapse(e.target.checked)}
            className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900 h-3 w-3"
          />
        </div>
      </div>

      {/* 中部对话记录展示区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-slate-950/15">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
            <MessageSquare size={32} className="text-slate-700 mb-2" />
            <span className="font-semibold block mb-0.5">开启智能数据分析</span>
            <span className="text-[10px] text-slate-600 leading-normal">
              在下方输入您的分析提问。您可以关联左侧的 Excel 数据集，AI 将会自动识别字段并为您解答。
            </span>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id || index} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {/* 头像 */}
                {!isUser && (
                  <div className="w-6 h-6 rounded-full bg-blue-900/80 flex items-center justify-center text-blue-300 flex-shrink-0">
                    <Bot size={12} />
                  </div>
                )}

                {/* 消息框 */}
                <div className={`p-2.5 rounded max-w-[85%] leading-relaxed break-words whitespace-pre-wrap ${
                  isUser
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/50'
                }`}>
                  {msg.content}
                  {msg.streaming && (
                    <span className="inline-block w-1.5 h-3 bg-blue-400 ml-1 animate-pulse" />
                  )}
                </div>

                {isUser && (
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0 border border-slate-700">
                    <User size={12} />
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messageListEndRef} />
      </div>

      {/* 底部报错栏 */}
      {errorMsg && (
        <div className="px-4 py-2 bg-red-950/80 border-t border-red-900 text-red-300 text-[10px] leading-normal flex items-start gap-1 flex-shrink-0 animate-pulse">
          <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 底部输入框 */}
      <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-800 flex-shrink-0 flex gap-2">
        <textarea
          rows={1}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'AI 正在分析回复...' : '输入问题，Ctrl+Enter 发送...'}
          disabled={loading}
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-white text-[11px] placeholder-slate-500 leading-normal resize-none overflow-y-auto max-h-16"
        />
        <button
          type="submit"
          disabled={!inputVal.trim() || loading}
          className="bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-600 hover:bg-blue-700 text-white p-2 rounded flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
};
export default AIChatPanel;
