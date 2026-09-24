import React, { useState, useEffect } from 'react';
import { X, Plus, AlertTriangle, Check, Laptop, ShieldAlert, Clock, UserCheck } from 'lucide-react';
import { Dataset } from '../types';

interface AddEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: Dataset;
  onAddRow: (newRow: Record<string, any>) => void;
}

export const EQUIPMENT_TYPES = [
  'Ноутбук',
  'Монитор',
  'Мышь',
  'Клавиатура',
  'Гарнитура',
  'Сумка / Рюкзак',
  'USB Type-C Hub',
  'Сетевой фильтр',
  'Производственное оборудование',
];

export const MOVEMENT_STATUSES = [
  'Новый',
  'Принял',
  'Сдал',
];

export const DEFAULT_ISSUER = 'Зохид Зокиров';

// Helper to format date as DD.MM.YYYY HH:mm:ss
export function getCurrentTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = pad(now.getDate());
  const m = pad(now.getMonth() + 1);
  const y = now.getFullYear();
  const hr = pad(now.getHours());
  const min = pad(now.getMinutes());
  const sec = pad(now.getSeconds());
  return `${d}.${m}.${y} ${hr}:${min}:${sec}`;
}

export const AddEquipmentModal: React.FC<AddEquipmentModalProps> = ({
  isOpen,
  onClose,
  dataset,
  onAddRow,
}) => {
  const [pcId, setPcId] = useState('');
  const [userName, setUserName] = useState('');
  const [position, setPosition] = useState('');
  const [type, setType] = useState(EQUIPMENT_TYPES[0]);
  const [customType, setCustomType] = useState('');
  const [brand, setBrand] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [timestamp, setTimestamp] = useState(getCurrentTimestamp());
  const [issuer, setIssuer] = useState(DEFAULT_ISSUER);
  const [movement, setMovement] = useState<string>('Новый');
  const [notes, setNotes] = useState('');

  // Auto-refresh timestamp when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimestamp(getCurrentTimestamp());
      setPcId('');
      setUserName('');
      setPosition('');
      setType(EQUIPMENT_TYPES[0]);
      setCustomType('');
      setBrand('');
      setSerialNumber('');
      setIssuer(DEFAULT_ISSUER);
      setMovement('Новый');
      setNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Find column name mappings in dataset
  const pcIdCol = dataset.columns.find((c) => /идентификатор|доменный|пк/i.test(c)) || 'Идентификатор ПК';
  const userCol = dataset.columns.find((c) => /имя пользователя|фио|пользователь|сотрудник/i.test(c)) || 'Имя пользователя';
  const positionCol = dataset.columns.find((c) => /должность|подразделение|отдел/i.test(c)) || 'Должность';
  const typeCol = dataset.columns.find((c) => /тип/i.test(c)) || 'Тип';
  const brandCol = dataset.columns.find((c) => /марка|модель/i.test(c)) || 'Марка';
  const snCol = dataset.columns.find((c) => /s\/n|серийный|sn/i.test(c)) || 'S/N';
  const timeCol = dataset.columns.find((c) => /отметка|время|дата/i.test(c)) || 'Отметка времени';
  const issuerCol = dataset.columns.find((c) => /кто выдал|выдал|ответственный/i.test(c)) || 'Кто выдал';
  const movementCol = dataset.columns.find((c) => /движени/i.test(c)) || 'Движения';
  const notesCol = dataset.columns.find((c) => /запись|комментар|примечан/i.test(c)) || 'Запись';

  // Dynamic types list combining dataset existing types + standard types
  const availableTypes = React.useMemo(() => {
    const typeSet = new Set<string>();
    dataset.rows.forEach((r) => {
      const val = r[typeCol];
      if (val !== null && val !== undefined) {
        const str = String(val).trim();
        if (str && str !== '—' && str !== '-' && str.toLowerCase() !== 'пусто') {
          typeSet.add(str);
        }
      }
    });
    const existing = Array.from(typeSet);
    EQUIPMENT_TYPES.forEach((et) => {
      if (!existing.some((e) => e.toLowerCase() === et.toLowerCase())) {
        existing.push(et);
      }
    });
    return existing;
  }, [dataset, typeCol]);

  // Dynamic brand suggestions extracted from current dataset filtered by selected type
  const availableBrandSuggestions = React.useMemo(() => {
    const brandCounts = new Map<string, number>();
    const selectedTypeLower = type.toLowerCase().trim();

    // Stem matching keywords
    const stemKeywords: string[] = [];
    if (/мыш/i.test(selectedTypeLower)) stemKeywords.push('мыш', 'mouse');
    if (/монит/i.test(selectedTypeLower)) stemKeywords.push('монит', 'monitor', 'диспл', 'экран');
    if (/ноут/i.test(selectedTypeLower)) stemKeywords.push('ноут', 'laptop', 'book');
    if (/клав/i.test(selectedTypeLower)) stemKeywords.push('клав', 'keyboard');
    if (/гарнит|науш/i.test(selectedTypeLower)) stemKeywords.push('гарнит', 'науш', 'headset');
    if (/hub|хаб|type-c/i.test(selectedTypeLower)) stemKeywords.push('hub', 'хаб', 'type-c', 'док');
    if (/фильтр|сетев/i.test(selectedTypeLower)) stemKeywords.push('фильтр', 'сетев', 'удлин');
    if (/сумк|рюкзак/i.test(selectedTypeLower)) stemKeywords.push('сумк', 'рюкзак', 'bag');
    if (/производ|тсд|принтер|сканер/i.test(selectedTypeLower)) stemKeywords.push('производ', 'тсд', 'принтер', 'сканер', 'tsc', 'zebra', 'honeywell');

    dataset.rows.forEach((row) => {
      const rowType = String(row[typeCol] || '').toLowerCase().trim();
      const b = String(row[brandCol] || '').trim();
      if (!b || b === '-' || b === '—' || b.toLowerCase() === 'нет' || b.toLowerCase() === 'пусто') return;

      let isMatch = false;
      if (type === 'Все' || type === 'Другое' || rowType === selectedTypeLower || rowType.includes(selectedTypeLower) || selectedTypeLower.includes(rowType)) {
        isMatch = true;
      }
      if (!isMatch && stemKeywords.length > 0) {
        if (stemKeywords.some((stem) => rowType.includes(stem))) {
          isMatch = true;
        }
      }

      if (isMatch) {
        brandCounts.set(b, (brandCounts.get(b) || 0) + 1);
      }
    });

    if (brandCounts.size > 0) {
      return Array.from(brandCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([brandName]) => brandName);
    }

    // Fallbacks if dataset has no matching items yet
    if (/ноут/i.test(selectedTypeLower)) {
      return ["HP G250 i5 8gb", "HP G250 i3 8gb", "HP 250 G8", "Lenovo ThinkBook 15", "Dell Vostro"];
    }
    if (/монит/i.test(selectedTypeLower)) {
      return ["Lenovo L24i-30", "Lenovo L24i", "HP P24v G4", "Dell SE2422H", "Samsung 24\""];
    }
    if (/мыш/i.test(selectedTypeLower)) {
      return ["Logitech B100", "HP 150 Wireless", "Genius DX-120", "A4Tech"];
    }
    if (/клав/i.test(selectedTypeLower)) {
      return ["Logitech K120", "HP 150 Keyboard", "A4Tech"];
    }
    if (/гарнит/i.test(selectedTypeLower)) {
      return ["Jabra Evolve 20", "Logitech H390", "A4Tech HS-30"];
    }
    if (/hub/i.test(selectedTypeLower)) {
      return ["HP USB-C G2 Hub", "Baseus 6-in-1", "UGreen Type-C Hub"];
    }
    return [];
  }, [dataset, type, typeCol, brandCol]);

  // Check if pcId already exists in the dataset
  const cleanPcId = pcId.trim();
  const existingMatches = cleanPcId
    ? dataset.rows.filter((r) => {
        const val = r[pcIdCol];
        return val && String(val).trim().toLowerCase() === cleanPcId.toLowerCase();
      })
    : [];

  const isDuplicate = existingMatches.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedType = type === 'Другое' ? customType.trim() || 'Прочее' : type;

    const newRow: Record<string, any> = {
      [pcIdCol]: cleanPcId || '',
      [userCol]: userName.trim() || '',
      [positionCol]: position.trim() || '',
      [typeCol]: selectedType,
      [brandCol]: brand.trim() || '',
      [snCol]: serialNumber.trim() || '',
      [timeCol]: timestamp || getCurrentTimestamp(),
      [issuerCol]: issuer.trim() || DEFAULT_ISSUER,
      [movementCol]: movement || '',
      [notesCol]: notes.trim() || '',
    };

    // Ensure all other columns from dataset exist even if empty
    dataset.columns.forEach((c) => {
      if (newRow[c] === undefined) {
        newRow[c] = '';
      }
    });

    onAddRow(newRow);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950/80 border border-emerald-800/80 rounded-xl text-emerald-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base">
                Добавить запись в журнал ИТ-оборудования
              </h3>
              <p className="text-2xs sm:text-xs text-slate-400">
                Авто-фиксация времени, контроль уникальности Доменного ID и ответственный по умолчанию
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          
          {/* Row 1: PC Identifier / Domain number with Uniqueness validation */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>Идентификатор ПК (Доменный номер)</span>
                <span className="text-emerald-400 text-2xs font-normal">(строгая уникальность)</span>
              </label>
              {isDuplicate && (
                <span className="text-2xs text-rose-400 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Дубликат! Уже используется
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                value={pcId}
                onChange={(e) => setPcId(e.target.value)}
                placeholder="Например: TAS05-003-SK-LT"
                className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-100 font-mono focus:outline-none transition-colors ${
                  isDuplicate
                    ? 'border-rose-600 focus:ring-2 focus:ring-rose-500 bg-rose-950/20'
                    : 'border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                }`}
              />
            </div>

            {isDuplicate && (
              <div className="mt-1.5 p-2 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-2xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  Внимание: Идентификатор <strong>«{cleanPcId}»</strong> уже закреплен в таблице за:{' '}
                  {existingMatches.map((m, idx) => (
                    <span key={idx} className="font-semibold text-white">
                      {m[userCol] || '(Без пользователя)'} [{m[typeCol] || 'Техника'}]
                      {idx < existingMatches.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                  . Доменные номера ноутбуков должны быть строго уникальными!
                </div>
              </div>
            )}
          </div>

          {/* Row 2: User name & Department (both can be empty) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Имя пользователя <span className="text-slate-500 text-2xs">(если пусто — оставить пустым)</span>
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="ФИО сотрудника..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Должность / Подразделение <span className="text-slate-500 text-2xs">(опционально)</span>
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Например: Инженер КИПиА..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Row 3: Equipment Type & Brand / Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Тип оборудования
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="Другое">Другое (ввести вручную)</option>
              </select>

              {type === 'Другое' && (
                <input
                  type="text"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Укажите тип техники..."
                  className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Марка / Модель <span className="text-emerald-400 text-2xs">(из базы или новая)</span>
              </label>
              <input
                type="text"
                list="brand-suggestions"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Например: HP G250 i5 8gb, Lenovo L24i..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <datalist id="brand-suggestions">
                {availableBrandSuggestions.map((sug) => (
                  <option key={sug} value={sug} />
                ))}
              </datalist>

              {/* Quick suggestion tags from current dataset */}
              {availableBrandSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5 max-h-16 overflow-y-auto">
                  {availableBrandSuggestions.slice(0, 4).map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setBrand(sug)}
                      className={`text-2xs px-2 py-0.5 rounded-md border transition-all ${
                        brand === sug
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-700/60 hover:bg-slate-700'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Serial Number & Movement Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                S/N (Серийный номер) <span className="text-slate-500 text-2xs">(если пусто — оставить пустым)</span>
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Например: 1H84263B2Q..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Движения (Статус перемещения)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {MOVEMENT_STATUSES.map((status) => {
                  const isSelected = movement === status;
                  return (
                    <button
                      type="button"
                      key={status}
                      onClick={() => setMovement(status)}
                      className={`py-2 text-xs font-medium rounded-xl border transition-all ${
                        isSelected
                          ? status === 'Новый'
                            ? 'bg-blue-950 border-blue-600 text-blue-300 font-semibold shadow-sm'
                            : status === 'Принял'
                            ? 'bg-emerald-950 border-emerald-600 text-emerald-300 font-semibold shadow-sm'
                            : 'bg-amber-950 border-amber-600 text-amber-300 font-semibold shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 5: Issuer & Auto Timestamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between mb-1">
                <span>Кто выдал</span>
                <span className="text-2xs text-slate-400 font-normal">по умолчанию «Зохид Зокиров»</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  placeholder="Ответственное лицо..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setIssuer(DEFAULT_ISSUER)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-emerald-400 hover:underline px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800"
                >
                  Сбросить на Зохид
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Отметка времени</span>
                </label>
                <button
                  type="button"
                  onClick={() => setTimestamp(getCurrentTimestamp())}
                  className="text-2xs text-slate-400 hover:text-slate-200 underline"
                >
                  Обновить на сейчас
                </button>
              </div>
              <input
                type="text"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Row 6: Notes / Запись */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Запись (примечание, кому сдал, на ремонте, сломался и т.д.)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Например: получил Алижон, на диагностике в сервисе, заменен блок питания..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-950"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить в таблицу</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
