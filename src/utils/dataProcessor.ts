import Papa from 'papaparse';
import { ColumnMetadata, DataType, Dataset, ChartConfig } from '../types';
import initialInventoryData from './initialInventory.json';

export function detectColumnType(values: any[]): DataType {
  let numberCount = 0;
  let dateCount = 0;
  let booleanCount = 0;
  let currencyCount = 0;
  let percentCount = 0;
  let validCount = 0;

  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    validCount++;

    const str = String(v).trim();

    // Check boolean
    if (/^(true|false|yes|no|да|нет|1|0)$/i.test(str) && typeof v === 'boolean') {
      booleanCount++;
      continue;
    }

    // Check currency
    if (/^[\$€₽£¥]\s?[\d,.]+|[\d,.]+\s?[\$€₽£¥]/.test(str)) {
      currencyCount++;
      continue;
    }

    // Check percentage
    if (/^[\d,.]+\s?%$/.test(str)) {
      percentCount++;
      continue;
    }

    // Check pure number
    const cleanedNum = str.replace(/\s/g, '').replace(',', '.');
    if (!isNaN(Number(cleanedNum)) && !isNaN(parseFloat(cleanedNum))) {
      numberCount++;
      continue;
    }

    // Check Date
    const parsedDate = Date.parse(str);
    if (!isNaN(parsedDate) && /[\/-]/.test(str) && str.length >= 6) {
      dateCount++;
      continue;
    }
  }

  if (validCount === 0) return 'string';
  if (currencyCount / validCount > 0.6) return 'currency';
  if (percentCount / validCount > 0.6) return 'percentage';
  if (numberCount / validCount > 0.6) return 'number';
  if (dateCount / validCount > 0.6) return 'date';
  if (booleanCount / validCount > 0.6) return 'boolean';

  return 'string';
}

export function cleanNumericValue(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val)
    .replace(/[\$€₽£¥%]/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Inserts a new equipment record grouped right next to the employee's existing records
 */
export function insertRecordForUserInDataset(
  rows: Record<string, any>[],
  newRow: Record<string, any>,
  columns: string[]
): Record<string, any>[] {
  const userCol = columns.find((c) => /имя пользователя|фио|пользователь|сотрудник/i.test(c)) || 'Имя пользователя';
  const targetUser = String(newRow[userCol] || newRow['Имя пользователя'] || '').trim();

  if (!targetUser || targetUser === '📦 Без назначения / Склад' || targetUser.toLowerCase() === 'склад') {
    const lastWarehouseIndex = rows.reduce((lastIdx, item, idx) => {
      const u = String(item[userCol] || item['Имя пользователя'] || '').trim().toLowerCase();
      if (!u || u.includes('склад') || u.includes('без назначения')) {
        return idx;
      }
      return lastIdx;
    }, -1);

    const copy = [...rows];
    if (lastWarehouseIndex >= 0) {
      copy.splice(lastWarehouseIndex + 1, 0, newRow);
      return copy;
    }
    copy.push(newRow);
    return copy;
  }

  const targetUserLower = targetUser.toLowerCase();
  let lastMatchingIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    const rowUser = String(rows[i][userCol] || rows[i]['Имя пользователя'] || '').trim().toLowerCase();
    if (rowUser) {
      if (
        rowUser === targetUserLower ||
        (rowUser.length > 3 && targetUserLower.includes(rowUser)) ||
        (targetUserLower.length > 3 && rowUser.includes(targetUserLower))
      ) {
        lastMatchingIndex = i;
      }
    }
  }

  const copy = [...rows];
  if (lastMatchingIndex >= 0) {
    // Insert directly AFTER the employee's last equipment row
    copy.splice(lastMatchingIndex + 1, 0, newRow);
  } else {
    // New employee: insert before warehouse items if any, otherwise append to end
    const firstWarehouseIdx = copy.findIndex((r) => {
      const u = String(r[userCol] || r['Имя пользователя'] || '').trim().toLowerCase();
      return u.includes('склад') || u.includes('без назначения');
    });

    if (firstWarehouseIdx >= 0 && firstWarehouseIdx > 0) {
      copy.splice(firstWarehouseIdx, 0, newRow);
    } else {
      copy.push(newRow);
    }
  }

  return copy;
}

export function analyzeDataset(
  rawRows: Record<string, any>[],
  columnsInput: string[],
  id: string,
  title: string,
  sourceUrl?: string,
  sourceType: Dataset['sourceType'] = 'google_sheets'
): Dataset {
  const columns = columnsInput
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith('_') && c.length > 0);

  const columnMeta: Record<string, ColumnMetadata> = {};

  columns.forEach((col) => {
    const rawValues = rawRows.map((r) => r[col]);
    const type = detectColumnType(rawValues);

    const nonNullValues = rawValues.filter((v) => v !== null && v !== undefined && v !== '');
    const nullCount = rawValues.length - nonNullValues.length;

    // Distinct counts
    const frequencyMap = new Map<string, number>();
    nonNullValues.forEach((v) => {
      const key = String(v);
      frequencyMap.set(key, (frequencyMap.get(key) || 0) + 1);
    });

    const uniqueCount = frequencyMap.size;
    const topValues = Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));

    const meta: ColumnMetadata = {
      name: col,
      type,
      sampleValues: nonNullValues.slice(0, 5),
      uniqueCount,
      nullCount,
      topValues,
    };

    // Calculate numeric stats if applicable
    if (type === 'number' || type === 'currency' || type === 'percentage') {
      const nums = nonNullValues
        .map(cleanNumericValue)
        .filter((n): n is number => n !== null);

      if (nums.length > 0) {
        nums.sort((a, b) => a - b);
        const min = nums[0];
        const max = nums[nums.length - 1];
        const sum = nums.reduce((acc, curr) => acc + curr, 0);
        const avg = sum / nums.length;
        const median =
          nums.length % 2 === 0
            ? (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2
            : nums[Math.floor(nums.length / 2)];

        const variance = nums.reduce((acc, curr) => acc + Math.pow(curr - avg, 2), 0) / nums.length;
        const stdDev = Math.sqrt(variance);

        meta.stats = {
          min: Math.round(min * 100) / 100,
          max: Math.round(max * 100) / 100,
          avg: Math.round(avg * 100) / 100,
          median: Math.round(median * 100) / 100,
          sum: Math.round(sum * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
        };
      }
    }

    columnMeta[col] = meta;
  });

  return {
    id,
    title,
    sourceUrl,
    sourceType,
    columns,
    columnMeta,
    rows: rawRows,
    totalRows: rawRows.length,
    fetchedAt: new Date().toISOString(),
  };
}

export function aggregateChartData(rows: Record<string, any>[], config: ChartConfig) {
  const { xAxisKey, yAxisKey, aggregation, limit = 15 } = config;

  if (!xAxisKey || !yAxisKey) return [];

  const groups = new Map<string, { sum: number; count: number; min: number; max: number; values: number[] }>();

  rows.forEach((row) => {
    const rawX = row[xAxisKey];
    const xVal = rawX === null || rawX === undefined || rawX === '' ? '(Empty)' : String(rawX);

    const numY = cleanNumericValue(row[yAxisKey]);
    if (numY === null) return;

    if (!groups.has(xVal)) {
      groups.set(xVal, {
        sum: numY,
        count: 1,
        min: numY,
        max: numY,
        values: [numY],
      });
    } else {
      const g = groups.get(xVal)!;
      g.sum += numY;
      g.count += 1;
      g.min = Math.min(g.min, numY);
      g.max = Math.max(g.max, numY);
      g.values.push(numY);
    }
  });

  const result = Array.from(groups.entries()).map(([key, data]) => {
    let aggregatedValue = 0;
    switch (aggregation) {
      case 'sum':
        aggregatedValue = data.sum;
        break;
      case 'avg':
        aggregatedValue = data.count > 0 ? data.sum / data.count : 0;
        break;
      case 'count':
        aggregatedValue = data.count;
        break;
      case 'min':
        aggregatedValue = data.min;
        break;
      case 'max':
        aggregatedValue = data.max;
        break;
    }

    return {
      [xAxisKey]: key,
      [yAxisKey]: Math.round(aggregatedValue * 100) / 100,
      count: data.count,
    };
  });

  // Sort descending by aggregated metric value
  result.sort((a, b) => (b[yAxisKey] as number) - (a[yAxisKey] as number));

  return result.slice(0, limit);
}

export function exportDatasetToCsv(dataset: Dataset, filename = 'dataset_export.csv') {
  const csv = Papa.unparse({
    fields: dataset.columns,
    data: dataset.rows,
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Rich Sample Datasets
export const SAMPLE_DATASETS: { name: string; description: string; data: Record<string, any>[] }[] = [
  {
    name: 'ИТ-Оборудование и Склад техники (Google Sheets)',
    description: 'Реальные данные ИТ-инвентаризации, движения техники и закрепления за сотрудниками компании',
    data: initialInventoryData,
  },
  {
    name: 'Бизнес Аналитика Продаж (E-commerce)',
    description: 'Данные по заказам, выручке, категориям товаров, регионам и конверсиям',
    data: [
      { 'ID Заказа': 'ORD-101', 'Дата': '2025-01-15', 'Категория': 'Электроника', 'Товар': 'Ноутбук Pro 15', 'Клиент': 'ООО Вектор', 'Город': 'Москва', 'Количество': 2, 'Цена': 85000, 'Выручка': 170000, 'Прибыль': 34000, 'Статус': 'Доставлен' },
      { 'ID Заказа': 'ORD-102', 'Дата': '2025-01-16', 'Категория': 'Аксессуары', 'Товар': 'Беспроводная мышь', 'Клиент': 'ИП Сидоров', 'Город': 'Санкт-Петербург', 'Количество': 15, 'Цена': 2400, 'Выручка': 36000, 'Прибыль': 12000, 'Статус': 'Доставлен' },
      { 'ID Заказа': 'ORD-103', 'Дата': '2025-01-18', 'Категория': 'Мебель', 'Товар': 'Эргономичное кресло', 'Клиент': 'ТехноПарк', 'Город': 'Казань', 'Количество': 5, 'Цена': 18500, 'Выручка': 92500, 'Прибыль': 27750, 'Статус': 'В пути' },
      { 'ID Заказа': 'ORD-104', 'Дата': '2025-01-20', 'Категория': 'Электроника', 'Товар': 'Монитор 4K 27"', 'Клиент': 'ООО Альфа', 'Город': 'Москва', 'Количество': 4, 'Цена': 32000, 'Выручка': 128000, 'Прибыль': 25600, 'Статус': 'Доставлен' },
      { 'ID Заказа': 'ORD-105', 'Дата': '2025-01-22', 'Категория': 'ПО и Сервисы', 'Товар': 'Лицензия Cloud Suite', 'Клиент': 'Банк Развития', 'Город': 'Екатеринбург', 'Количество': 20, 'Цена': 4500, 'Выручка': 90000, 'Прибыль': 63000, 'Статус': 'Доставлен' },
      { 'ID Заказа': 'ORD-106', 'Дата': '2025-01-24', 'Категория': 'Аксессуары', 'Товар': 'USB-C Dock Station', 'Клиент': 'ООО Старт', 'Город': 'Новосибирск', 'Количество': 8, 'Цена': 6200, 'Выручка': 49600, 'Прибыль': 14880, 'Статус': 'Обработка' },
      { 'ID Заказа': 'ORD-107', 'Дата': '2025-01-26', 'Категория': 'Электроника', 'Товар': 'Планшет Ultra 11', 'Клиент': 'Академия Дизайна', 'Город': 'Москва', 'Количество': 6, 'Цена': 48000, 'Выручка': 288000, 'Прибыль': 57600, 'Статус': 'Доставлен' },
      { 'ID Заказа': 'ORD-108', 'Дата': '2025-01-29', 'Категория': 'Мебель', 'Товар': 'Стол с электроприводом', 'Клиент': 'Digital Agency', 'Город': 'Санкт-Петербург', 'Количество': 3, 'Цена': 42000, 'Выручка': 126000, 'Прибыль': 31500, 'Статус': 'Доставлен' },
      { 'ID Заказа': 'ORD-109', 'Дата': '2025-02-02', 'Категория': 'ПО и Сервисы', 'Товар': 'Security Enterprise', 'Клиент': 'ПромИнвест', 'Город': 'Нижний Новгород', 'Количество': 10, 'Цена': 15000, 'Выручка': 150000, 'Прибыль': 105000, 'Статус': 'Доставлен' },
      { 'ID Заказа': 'ORD-110', 'Дата': '2025-02-05', 'Категория': 'Электроника', 'Товар': 'Смартфон Nova 12', 'Клиент': 'ИП Смирнов', 'Город': 'Краснодар', 'Количество': 12, 'Цена': 28000, 'Выручка': 336000, 'Прибыль': 50400, 'Статус': 'Доставлен' },
      { 'ID Заказа': 'ORD-111', 'Дата': '2025-02-08', 'Категория': 'Аксессуары', 'Товар': 'Механическая клавиатура', 'Клиент': 'GameDev Studio', 'Город': 'Москва', 'Количество': 7, 'Цена': 9500, 'Выручка': 66500, 'Прибыль': 23275, 'Статус': 'Доставлен' },
      { 'ID Заказа': 'ORD-112', 'Дата': '2025-02-12', 'Категория': 'Мебель', 'Товар': 'Шкаф архивный', 'Клиент': 'ЮрКонсалт', 'Город': 'Самара', 'Количество': 2, 'Цена': 21000, 'Выручка': 42000, 'Прибыль': 8400, 'Статус': 'Доставлен' },
    ],
  },
  {
    name: 'Финансовые Показатели и Бюджет',
    description: 'Анализ расходов, доходов, статей бюджета и отклонений по кварталам',
    data: [
      { 'Статья': 'Маркетинг и Реклама', 'Квартал': 'Q1 2025', 'План (руб)': 1200000, 'Факт (руб)': 1150000, 'Отклонение': -50000, 'Эффективность ROI (%)': 280, 'Ответственный': 'Иванова Е.' },
      { 'Статья': 'ФОТ Разработка', 'Квартал': 'Q1 2025', 'План (руб)': 4500000, 'Факт (руб)': 4620000, 'Отклонение': 120000, 'Эффективность ROI (%)': 350, 'Ответственный': 'Петров А.' },
      { 'Статья': 'Облачная Инфраструктура', 'Квартал': 'Q1 2025', 'План (руб)': 800000, 'Факт (руб)': 740000, 'Отклонение': -60000, 'Эффективность ROI (%)': 420, 'Ответственный': 'Кузнецов Д.' },
      { 'Статья': 'Аренда Офиса', 'Квартал': 'Q1 2025', 'План (руб)': 650000, 'Факт (руб)': 650000, 'Отклонение': 0, 'Эффективность ROI (%)': 110, 'Ответственный': 'Смирнова О.' },
      { 'Статья': 'Обучение Персонала', 'Квартал': 'Q1 2025', 'План (руб)': 300000, 'Факт (руб)': 220000, 'Отклонение': -80000, 'Эффективность ROI (%)': 190, 'Ответственный': 'Иванова Е.' },
      { 'Статья': 'Маркетинг и Реклама', 'Квартал': 'Q2 2025', 'План (руб)': 1400000, 'Факт (руб)': 1550000, 'Отклонение': 150000, 'Эффективность ROI (%)': 310, 'Ответственный': 'Иванова Е.' },
      { 'Статья': 'ФОТ Разработка', 'Квартал': 'Q2 2025', 'План (руб)': 4800000, 'Факт (руб)': 4800000, 'Отклонение': 0, 'Эффективность ROI (%)': 390, 'Ответственный': 'Петров А.' },
      { 'Статья': 'Облачная Инфраструктура', 'Квартал': 'Q2 2025', 'План (руб)': 900000, 'Факт (руб)': 890000, 'Отклонение': -10000, 'Эффективность ROI (%)': 450, 'Ответственный': 'Кузнецов Д.' },
    ],
  },
];
