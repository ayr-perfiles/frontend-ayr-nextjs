import { z } from 'zod';

export const drywallCatalogSchema = z.object({
  sku: z
    .string()
    .min(1, 'El SKU es obligatorio')
    .regex(/^[A-Z0-9]+$/, 'El SKU debe ser alfanumérico en mayúsculas'),

  name: z.string().min(1, 'El nombre es obligatorio'),

  stripWidth: z
    .number()
    .positive('El ancho de fleje debe ser mayor a 0'),

  standardWeight: z
    .number()
    .positive('El peso estándar debe ser mayor a 0'),

  lengthMeters: z
    .number()
    .positive('El largo debe ser mayor a 0')
    .optional(),

  isActive: z.boolean(),
});

export type DrywallCatalogItem = z.infer<typeof drywallCatalogSchema>;
