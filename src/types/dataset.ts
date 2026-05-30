export interface ColumnInfo {
  name: string;
  type: 'string' | 'number' | 'date';
}

export interface Dataset {
  id: string;
  spaceId: string;
  name: string;
  fileName: string;
  sheetName: string;
  rowCount: number;
  columns: ColumnInfo[];
  data: any[]; // 结构化数据：JSON 对象数组
  createdAt: Date;
}
