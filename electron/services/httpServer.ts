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
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
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
            position: absolute; background: white; border: 1px solid rgba(226, 232, 240, 0.8); 
            border-radius: 4px; display: flex; flex-direction: column; 
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); overflow: hidden; padding: 16px;
          }
          .widget:hover { z-index: 50; }
          .widget-header {
            height: 32px; border-bottom: 1px solid #f1f5f9; background: #f8fafc;
            display: flex; align-items: center; padding: 0 12px; flex-shrink: 0; margin: -16px -16px 12px -16px;
          }
          .widget-header span { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
          .widget-body { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; }
          
          /* 表格对齐样式 */
          .preview-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          .preview-table th {
            padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left;
            font-size: 12px; color: #475569; font-weight: 600; background: #f1f5f9;
            position: sticky; top: 0; z-index: 5;
          }
          .preview-table td { 
            border-bottom: 1px solid #f1f5f9; color: #334155; 
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            padding: 10px 12px; font-size: 14px;
          }
          .preview-table tr.stripe { background-color: rgba(248, 250, 252, 0.7); }
          .preview-table tr:hover { background-color: #f8fafc; }

          /* 分页按钮对齐 */
          .btn-pagination {
            padding: 4px; border-radius: 4px; border: 1px solid #e2e8f0; 
            background: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
          }
          .btn-pagination:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
          .btn-pagination:disabled { opacity: 0.5; cursor: not-allowed; }
          
          .ai-chat-area { width: 360px; border-left: 1px solid #e2e8f0; background: white; display: none; flex-direction: column; height: 100%; flex-shrink: 0; }
          .error-box { text-align: center; margin: 120px auto; max-width: 440px; padding: 40px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; }
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

          const cellFormatter = {
            format(value, config) {
              if (!config) return String(value ?? '-');
              if (config.type === 'number') {
                if (value === null || value === undefined || value === '') return '-';
                const num = Number(value);
                if (isNaN(num)) return '错误';
                const precision = config.precision !== undefined ? config.precision : 2;
                const useGrouping = config.useGrouping !== undefined ? config.useGrouping : true;
                const options = {
                  minimumFractionDigits: precision,
                  maximumFractionDigits: precision,
                  useGrouping: useGrouping
                };
                return new Intl.NumberFormat('zh-CN', options).format(num);
              } else if (config.type === 'date') {
                if (!value) return '-';
                const date = value instanceof Date ? value : new Date(value);
                if (isNaN(date.getTime())) return '错误';
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                if (config.dateFormat === 'YYYYMMDD') {
                  return '' + year + month + day;
                }
                return year + '-' + month + '-' + day;
              } else {
                if (value === null || value === undefined || value === '') return '-';
                return String(value);
              }
            }
          };

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
            const columnWidths = config.columnWidths || {};
            const columnFormatters = config.columnFormatters || {};
            
            let searchText = '', 
                currentPage = 1, 
                pageSize = Number(config.pageSize || 20), 
                sortField = null, 
                sortOrder = null;

            let pageInputVal = '1';

            const icons = {
              search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
              chevronLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
              chevronRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
              chevronUp: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px; display: inline-block; vertical-align: middle;"><path d="m18 15-6-6-6 6"/></svg>',
              chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px; display: inline-block; vertical-align: middle;"><path d="m6 9 6 6 6-6"/></svg>'
            };

            const tableWrap = document.createElement('div');
            tableWrap.style.cssText = 'display:flex; flex-direction:column; width:100%; height:100%; background:white;';

            // 头部：标题与搜索框
            const header = document.createElement('div');
            header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0 0 12px 0; border-bottom:1px solid #f1f5f9; flex-shrink:0; background:white; z-index:10; min-height:40px;';
            
            const title = document.createElement('h3');
            title.innerText = config.title || comp.name || '表格';
            title.style.cssText = 'font-size:14px; font-weight:600; margin:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#1e293b;';
            
            const searchBox = document.createElement('div');
            searchBox.style.cssText = 'position:relative; width:220px; flex-shrink:0;';
            searchBox.innerHTML = '<span style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#94a3b8; pointer-events:none; display:flex;">' + icons.search + '</span>';
            
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '搜索表格数据...';
            input.style.cssText = 'width:100%; height:32px; padding:0 10px 0 32px; font-size:12px; border:1px solid #e2e8f0; border-radius:4px; outline:none; background:#f8fafc; transition: all 0.2s;';
            input.onfocus = () => input.style.borderColor = '#3b82f6';
            input.onblur = () => input.style.borderColor = '#e2e8f0';
            input.addEventListener('input', (e) => { 
              searchText = e.target.value; 
              currentPage = 1; 
              pageInputVal = '1';
              draw(); 
            });
            
            searchBox.appendChild(input);
            header.appendChild(title);
            header.appendChild(searchBox);
            tableWrap.appendChild(header);

            const scrollArea = document.createElement('div');
            scrollArea.style.cssText = 'flex:1; overflow:auto; border:1px solid #f1f5f9; border-radius:4px; margin-top:4px;';
            tableWrap.appendChild(scrollArea);

            const footer = document.createElement('div');
            footer.style.cssText = 'padding:12px 0 0 0; border-top:1px solid #f1f5f9; font-size:12px; color:#64748b; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; margin-top:4px;';
            tableWrap.appendChild(footer);

            container.appendChild(tableWrap);

            const handleSort = (fieldName) => {
              if (sortField !== fieldName) {
                sortField = fieldName;
                sortOrder = 'asc';
              } else if (sortOrder === 'asc') {
                sortOrder = 'desc';
              } else {
                sortField = null;
                sortOrder = null;
              }
              currentPage = 1;
              pageInputVal = '1';
              draw();
            };

            const draw = () => {
              let data = dataset.data || [];

              // 自动过滤冗余数据行
              data = data.filter(row => {
                return !dataset.columns.every(col => String(row[col.name]) === col.name);
              });

              // 搜索
              if (searchText) {
                const q = searchText.toLowerCase().trim();
                data = data.filter(r => cols.some(c => {
                  const val = r[c.name];
                  if (val === null || val === undefined) return false;
                  return String(val).toLowerCase().includes(q);
                }));
              }

              // 排序
              if (sortField && sortOrder) {
                const col = dataset.columns.find(c => c.name === sortField);
                const colType = col ? col.type : 'string';
                
                data.sort((a, b) => {
                  const valA = a[sortField];
                  const valB = b[sortField];

                  if (valA === null || valA === undefined || valA === '') return 1;
                  if (valB === null || valB === undefined || valB === '') return -1;

                  if (colType === 'number') {
                    const numA = Number(valA);
                    const numB = Number(valB);
                    return sortOrder === 'asc' ? numA - numB : numB - numA;
                  }

                  if (colType === 'date') {
                    const dateA = new Date(valA).getTime();
                    const dateB = new Date(valB).getTime();
                    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
                  }

                  const strA = String(valA).localeCompare(String(valB), 'zh');
                  return sortOrder === 'asc' ? strA : -strA;
                });
              }

              const total = data.length;
              const pages = Math.ceil(total / pageSize) || 1;
              currentPage = Math.max(1, Math.min(currentPage, pages));
              const rows = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

              const fontSize = tableStyle.fontSize || 14;
              const headerBg = tableStyle.headerBg || '#f1f5f9';
              
              let py = '10px', px = '12px', fSize = fontSize + 'px';
              if (tableStyle.rowHeight === 'compact') {
                py = '6px'; px = '8px'; fSize = '12px';
              } else if (tableStyle.rowHeight === 'loose') {
                py = '14px'; px = '16px'; fSize = '16px';
              }

              const ths = cols.map(c => {
                const width = columnWidths[c.name] || 150;
                const sortIcon = sortField === c.name ? (sortOrder === 'asc' ? icons.chevronUp : icons.chevronDown) : '';
                return '<th data-col="' + c.name + '" style="font-size:12px; background:' + headerBg + '; border-bottom:1px solid #e2e8f0; text-align:left; padding:10px 12px; color:#475569; width:' + width + 'px; cursor:pointer; user-select:none; position:sticky; top:0; z-index:5;">' +
                  '<div style="display:flex; align-items:center;">' +
                    '<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">' + c.name + '</span>' +
                    sortIcon +
                  '</div>' +
                '</th>';
              }).join('');

              const trs = rows.length ? rows.map((r, i) => {
                const tds = cols.map(c => {
                  const formatterConfig = columnFormatters[c.name] || { type: c.type };
                  const formattedVal = cellFormatter.format(r[c.name], {
                    type: c.type === 'string' ? 'text' : c.type,
                    precision: formatterConfig.precision,
                    useGrouping: formatterConfig.useGrouping,
                    dateFormat: formatterConfig.dateFormat
                  });
                  return '<td style="padding:' + py + ' ' + px + '; font-size:' + fSize + '; border-bottom:1px solid #f1f5f9; color:#334155; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + String(r[c.name] ?? '') + '">' + formattedVal + '</td>';
                }).join('');
                return '<tr' + (tableStyle.stripe && i % 2 ? ' class="stripe"' : '') + '>' + tds + '</tr>';
              }).join('') : '<tr><td colspan="' + cols.length + '" style="text-align:center; padding:40px; color:#94a3b8; font-size:12px;">暂无匹配数据</td></tr>';

              scrollArea.innerHTML = '<table class="preview-table" style="table-layout:fixed; width:100%; border-collapse:collapse; font-size:' + fontSize + 'px;"><thead><tr>' + ths + '</tr></thead><tbody>' + trs + '</tbody></table>';
              
              scrollArea.querySelectorAll('th').forEach(th => {
                th.addEventListener('click', () => {
                  const colName = th.getAttribute('data-col');
                  if (colName) handleSort(colName);
                });
              });

              footer.innerHTML = '<div>共计 <span style="font-weight:600; color:#334155;">' + total + '</span> 条记录</div>' +
                '<div style="display:flex; gap:16px; align-items:center;">' +
                  '<form id="page-form-' + comp.id + '" style="display:flex; gap:4px; align-items:center; margin:0;">' +
                    '<button type="button" id="prev-' + comp.id + '" class="btn-pagination" ' + (currentPage <= 1 ? 'disabled' : '') + '>' + icons.chevronLeft + '</button>' +
                    '<span style="margin:0 4px; display:flex; align-items:center; gap:4px;">' +
                      '第 <input type="text" id="page-input-' + comp.id + '" value="' + pageInputVal + '" style="width:36px; height:24px; text-align:center; border:1px solid #e2e8f0; border-radius:4px; outline:none; font-size:12px;" /> 页 / 共 ' + pages + ' 页' +
                    '</span>' +
                    '<button type="button" id="next-' + comp.id + '" class="btn-pagination" ' + (currentPage >= pages ? 'disabled' : '') + '>' + icons.chevronRight + '</button>' +
                  '</form>' +
                  '<div style="display:flex; align-items:center; gap:4px;">' +
                    '<span>每页</span>' +
                    '<select id="size-select-' + comp.id + '" style="height:24px; border:1px solid #e2e8f0; border-radius:4px; outline:none; font-size:12px; background:transparent; padding:0 4px;">' +
                      '<option value="10" ' + (pageSize === 10 ? 'selected' : '') + '>10</option>' +
                      '<option value="20" ' + (pageSize === 20 ? 'selected' : '') + '>20</option>' +
                      '<option value="50" ' + (pageSize === 50 ? 'selected' : '') + '>50</option>' +
                      '<option value="100" ' + (pageSize === 100 ? 'selected' : '') + '>100</option>' +
                    '</select>' +
                    '<span>条</span>' +
                  '</div>' +
                '</div>';

              footer.querySelector('#prev-' + comp.id)?.addEventListener('click', () => { 
                currentPage--; 
                pageInputVal = String(currentPage);
                draw(); 
              });
              footer.querySelector('#next-' + comp.id)?.addEventListener('click', () => { 
                currentPage++; 
                pageInputVal = String(currentPage);
                draw(); 
              });

              const pageForm = footer.querySelector('#page-form-' + comp.id);
              const pageInput = footer.querySelector('#page-input-' + comp.id);
              
              pageInput?.addEventListener('input', (e) => {
                pageInputVal = e.target.value;
              });

              const handlePageJump = () => {
                let val = parseInt(pageInputVal, 10);
                
                const showTooltip = (msg) => {
                  if (!pageInput) return;
                  pageInput.style.borderColor = '#ef4444';
                  pageInput.style.backgroundColor = '#fef2f2';
                  pageInput.style.color = '#ef4444';
                  
                  const rect = pageInput.getBoundingClientRect();
                  const tooltip = document.createElement('div');
                  tooltip.innerText = msg;
                  tooltip.style.cssText = 'position:fixed; background:#1e293b; color:white; font-size:10px; padding:4px 8px; border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.15); z-index:10000; pointer-events:none; transition:opacity 0.2s; font-family:sans-serif; line-height:1.2;';
                  document.body.appendChild(tooltip);
                  
                  const tooltipRect = tooltip.getBoundingClientRect();
                  tooltip.style.left = (rect.left + rect.width / 2 - tooltipRect.width / 2) + 'px';
                  tooltip.style.top = (rect.top - tooltipRect.height - 6) + 'px';
                  
                  setTimeout(() => {
                    tooltip.style.opacity = '0';
                    setTimeout(() => tooltip.remove(), 200);
                    if (pageInput) {
                      pageInput.style.borderColor = '#e2e8f0';
                      pageInput.style.backgroundColor = '';
                      pageInput.style.color = '';
                    }
                  }, 2000);
                };

                if (isNaN(val)) {
                  showTooltip('请输入有效的页码');
                  pageInputVal = String(currentPage);
                  if (pageInput) pageInput.value = pageInputVal;
                  return;
                }
                if (val < 1) {
                  showTooltip('页码超出范围，已自动调整');
                  val = 1;
                } else if (val > pages) {
                  showTooltip('页码超出范围，已自动调整');
                  val = pages;
                }
                currentPage = val;
                pageInputVal = String(currentPage);
                draw();
              };

              pageForm?.addEventListener('submit', (e) => {
                e.preventDefault();
                handlePageJump();
              });
              
              pageInput?.addEventListener('blur', () => {
                handlePageJump();
              });

              const sizeSelect = footer.querySelector('#size-select-' + comp.id);
              sizeSelect?.addEventListener('change', (e) => {
                pageSize = Number(e.target.value);
                currentPage = 1;
                pageInputVal = '1';
                draw();
              });
            };
            draw();
          }

          function renderChart(container, comp, dataset) {
            if (!dataset) return;
            const config = comp.config || {};
            
            // 字段校验
            const hasX = dataset.columns.some(c => c.name === config.xField);
            const hasY = dataset.columns.some(c => c.name === config.yField);
            const hasSecondaryY = !config.dualYAxis || !config.secondaryYField || dataset.columns.some(c => c.name === config.secondaryYField);
            if (!config.xField || !config.yField || !hasX || !hasY || !hasSecondaryY) {
              container.innerHTML = '<div style="padding:20px; color:red; font-size:12px; text-align:center;">配置字段缺失或数据源失效</div>';
              return;
            }

            const titleEl = document.createElement('h3');
            titleEl.innerText = config.title || comp.name || '图表';
            titleEl.style.cssText = 'margin:0 0 10px 0; font-size:14px; font-weight:700; padding:10px 14px 0 14px;';
            const chartDiv = document.createElement('div');
            chartDiv.style.cssText = 'width:100%; height:calc(100% - 40px);';
            container.appendChild(titleEl);
            container.appendChild(chartDiv);
            
            const chart = echarts.init(chartDiv);
            
            // 聚合计算
            const rawData = dataset.data || [];
            const statsMap = new Map();

            for (const row of rawData) {
              const xVal = String(row[config.xField] ?? '');
              if (xVal === '') continue;

              const yVal = Number(row[config.yField]);
              const val = isNaN(yVal) ? 0 : yVal;
              
              const stats = statsMap.get(xVal) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
              stats.sum += val;
              stats.count += 1;
              stats.max = Math.max(stats.max, val);
              stats.min = Math.min(stats.min, val);
              statsMap.set(xVal, stats);
            }

            let aggregatedList = Array.from(statsMap.entries()).map(([x, stats]) => {
              let finalVal = 0;
              switch (config.aggregation) {
                case 'sum': finalVal = stats.sum; break;
                case 'avg': finalVal = stats.count > 0 ? stats.sum / stats.count : 0; break;
                case 'count': finalVal = stats.count; break;
                case 'max': finalVal = stats.max === -Infinity ? 0 : stats.max; break;
                case 'min': finalVal = stats.min === Infinity ? 0 : stats.min; break;
                default: finalVal = stats.sum;
              }
              return { x, y: finalVal };
            });

            // 智能过滤：只保留数值不为 0 且有效的分类，剔除无数据的类别占位
            aggregatedList = aggregatedList.filter(item => item.y !== 0 && item.y !== null && item.y !== undefined && !isNaN(item.y));

            const xAxisData = aggregatedList.map(item => item.x);
            const yAxisData = aggregatedList.map(item => item.y);

            const baseTitle = config.title || comp.name;
            const colors = config.colors && config.colors.length > 0 ? config.colors : ['#3b82f6'];
            const precision = config.precision ?? 2;
            const chartType = config.chartType || comp.type;
            
            // 智能 dataZoom 滚动条控制
            const totalPoints = xAxisData.length;
            const enableDataZoom = totalPoints > 30;
            const dataZoomPercent = enableDataZoom ? Math.min(100, Math.ceil(30 / totalPoints * 100)) : 100;
            const dataZoomOption = enableDataZoom ? [
              {
                type: 'slider',
                show: true,
                xAxisIndex: [0],
                start: 0,
                end: dataZoomPercent,
                height: 18,
                bottom: 30,
                textStyle: { fontSize: 10 }
              },
              {
                type: 'inside',
                xAxisIndex: [0],
                start: 0,
                end: dataZoomPercent
              }
            ] : undefined;

            // 计算自适应 X 轴标签旋转角度
            const xLabelRotate = statsMap.size > 30 ? 45 : (statsMap.size > 10 ? 30 : 0);

            // 数据项过多（大于 30）时，强制隐藏柱顶数值标签以规避数值重叠，靠 hover tooltip 查看
            const autoShowLabel = config.showDataLabel && totalPoints <= 30;

            // 柱体自适应宽度及组间间距（分类多则收窄，分类少则加宽）
            const dynamicBarWidth = totalPoints > 50 ? '30%' : (totalPoints > 20 ? '45%' : '60%');
            const dynamicBarCategoryGap = totalPoints > 50 ? '35%' : '20%';

            let option = {};

            if (chartType === 'pie' || chartType === 'ring' || chartType === 'rose') {
              let pieData = xAxisData.map((x, index) => ({
                name: x,
                value: yAxisData[index]
              }));

              // 对小占比的饼图扇区合并为“其他”
              const totalSum = yAxisData.reduce((a, b) => a + b, 0);
              if (pieData.length > 8 && totalSum > 0) {
                const threshold = totalSum * 0.02; // 占比小于 2%
                let otherSum = 0;
                const mainData = [];
                for (const item of pieData) {
                  if (item.value < threshold) {
                    otherSum += item.value;
                  } else {
                    mainData.push(item);
                  }
                }
                if (otherSum > 0) {
                  mainData.push({ name: '其他', value: otherSum });
                  pieData = mainData;
                }
              }

              const legendPosition = config.legendPosition || 'bottom';
              const legendOption = {
                orient: (legendPosition === 'left' || legendPosition === 'right') ? 'vertical' : 'horizontal',
                type: 'scroll'
              };
              if (legendPosition === 'center') {
                legendOption.left = 'center';
                legendOption.top = 'middle';
              } else if (legendPosition === 'left' || legendPosition === 'right') {
                legendOption[legendPosition] = 0;
                legendOption.top = 'middle';
              } else {
                legendOption.left = 'center';
                legendOption[legendPosition] = 0;
              }

              option = {
                title: { text: baseTitle, left: 'center', textStyle: { fontSize: 14, fontWeight: 'normal' } },
                tooltip: {
                  trigger: 'item',
                  confine: true,
                  formatter: function(params) {
                    return params.seriesName + '<br/>' + params.name + ' : ' + Number(params.value).toFixed(precision) + ' (' + params.percent + '%)';
                  }
                },
                legend: config.showLegend !== false ? legendOption : undefined,
                color: colors,
                series: [
                  {
                    name: config.yField,
                    type: 'pie',
                    radius: chartType === 'ring' ? ['40%', '70%'] : '70%',
                    roseType: chartType === 'rose' ? 'radius' : undefined,
                    data: pieData,
                    label: {
                      show: config.showDataLabel !== false,
                      formatter: function(params) {
                        return params.name + ': ' + params.percent + '%';
                      }
                    },
                    labelLine: {
                      show: config.showPieLabelLine !== false
                    },
                    labelLayout: {
                      hideOverlap: true
                    }
                  }
                ]
              };
            } else if (chartType === 'bar' || chartType === 'group' || chartType === 'stack') {
              const shouldUseSeries = Boolean(config.seriesField && (chartType === 'group' || chartType === 'stack'));
              let barSeries = [];

              if (shouldUseSeries) {
                const xSet = new Set();
                const seriesSet = new Set();
                const groupedStats = new Map();

                for (const row of rawData) {
                  const xVal = String(row[config.xField] ?? '');
                  const seriesVal = String(row[config.seriesField] ?? '');
                  const yVal = Number(row[config.yField]);
                  if (!xVal || !seriesVal) continue;

                  xSet.add(xVal);
                  seriesSet.add(seriesVal);

                  const xMap = groupedStats.get(xVal) || new Map();
                  const stats = xMap.get(seriesVal) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
                  const val = isNaN(yVal) ? 0 : yVal;
                  stats.sum += val;
                  stats.count += 1;
                  stats.max = Math.max(stats.max, val);
                  stats.min = Math.min(stats.min, val);

                  xMap.set(seriesVal, stats);
                  groupedStats.set(xVal, xMap);
                }

                const groupedXAxisData = Array.from(xSet);
                const seriesNames = Array.from(seriesSet);

                const getFinalValue = (stats) => {
                  if (!stats) return 0;
                  switch (config.aggregation) {
                    case 'sum': return stats.sum;
                    case 'avg': return stats.count > 0 ? stats.sum / stats.count : 0;
                    case 'count': return stats.count;
                    case 'max': return stats.max === -Infinity ? 0 : stats.max;
                    case 'min': return stats.min === Infinity ? 0 : stats.min;
                    default: return stats.sum;
                  }
                };

                // 智能过滤：过滤并移去无有效数据的系列
                const activeSeriesNames = seriesNames.filter(seriesName => {
                  let hasData = false;
                  for (const x of groupedXAxisData) {
                    const val = getFinalValue(groupedStats.get(x)?.get(seriesName));
                    if (val !== 0 && val !== null && val !== undefined && !isNaN(val)) {
                      hasData = true;
                      break;
                    }
                  }
                  return hasData;
                });

                // 智能过滤：过滤并移去该分类下全系列均无数据的 X 轴目
                const activeXAxisData = groupedXAxisData.filter(x => {
                  let hasData = false;
                  for (const seriesName of activeSeriesNames) {
                    const val = getFinalValue(groupedStats.get(x)?.get(seriesName));
                    if (val !== 0 && val !== null && val !== undefined && !isNaN(val)) {
                      hasData = true;
                      break;
                    }
                  }
                  return hasData;
                });

                barSeries = activeSeriesNames.map(seriesName => ({
                  name: seriesName,
                  type: 'bar',
                  stack: chartType === 'stack' ? 'total' : undefined,
                  data: activeXAxisData.map(x => getFinalValue(groupedStats.get(x)?.get(seriesName))),
                  barWidth: dynamicBarWidth,
                  barGap: '10%',
                  label: autoShowLabel ? {
                    show: true,
                    position: chartType === 'stack' ? 'inside' : 'top',
                    formatter: function(params) {
                      var val = Number(params.value);
                      return val === 0 ? '' : val.toFixed(precision);
                    }
                  } : undefined,
                  labelLayout: {
                    hideOverlap: true
                  }
                }));

                xAxisData.splice(0, xAxisData.length, ...activeXAxisData);
              } else {
                barSeries = [{
                  name: config.yField,
                  type: 'bar',
                  data: yAxisData,
                  barWidth: dynamicBarWidth,
                  label: autoShowLabel ? {
                    show: true,
                    position: chartType === 'stack' ? 'inside' : 'top',
                    formatter: function(params) {
                      var val = Number(params.value);
                      return val === 0 ? '' : val.toFixed(precision);
                    }
                  } : undefined,
                  labelLayout: {
                    hideOverlap: true
                  }
                }];
              }

              option = {
                title: { text: baseTitle, textStyle: { fontSize: 14, fontWeight: 'normal' } },
                tooltip: {
                  trigger: 'axis',
                  axisPointer: { type: 'shadow' },
                  confine: true,
                  formatter: function(params) {
                    let res = params[0].name;
                    params.forEach(function(item) {
                      res += '<br/>' + item.marker + ' ' + item.seriesName + ': ' + Number(item.value).toFixed(precision);
                    });
                    return res;
                  }
                },
                legend: config.showLegend ? { bottom: 0, left: 'center', type: 'scroll', orient: 'horizontal' } : undefined,
                grid: { left: '3%', right: '4%', bottom: enableDataZoom ? 75 : 40, containLabel: true },
                color: colors,
                dataZoom: dataZoomOption,
                xAxis: {
                  type: 'category',
                  data: xAxisData,
                  axisLabel: { 
                    rotate: xLabelRotate, 
                    interval: 'auto',
                    formatter: function(val) {
                      if (typeof val === 'string' && val.length > 8) {
                        return val.substring(0, 8) + '...';
                      }
                      return val;
                    }
                  }
                },
                yAxis: { 
                  type: 'value',
                  axisLabel: {
                    formatter: function(val) {
                      if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
                      if (val >= 10000) return (val / 10000).toFixed(1) + '万';
                      return new Intl.NumberFormat('zh-CN').format(val);
                    }
                  }
                },
                series: barSeries
              };
            } else {
              // 折线图
              let lineSeries = [
                {
                  name: config.yField,
                  type: 'line',
                  data: yAxisData,
                  smooth: config.smoothLine || false,
                  areaStyle: config.areaFill ? { opacity: 0.3 } : undefined,
                  label: autoShowLabel ? {
                    show: true,
                    position: 'top',
                    formatter: function(params) { return Number(params.value).toFixed(precision); }
                  } : undefined,
                  labelLayout: {
                    hideOverlap: true
                  }
                }
              ];

              if (config.dualYAxis && config.secondaryYField) {
                const secondaryStats = new Map();
                for (const row of rawData) {
                  const xVal = String(row[config.xField] ?? '');
                  const yVal = Number(row[config.secondaryYField]);
                  if (!xVal) continue;

                  const val = isNaN(yVal) ? 0 : yVal;
                  const stats = secondaryStats.get(xVal) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
                  stats.sum += val;
                  stats.count += 1;
                  stats.max = Math.max(stats.max, val);
                  stats.min = Math.min(stats.min, val);
                  secondaryStats.set(xVal, stats);
                }

                const getFinalValue = (stats) => {
                  if (!stats) return 0;
                  switch (config.aggregation) {
                    case 'sum': return stats.sum;
                    case 'avg': return stats.count > 0 ? stats.sum / stats.count : 0;
                    case 'count': return stats.count;
                    case 'max': return stats.max === -Infinity ? 0 : stats.max;
                    case 'min': return stats.min === Infinity ? 0 : stats.min;
                    default: return stats.sum;
                  }
                };

                lineSeries = [
                  Object.assign({}, lineSeries[0], { yAxisIndex: 0 }),
                  {
                    name: config.secondaryYField,
                    type: 'line',
                    yAxisIndex: 1,
                    data: xAxisData.map(x => getFinalValue(secondaryStats.get(x))),
                    smooth: config.smoothLine || false,
                    label: autoShowLabel ? {
                      show: true,
                      position: 'top',
                      formatter: function(params) { return Number(params.value).toFixed(precision); }
                    } : undefined,
                    labelLayout: {
                      hideOverlap: true
                    }
                  }
                ];
              }

              option = {
                title: { text: baseTitle, textStyle: { fontSize: 14, fontWeight: 'normal' } },
                tooltip: {
                  trigger: 'axis',
                  confine: true,
                  formatter: function(params) {
                    let res = params[0].name;
                    params.forEach(function(item) {
                      res += '<br/>' + item.marker + ' ' + item.seriesName + ': ' + Number(item.value).toFixed(precision);
                    });
                    return res;
                  }
                },
                legend: config.showLegend ? { bottom: 0, left: 'center', type: 'scroll', orient: 'horizontal' } : undefined,
                grid: { left: '3%', right: '4%', bottom: enableDataZoom ? 75 : 40, containLabel: true },
                color: colors,
                dataZoom: dataZoomOption,
                xAxis: {
                  type: 'category',
                  data: xAxisData,
                  axisLabel: { 
                    rotate: xLabelRotate, 
                    interval: 'auto',
                    formatter: function(val) {
                      if (typeof val === 'string' && val.length > 8) {
                        return val.substring(0, 8) + '...';
                      }
                      return val;
                    }
                  }
                },
                yAxis: config.dualYAxis && config.secondaryYField
                  ? [
                      { 
                        type: 'value', 
                        name: config.yField,
                        axisLabel: {
                          formatter: function(val) {
                            if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
                            if (val >= 10000) return (val / 10000).toFixed(1) + '万';
                            return new Intl.NumberFormat('zh-CN').format(val);
                          }
                        }
                      },
                      { 
                        type: 'value', 
                        name: config.secondaryYField,
                        axisLabel: {
                          formatter: function(val) {
                            if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
                            if (val >= 10000) return (val / 10000).toFixed(1) + '万';
                            return new Intl.NumberFormat('zh-CN').format(val);
                          }
                        }
                      }
                    ]
                  : { 
                      type: 'value',
                      axisLabel: {
                        formatter: function(val) {
                          if (val >= 100000000) return (val / 100000000).toFixed(1) + '亿';
                          if (val >= 10000) return (val / 10000).toFixed(1) + '万';
                          return new Intl.NumberFormat('zh-CN').format(val);
                        }
                      }
                    },
                series: lineSeries
              };
            }

            const isDataEmpty = xAxisData.length === 0;

            if (isDataEmpty) {
              container.innerHTML = '<div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:16px; background:#f8fafc; color:#64748b; font-size:12px;">' +
                '<span style="font-size:14px; font-weight:600; margin-bottom:4px; color:#475569;">暂无有效数据</span>' +
                '<span>图表数据已被过滤或数值全部为零/空</span>' +
              '</div>';
              return;
            }

            chart.setOption(option);
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
