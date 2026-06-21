import { z } from 'zod';

/**
 * Schema de catálogo aluzinc. Más rico que UPVC porque hay varias familias.
 * `sku` y `displayName` opcionales: si no llegan se autogeneran (ver catalogService).
 */
export const MetallicProductSchema = z
  .object({
    sku: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    family: z.enum(['COBERTURA', 'PLANCHA', 'ACCESORIO']),
    finish: z.string().trim().min(1, 'El acabado es obligatorio (GALV, NATURAL, PREPINTADO...).'),
    color: z.string().trim().optional(),
    thickness: z.number().positive('El espesor debe ser mayor a 0.'),
    width: z.number().positive().optional(),
    length: z.number().positive().optional(),
    unit: z.enum(['PIEZA', 'METRO', 'KILOGRAMO', 'TONELADA']),
    active: z.boolean().default(true),
    widthMm: z.number().positive().optional(),
    densityFactor: z.number().positive().optional(),
    metaSource: z.enum(['parser', 'manual']).optional(),
  })
  .refine((p) => p.family !== 'PLANCHA' || p.length !== undefined, {
    message: 'Las planchas requieren largo (length).',
    path: ['length'],
  });

export type MetallicProductInput = z.infer<typeof MetallicProductSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Form schema para AddProductModal (todos los campos son string para HTML inputs)
// ─────────────────────────────────────────────────────────────────────────────

export const addMetallicProductFormSchema = z.object({
  family: z.enum(['COBERTURA', 'PLANCHA', 'ACCESORIO']),
  finish: z.string().min(1, 'El acabado es obligatorio'),
  color: z.string(),
  thickness: z
    .string()
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'El espesor debe ser mayor a 0'),
  width: z
    .string()
    .refine((v) => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), 'El ancho debe ser mayor a 0'),
  length: z.string(),
  unit: z.enum(['PIEZA', 'METRO', 'KILOGRAMO', 'TONELADA']),
  sku: z.string(),
  displayName: z.string(),
  widthMm: z
    .string()
    .refine((v) => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), 'El ancho en mm debe ser mayor a 0'),
}).superRefine((data, ctx) => {
  if (data.family === 'PLANCHA' && (!data.length || isNaN(parseFloat(data.length)) || parseFloat(data.length) <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['length'],
      message: 'Las planchas requieren largo mayor a 0',
    });
  }
});

export type AddMetallicProductFormState = z.infer<typeof addMetallicProductFormSchema>;
