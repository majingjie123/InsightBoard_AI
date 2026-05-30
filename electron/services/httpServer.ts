import * as http from 'http';
import { ipcMain, BrowserWindow } from 'electron';

export class PreviewServer {
  private serverInstance: http.Server | null = null;
  private serverPort = 18080;
  private mainWindowRef: BrowserWindow | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindowRef = mainWindow;
  }

  /**
   * 启动本地 HTTP 预览服务器
   */
  start(port: number = 18080): void {
    // 卫语句：防止重复启动
    if (this.serverInstance) {
      return;
    }

    const requestListener: http.RequestListener = (req, res) => {
      // 允许跨域请求
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // 卫语句：拦截 OPTIONS 请求
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = req.url || '';

      // API: 获取快照
      if (url.startsWith('/api/preview/')) {
        const spaceId = url.split('/').pop() || '';
        if (this.mainWindowRef) {
          this.mainWindowRef.webContents.send('request-snapshot-data', spaceId);
          ipcMain.once(`response-snapshot-data-${spaceId}`, (_, snapshot) => {
            if (!snapshot) {
              res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
              res.end(JSON.stringify({ error: '看板不存在或已被删除' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(snapshot));
          });
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: '主窗口未实例化' }));
        }
        return;
      }

      // 预览路由
      if (url.startsWith('/preview/')) {
        const spaceId = url.split('/').pop() || '';
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        
        const html = this.getHtmlTemplate(spaceId);
        res.end(html);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    };

    const tryStart = (p: number) => {
      this.serverInstance = http.createServer(requestListener);
      this.serverInstance.listen(p, '127.0.0.1', () => {
        this.serverPort = p;
        console.log(`内置 HTTP 服务启动成功: http://127.0.0.1:${p}`);
      });

      this.serverInstance.on('error', (err: any) => {
        // 卫语句：拦截端口冲突，自增重试
        if (err.code === 'EADDRINUSE') {
          console.warn(`端口 ${p} 被占用，自增重试...`);
          tryStart(p + 1);
        } else {
          console.error('内置 HTTP 服务启动发生未知错误', err);
        }
      });
    };

    tryStart(port);
  }

  /**
   * 停止服务器
   */
  stop(): void {
    // 卫语句：若未启动则直接返回
    if (!this.serverInstance) {
      return;
    }
    this.serverInstance.close(() => {
      console.log('内置 HTTP 预览服务已停止。');
    });
    this.serverInstance = null;
  }

  /**
   * 获取实际运行端口
   */
  getPort(): number {
    return this.serverPort;
  }

  private getHtmlTemplate(spaceId: string): string {
    const isDev = process.env.NODE_ENV === 'development';
    const host = isDev ? 'http://localhost:5173' : `http://127.0.0.1:${this.serverPort}`;
    return `
      <!DOCTYPE html>
      <html lang="zh">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>本地AI看板 - 预览</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          
          * {
            box-sizing: border-box;
          }
          
          body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f1f5f9;
            color: #1e293b;
            height: 100vh;
            overflow: hidden;
          }
          
          .layout-container {
            display: flex;
            width: 100%;
            height: 100vh;
          }
          
          .board-area {
            flex: 1;
            height: 100%;
            overflow: auto; /* 支持水平与垂直滑动 */
            padding: 24px;
            display: flex;
            flex-direction: column;
          }
          
          .header-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            padding: 0 8px 16px 8px;
            border-bottom: 1px solid #e2e8f0;
            flex-shrink: 0;
            min-width: 1200px;
          }
          
          .header-bar h1 {
            font-size: 20px;
            font-weight: 700;
            margin: 0;
            color: #0f172a;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .header-bar .badge {
            background: #eff6ff;
            color: #2563eb;
            border: 1px solid #bfdbfe;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
          }
          
          .board-canvas {
            position: relative;
            width: 100%;
            min-width: 1200px;
            background-size: 20px 20px;
            background-image: radial-gradient(#e2e8f0 1.2px, transparent 1.2px);
          }
          
          .widget {
            position: absolute; /* 切换为绝对定位以实现像素级比例对齐 */
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            overflow: hidden;
            transition: box-shadow 0.2s;
          }
          
          .widget:hover {
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 50;
          }

          .widget-header {
            height: 32px;
            border-bottom: 1px solid #f1f5f9;
            background: #f8fafc;
            display: flex;
            align-items: center;
            padding: 0 12px;
            flex-shrink: 0;
          }

          .widget-header span {
            font-size: 10px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          
          .widget-body {
            flex: 1;
            min-height: 0;
            position: relative;
            padding: 16px;
          }
          
          .ai-chat-area {
            width: 360px;
            border-left: 1px solid #e2e8f0;
            background: white;
            display: none;
            flex-direction: column;
            height: 100%;
            flex-shrink: 0;
            box-shadow: -4px 0 12px rgba(0,0,0,0.02);
          }
          
          .ai-chat-header {
            padding: 20px;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
            flex-shrink: 0;
          }
          
          .ai-chat-header h3 {
            margin: 0;
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .ai-chat-header p {
            margin: 6px 0 0 0;
            font-size: 11px;
            color: #64748b;
          }
          
          .ai-messages-list {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            background: #f8fafc;
          }
          
          .message-item {
            display: flex;
            flex-direction: column;
            max-width: 88%;
          }
          
          .message-item.user {
            align-self: flex-end;
            align-items: flex-end;
          }
          
          .message-item.assistant {
            align-self: flex-start;
            align-items: flex-start;
          }
          
          .message-bubble {
            padding: 12px 16px;
            border-radius: 12px;
            font-size: 13px;
            line-height: 1.6;
            word-break: break-word;
          }
          
          .message-item.user .message-bubble {
            background: #2563eb;
            color: white;
            border-bottom-right-radius: 2px;
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
          }
          
          .message-item.assistant .message-bubble {
            background: white;
            color: #1e293b;
            border-bottom-left-radius: 2px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.02);
          }
          
          .message-time {
            font-size: 10px;
            color: #94a3b8;
            margin-top: 6px;
          }
          
          .chat-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #cbd5e1;
            font-size: 12px;
            gap: 10px;
          }
          
          .error-box {
            text-align: center;
            margin: 120px auto;
            max-width: 440px;
            padding: 40px;
            background: white;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
          }
          
          .error-box h2 {
            margin-top: 0;
            font-size: 20px;
            color: #be123c;
          }
          
          .error-box p {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 24px;
          }
          
          .error-box button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 6px;
            font-size: 13px;
            cursor: pointer;
            font-weight: 600;
          }
          
          /* 表格定制 */
          .table-container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: white;
          }
          
          .table-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f1f5f9;
            gap: 8px;
            width: 100%;
            flex-shrink: 0;
            z-index: 5;
            min-height: 40px;
          }

          .table-title {
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
            margin: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
            min-width: 80px;
          }
          
          .table-search-container {
            position: relative;
            width: 180px;
            max-width: 100%;
            flex-shrink: 1;
            display: flex;
            align-items: center;
          }

          .table-search-container svg {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            color: #94a3b8;
            pointer-events: none;
            z-index: 2;
          }

          .table-search {
            width: 100%;
            height: 32px;
            padding: 0 12px 0 32px;
            font-size: 12px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            outline: none;
            transition: all 0.2s;
            color: #1e293b;
          }

          .table-search:focus {
            background-color: white;
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
          }
          
          .table-scroll {
            flex: 1;
            overflow: auto;
            border: 1px solid #f1f5f9;
            border-radius: 6px;
          }
          
          .preview-table {
            width: max-content;
            min-width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          
          .preview-table th {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
            font-size: 12px;
            color: #64748b;
            font-weight: 600;
            background: #f8fafc;
            position: sticky;
            top: 0;
            z-index: 10;
            cursor: pointer;
            transition: background-color 0.2s;
          }

          .preview-table th:hover {
            background-color: #f1f5f9;
          }

          .th-content {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          
          .preview-table td {
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .preview-table tr.stripe {
            background-color: #f8fafc;
          }
          
          .preview-table tr:hover td {
            background-color: #f1f5f9;
          }
          
          .table-footer {
            font-size: 12px;
            color: #64748b;
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid #f1f5f9;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .footer-left {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .table-pagination {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .pagination-controls {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .pagination-controls button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border: 1px solid #e2e8f0;
            background: white;
            color: #64748b;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
          }

          .pagination-controls button:hover:not(:disabled) {
            background: #f8fafc;
            border-color: #cbd5e1;
            color: #2563eb;
          }

          .pagination-controls button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .page-input-container {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #94a3b8;
          }

          .table-pagination input {
            width: 36px;
            height: 24px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            font-size: 12px;
            text-align: center;
            outline: none;
            font-weight: 600;
            color: #1e293b;
          }

          .table-pagination input:focus {
            border-color: #2563eb;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
          }

          .page-size-selector {
            display: flex;
            align-items: center;
            gap: 4px;
          }

          .page-size-selector select {
            padding: 2px 4px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            font-size: 11px;
            color: #64748b;
            outline: none;
            background: transparent;
          }

          @media (max-width: 900px) {
            .layout-container {
              flex-direction: column;
            }
            .ai-chat-area {
              width: 100%;
              height: 40vh;
              border-left: 0;
              border-top: 1px solid #e2e8f0;
            }
          }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
      </head>
      <body>
        <div class="layout-container">
          <div class="board-area">
            <div class="header-bar">
              <h1 id="title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: #2563eb;">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 17V9" />
                  <path d="M15 17V13" />
                </svg>
                <span id="board-name">加载中...</span>
              </h1>
              <span class="badge">已发布版本</span>
            </div>
            <div id="board-canvas" class="board-canvas"></div>
          </div>
          
          <div id="ai-chat" class="ai-chat-area">
            <div class="ai-chat-header">
              <h3>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: #2563eb;">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4" />
                  <path d="M8 12h8" />
                </svg>
                AI 历史记录
              </h3>
              <p>本次发布时的上下文对话快照</p>
            </div>
            <div id="messages-list" class="ai-messages-list">
              <div class="chat-empty">暂无数据内容</div>
            </div>
          </div>
        </div>

        <script>
          const spaceId = "${spaceId}";
          const host = "${host}";
          let globalSnapshot = null;
          
          async function init() {
            try {
              const res = await fetch(host + '/api/preview/' + spaceId);
              if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || '无法获取看板快照数据');
              }
              const snapshot = await res.json();
              globalSnapshot = snapshot;
              
              document.getElementById('board-name').innerText = snapshot.spaceName || "已发布看板";
              
              const aiChat = document.getElementById('ai-chat');
              if (snapshot.aiPanelCollapsed === false) {
                aiChat.style.display = 'flex';
                renderChatHistory(snapshot.chatHistory || []);
              } else {
                aiChat.style.display = 'none';
              }
              
              renderBoard(snapshot);
              
              // 启动比例监控
              const observer = new ResizeObserver(entries => {
                for (let entry of entries) {
                  updateLayout(entry.contentRect.width);
                }
              });
              observer.observe(document.querySelector('.board-area'));
            } catch (e) {
              document.body.innerHTML =
                '<div class="error-box">' +
                  '<h2>看板数据加载失败</h2>' +
                  '<p>' + e.message + '</p>' +
                  '<button onclick="window.location.reload()">重试加载</button>' +
                '</div>';
            }
          }

          function renderChatHistory(history) {
            const list = document.getElementById('messages-list');
            if (!history || history.length === 0) {
              list.innerHTML = '<div class="chat-empty">暂无对话记录</div>';
              return;
            }
            list.innerHTML = '';
            history.forEach(item => {
              const itemEl = document.createElement('div');
              itemEl.className = 'message-item ' + item.role;
              
              const bubble = document.createElement('div');
              bubble.className = 'message-bubble';
              bubble.innerText = item.content;
              
              const timeEl = document.createElement('div');
              timeEl.className = 'message-time';
              timeEl.innerText = new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
              
              itemEl.appendChild(bubble);
              itemEl.appendChild(timeEl);
              list.appendChild(itemEl);
            });
            list.scrollTop = list.scrollHeight;
          }

          function renderBoard(snapshot) {
            const canvas = document.getElementById('board-canvas');
            const comps = snapshot.components || [];
            
            comps.forEach((comp) => {
              const widget = document.createElement('div');
              widget.className = 'widget';
              widget.id = 'widget-' + comp.id;
              
              const header = document.createElement('div');
              header.className = 'widget-header';
              header.innerHTML = '<span>' + (comp.type === 'table' ? 'DATA TABLE' : 'VISUALIZATION') + '</span>';
              
              const body = document.createElement('div');
              body.className = 'widget-body';
              
              widget.appendChild(header);
              widget.appendChild(body);
              canvas.appendChild(widget);

              const dataset = (snapshot.datasets || []).find(d => d.id === comp.config.dataSourceId) || null;
              if (comp.type === 'table') {
                renderTable(body, comp, dataset);
              } else {
                renderChart(body, comp, dataset);
              }
            });
            
            const area = document.querySelector('.board-area');
            updateLayout(area.clientWidth - 48);
          }

          function updateLayout(containerWidth) {
            if (!globalSnapshot) return;
            
            // 设置 1200px 为最小缩放基准，防止窄屏下内容过小
            const availableWidth = Math.max(1200, containerWidth);
            const ratio = availableWidth / 1200; 
            
            const canvas = document.getElementById('board-canvas');
            let maxBottom = 0;

            globalSnapshot.components.forEach(comp => {
              const el = document.getElementById('widget-' + comp.id);
              if (!el) return;

              const x = comp.position.x * ratio;
              const y = comp.position.y * ratio;
              const w = comp.size.width * ratio;
              const h = comp.size.height * ratio;

              el.style.left = x + 'px';
              el.style.top = y + 'px';
              el.style.width = w + 'px';
              el.style.height = h + 'px';
              
              const baseFontSize = comp.config.style?.fontSize || 14;
              el.style.fontSize = Math.max(8, baseFontSize * ratio) + 'px';
              
              const tableTitle = el.querySelector('.table-title');
              if (tableTitle) tableTitle.style.fontSize = Math.max(10, 14 * ratio) + 'px';

              const chartTitle = el.querySelector('.chart-title');
              if (chartTitle) chartTitle.style.fontSize = Math.max(10, 15 * ratio) + 'px';
              
              maxBottom = Math.max(maxBottom, y + h);

              const chartDom = el.querySelector('.widget-body div:last-child');
              if (chartDom) {
                const chart = echarts.getInstanceByDom(chartDom);
                if (chart) chart.resize();
              }
            });

            canvas.style.height = (maxBottom + 100) + 'px';
            canvas.style.width = '100%';
          }

          function formatCell(val, colName, formatterConfig) {
            if (val === null || val === undefined || val === '') return '-';
            const config = formatterConfig?.[colName];
            if (!config) return val;
            
            if (typeof val === 'number' || !isNaN(Number(val))) {
              const num = Number(val);
              if (config.precision !== undefined || config.useGrouping !== false) {
                try {
                  return new Intl.NumberFormat('zh-CN', {
                    minimumFractionDigits: config.precision ?? 2,
                    maximumFractionDigits: config.precision ?? 2,
                    useGrouping: config.useGrouping ?? true
                  }).format(num);
                } catch(e) {}
              }
            }
            
            if (config.dateFormat) {
              try {
                const date = new Date(val);
                if (!isNaN(date.getTime())) {
                  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
                  return config.dateFormat === 'YYYYMMDD' ? y + m + d : y + '-' + m + '-' + d;
                }
              } catch(e) {}
            }
            return val;
          }

          function renderTable(container, comp, dataset) {
            if (!dataset) {
              container.innerHTML = '<div style="color:#ef4444; font-size:12px; padding:20px; text-align:center;">关联数据源已失效</div>';
              return;
            }
            
            const config = comp.config;
            const tableStyle = config.style || {};
            const cols = dataset.columns.filter(c => !(config.hiddenColumns || []).includes(c.name));
            const formatters = config.columnFormatters || {};
            const columnWidths = config.columnWidths || {};
            
            let pageSize = Number(config.pageSize || 20);
            let currentPage = 1;
            let searchText = '';
            let sortField = null;
            let sortOrder = null; // 'asc' | 'desc'

            const tableWrap = document.createElement('div');
            tableWrap.className = 'table-container';
            container.appendChild(tableWrap);

            const icons = {
              search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
              chevronLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
              chevronRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
              chevronUp: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
              chevronDown: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
            };

            // 预先创建三个主要区域，避免全量 innerHTML 导致焦点丢失
            const headerArea = document.createElement('div');
            headerArea.className = 'table-header';
            
            const scrollArea = document.createElement('div');
            scrollArea.className = 'table-scroll';
            
            const footerArea = document.createElement('div');
            footerArea.className = 'table-footer';
            
            tableWrap.appendChild(headerArea);
            tableWrap.appendChild(scrollArea);
            tableWrap.appendChild(footerArea);

            // 初始化头部内容
            const safeTitle = (config.title || comp.name || '数据表格').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            headerArea.innerHTML = 
              '<h3 class="table-title">' + safeTitle + '</h3>' +
              '<div class="table-search-container">' +
                icons.search +
                '<input type="text" class="table-search" placeholder="搜索表格数据..." />' +
              '</div>';

            const searchInput = headerArea.querySelector('.table-search');
            searchInput.addEventListener('input', (e) => {
              searchText = e.target.value;
              currentPage = 1;
              renderData();
            });

            const renderData = () => {
              // 1. 过滤
              let data = dataset.data;
              if (searchText) {
                const q = searchText.toLowerCase();
                data = data.filter(r => cols.some(c => String(r[c.name] ?? '').toLowerCase().includes(q)));
              }

              // 2. 排序
              if (sortField && sortOrder) {
                const col = cols.find(c => c.name === sortField);
                const type = col?.type || 'string';
                data = [...data].sort((a, b) => {
                  let vA = a[sortField], vB = b[sortField];
                  if (vA === null || vA === undefined || vA === '') return 1;
                  if (vB === null || vB === undefined || vB === '') return -1;
                  
                  if (type === 'number') {
                    return sortOrder === 'asc' ? Number(vA) - Number(vB) : Number(vB) - Number(vA);
                  }
                  if (type === 'date') {
                    const dA = new Date(vA).getTime(), dB = new Date(vB).getTime();
                    return sortOrder === 'asc' ? dA - dB : dB - dA;
                  }
                  return sortOrder === 'asc' ? String(vA).localeCompare(String(vB), 'zh') : String(vB).localeCompare(String(vA), 'zh');
                });
              }

              const totalItems = data.length;
              const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
              currentPage = Math.max(1, Math.min(currentPage, totalPages));

              const start = (currentPage - 1) * pageSize;
              const rowsData = data.slice(start, start + pageSize);
              
              const baseFontSize = tableStyle.fontSize || 14;
              const rowHeight = tableStyle.rowHeight || 'standard';
              const padding = rowHeight === 'compact' ? '6px 8px' : (rowHeight === 'loose' ? '14px 16px' : '10px 12px');

              // 渲染表格主体
              const ths = cols.map(c => {
                const w = columnWidths[c.name] ? columnWidths[c.name] + 'px' : '150px';
                const sortIcon = sortField === c.name ? (sortOrder === 'asc' ? icons.chevronUp : icons.chevronDown) : '';
                return '<th style="width:' + w + '; min-width:' + w + '; font-size:' + baseFontSize + 'px; background-color:' + (tableStyle.headerBg || '#f8fafc') + ';" data-col="' + c.name + '">' +
                       '<div class="th-content"><span>' + c.name + '</span>' + sortIcon + '</div></th>';
              }).join('');

              const trs = rowsData.length > 0
                ? rowsData.map((r, idx) => {
                    const isStripe = tableStyle.stripe && idx % 2 === 1;
                    const tds = cols.map(c => {
                      const v = formatCell(r[c.name], c.name, formatters);
                      const w = columnWidths[c.name] ? columnWidths[c.name] + 'px' : '150px';
                      return '<td style="width:' + w + '; min-width:' + w + '; padding:' + padding + '; font-size:' + baseFontSize + 'px;" title="' + String(r[c.name] ?? '') + '">' + v + '</td>';
                    }).join('');
                    return '<tr class="' + (isStripe ? 'stripe' : '') + '">' + tds + '</tr>';
                  }).join('')
                : '<tr><td colspan="' + cols.length + '" style="text-align:center;color:#94a3b8;padding:32px; font-size:' + baseFontSize + 'px;">暂无匹配数据</td></tr>';

              scrollArea.innerHTML = 
                '<table class="preview-table">' +
                  '<thead><tr>' + ths + '</tr></thead>' +
                  '<tbody>' + trs + '</tbody>' +
                '</table>';

              // 渲染底部
              footerArea.innerHTML = 
                '<div class="footer-left">' +
                  '共计 <span style="font-weight:600; color:#1e293b;">' + totalItems + '</span> 条记录' +
                  (searchText ? ' (已从 ' + dataset.data.length + ' 条中筛选)' : '') +
                '</div>' +
                '<div class="table-pagination">' +
                  '<div class="pagination-controls">' +
                    '<button type="button" data-action="prev" ' + (currentPage <= 1 ? 'disabled' : '') + '>' + icons.chevronLeft + '</button>' +
                    '<div class="page-input-container">' +
                      '第 <input type="text" value="' + currentPage + '" data-role="page-input" /> 页 / 共 ' + totalPages + ' 页' +
                    '</div>' +
                    '<button type="button" data-action="next" ' + (currentPage >= totalPages ? 'disabled' : '') + '>' + icons.chevronRight + '</button>' +
                  '</div>' +
                  '<div class="page-size-selector">' +
                    '<span>每页</span>' +
                    '<select data-role="size-select">' +
                      [10, 20, 50, 100].map(s => '<option value="' + s + '" ' + (pageSize === s ? 'selected' : '') + '>' + s + '</option>').join('') +
                    '</select>' +
                    '<span>条</span>' +
                  '</div>' +
                '</div>';

              // 重新绑定事件
              scrollArea.querySelectorAll('th[data-col]').forEach(th => {
                th.addEventListener('click', () => {
                  const col = th.getAttribute('data-col');
                  if (sortField === col) {
                    sortOrder = sortOrder === 'asc' ? 'desc' : (sortOrder === 'desc' ? null : 'asc');
                    if (!sortOrder) sortField = null;
                  } else {
                    sortField = col;
                    sortOrder = 'asc';
                  }
                  renderData();
                });
              });

              footerArea.querySelector('[data-action="prev"]')?.addEventListener('click', () => { currentPage -= 1; renderData(); });
              footerArea.querySelector('[data-action="next"]')?.addEventListener('click', () => { currentPage += 1; renderData(); });
              
              const pageInput = footerArea.querySelector('[data-role="page-input"]');
              pageInput?.addEventListener('change', (e) => {
                const target = parseInt(e.target.value, 10);
                if (!isNaN(target)) {
                  currentPage = Math.max(1, Math.min(target, totalPages));
                }
                renderData();
              });

              const sizeSelect = footerArea.querySelector('[data-role="size-select"]');
              sizeSelect?.addEventListener('change', (e) => {
                pageSize = parseInt(e.target.value, 10);
                currentPage = 1;
                renderData();
              });
            };

            renderData();
          }

          function renderChart(container, comp, dataset) {
            if (!dataset) {
              container.innerHTML = '<div style="color:#ef4444; font-size:12px; padding:20px; text-align:center;">图表数据源不可用</div>';
              return;
            }

            const config = comp.config;
            const chartDiv = document.createElement('div');
            chartDiv.style.width = '100%';
            chartDiv.style.height = 'calc(100% - 32px)';
            
            const titleEl = document.createElement('h3');
            titleEl.className = 'chart-title';
            titleEl.style.margin = '0 0 12px 0';
            titleEl.style.fontSize = '15px';
            titleEl.style.fontWeight = '700';
            titleEl.style.color = '#0f172a';
            titleEl.innerText = config.title || comp.name;
            
            container.appendChild(titleEl);
            container.appendChild(chartDiv);

            const myChart = echarts.init(chartDiv);
            const xField = config.xField, yField = config.yField;
            const aggMethod = config.aggregation || 'sum';
            const precision = config.precision ?? 2;
            
            const getFinalValue = (stats) => {
              if (!stats) return 0;
              if (aggMethod === 'sum') return stats.sum;
              if (aggMethod === 'avg') return stats.count > 0 ? stats.sum / stats.count : 0;
              if (aggMethod === 'count') return stats.count;
              if (aggMethod === 'max') return stats.max === -Infinity ? 0 : stats.max;
              if (aggMethod === 'min') return stats.min === Infinity ? 0 : stats.min;
              return stats.sum;
            };

            // 1. 基础聚合 (流式统计)
            const statsMap = new Map();
            dataset.data.forEach(r => {
              const xVal = String(r[xField] ?? ''), yVal = Number(r[yField]);
              if(xVal !== '') {
                const stats = statsMap.get(xVal) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
                const val = isNaN(yVal) ? 0 : yVal;
                stats.sum += val;
                stats.count += 1;
                stats.max = Math.max(stats.max, val);
                stats.min = Math.min(stats.min, val);
                statsMap.set(xVal, stats);
              }
            });
            
            let xAxisData = Array.from(statsMap.keys());
            let yAxisData = xAxisData.map(x => getFinalValue(statsMap.get(x)));

            // 2. 采样
            const originalLength = xAxisData.length;
            if (config.enableDownSampling !== false && originalLength > 5000) {
              const step = Math.floor(originalLength / 1000);
              const sX = [], sY = [];
              for (let i = 0; i < originalLength; i += step) {
                sX.push(xAxisData[i]); sY.push(yAxisData[i]);
              }
              xAxisData = sX; yAxisData = sY;
            }

            let option = {};
            const colors = config.colors && config.colors.length > 0 ? config.colors : ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#64748b'];

            if (comp.type === 'pie') {
              const isRing = config.chartType === 'ring', isRose = config.chartType === 'rose';
              const lp = config.legendPosition || 'bottom';
              const lo = lp === 'center' ? { orient:'horizontal', left:'center', top:'middle', type:'scroll' }
                         : (lp === 'left' || lp === 'right') ? { orient:'vertical', [lp]:0, top:'middle', type:'scroll' }
                         : { orient:'horizontal', left:'center', [lp]:0, type:'scroll' };

              option = {
                color: colors,
                tooltip: { 
                  trigger: 'item', 
                  formatter: (params) => {
                    return params.seriesName + '<br/>' + params.name + ' : ' + params.value.toFixed(precision) + ' (' + params.percent + '%)';
                  }
                },
                legend: config.showLegend !== false ? { ...lo, icon: 'circle', textStyle: { fontSize: 11 } } : { show: false },
                series: [{
                  name: yField, type: 'pie',
                  radius: isRing ? ['40%', '70%'] : '70%',
                  roseType: isRose ? 'radius' : false,
                  center: ['50%', '45%'],
                  data: xAxisData.map((x, i) => ({ name: x, value: yAxisData[i] })),
                  label: { 
                    show: config.showDataLabel !== false, 
                    fontSize: 11, 
                    formatter: '{b}: {d}%' 
                  },
                  labelLine: { show: config.showPieLabelLine !== false }
                }]
              };
            } else {
              const isLine = comp.type === 'line';
              let series = [];

              if (config.seriesField && (config.chartType === 'group' || config.chartType === 'stack')) {
                const sSet = new Set(), sMap = new Map();
                dataset.data.forEach(row => {
                  const x = String(row[xField] ?? ''), s = String(row[config.seriesField] ?? ''), y = Number(row[yField]);
                  if (!x || !s) return;
                  sSet.add(s);
                  if (!sMap.has(x)) sMap.set(x, new Map());
                  const xm = sMap.get(x);
                  const stats = xm.get(s) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
                  const val = isNaN(y) ? 0 : y;
                  stats.sum += val;
                  stats.count += 1;
                  stats.max = Math.max(stats.max, val);
                  stats.min = Math.min(stats.min, val);
                  xm.set(s, stats);
                });

                const sNames = Array.from(sSet);
                xAxisData = Array.from(sMap.keys());
                series = sNames.map((sn, idx) => ({
                  name: sn, type: isLine ? 'line' : 'bar',
                  stack: config.chartType === 'stack' ? 'total' : undefined,
                  data: xAxisData.map(x => getFinalValue(sMap.get(x)?.get(sn))),
                  smooth: config.smoothLine === true,
                  areaStyle: (isLine && config.areaFill) ? { opacity: 0.25 } : undefined,
                  label: config.showDataLabel ? { 
                    show: true, 
                    position: 'top', 
                    fontSize: 10,
                    formatter: (params) => params.value.toFixed(precision)
                  } : undefined
                }));
              } else {
                series.push({
                  name: yField, type: isLine ? 'line' : 'bar', data: yAxisData,
                  smooth: config.smoothLine === true,
                  areaStyle: (isLine && config.areaFill) ? { opacity: 0.25 } : undefined,
                  label: config.showDataLabel ? { 
                    show: true, 
                    position: 'top', 
                    fontSize: 10,
                    formatter: (params) => params.value.toFixed(precision)
                  } : undefined
                });

                if (isLine && config.dualYAxis && config.secondaryYField) {
                  const s2Map = new Map();
                  dataset.data.forEach(r => {
                    const x = String(r[xField] ?? ''), y2 = Number(r[config.secondaryYField]);
                    if (!x) return;
                    const stats = s2Map.get(x) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
                    const val = isNaN(y2) ? 0 : y2;
                    stats.sum += val;
                    stats.count += 1;
                    stats.max = Math.max(stats.max, val);
                    stats.min = Math.min(stats.min, val);
                    s2Map.set(x, stats);
                  });
                  series[0].yAxisIndex = 0;
                  series.push({
                    name: config.secondaryYField, type: 'line', yAxisIndex: 1,
                    data: xAxisData.map(x => getFinalValue(s2Map.get(x))),
                    smooth: config.smoothLine === true,
                    label: config.showDataLabel ? { 
                      show: true, 
                      position: 'top', 
                      fontSize: 10,
                      formatter: (params) => params.value.toFixed(precision)
                    } : undefined
                  });
                }
              }

              option = {
                color: colors,
                tooltip: { 
                  trigger: 'axis', 
                  axisPointer: { type: isLine ? 'line' : 'shadow' },
                  formatter: (params) => {
                    let res = params[0].name;
                    params.forEach(item => {
                      res += '<br/>' + item.marker + ' ' + item.seriesName + ': ' + item.value.toFixed(precision);
                    });
                    return res;
                  }
                },
                legend: config.showLegend ? { top: 0, icon: 'roundRect', textStyle: { fontSize: 11 } } : { show: false },
                grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
                xAxis: {
                  type: 'category', data: xAxisData,
                  axisLabel: { rotate: xAxisData.length > 20 ? 45 : 0, interval: xAxisData.length > 50 ? 'auto' : 0, fontSize: 10 }
                },
                yAxis: (isLine && config.dualYAxis && config.secondaryYField) 
                  ? [{ type: 'value', name: yField }, { type: 'value', name: config.secondaryYField }]
                  : { type: 'value' },
                series: series
              };
            }

            myChart.setOption(option);
          }

          init();
        </script>
      </body>
      </html>
    `;
  }
}
