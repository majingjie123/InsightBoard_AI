import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件选择与操作
  selectFile: (filters: { name: string; extensions: string[] }[]) => 
    ipcRenderer.invoke('dialog:selectFile', filters),
  saveFile: (data: any, path: string) => 
    ipcRenderer.invoke('file:save', { data, path }),

  // 获取本地 HTTP 服务器实际端口
  getServerPort: () => ipcRenderer.invoke('server:getPort'),

  // 配置持久化读写 (本地 app-config.json)
  getConfig: (key: string) => ipcRenderer.invoke('config:get', key),
  setConfig: (key: string, value: any) => ipcRenderer.invoke('config:set', { key, value }),

  // 窗口操作
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // HTTP服务操作
  startServer: () => ipcRenderer.invoke('server:start'),
  stopServer: () => ipcRenderer.invoke('server:stop'),

  // AI请求
  chat: (endpoint: string, messages: any[]) => ipcRenderer.invoke('ai:chat', { endpoint, messages }),
  streamChat: (endpoint: string, messages: any[], onChunk: (chunk: string) => void) => {
    const channel = 'ai:stream';
    ipcRenderer.send(channel, { endpoint, messages });
    const listener = (_: any, chunk: string) => onChunk(chunk);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // 监听主进程的快照数据请求
  onRequestSnapshotData: (callback: (spaceId: string) => void) => {
    ipcRenderer.on('request-snapshot-data', (_, spaceId) => callback(spaceId));
  },

  // 渲染进程将快照数据回复给主进程的 HTTP 服务
  responseSnapshotData: (spaceId: string, snapshot: any) => {
    ipcRenderer.send(`response-snapshot-data-${spaceId}`, snapshot);
  }
});
