export type DataType = 'number' | 'string' | 'date' | 'boolean' | 'currency' | 'percentage';

export interface ColumnMetadata {
  name: string;
  type: DataType;
  sampleValues: any[];
  uniqueCount: number;
  nullCount: number;
  stats?: {
    min?: number;
    max?: number;
    avg?: number;
    median?: number;
    sum?: number;
    stdDev?: number;
  };
  topValues?: { value: string; count: number }[];
}

export interface Dataset {
  id: string;
  title: string;
  sourceUrl?: string;
  sourceType: 'google_sheets' | 'file_upload' | 'sample' | 'pasted';
  columns: string[];
  columnMeta: Record<string, ColumnMetadata>;
  rows: Record<string, any>[];
  totalRows: number;
  fetchedAt: string;
}

export type ChartType = 'bar' | 'line' | 'area' | 'pie' | 'scatter' | 'radar';

export interface ChartConfig {
  id: string;
  title: string;
  type: ChartType;
  xAxisKey: string;
  yAxisKey: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
  groupByKey?: string;
  limit?: number;
  colorScheme?: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}
