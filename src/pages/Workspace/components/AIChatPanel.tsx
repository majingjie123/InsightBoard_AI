import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../../stores/chatStore';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { Dataset } from '../../../types/dataset';
import { ChatMessage } from '../../../types/ai';
import { MessageSquare, Send, Trash2, ChevronLeft, ChevronRight, Cpu, Database, AlertCircle, Bot, User, Sparkles, StopCircle, Copy, Check } from 'lucide-react';


// 行内 Markdown 格式切分与解析
const renderInlineMarkdown = (text: string): React.ReactNode => {
  if (!text) return '';

  let parts: (string | React.ReactElement)[] = [text];

  // 1. 解析行内代码
  parts = parts.flatMap(part => {
    if (typeof part !== 'string') return part;
    const split = part.split(/`([^`]+)`/g);
    return split.map((sub, i) => {
      if (i % 2 === 1) {
        return (
          <code key={i} className="bg-slate-200 text-amber-800 px-1 py-0.5 rounded font-mono mx-0.5 select-text text-[10px] font-semibold">
            {sub}
          </code>
        );
      }
      return sub;
    });
  });

  // 2. 解析加粗 **
  parts = parts.flatMap(part => {
    if (typeof part !== 'string') return part;
    const split = part.split(/\*\*([^*]+)\*\*/g);
    return split.map((sub, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-slate-900 font-bold">{sub}</strong>;
      }
      return sub;
    });
  });

  // 3. 解析斜体 *
  parts = parts.flatMap(part => {
    if (typeof part !== 'string') return part;
    const split = part.split(/\*([^*]+)\*/g);
    return split.map((sub, i) => {
      if (i % 2 === 1) {
        return <em key={i} className="text-slate-600 italic">{sub}</em>;
      }
      return sub;
    });
  });

  // 4. 解析链接 [title](url)
  parts = parts.flatMap(part => {
    if (typeof part !== 'string') return part;
    const split = part.split(/\[([^\]]+)\]\(([^)]+)\)/g);
    const result: (string | React.ReactElement)[] = [];
    for (let i = 0; i < split.length; i++) {
      if (i % 3 === 0) {
        result.push(split[i]);
      } else if (i % 3 === 1) {
        const title = split[i];
        const url = split[i + 1] || '';
        result.push(
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
          >
            {title}
          </a>
        );
        i++; // 跳过 url 元素
      }
    }
    return result;
  });

  return <>{parts}</>;
};

// 带有一键复制功能的高级代码块组件
const CopyableCodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="my-2 border border-slate-800 rounded overflow-hidden">
      <div className="bg-slate-950/80 px-3 py-1 flex justify-between items-center text-[10px] text-slate-400 border-b border-slate-800/60 select-none">
        <span className="font-mono uppercase text-blue-400">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="hover:text-white text-slate-500 transition-colors flex items-center gap-1 active:scale-95 py-0.5 px-1.5 rounded bg-slate-800/30 hover:bg-slate-800/80"
        >
          {copied ? '已复制!' : '复制'}
        </button>
      </div>
      <pre className="bg-slate-950 p-2.5 text-emerald-400 font-mono text-[10px] overflow-auto whitespace-pre select-text leading-relaxed custom-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// 带有一键复制功能的高级数据表格组件
const CopyableTable: React.FC<{ lines: string[] }> = ({ lines }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyTable = async () => {
    try {
      const text = lines.join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy table', err);
    }
  };

  const parseTableRow = (rowStr: string) => {
    const clean = rowStr.trim().replace(/^\||\|$/g, '');
    return clean.split('|').map(cell => cell.trim());
  };

  const headers = parseTableRow(lines[0]);
  let dataRows = lines.slice(1);
  
  if (dataRows.length > 0 && /^[|:\-\s]+$/.test(dataRows[0].trim())) {
    dataRows = dataRows.slice(1);
  }

  const rows = dataRows.map(parseTableRow);

  return (
    <div className="my-2 border border-slate-200 rounded overflow-hidden relative group/table">
      <div className="bg-slate-200/80 px-2.5 py-1 flex justify-between items-center text-[9px] text-slate-500 border-b border-slate-300/40 select-none">
        <span className="font-mono text-blue-600 font-semibold">DATA TABLE</span>
        <button
          onClick={handleCopyTable}
          className="hover:text-slate-900 text-slate-500 transition-colors flex items-center gap-1 active:scale-95 py-0.5 px-1.5 rounded border border-slate-300/40 bg-white hover:bg-slate-50"
          title="复制表格数据 (Markdown 格式)"
        >
          {copied ? '已复制!' : '复制表格'}
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full text-[10px] text-slate-700 border-collapse">
          <thead className="bg-slate-200 text-slate-800 font-semibold">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-2.5 py-1.5 border-b border-slate-300 text-left font-semibold">
                  {renderInlineMarkdown(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row, ri) => (
              <tr key={ri} className="even:bg-slate-100/40 hover:bg-slate-200/30">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-2.5 py-1.5 border-r border-slate-200 last:border-r-0 text-left select-text max-w-[150px] break-words">
                    {renderInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// 完整的高性能、高容错 Markdown 解析器
const renderMarkdown = (text: string) => {
  if (!text) return null;

  const lines = text.split('\n');
  const blocks: any[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. 多行代码块
    if (trimmed.startsWith('```')) {
      const lang = trimmed.substring(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        language: lang,
        content: codeLines.join('\n')
      });
      i++; // 跳过结束的 ```
      continue;
    }

    // 2. 表格
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'table',
        lines: tableLines
      });
      continue;
    }

    // 3. 引用块
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        const content = lines[i].trim().substring(1).replace(/^\s/, '');
        quoteLines.push(content);
        i++;
      }
      blocks.push({
        type: 'quote',
        lines: quoteLines
      });
      continue;
    }

    // 4. 标题 (H1-H6)
    if (trimmed.startsWith('#')) {
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        blocks.push({
          type: 'heading',
          level: match[1].length,
          content: match[2]
        });
        i++;
        continue;
      }
    }

    // 5. 列表项 (无序/有序)
    const isUl = trimmed.startsWith('- ') || trimmed.startsWith('* ');
    const isOl = /^\d+\.\s+/.test(trimmed);
    if (isUl || isOl) {
      const listLines: { type: 'ul' | 'ol'; content: string; indent: number }[] = [];
      while (i < lines.length) {
        const curLine = lines[i];
        const curTrimmed = curLine.trim();
        const curIsUl = curTrimmed.startsWith('- ') || curTrimmed.startsWith('* ');
        const curIsOl = /^\d+\.\s+/.test(curTrimmed);

        if (!curIsUl && !curIsOl) {
          break;
        }

        const leadingSpaces = curLine.match(/^\s*/)?.[0].length || 0;
        const indent = Math.floor(leadingSpaces / 2);
        
        let content = '';
        if (curIsUl) {
          content = curTrimmed.substring(2);
        } else {
          content = curTrimmed.replace(/^\d+\.\s+/, '');
        }

        listLines.push({
          type: curIsUl ? 'ul' : 'ol',
          content,
          indent
        });
        i++;
      }
      blocks.push({
        type: 'list',
        items: listLines
      });
      continue;
    }

    // 6. 空白行
    if (trimmed === '') {
      blocks.push({
        type: 'empty'
      });
      i++;
      continue;
    }

    // 7. 普通段落
    const paraLines: string[] = [];
    while (i < lines.length) {
      const curLine = lines[i];
      const curTrimmed = curLine.trim();
      
      // 卫语句：拦截新类型的块
      if (
        curTrimmed.startsWith('```') ||
        curTrimmed.startsWith('|') ||
        curTrimmed.startsWith('>') ||
        curTrimmed.startsWith('#') ||
        curTrimmed.startsWith('- ') ||
        curTrimmed.startsWith('* ') ||
        /^\d+\.\s+/.test(curTrimmed) ||
        curTrimmed === ''
      ) {
        break;
      }
      
      paraLines.push(curLine);
      i++;
    }
    blocks.push({
      type: 'paragraph',
      content: paraLines.join('\n')
    });
  }

  // 渲染所有块
  return blocks.map((block, idx) => {
    switch (block.type) {
      case 'heading': {
        const level = block.level;
        if (level === 1) {
          return (
            <h1 key={idx} className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2 mt-3.5 select-text leading-snug">
              {renderInlineMarkdown(block.content)}
            </h1>
          );
        }
        if (level === 2) {
          return (
            <h2 key={idx} className="text-[11px] font-bold text-slate-800 mb-1.5 mt-3 select-text leading-snug">
              {renderInlineMarkdown(block.content)}
            </h2>
          );
        }
        return (
          <h3 key={idx} className="text-[10px] font-semibold text-slate-700 mb-1 mt-2.5 select-text leading-snug">
            {renderInlineMarkdown(block.content)}
          </h3>
        );
      }

      case 'code':
        return <CopyableCodeBlock key={idx} code={block.content} language={block.language} />;

      case 'table':
        return <CopyableTable key={idx} lines={block.lines} />;

      case 'quote':
        return (
          <blockquote key={idx} className="border-l-2 border-blue-500 bg-slate-200/40 px-3 py-2 my-2 rounded-r text-[10px] text-slate-600 italic leading-relaxed select-text">
            {block.lines.map((line: string, i: number) => (
              <div key={i}>{renderInlineMarkdown(line)}</div>
            ))}
          </blockquote>
        );

      case 'list':
        return (
          <div key={idx} className="my-1.5 space-y-1 select-text">
            {block.items.map((item: any, i: number) => {
              const indentStyle = item.indent > 0 ? { paddingLeft: `${item.indent * 12}px` } : undefined;
              return (
                <div key={i} style={indentStyle} className="flex items-start gap-1.5 text-slate-700 leading-relaxed text-[11px]">
                  {item.type === 'ul' ? (
                    <span className="text-blue-500 select-none mt-1 flex-shrink-0 text-[10px]">•</span>
                  ) : (
                    <span className="text-blue-500 select-none font-semibold flex-shrink-0 text-[10px]">{i + 1}.</span>
                  )}
                  <span className="flex-1">{renderInlineMarkdown(item.content)}</span>
                </div>
              );
            })}
          </div>
        );

      case 'paragraph':
        return (
          <p key={idx} className="my-1.5 leading-relaxed text-slate-700 select-text text-[11px]">
            {renderInlineMarkdown(block.content)}
          </p>
        );

      case 'empty':
        return <div key={idx} className="h-1" />;

      default:
        return null;
    }
  });
};

// 记忆化单条聊天消息组件，避免用户在输入框打字触发频繁重渲染导致 AI 正在生成的回复卡顿或闪烁
const ChatMessageItem: React.FC<{ msg: ChatMessage }> = React.memo(({ msg }) => {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message', err);
    }
  };

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* 头像 */}
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
          <Bot size={12} />
        </div>
      )}

      {/* 消息与操作组合 */}
      <div className="flex flex-col max-w-[82%] min-w-[50px]">
        {/* 消息气泡框 */}
        <div className={`p-2.5 rounded leading-relaxed break-words text-[11px] select-text relative ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-none whitespace-pre-wrap'
            : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/80'
        }`}>
          {isUser ? (
            msg.content
          ) : (
            <>
              {!msg.content && msg.streaming ? (
                <div className="flex items-center gap-1 py-1 px-0.5">
                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : (
                renderMarkdown(msg.content)
              )}
            </>
          )}
          {msg.streaming && msg.content && (
            <span className="inline-block w-1.5 h-3 bg-blue-400 ml-1 animate-pulse" />
          )}
        </div>

        {/* 底部一键复制栏 */}
        <div className={`flex items-center gap-1 mt-1.5 select-none ${isUser ? 'justify-end' : 'justify-start'}`}>
          <button
            type="button"
            onClick={handleCopyMessage}
            className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 py-0.5 px-1 rounded hover:bg-slate-100 cursor-pointer active:scale-95"
            title="复制整条消息"
          >
            {copied ? (
              <>
                <Check size={9} className="text-emerald-500" />
                <span className="text-emerald-600 font-bold">已复制</span>
              </>
            ) : (
              <>
                <Copy size={9} />
                <span>复制全文</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isUser && (
        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0 border border-slate-700">
          <User size={12} />
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // 仅在消息内容、流式状态或角色类型真正变化时才重新渲染
  return (
    prevProps.msg.content === nextProps.msg.content &&
    prevProps.msg.streaming === nextProps.msg.streaming &&
    prevProps.msg.role === nextProps.msg.role
  );
});


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
  const [panelWidth, setPanelWidth] = useState(512);
  const [isResizing, setIsResizing] = useState(false);

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
    setSelectedDatasetId,
    abortController
  } = useChatStore();

  const { assistants, endpoints } = useAIConfigStore();

  const [inputVal, setInputVal] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 拖拽宽度逻辑
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = panelWidth;

    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // 面板在右侧，向左拉 clientX 减小，deltaX 变负，面板宽度增加
      const newWidth = Math.max(320, Math.min(1200, startWidth - deltaX));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

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
      <div className="w-12 h-full bg-white flex flex-col items-center py-4 border-l border-slate-200 flex-shrink-0 transition-all select-none">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded bg-slate-100 text-slate-600 hover:text-slate-950 hover:bg-slate-200 transition-colors mb-6"
          title="展开 AI 交互面板"
        >
          <ChevronLeft size={16} />
        </button>
        
        {/* 窄边状态悬浮小标题 */}
        <div className="writing-mode-vertical text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1">
          <Cpu size={12} className="text-blue-500 animate-spin" style={{ animationDuration: '4s' }} />
          <span>AI 交互面板</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ width: `${panelWidth}px` }}
      className={`h-full bg-white border-l border-slate-200 flex flex-col flex-shrink-0 text-xs text-slate-600 select-none overflow-hidden relative ${
        isResizing ? '' : 'transition-[width] duration-200'
      }`}
    >
      {/* 左右拖拽手柄 */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/40 z-50 transition-colors"
        title="拖拽调整宽度"
      />
      {/* 头部控制栏 */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-blue-500" />
          <span className="font-bold text-slate-800">AI 智能分析助理</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClear}
            disabled={messages.length === 0}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent"
            title="清空当前对话历史"
          >
            <Trash2 size={13} />
          </button>
          
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
            title="折叠面板"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* 绑定助手与数据集设置 */}
      <div className="p-3 bg-slate-50/50 border-b border-slate-200 space-y-2.5 flex-shrink-0">
        {/* 选择 AI 助手 */}
        <div className="flex items-center gap-1.5">
          <Bot size={12} className="text-slate-500 flex-shrink-0" />
          <select
            value={selectedAssistantId || ''}
            onChange={(e) => setSelectedAssistantId(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none text-slate-800 text-[11px]"
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
          <Database size={12} className="text-slate-500 flex-shrink-0" />
          <select
            value={selectedDatasetId || ''}
            onChange={(e) => setSelectedDatasetId(e.target.value || null)}
            className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none text-slate-800 text-[11px]"
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
        <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 justify-between">
          <span className="text-[10px] text-slate-600">折叠后继续接收回复:</span>
          <input
            type="checkbox"
            checked={continueOnCollapse}
            onChange={(e) => setContinueOnCollapse(e.target.checked)}
            className="rounded bg-white border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-white h-3 w-3"
          />
        </div>
      </div>

      {/* 中部对话记录展示区 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4 min-h-0 bg-slate-50/20">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
            <MessageSquare size={32} className="text-slate-700 mb-2" />
            <span className="font-semibold block mb-0.5">开启智能数据分析</span>
            <span className="text-[10px] text-slate-600 leading-normal">
              在下方输入您的分析提问。您可以关联左侧的 Excel 数据集，AI 将会自动识别字段并为您解答。
            </span>

            {/* 常见问题一键提问卡片 */}
            <div className="mt-4 grid grid-cols-2 gap-2 w-full max-w-[280px]">
              {[
                { text: '分析数据集关键指标有哪些？', title: '指标分析', icon: <Sparkles size={10} /> },
                { text: '检测数据质量如何？有没有缺失值或异常？', title: '数据体检', icon: <Database size={10} /> },
                { text: '如何根据此数据集设计优秀的看板图表？', title: '看板规划', icon: <MessageSquare size={10} /> },
                { text: '帮我预测本数据集未来的发展趋势。', title: '趋势预测', icon: <Cpu size={10} /> }
              ].map((card, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (!selectedDatasetId && idx !== 2) {
                      setErrorMsg('此项提问建议先在上方“关联数据集”后再点击提问。');
                      return;
                    }
                    setInputVal(card.text);
                  }}
                  className="p-2 rounded bg-slate-100/60 hover:bg-slate-200/80 border border-slate-200 hover:border-slate-300 transition-all text-left flex flex-col gap-1 active:scale-95 group cursor-pointer"
                >
                  <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold group-hover:text-blue-500">
                    {card.icon}
                    <span>{card.title}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 leading-tight block group-hover:text-slate-700 truncate w-full" title={card.text}>
                    {card.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <ChatMessageItem key={msg.id || index} msg={msg} />
          ))
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


      {loading && abortController && (
        <div className="px-3 py-2 bg-slate-950/60 border-t border-slate-800/80 flex justify-center flex-shrink-0">
          <button
            type="button"
            onClick={() => abortController.abort()}
            className="bg-red-500/20 hover:bg-red-500/35 border border-red-500/60 text-red-200 hover:text-white px-4 py-1.5 rounded flex items-center gap-2 transition-colors text-[11px] font-bold shadow-sm active:scale-95 cursor-pointer"
          >
            <StopCircle size={12} className="text-red-400 animate-pulse" />
            <span>停止分析并中止接收</span>
          </button>
        </div>
      )}

      {/* 底部输入框 */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex-shrink-0 flex gap-2 items-end">
        <textarea
          rows={3}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'AI 正在分析回复...' : '输入问题，Ctrl+Enter 发送...'}
          disabled={loading}
          className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 text-[11px] placeholder-slate-400 leading-normal resize-none overflow-y-auto custom-scrollbar max-h-32"
        />
        <button
          type="submit"
          disabled={!inputVal.trim() || loading}
          className="bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
};
export default AIChatPanel;
