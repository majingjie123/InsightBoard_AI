import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { PreviewServer } from './services/httpServer';

let mainWindow: BrowserWindow | null = null;
let previewServer: PreviewServer | null = null;

// 1. 创建桌面客户端主窗口
function createWindow() {
  const iconPath = path.join(app.getAppPath(), 'resources', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: true, // 保留标准窗口控制栏
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 根据环境变量或打包路径加载页面
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 2. Electron App 生命周期管理
app.whenReady().then(() => {
  createWindow();
  
  // 统一初始化预览服务器
  if (mainWindow) {
    previewServer = new PreviewServer(mainWindow);
    previewServer.start(18080);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (mainWindow && !previewServer) {
        previewServer = new PreviewServer(mainWindow);
        previewServer.start(18080);
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (previewServer) {
    previewServer.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 3. IPC 通信处理器
ipcMain.handle('server:getPort', () => {
  return previewServer ? previewServer.getPort() : 18080;
});

ipcMain.handle('dialog:selectFile', async (_, filters) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: filters
  });
  
  // 卫语句：取消文件选择
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  // 读取二进制文件返回给渲染进程
  const filePath = result.filePaths[0];
  const fileBuffer = fs.readFileSync(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    buffer: fileBuffer
  };
});

// 轻量配置本地存储文件路径
const configFilePath = path.join(app.getPath('userData'), 'app-config.json');

ipcMain.handle('config:get', (_, key) => {
  if (!fs.existsSync(configFilePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(configFilePath, 'utf-8');
    const data = JSON.parse(raw);
    return data[key] ?? null;
  } catch {
    return null;
  }
});

ipcMain.handle('config:set', (_, dataObj) => {
  const { key, value } = dataObj;
  let current: any = {};
  if (fs.existsSync(configFilePath)) {
    try {
      current = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
    } catch {
      current = {};
    }
  }
  current[key] = value;
  fs.writeFileSync(configFilePath, JSON.stringify(current, null, 2), 'utf-8');
  return true;
});

// 4. 窗口最大化/最小化/关闭自定义命令
ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('file:save', async (_, { data, path: filePath }) => {
  try {
    fs.writeFileSync(filePath, data);
    return true;
  } catch (err) {
    console.error('保存文件失败', err);
    return false;
  }
});

ipcMain.handle('server:start', async () => {
  if (previewServer) {
    previewServer.start(18080);
    return previewServer.getPort();
  }
  return 18080;
});

ipcMain.handle('server:stop', async () => {
  if (previewServer) {
    previewServer.stop();
    return true;
  }
  return false;
});

ipcMain.handle('ai:chat', async () => {
  return { choices: [{ message: { content: 'API 对齐成功' } }] };
});

ipcMain.on('ai:stream', (event) => {
  event.reply('ai:stream', 'API 对齐成功');
});
