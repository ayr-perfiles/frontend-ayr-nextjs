import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Schema base
// ─────────────────────────────────────────────────────────────────────────────

const roofingProductBase = z.object({
  /** Omitir para auto-generación con generateSKU(); si se provee, se valida el formato. */
  sku: z
    .string()
    .min(3, 'SKU debe tener al menos 3 caracteres')
    .max(30, 'SKU muy largo')
    .regex(/^[A-Z0-9]+$/, 'SKU solo permite mayúsculas y números')
    .optional(),

  /** Omitir para auto-generación con generateDisplayName(). */
  displayName: z.string().min(5, 'Nombre muy corto').optional(),

  /** Por ahora solo TC5; se extiende al agregar nuevos modelos */
  family: z.string().optional().default('TC5'),

  material: z.enum(['UPVC', 'ACERO_GALV', 'POLICARBONATO']),

  /**
   * Obligatorio para UPVC. Opcional para otros materiales.
   * Se normaliza a mayúsculas. El color ROJO es el default y se omite del SKU.
   */
  color: z
    .string()
    .min(2, 'Color muy corto')
    .transform(s => s.toUpperCase())
    .optional(),

  /** Espesor en mm */
  thickness: z.number().positive('El espesor debe ser mayor a 0').max(10),

  /** Ancho en mm */
  width: z.number().positive('El ancho debe ser mayor a 0').max(10),

  /** Largo en metros */
  length: z.number().positive('El largo debe ser mayor a 0').max(20),

  unit: z.literal('PIEZA'),

  /** Peso por unidad en kg */
  weight: z.number().positive('El peso debe ser mayor a 0').optional(),

  active: z.boolean().optional().default(true),
});

// ─────────────────────────────────────────────────────────────────────────────
// Validaciones cross-field
//
// ⚠️  Validaciones que requieren BD (SKU único, combinación única) deben
//    hacerse en catalogService.ts, no aquí (Zod no tiene acceso a Firestore).
// ─────────────────────────────────────────────────────────────────────────────

export const RoofingProductSchema = roofingProductBase.superRefine((data, ctx) => {
  if (data.material === 'UPVC' && !data.color) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['color'],
      message: 'El color es obligatorio para material UPVC',
    });
  }
});

/** Input type: what callers pass in (family/active optional — defaults applied by schema). */
export type RoofingProductInput = z.input<typeof RoofingProductSchema>;

/** Parsed output type: all defaults resolved (family/active always present). */
export type RoofingProductParsed = z.infer<typeof RoofingProductSchema>;
