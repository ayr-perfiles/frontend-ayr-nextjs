import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Schema base
// ─────────────────────────────────────────────────────────────────────────────

const roofingProductBase = z.object({
  sku: z
    .string()
    .min(3, 'El SKU debe tener al menos 3 caracteres')
    .max(30, 'El SKU no puede superar los 30 caracteres')
    .regex(/^[A-Z0-9]+$/, 'El SKU solo puede contener mayúsculas y números')
    .optional(),
  displayName: z.string().min(5, 'El nombre debe tener al menos 5 caracteres').optional(),
  family: z.string().optional().default('TC5'),
  material: z.enum(['UPVC', 'ACERO_GALV', 'POLICARBONATO']),
  color: z
    .string()
    .transform(v => v.toUpperCase())
    .refine(v => v.length >= 2, 'El color debe tener al menos 2 caracteres')
    .optional(),
  spec: z.string().optional(),
  thickness: z.number().positive('El espesor debe ser mayor a 0').max(10),
  width: z.number().positive('El ancho debe ser mayor a 0').max(10),
  length: z.number().positive('El largo debe ser mayor a 0').max(20),
  unit: z.literal('PIEZA').default('PIEZA'),
  weight: z.number().positive('El peso debe ser mayor a 0').optional(),
  active: z.boolean().optional().default(true),
  avgCost: z.number().nonnegative().default(0),
}).superRefine((data, ctx) => {
  if (data.material === 'UPVC' && !data.color) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['color'],
      message: 'El color es obligatorio para material UPVC',
    });
  }
});

export const RoofingProductSchema = roofingProductBase;

/** Input type: what callers pass in (family/active optional — defaults applied by schema). */
export type RoofingProductInput = z.input<typeof RoofingProductSchema>;

/** Parsed output type: all defaults resolved (family/active always present). */
export type RoofingProductParsed = z.infer<typeof RoofingProductSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Form schema for AddProductModal
// Validates FormState (all string values from HTML inputs) before building the
// RoofingProductInput for the service. Uses string refines instead of coerce so
// the schema output type matches FormState exactly.
// ─────────────────────────────────────────────────────────────────────────────

export const addProductFormSchema = z.object({
  material: z.enum(['UPVC', 'ACERO_GALV', 'POLICARBONATO']),
  color: z.string(),
  thickness: z
    .string()
    .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'El espesor debe ser mayor a 0')
    .refine(v => parseFloat(v) <= 10, 'El espesor no puede superar 10 mm'),
  width: z
    .string()
    .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'El ancho debe ser mayor a 0')
    .refine(v => parseFloat(v) <= 10, 'El ancho no puede superar 10 m'),
  length: z
    .string()
    .refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, 'El largo debe ser mayor a 0')
    .refine(v => parseFloat(v) <= 20, 'El largo no puede superar 20 m'),
  weight: z
    .string()
    .refine(v => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), 'El peso debe ser mayor a 0'),
  sku: z.string(),
  displayName: z.string(),
}).superRefine((data, ctx) => {
  if (data.material === 'UPVC' && !data.color) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['color'],
      message: 'El color es obligatorio para material UPVC',
    });
  }
});

export type AddProductFormState = z.infer<typeof addProductFormSchema>;
