import { ColumnInfo } from '../types/dataset';

export interface ParseProgressEvent {
  type: 'progress';
  percent: number;
}

export interface ParseSuccessEvent {
  type: 'success';
  sheets: string[];
  data: any[];
  columns: ColumnInfo[];
}

export interface ParseErrorEvent {
  type: 'error';
  message: string;
}

export type ParseEvent = ParseProgressEvent | ParseSuccessEvent | ParseErrorEvent;

export class ExcelParser {
  private worker: Worker | null = null;

  /**
   * 异步分片解析 Excel 文件
   * @param file Excel 文件对象
   * @param onProgress 进度回调函数 (0 - 100)
   */
  async parse(
    file: File,
    onProgress: (percent: number) => void
  ): Promise<Omit<ParseSuccessEvent, 'type'>> {
    // 卫语句：校验文件后缀格式
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      throw new Error('仅支持上传 .xlsx 或 .xls 格式的 Excel 文件');
    }

    return new Promise((resolve, reject) => {
      // 卫语句：若已存在解析任务，先终止以释放资源
      if (this.worker) {
        this.worker.terminate();
      }

      // 在 Vite 环境下加载本地 Worker，实现纯本地离线使用
      this.worker = new Worker(
        new URL('./excel.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<ParseEvent>) => {
        const msg = event.data;

        // 卫语句：进度变更回调
        if (msg.type === 'progress') {
          onProgress(msg.percent);
          return;
        }

        // 卫语句：错误捕获
        if (msg.type === 'error') {
          this.terminate();
          reject(new Error(msg.message));
          return;
        }

        // 卫语句：解析完成返回
        if (msg.type === 'success') {
          this.terminate();
          resolve({
            sheets: msg.sheets,
            data: msg.data,
            columns: msg.columns
          });
        }
      };

      const reader = new FileReader();
      reader.onload = (e) => {
        // 卫语句：检验读取内容
        if (!e.target?.result) {
          reject(new Error('无法读取文件内容'));
          return;
        }
        this.worker?.postMessage({ fileBuffer: e.target.result });
      };
      reader.onerror = () => reject(new Error('文件读取出错'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 中止当前解析任务
   */
  cancel(): void {
    // 卫语句：未在解析中则直接返回
    if (!this.worker) {
      return;
    }
    this.terminate();
  }

  private terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const excelParser = new ExcelParser();
export default excelParser;
