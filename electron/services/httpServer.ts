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
    if (this.serverInstance) return;

    const requestListener: http.RequestListener = (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = req.url || '';

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

      if (url.startsWith('/preview/')) {
        const spaceId = url.split('/').pop() || '';
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(this.getHtmlTemplate(spaceId));
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
        if (err.code === 'EADDRINUSE') {
          tryStart(p + 1);
        } else {
          console.error('内置 HTTP 服务启动发生未知错误', err);
        }
      });
    };

    tryStart(port);
  }

  stop(): void {
    if (!this.serverInstance) return;
    this.serverInstance.close();
    this.serverInstance = null;
  }

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
          * { box-sizing: border-box; }
          body {
            margin: 0; padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #f1f5f9; color: #1e293b;
            height: 100vh; overflow: hidden;
          }
          .layout-container { display: flex; width: 100%; height: 100vh; }
          .board-area { flex: 1; height: 100%; overflow: auto; padding: 24px; display: flex; flex-direction: column; }
          .header-bar {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: 24px; padding: 0 8px 16px 8px; border-bottom: 1px solid #e2e8f0;
            flex-shrink: 0; min-width: 1200px;
          }
          .header-bar h1 { font-size: 20px; font-weight: 700; margin: 0; color: #0f172a; display: flex; align-items: center; gap: 10px; }
          .board-canvas { position: relative; width: 100%; min-width: 1200px; }
          .widget {
            position: absolute; background: white; border: 1px solid #e2e8f0; border-radius: 8px;
            display: flex; flex-direction: column; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            overflow: hidden;
          }
          .widget-header {
            height: 32px; border-bottom: 1px solid #f1f5f9; background: #f8fafc;
            display: flex; align-items: center; padding: 0 12px; flex-shrink: 0;
          }
          .widget-header span { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
          .widget-body { flex: 1; min-height: 0; position: relative; }
          .ai-chat-area { width: 360px; border-left: 1px solid #e2e8f0; background: white; display: none; flex-direction: column; height: 100%; flex-shrink: 0; }
          .error-box { text-align: center; margin: 120px auto; max-width: 440px; padding: 40px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; }
          
          /* 表格通用样式 */
          .preview-table { width: max-content; min-width: 100%; border-collapse: collapse; table-layout: fixed; }
          .preview-table th {
            padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left;
            font-size: 12px; color: #64748b; font-weight: 600; background: #f8fafc;
            position: sticky; top: 0; z-index: 5;
          }
          .preview-table td { border-bottom: 1px solid #f1f5f9; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .preview-table tr.stripe { background-color: #f8fafc; }
          .th-content { display: flex; align-items: center; gap: 4px; }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
      </head>
      <body>
        <div class="layout-container">
          <div class="board-area">
            <div class="header-bar">
              <h1><span id="board-name">加载中...</span></h1>
              <span style="background:#eff6ff; color:#2563eb; padding:4px 12px; border-radius:6px; font-size:11px; font-weight:600;">已发布版本</span>
            </div>
            <div id="board-canvas" class="board-canvas"></div>
          </div>
          <div id="ai-chat" class="ai-chat-area"></div>
        </div>

        <script>
          const spaceId = "${spaceId}";
          const host = "${host}";
          let globalSnapshot = null;

          async function init() {
            try {
              const res = await fetch(host + '/api/preview/' + spaceId);
              const snapshot = await res.json();
              globalSnapshot = snapshot;
              document.getElementById('board-name').innerText = snapshot.spaceName || "已发布看板";
              renderBoard(snapshot);
              const observer = new ResizeObserver(entries => {
                for (let entry of entries) updateLayout(entry.contentRect.width);
              });
              observer.observe(document.querySelector('.board-area'));
            } catch (e) {
              document.body.innerHTML = '<div class="error-box"><h2>数据加载失败</h2><p>' + e.message + '</p></div>';
            }
          }

          function renderBoard(snapshot) {
            const canvas = document.getElementById('board-canvas');
            snapshot.components.forEach(comp => {
              const widget = document.createElement('div');
              widget.className = 'widget';
              widget.id = 'widget-' + comp.id;
              
              if (comp.type !== 'table') {
                const header = document.createElement('div');
                header.className = 'widget-header';
                header.innerHTML = '<span>VISUALIZATION</span>';
                widget.appendChild(header);
              }
              
              const body = document.createElement('div');
              body.className = 'widget-body';
              widget.appendChild(body);
              canvas.appendChild(widget);

              const dataset = (snapshot.datasets || []).find(d => d.id === comp.config.dataSourceId);
              if (comp.type === 'table') {
                renderTable(body, comp, dataset);
              } else {
                renderChart(body, comp, dataset);
              }
            });
            updateLayout(document.querySelector('.board-area').clientWidth - 48);
          }

          function renderTable(container, comp, dataset) {
            if (!dataset) {
              container.innerHTML = '<div style="padding:20px; color:red;">数据源缺失</div>';
              return;
            }

            const config = comp.config || {};
            const tableStyle = config.style || {};
            const cols = (dataset.columns || []).filter(c => !(config.hiddenColumns || []).includes(c.name));
            
            let searchText = '', currentPage = 1, pageSize = Number(config.pageSize || 20), sortField = null, sortOrder = null;

            const icons = {
              search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
              chevronLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
              chevronRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>'
            };

            const tableWrap = document.createElement('div');
            tableWrap.style.cssText = 'display:flex; flex-direction:column; width:100%; height:100%; background:white;';

            // 头部：标题与搜索框 (采用原子构建确保 100% 可见)
            const header = document.createElement('div');
            header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-bottom:1px solid #f1f5f9; flex-shrink:0; background:white; z-index:10; min-height:48px;';
            
            const title = document.createElement('h3');
            title.innerText = config.title || comp.name || '表格';
            title.style.cssText = 'font-size:14px; font-weight:700; margin:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
            
            const searchBox = document.createElement('div');
            searchBox.style.cssText = 'position:relative; width:220px; flex-shrink:0;';
            searchBox.innerHTML = '<span style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#94a3b8; pointer-events:none; display:flex;">' + icons.search + '</span>';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '搜索数据...';
            input.style.cssText = 'width:100%; height:32px; padding:0 10px 0 32px; font-size:12px; border:1px solid #e2e8f0; border-radius:6px; outline:none; background:#f8fafc;';
            input.addEventListener('input', (e) => { searchText = e.target.value; currentPage = 1; draw(); });
            
            searchBox.appendChild(input);
            header.appendChild(title);
            header.appendChild(searchBox);
            tableWrap.appendChild(header);

            const scrollArea = document.createElement('div');
            scrollArea.style.cssText = 'flex:1; overflow:auto;';
            tableWrap.appendChild(scrollArea);

            const footer = document.createElement('div');
            footer.style.cssText = 'padding:10px 14px; border-top:1px solid #f1f5f9; font-size:12px; color:#64748b; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;';
            tableWrap.appendChild(footer);

            container.appendChild(tableWrap);

            const draw = () => {
              let data = dataset.data || [];
              if (searchText) {
                const q = searchText.toLowerCase();
                data = data.filter(r => cols.some(c => String(r[c.name] || '').toLowerCase().includes(q)));
              }
              const total = data.length;
              const pages = Math.ceil(total / pageSize) || 1;
              currentPage = Math.max(1, Math.min(currentPage, pages));
              const rows = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

              const ths = cols.map(c => '<th style="font-size:12px; background:#f8fafc; border-bottom:1px solid #e2e8f0; text-align:left; padding:10px 12px;">' + c.name + '</th>').join('');
              const trs = rows.length ? rows.map((r, i) => {
                const tds = cols.map(c => '<td style="padding:10px 12px; font-size:12px; border-bottom:1px solid #f1f5f9;">' + (r[c.name] ?? '-') + '</td>').join('');
                return '<tr' + (tableStyle.stripe && i % 2 ? ' class="stripe"' : '') + '>' + tds + '</tr>';
              }).join('') : '<tr><td colspan="' + cols.length + '" style="text-align:center; padding:40px; color:#94a3b8;">暂无数据</td></tr>';

              scrollArea.innerHTML = '<table class="preview-table"><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
              
              footer.innerHTML = '<div>共 ' + total + ' 条</div><div style="display:flex; gap:8px; align-items:center;">' +
                '<button id="prev-' + comp.id + '" style="padding:2px 6px; border:1px solid #e2e8f0; background:white; cursor:pointer;" ' + (currentPage <= 1 ? 'disabled' : '') + '>上页</button>' +
                '<span>' + currentPage + ' / ' + pages + '</span>' +
                '<button id="next-' + comp.id + '" style="padding:2px 6px; border:1px solid #e2e8f0; background:white; cursor:pointer;" ' + (currentPage >= pages ? 'disabled' : '') + '>下页</button>' +
              '</div>';

              footer.querySelector('#prev-' + comp.id)?.addEventListener('click', () => { currentPage--; draw(); });
              footer.querySelector('#next-' + comp.id)?.addEventListener('click', () => { currentPage++; draw(); });
            };
            draw();
          }

          function renderChart(container, comp, dataset) {
            if (!dataset) return;
            const config = comp.config;
            const titleEl = document.createElement('h3');
            titleEl.innerText = config.title || comp.name;
            titleEl.style.cssText = 'margin:0 0 10px 0; font-size:14px; font-weight:700; padding:10px 14px 0 14px;';
            const chartDiv = document.createElement('div');
            chartDiv.style.cssText = 'width:100%; height:calc(100% - 40px);';
            container.appendChild(titleEl);
            container.appendChild(chartDiv);
            
            const chart = echarts.init(chartDiv);
            const x = config.xField, y = config.yField;
            const stats = new Map();
            dataset.data.forEach(r => {
              const val = Number(r[y]) || 0;
              const group = String(r[x] || '未知');
              stats.set(group, (stats.get(group) || 0) + val);
            });
            const xAxis = Array.from(stats.keys());
            const yAxis = xAxis.map(k => stats.get(k));
            
            chart.setOption({
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: xAxis },
              yAxis: { type: 'value' },
              series: [{ data: yAxis, type: comp.type === 'line' ? 'line' : 'bar', smooth: true }]
            });
          }

          function updateLayout(containerWidth) {
            if (!globalSnapshot) return;
            const ratio = Math.max(1200, containerWidth) / 1200;
            let maxBottom = 0;
            globalSnapshot.components.forEach(comp => {
              const el = document.getElementById('widget-' + comp.id);
              if (!el) return;
              const w = comp.size.width * ratio, h = comp.size.height * ratio;
              const x = comp.position.x * ratio, y = comp.position.y * ratio;
              el.style.cssText += 'left:' + x + 'px; top:' + y + 'px; width:' + w + 'px; height:' + h + 'px;';
              maxBottom = Math.max(maxBottom, y + h);
              const chartDom = el.querySelector('.widget-body div:last-child');
              if (chartDom) {
                const chart = echarts.getInstanceByDom(chartDom);
                if (chart) chart.resize();
              }
            });
            document.getElementById('board-canvas').style.height = (maxBottom + 100) + 'px';
          }

          init();
        </script>
      </body>
      </html>
    `;
  }
}
