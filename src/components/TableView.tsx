import React, { useState, useMemo } from 'react';
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown, Filter, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Download, Eye, EyeOff, Hash, Calendar, Type,
  CheckSquare, Plus, ShieldAlert, Copy, Check, Trash2, Edit2, Laptop, AlertTriangle,
  UserCheck
} from 'lucide-react';
import { Dataset, DataType } from '../types';
import { exportDatasetToCsv, insertRecordForUserInDataset } from '../utils/dataProcessor';
import { AddEquipmentModal } from './AddEquipmentModal';
import { WarehouseTableView } from './WarehouseTableView';

interface TableViewProps {
  dataset: Dataset;
  onUpdateRows?: (updatedRows: Record<string, any>[]) => void;
}

export const TableView: React.FC<TableViewProps> = ({ dataset, onUpdateRows }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showStatsRow, setShowStatsRow] = useState(true);
  const [columnFilter, setColumnFilter] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [filledIssuerNotification, setFilledIssuerNotification] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRowData, setEditingRowData] = useState<Record<string, any> | null>(null);
  const [activeSheetTab, setActiveSheetTab] = useState<'employees' | 'warehouse'>('employees');

  // Column name detection
  const pcIdCol = dataset.columns.find((c) => /идентификатор|доменный|пк/i.test(c)) || dataset.columns[0];
  const typeCol = dataset.columns.find((c) => /тип/i.test(c)) || '';
  const movementCol = dataset.columns.find((c) => /движени/i.test(c)) || '';
  const userCol = dataset.columns.find((c) => /имя пользователя|фио|пользователь|сотрудник/i.test(c)) || '';
  const issuerCol = dataset.columns.find((c) => /кто выдал|выдал|ответственный/i.test(c)) || 'Кто выдал';

  // Duplicate PC ID calculation
  const duplicatePcIds = useMemo(() => {
    if (!pcIdCol) return new Set<string>();
    const counts = new Map<string, number>();

    dataset.rows.forEach((r) => {
      const raw = r[pcIdCol];
      if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
        const key = String(raw).trim().toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    const dupes = new Set<string>();
    counts.forEach((count, key) => {
      if (count > 1) {
        dupes.add(key);
      }
    });

    return dupes;
  }, [dataset.rows, pcIdCol]);

  // Handle Sort
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filtered & Sorted Rows
  const filteredAndSortedRows = useMemo(() => {
    let result = dataset.rows.map((row, originalIndex) => ({
      ...row,
      __originalIndex: originalIndex,
    }));

    // Category Filter
    if (selectedCategory !== 'all' && typeCol) {
      const catLower = selectedCategory.toLowerCase();
      result = result.filter((row) => {
        const val = row[typeCol];
        return val && String(val).toLowerCase().includes(catLower);
      });
    }

    // Only Duplicates Filter
    if (onlyDuplicates && pcIdCol) {
      result = result.filter((row) => {
        const val = row[pcIdCol];
        if (!val) return false;
        return duplicatePcIds.has(String(val).trim().toLowerCase());
      });
    }

    // Global Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((row) =>
        Object.entries(row).some(([key, val]) => {
          if (key === '__originalIndex') return false;
          return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
        })
      );
    }

    // Column-specific filter
    Object.entries(columnFilter).forEach(([col, filterVal]) => {
      if (filterVal.trim()) {
        const q = filterVal.toLowerCase();
        result = result.filter((row) => {
          const val = row[col];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
        });
      }
    });

    // Sorting
    if (sortColumn) {
      const meta = dataset.columnMeta[sortColumn];
      const isNum = meta?.type === 'number' || meta?.type === 'currency' || meta?.type === 'percentage';

      result.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];

        if (valA === null || valA === undefined || valA === '') return 1;
        if (valB === null || valB === undefined || valB === '') return -1;

        if (isNum) {
          const nA = typeof valA === 'number' ? valA : parseFloat(String(valA).replace(/[^\d.-]/g, ''));
          const nB = typeof valB === 'number' ? valB : parseFloat(String(valB).replace(/[^\d.-]/g, ''));
          return sortDirection === 'asc' ? nA - nB : nB - nA;
        }

        const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
        return sortDirection === 'asc' ? comp : -comp;
      });
    }

    return result;
  }, [
    dataset.rows,
    selectedCategory,
    typeCol,
    onlyDuplicates,
    pcIdCol,
    duplicatePcIds,
    searchTerm,
    columnFilter,
    sortColumn,
    sortDirection,
    dataset.columnMeta,
  ]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  // Add new row handler (grouped directly with the employee's existing records)
  const handleAddRow = (newRow: Record<string, any>) => {
    if (!onUpdateRows) return;
    const updated = insertRecordForUserInDataset(dataset.rows, newRow, dataset.columns);
    onUpdateRows(updated);
  };

  // Delete row handler
  const handleDeleteRow = (originalIndex: number) => {
    if (!onUpdateRows) return;
    const item = dataset.rows[originalIndex];
    const confirmName = item?.[pcIdCol] || item?.[userCol] || `строку #${originalIndex + 1}`;
    if (window.confirm(`Вы действительно хотите удалить запись «${confirmName}»?`)) {
      const updated = dataset.rows.filter((_, idx) => idx !== originalIndex);
      onUpdateRows(updated);
    }
  };

  // Save inline edit
  const handleSaveInlineEdit = (originalIndex: number) => {
    if (!onUpdateRows || !editingRowData) return;
    const updated = [...dataset.rows];
    updated[originalIndex] = { ...editingRowData };
    onUpdateRows(updated);
    setEditingRowIndex(null);
    setEditingRowData(null);
  };

  // Bulk fill "Кто выдал" with "Зохид Зокиров" across all rows
  const handleFillAllIssuer = () => {
    if (!onUpdateRows) return;
    const targetCol = issuerCol || 'Кто выдал';
    const updated = dataset.rows.map((row) => ({
      ...row,
      [targetCol]: 'Зохид Зокиров',
    }));
    onUpdateRows(updated);
    setFilledIssuerNotification(true);
    setTimeout(() => setFilledIssuerNotification(false), 3000);
  };

  // Copy to clipboard for Google Sheets (TSV format)
  const handleCopyToClipboard = () => {
    const headers = dataset.columns.join('\t');
    const rows = dataset.rows.map((r) =>
      dataset.columns
        .map((c) => {
          const val = r[c];
          return val === null || val === undefined ? '' : String(val).replace(/\t/g, ' ');
        })
        .join('\t')
    );
    const tsvContent = [headers, ...rows].join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    });
  };

  const getTypeIcon = (type: DataType) => {
    switch (type) {
      case 'number':
      case 'currency':
      case 'percentage':
        return <Hash className="w-3 h-3 text-purple-400" />;
      case 'date':
        return <Calendar className="w-3 h-3 text-amber-400" />;
      case 'boolean':
        return <CheckSquare className="w-3 h-3 text-emerald-400" />;
      default:
        return <Type className="w-3 h-3 text-blue-400" />;
    }
  };

  const formatCellValue = (val: any, colName: string, type: DataType) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-slate-600 italic text-2xs">(пусто)</span>;
    }

    // Status badges for Движения
    if (colName === movementCol) {
      const v = String(val).trim();
      if (v === 'Сдал') {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold bg-amber-950/80 border border-amber-700/80 text-amber-300">
            {v}
          </span>
        );
      }
      if (v === 'Принял') {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold bg-emerald-950/80 border border-emerald-700/80 text-emerald-300">
            {v}
          </span>
        );
      }
      if (v === 'Новый') {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold bg-blue-950/80 border border-blue-700/80 text-blue-300">
            {v}
          </span>
        );
      }
    }

    // Highlighting PC ID duplicates
    if (colName === pcIdCol) {
      const isDupe = duplicatePcIds.has(String(val).trim().toLowerCase());
      return (
        <span className="flex items-center gap-1.5 font-mono text-xs">
          <span className={isDupe ? 'text-rose-300 font-bold' : 'text-slate-200'}>{String(val)}</span>
          {isDupe && (
            <span
              title="Внимание: Этот Доменный номер / Идентификатор ПК повторяется в таблице!"
              className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-rose-950 border border-rose-800 text-rose-300 rounded text-3xs font-sans font-medium"
            >
              <AlertTriangle className="w-2.5 h-2.5 text-rose-400" />
              Дубликат ID
            </span>
          )}
        </span>
      );
    }

    if (type === 'currency' && typeof val === 'number') {
      return <span>{val.toLocaleString('ru-RU')} ₽</span>;
    }

    if (typeof val === 'number') {
      return <span>{val.toLocaleString('ru-RU')}</span>;
    }

    return String(val);
  };

  const CATEGORY_PILLS = [
    { key: 'all', label: 'Все' },
    { key: 'ноутбук', label: '💻 Ноутбуки' },
    { key: 'монитор', label: '🖥️ Мониторы' },
    { key: 'мышь', label: '🖱️ Мыши' },
    { key: 'клавиатур', label: '⌨️ Клавиатуры' },
    { key: 'гарнитур', label: '🎧 Гарнитуры' },
    { key: 'сумка', label: '🎒 Рюкзаки / Сумки' },
    { key: 'hub', label: '🔌 USB Type-C Hub' },
    { key: 'фильтр', label: '⚡ Сетевые фильтры' },
    { key: 'производ', label: '🏭 Произв. оборуд.' },
  ];

  return (
    <div className="space-y-4">
      {/* Google Sheets Dual-Tab Selector */}
      <div className="flex items-center justify-between bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSheetTab('employees')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeSheetTab === 'employees'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>📋 Лист1: Оборудование сотрудников</span>
            <span className={`px-2 py-0.5 rounded-full text-2xs ${activeSheetTab === 'employees' ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300'}`}>
              {dataset.totalRows}
            </span>
          </button>

          <button
            onClick={() => setActiveSheetTab('warehouse')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeSheetTab === 'warehouse'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <span>🏢 Лист «Склад»: Приход и учет остатков</span>
            <span className={`px-2 py-0.5 rounded-full text-2xs ${activeSheetTab === 'warehouse' ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-slate-300'}`}>
              8 колонок
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-2xs text-slate-400 px-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Два листа синхронизированы в Google Таблице</span>
        </div>
      </div>

      {activeSheetTab === 'warehouse' ? (
        <WarehouseTableView
          spreadsheetUrl={dataset.sourceUrl}
          onRowIssuedToUser={() => {
            // Trigger refresh
            if (onUpdateRows) {
              fetch('/api/inventory/state')
                .then(r => r.json())
                .then(d => {
                  if (d.success && d.rows) onUpdateRows(d.rows);
                })
                .catch(() => {});
            }
          }}
        />
      ) : (
        <>
          {/* Duplicate ID Audit Banner */}
      {duplicatePcIds.size > 0 && (
        <div className="p-3.5 bg-rose-950/70 border border-rose-800/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start sm:items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <div className="text-xs sm:text-sm font-semibold text-rose-200">
                Контроль уникальности: обнаружено {duplicatePcIds.size} повторяющихся Идентификаторов ПК (доменных номеров)
              </div>
              <div className="text-2xs text-rose-300/80">
                По правилам учета каждый доменный номер ноутбука должен быть строго уникален
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setOnlyDuplicates(!onlyDuplicates);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                onlyDuplicates
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-rose-900/80 hover:bg-rose-800 text-rose-100 border border-rose-700'
              }`}
            >
              {onlyDuplicates ? 'Показать все строки' : `Показать только дубликаты (${duplicatePcIds.size})`}
            </button>
          </div>
        </div>
      )}

      {/* Quick Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {CATEGORY_PILLS.map((pill) => {
          const isActive = selectedCategory === pill.key;
          return (
            <button
              key={pill.key}
              onClick={() => {
                setSelectedCategory(pill.key);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap font-medium transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Main Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Поиск по ФИО, модели, серийнику, ID..."
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          
          {/* Add Entry Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить запись</span>
          </button>

          {/* Quick Fill Issuer Button */}
          {onUpdateRows && (
            <button
              onClick={handleFillAllIssuer}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filledIssuerNotification
                  ? 'bg-emerald-950/90 border-emerald-600 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
              title="Записать во все строки «Кто выдал: Зохид Зокиров»"
            >
              {filledIssuerNotification ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold">«Зохид Зокиров» заполнен во всех строках!</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Заполнить «Кто выдал: Зохид Зокиров»</span>
                </>
              )}
            </button>
          )}

          {/* Copy for Google Sheets */}
          <button
            onClick={handleCopyToClipboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            title="Скопировать таблицу для вставки в Google Sheets"
          >
            {copiedNotification ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Скопировано!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Для Google Таблиц</span>
              </>
            )}
          </button>

          {/* Stats Toggle */}
          <button
            onClick={() => setShowStatsRow(!showStatsRow)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showStatsRow
                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {showStatsRow ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showStatsRow ? 'Скрыть статистику' : 'Статистика'}</span>
          </button>

          {/* CSV Export */}
          <button
            onClick={() => exportDatasetToCsv(dataset, `${dataset.title || 'export'}_table.csv`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>CSV</span>
          </button>
        </div>

      </div>

      {/* Main Table Container */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-950/95 border-b border-slate-800 shadow-sm backdrop-blur-md">
              <tr>
                <th className="p-3 text-2xs font-semibold text-slate-400 uppercase tracking-wider w-12 text-center border-r border-slate-800/80">
                  #
                </th>
                {dataset.columns.map((col) => {
                  const meta = dataset.columnMeta[col];
                  const isSorted = sortColumn === col;
                  const isPcCol = col === pcIdCol;

                  return (
                    <th
                      key={col}
                      className="p-3 font-medium text-slate-200 select-none hover:bg-slate-900/80 transition-colors border-r border-slate-800/60 last:border-r-0 min-w-[150px]"
                    >
                      <div
                        className="flex items-center justify-between gap-2 cursor-pointer"
                        onClick={() => handleSort(col)}
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          {getTypeIcon(meta?.type || 'string')}
                          <span className={`font-semibold truncate ${isPcCol ? 'text-emerald-300' : 'text-slate-100'}`} title={col}>
                            {col}
                          </span>
                        </div>
                        <div className="text-slate-500 hover:text-slate-300">
                          {isSorted ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                          )}
                        </div>
                      </div>

                      {/* Column filter input */}
                      <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          placeholder="Фильтр..."
                          value={columnFilter[col] || ''}
                          onChange={(e) => {
                            setColumnFilter({ ...columnFilter, [col]: e.target.value });
                            setCurrentPage(1);
                          }}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-2xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-normal"
                        />
                      </div>
                    </th>
                  );
                })}
                {onUpdateRows && (
                  <th className="p-3 text-2xs font-semibold text-slate-400 uppercase tracking-wider w-20 text-center">
                    Действия
                  </th>
                )}
              </tr>

              {/* Statistics summary row if active */}
              {showStatsRow && (
                <tr className="bg-slate-950/80 border-b border-slate-800 text-2xs text-slate-400">
                  <td className="p-2 text-center font-mono text-slate-500 border-r border-slate-800">Σ</td>
                  {dataset.columns.map((col) => {
                    const meta = dataset.columnMeta[col];
                    if (!meta) return <td key={col} className="p-2 border-r border-slate-800"></td>;

                    if (meta.stats) {
                      return (
                        <td key={col} className="p-2 border-r border-slate-800/60 font-mono">
                          <div className="space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Ср:</span>
                              <span className="text-slate-300 font-medium">{meta.stats.avg?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-2xs">
                              <span className="text-slate-500">Сум:</span>
                              <span className="text-emerald-400 font-medium">{meta.stats.sum?.toLocaleString()}</span>
                            </div>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={col} className="p-2 border-r border-slate-800/60 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Уник:</span>
                          <span className="text-blue-300 font-medium">{meta.uniqueCount}</span>
                        </div>
                      </td>
                    );
                  })}
                  {onUpdateRows && <td className="p-2"></td>}
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={dataset.columns.length + (onUpdateRows ? 2 : 1)} className="p-8 text-center text-slate-500">
                    Нет строк, соответствующих условиям поиска или фильтрации
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, rIdx) => {
                  const actualIndex = (currentPage - 1) * pageSize + rIdx + 1;
                  const originalIndex = row.__originalIndex;
                  const isEditingThisRow = editingRowIndex === originalIndex;
                  const isDupe = pcIdCol && duplicatePcIds.has(String(row[pcIdCol] || '').trim().toLowerCase());

                  if (isEditingThisRow && editingRowData) {
                    return (
                      <tr key={rIdx} className="bg-emerald-950/30 border-y border-emerald-600/50">
                        <td className="p-2.5 text-center text-emerald-400 font-mono text-2xs border-r border-slate-800">
                          {actualIndex}
                        </td>
                        {dataset.columns.map((col) => (
                          <td key={col} className="p-1.5 border-r border-slate-800/40">
                            <input
                              type="text"
                              value={editingRowData[col] ?? ''}
                              onChange={(e) =>
                                setEditingRowData({ ...editingRowData, [col]: e.target.value })
                              }
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                        ))}
                        <td className="p-2 text-center whitespace-nowrap space-x-1">
                          <button
                            onClick={() => handleSaveInlineEdit(originalIndex)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-2xs font-semibold"
                          >
                            Сохранить
                          </button>
                          <button
                            onClick={() => {
                              setEditingRowIndex(null);
                              setEditingRowData(null);
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-2xs"
                          >
                            Отмена
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={rIdx}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isDupe ? 'bg-rose-950/15 border-l-2 border-rose-500' : ''
                      }`}
                    >
                      <td className="p-2.5 text-center text-slate-500 font-mono text-2xs border-r border-slate-800/60">
                        {actualIndex}
                      </td>
                      {dataset.columns.map((col) => {
                        const meta = dataset.columnMeta[col];
                        const val = row[col];
                        return (
                          <td
                            key={col}
                            className="p-2.5 text-slate-200 border-r border-slate-800/40 last:border-r-0 max-w-xs truncate"
                            title={String(val ?? '')}
                          >
                            {formatCellValue(val, col, meta?.type || 'string')}
                          </td>
                        );
                      })}
                      {onUpdateRows && (
                        <td className="p-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setEditingRowIndex(originalIndex);
                                setEditingRowData({ ...row });
                              }}
                              className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"
                              title="Редактировать запись"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(originalIndex)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                              title="Удалить запись"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Строк на странице:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-500 ml-2">
              Показано {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filteredAndSortedRows.length)} из {filteredAndSortedRows.length} строк
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800 cursor-pointer"
              title="Первая страница"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800 cursor-pointer"
              title="Предыдущая страница"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono text-slate-300 text-xs">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800 cursor-pointer"
              title="Следующая страница"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800 cursor-pointer"
              title="Последняя страница"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Add Equipment Modal */}
      <AddEquipmentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        dataset={dataset}
        onAddRow={handleAddRow}
      />
        </>
      )}

    </div>
  );
};
