import { LucideIcon } from 'lucide-react';

export type ReportCategory = 'VENTAS' | 'INVENTARIO' | 'MATERIA_PRIMA' | 'PRODUCCIÓN' | 'EJECUTIVO';

export type FilterType = 'PERIOD' | 'LINE' | 'CUSTOMER' | 'SELLER' | 'SKU' | 'FINISH' | 'STATUS' | 'TEXT' | 'DAYS' | 'BOOLEAN' | 'MULTISELECT';

export interface FilterSpec {
  id: string;
  label: string;
  type: FilterType;
  required?: boolean;
  defaultValue?: any;
}

export type ColumnFormat = 'currency' | 'number' | 'date' | 'percent' | 'string' | 'badge';

export interface ColumnSpec {
  label: string;
  key: string;
  format: ColumnFormat;
  align?: 'left' | 'center' | 'right';
  badgeStyle?: (val: any) => string;
  roles?: string[];
}

export interface ReportResult {
  rows: any[];
  totals?: Record<string, number>;
  series?: {
    name: string;
    data: { label: string; value: number }[];
  }[];
}

export interface ReportDefinition {
  id: string;
  title: string;
  category: ReportCategory;
  description: string;
  icon: LucideIcon;
  filters: FilterSpec[];
  run: (params: any) => Promise<ReportResult>;
  columns: ColumnSpec[];
  chart?: {
    type: 'bar' | 'line' | 'donut' | 'none';
    xKey: string;
    yKeys: string[];
    colors?: string[];
  };
  exports: ('csv' | 'xlsx' | 'pdf')[];
  roles?: string[];
}
