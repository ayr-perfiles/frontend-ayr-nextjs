import { z } from 'zod';

export const TradingStockAdjustmentSchema = z.object({
  sku: z.string().min(1, 'El SKU es obligatorio'),
  type: z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT']),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.number().nonnegative('El costo unitario no puede ser negativo').optional(),
  reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
});

export type TradingStockAdjustmentInput = z.infer<typeof TradingStockAdjustmentSchema>;
