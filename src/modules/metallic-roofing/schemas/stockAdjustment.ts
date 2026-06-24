import { z } from 'zod';

export const stockAdjustmentFormSchema = z.object({
  type: z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT']),
  quantity: z
    .string()
    .min(1, 'La cantidad es obligatoria')
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'La cantidad debe ser mayor a 0'),
  unitCost: z.string(),
  reason: z.string().min(1, 'El motivo es obligatorio'),
}).superRefine((data, ctx) => {
  if (data.type === 'ENTRY' && (!data.unitCost || Number(data.unitCost) <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['unitCost'],
      message: 'El costo unitario es obligatorio para una entrada',
    });
  }
});

export type StockAdjustmentFormValues = z.infer<typeof stockAdjustmentFormSchema>;
