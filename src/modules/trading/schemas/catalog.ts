import { z } from 'zod';

export const TradingProductSchema = z.object({
  sku: z.string().trim().min(1, 'El SKU es obligatorio'),
  displayName: z.string().trim().min(1, 'El nombre es obligatorio').optional(),
  category: z.enum(['POLICARBONATO', 'TUBO', 'AUTOPERFORANTE', 'ACCESORIO', 'OTRO']),
  color: z.string().trim().optional(),
  spec: z.string().trim().optional(),
  unit: z.enum(['PIEZA', 'METRO', 'ROLLO']),
  active: z.boolean().default(true),
  avgCost: z.number().nonnegative().default(0),
});

export type TradingProductInput = z.infer<typeof TradingProductSchema>;

// Form schema for ProductModal (string-based for HTML inputs)
export const addTradingProductFormSchema = z.object({
  sku: z.string().trim().min(1, 'El SKU es obligatorio'),
  displayName: z.string().trim().min(1, 'El nombre es obligatorio'),
  category: z.enum(['POLICARBONATO', 'TUBO', 'AUTOPERFORANTE', 'ACCESORIO', 'OTRO']),
  color: z.string().trim().optional(),
  spec: z.string().trim().optional(),
  unit: z.enum(['PIEZA', 'METRO', 'ROLLO']),
});

export type AddTradingProductFormState = z.infer<typeof addTradingProductFormSchema>;
