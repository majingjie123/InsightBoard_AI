import React, { useState, useMemo, useEffect } from 'react';
import { TableConfig } from '../../types/board';
import { Dataset } from '../../types/dataset';
import cellFormatter from '../../core/strategies/CellFormatterStrategy';
import { Search, AlertCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// 为了防止类型报错，先将校验器在当前模块直接声明或从 elsewhere 导入。
// 之前我们在 6.5 节的 replace 中把 FormInputValidator 写到了 CellFormatterStrategy 后面（实际上是在 docs/development.md 中，但是在 types/ 后面我们没有真正的 FormInputValidator TS 实现。我们可以直接在 DataTable.tsx 中编写它，或者把它直接提取出来）。
// 我们这里直接实现一个简易的 FormInputValidator 并在当前文件使用，或者直接使用我们在 6.5 设计的逻辑：
class TablePageValidator {
  static validateAndCorrectPage(
    inputPageText: string,
    totalPages: number,
    onAlert: (msg: string) => void
  ): number {
    const pageNum = parseInt(inputPageText, 10);
    // 卫语句：拦截非数字非法输入
    if (isNaN(pageNum)) {
      onAlert('请输入有效的页码');
      return 1;
    }
    // 卫语句：超下界修正
    if (pageNum < 1) {
      onAlert('页码超出范围，已自动调整');
      return 1;
    }
    // 卫语句：超上界修正
    if (pageNum > totalPages) {
      onAlert('页码超出范围，已自动调整');
      return totalPages;
    }
    return pageNum;
  }
}

interface DataTableProps {
  config: TableConfig;
  dataset: Dataset | null;
  name: string;
  onUpdateConfig?: (newConfig: Partial<TableConfig>) => void;
  isReadOnly?: boolean;
}

export const DataTable: React.FC<DataTableProps> = ({
  config,
  dataset,
  name,
  onUpdateConfig,
  isReadOnly = false
}) => {
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(config.pageSize || 20);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [pageInputVal, setPageInputVal] = useState('1');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // 本地保存拖拽的列宽
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(config.columnWidths || {});

  // 每当配置里的 pageSize 或 columnWidths 改变时，同步更新本地状态
  useEffect(() => {
    if (config.pageSize) {
      setPageSize(config.pageSize);
    }
    if (config.columnWidths) {
      setColumnWidths(config.columnWidths);
    }
  }, [config.pageSize, config.columnWidths]);

  // 重置分页
  useEffect(() => {
    setCurrentPage(1);
    setPageInputVal('1');
  }, [searchText, sortField, sortOrder, pageSize, dataset]);

  // 1. 数据校验与错误状态
  const errorState = useMemo(() => {
    if (!dataset) return 'no-source';
    return 'none';
  }, [dataset]);

  // 2. 字段提取（过滤隐藏列）
  const visibleColumns = useMemo(() => {
    if (!dataset) return [];
    const hidden = config.hiddenColumns || [];
    return dataset.columns.filter(col => !hidden.includes(col.name));
  }, [dataset, config.hiddenColumns]);

  // 3. 数据过滤 (全局模糊搜索)
  const filteredData = useMemo(() => {
    if (!dataset) return [];
    
    // 卫语句：自动过滤掉内容与表头完全一致的冗余数据行（防止导入时重复包含标题）
    const rawData = dataset.data.filter(row => {
      // 只有当所有列的值都等于列名时，才判定为冗余表头行
      return !dataset.columns.every(col => String(row[col.name]) === col.name);
    });

    if (!searchText.trim()) return rawData;

    const query = searchText.toLowerCase().trim();
    return rawData.filter(row => {
      // 遍历所有可见列做文本模糊匹配
      return visibleColumns.some(col => {
        const val = row[col.name];
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      });
    });
  }, [dataset, searchText, visibleColumns]);

  // 4. 数据全量排序
  const sortedData = useMemo(() => {
    const dataCopy = [...filteredData];
    // 卫语句：未开启排序，直接返回
    if (!sortField || !sortOrder) {
      return dataCopy;
    }

    const col = dataset?.columns.find(c => c.name === sortField);
    const colType = col?.type || 'string';

    dataCopy.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      // 卫语句：处理空值
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

      // 默认文本排序
      const strA = String(valA).localeCompare(String(valB), 'zh');
      return sortOrder === 'asc' ? strA : -strA;
    });

    return dataCopy;
  }, [filteredData, sortField, sortOrder, dataset]);

  // 5. 分页计算 (仅加载渲染当前页，保证十万级大数据的流畅度)
  const totalItems = sortedData.length;
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);

  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return sortedData.slice(startIdx, startIdx + pageSize);
  }, [sortedData, currentPage, pageSize]);

  // 处理页码提示消息定时隐藏
  const showAlertMessage = (msg: string) => {
    setAlertMessage(msg);
    setTimeout(() => {
      setAlertMessage(null);
    }, 2500);
  };

  // 页码跳转控制
  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPage = TablePageValidator.validateAndCorrectPage(
      pageInputVal,
      totalPages,
      showAlertMessage
    );
    setCurrentPage(targetPage);
    setPageInputVal(String(targetPage));
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const next = currentPage - 1;
      setCurrentPage(next);
      setPageInputVal(String(next));
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      setPageInputVal(String(next));
    }
  };

  // 列排序切换
  const handleSort = (fieldName: string) => {
    if (sortField !== fieldName) {
      setSortField(fieldName);
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else {
      setSortField(null);
      setSortOrder(null);
    }
  };

  // 拖拽调整列宽
  const handleResizeStart = (e: React.MouseEvent, columnName: string) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startWidth = columnWidths[columnName] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + deltaX);
      setColumnWidths(prev => ({
        ...prev,
        [columnName]: newWidth
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // 在非只读模式下保存到快照中
      if (!isReadOnly && onUpdateConfig) {
        setColumnWidths(currentWidths => {
          onUpdateConfig({ columnWidths: { ...currentWidths } });
          return currentWidths;
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 6. 单元格样式与高亮配置
  const rowHeightClass = useMemo(() => {
    const rowHeight = config.style?.rowHeight || 'standard';
    if (rowHeight === 'compact') return 'py-1.5 px-2 text-xs';
    if (rowHeight === 'loose') return 'py-3.5 px-4 text-base';
    return 'py-2.5 px-3 text-sm';
  }, [config.style?.rowHeight]);

  const stripeClass = (index: number) => {
    if (config.style?.stripe && index % 2 === 1) {
      return 'bg-slate-50/70 hover:bg-slate-100/80';
    }
    return 'bg-white hover:bg-slate-50';
  };

  // 7. UI 渲染与异常遮罩
  return (
    <div className="relative w-full h-full bg-white rounded border border-slate-200/80 flex flex-col p-4 shadow-sm group/table">
      {/* 顶部工具栏: 标题与搜索 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 pb-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-800 truncate" title={name}>
          {name}
        </span>
        
        {dataset && (
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索表格数据..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-700"
            />
          </div>
        )}
      </div>

      {/* 表格主体容器 (带横向/纵向双向滚动) */}
      <div className="flex-1 w-full overflow-auto border border-slate-100 rounded relative min-h-0">
        {errorState === 'none' && dataset ? (
          <table className="w-full text-left border-collapse table-fixed" style={{ fontSize: (config.style?.fontSize || 14) + 'px' }}>
            <thead className="sticky top-0 bg-slate-100 text-slate-600 font-semibold z-10 select-none" style={{ backgroundColor: config.style?.headerBg || '#f1f5f9' }}>
              <tr>
                {visibleColumns.map((col) => {
                  const width = columnWidths[col.name] || 150;
                  return (
                    <th
                      key={col.name}
                      style={{ width, fontSize: (config.style?.fontSize || 14) + 'px' }}
                      onClick={() => handleSort(col.name)}
                      className="relative p-2.5 text-xs font-semibold text-slate-600 border-b border-slate-200 cursor-pointer hover:bg-slate-200/50 transition-colors truncate"
                    >
                      <div className="flex items-center gap-1">
                        <span className="truncate">{col.name}</span>
                        {sortField === col.name ? (
                          sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                        ) : null}
                      </div>

                      {/* 拖拽列宽 Handlers */}
                      {!isReadOnly && (
                        <div
                          onMouseDown={(e) => handleResizeStart(e, col.name)}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/80 transition-colors z-20"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, rIdx) => (
                  <tr key={rIdx} className={`border-b border-slate-100 transition-colors ${stripeClass(rIdx)}`}>
                    {visibleColumns.map((col) => {
                      const formatterConfig = config.columnFormatters[col.name] || { type: col.type };
                      const formattedVal = cellFormatter.format(row[col.name], {
                        type: col.type === 'string' ? 'text' : col.type,
                        precision: formatterConfig.precision,
                        useGrouping: formatterConfig.useGrouping,
                        dateFormat: formatterConfig.dateFormat
                      });

                      return (
                        <td
                          key={col.name}
                          className={`${rowHeightClass} text-slate-700 truncate`}
                          title={String(row[col.name] ?? '')}
                          style={{ fontSize: (config.style?.fontSize || 14) + 'px' }}
                        >
                          {formattedVal}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-8 text-xs text-slate-400" style={{ fontSize: (config.style?.fontSize || 14) + 'px' }}>
                    暂无匹配数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : null}

        {/* 异常状态：数据源已失效 */}
        {errorState === 'no-source' && (
          <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-[1px] flex flex-col items-center justify-center text-center p-4">
            <AlertCircle size={28} className="text-slate-400 mb-2" />
            <span className="text-sm font-medium text-slate-600">数据源已失效</span>
            <span className="text-xs text-slate-400 mt-1">关联的数据集已被删除或不可用</span>
          </div>
        )}
      </div>

      {/* 底部导航栏 */}
      {errorState === 'none' && dataset && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div>
            共计 <span className="font-semibold text-slate-700">{totalItems}</span> 条记录
            {searchText && ` (已从 ${dataset.data.length} 条中筛选)`}
          </div>

          <div className="flex items-center gap-4">
            {/* 页码与表单跳转 */}
            <form onSubmit={handlePageSubmit} className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-1 rounded border border-slate-200 disabled:opacity-50 hover:bg-slate-50 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={14} />
              </button>
              
              <span className="ml-1 text-slate-400">第</span>
              <input
                type="text"
                value={pageInputVal}
                onChange={(e) => setPageInputVal(e.target.value)}
                className="w-10 text-center py-0.5 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-400">页 / 共 {totalPages} 页</span>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-1 rounded border border-slate-200 disabled:opacity-50 hover:bg-slate-50 disabled:hover:bg-transparent"
              >
                <ChevronRight size={14} />
              </button>
            </form>

            {/* 超出范围文字气泡提示 */}
            {alertMessage && (
              <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow absolute bottom-12 right-4 transition-all animate-bounce">
                {alertMessage}
              </div>
            )}

            {/* 每页条数选择 */}
            <div className="flex items-center gap-1">
              <span>每页</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  setPageSize(size);
                  if (onUpdateConfig) {
                    onUpdateConfig({ pageSize: size });
                  }
                }}
                className="py-0.5 px-1 border border-slate-200 rounded bg-transparent focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>条</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default DataTable;
