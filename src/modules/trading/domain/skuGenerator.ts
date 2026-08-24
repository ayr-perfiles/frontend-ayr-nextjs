import type { TradingCategory } from "../types";

interface DisplayNameParams {
  category: TradingCategory;
  color?: string;
  spec?: string;
}

export function generateDisplayName({ category, color, spec }: DisplayNameParams): string {
  const parts: string[] = [category];
  if (color) parts.push(color);
  if (spec) parts.push(spec);
  return parts.join(' ').toUpperCase();
}
