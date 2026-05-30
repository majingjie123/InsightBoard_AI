import React from 'react';

export interface Column<T> {
  key: string;
  title: string;
  render?: (row: T, index: number) => React.ReactNode;
  width?: string | number;
}

export interface TableProps<T = any> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  stripe?: boolean;
  rowHeight?: 'compact' | 'standard' | 'loose';
}

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  loading = false,
  stripe = true,
  rowHeight = 'standard'
}) => {
  const heightStyles = {
    compact: 'py-1.5 px-3',
    standard: 'py-2 px-4',
    loose: 'py-3.5 px-4'
  };

  return (
    <div className="w-full overflow-x-auto border border-slate-200 rounded-lg shadow-sm bg-white">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className="font-semibold text-slate-500 py-3 px-4 select-none"
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-slate-400">
                加载中...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-slate-400">
                暂无数据
              </td>
            </tr>
          ) : (
            data.map((row, rIdx) => (
              <tr
                key={rIdx}
                className={stripe && rIdx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${heightStyles[rowHeight]} border-b border-slate-100 truncate`}
                  >
                    {col.render ? col.render(row, rIdx) : (row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
