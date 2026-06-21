import { z } from 'zod';

export const PurchaseItemSchema = z.object({
  sku: z.string().min(1, 'El SKU es obligatorio'),
  productName: z.string().min(1, 'El nombre del producto es obligatorio'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  unitCostCurrency: z.number().min(0, 'El costo unitario no puede ser negativo'),
  unitCostPEN: z.number().min(0, 'El costo unitario en PEN no puede ser negativo'),
});

export const PurchaseSchema = z.object({
  supplier: z.object({
    ruc: z.string().length(11, 'RUC debe tener 11 dígitos'),
    name: z.string().min(1, 'El nombre del proveedor es obligatorio'),
  }),
  businessLine: z.enum(['roofing', 'trading']),
  invoice: z.object({
    number: z.string().min(1, 'El número de factura es obligatorio'),
    date: z.any(), // Timestamp
    currency: z.enum(['PEN', 'USD']),
    exchangeRate: z.number().positive('El tipo de cambio debe ser mayor a 0'),
    gravada: z.number().min(0),
    igv: z.number().min(0),
    total: z.number().positive('El total debe ser mayor a 0'),
    detraccionPct: z.number().optional(),
    detraccionAmount: z.number().optional(),
  }),
  items: z.array(PurchaseItemSchema).min(1, 'Debe haber al menos un ítem'),
  totalCostPEN: z.number().positive(),
});
