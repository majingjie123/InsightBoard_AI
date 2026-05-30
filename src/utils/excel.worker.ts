import * as XLSX from 'xlsx';

self.onmessage = async (e) => {
  const { fileBuffer } = e.data;
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 卫语句：校验工作表内容是否存在
    const ref = worksheet['!ref'];
    if (!ref) {
      self.postMessage({ type: 'error', message: 'Excel 工作表为空' });
      return;
    }
    const range = XLSX.utils.decode_range(ref);
    const totalRows = range.e.r - range.s.r;

    const batchSize = 1000; // 每批分片读取 1000 行
    const rawData: any[] = [];

    // 逐批提取
    for (let i = 1; i <= totalRows; i += batchSize) {
      const currentRange = {
        s: { c: range.s.c, r: i },
        e: { c: range.e.c, r: Math.min(i + batchSize - 1, totalRows) }
      };
      
      const subSheet = {};
      Object.assign(subSheet, worksheet, {
        '!ref': XLSX.utils.encode_range(currentRange)
      });

      const chunk = XLSX.utils.sheet_to_json(subSheet, { header: 1 });
      
      for (const row of chunk) {
        if (row && Object.keys(row).length > 0) {
          rawData.push(row);
        }
      }

      // 计算进度百分比并推送
      const percent = Math.min(Math.round((i / totalRows) * 100), 99);
      self.postMessage({ type: 'progress', percent });
      
      // 释放 CPU 阻塞
      await new Promise(r => setTimeout(r, 10));
    }

    const headerRow = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as any[]) || [];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const inferType = (val: any): 'string' | 'number' | 'date' => {
      if (val === null || val === undefined) return 'string';
      if (typeof val === 'number') return 'number';
      if (val instanceof Date) return 'date';
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return 'date';
      return 'string';
    };

    const columns = headerRow.map(key => {
      const sampleRow = (jsonData[0] as any) || {};
      return {
        name: String(key),
        type: inferType(sampleRow[key])
      };
    });

    self.postMessage({
      type: 'success',
      sheets: workbook.SheetNames,
      data: jsonData,
      columns
    });
  } catch (err: any) {
    self.postMessage({ type: 'error', message: err.message || '文件解析发生未知错误' });
  }
};
