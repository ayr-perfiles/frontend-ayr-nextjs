import { z } from 'zod';

export const ServiceProductSchema = z.object({
  sku: z.string().trim().min(1, 'El SKU es obligatorio'),
  displayName: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: z.string().trim().optional(),
  unit: z.literal('TONELADA'),
  pricePerUnit: z.number().nonnegative('El precio no puede ser negativo').optional(),
  active: z.boolean().default(true),
});

export type ServiceProductInput = z.infer<typeof ServiceProductSchema>;

// Form schema for ProductModal (string-based for HTML inputs)
export const addServiceProductFormSchema = z.object({
  sku: z.string().trim().min(1, 'El SKU es obligatorio'),
  displayName: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: z.string().trim().optional(),
  unit: z.literal('TONELADA'),
  pricePerUnit: z.string().optional(),
});

export type AddServiceProductFormState = z.infer<typeof addServiceProductFormSchema>;
