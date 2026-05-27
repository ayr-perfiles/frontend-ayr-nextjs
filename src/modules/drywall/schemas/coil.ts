import { z } from 'zod';

export const coilInvoiceHeaderSchema = z.object({
  docType: z.enum(['LOCAL', 'TAX_ID']),
  providerDoc: z.string(),
  providerName: z.string(),
  invoiceDate: z.string().min(1, 'La fecha de factura es obligatoria'),
  invoiceNumber: z.string(),
  currency: z.enum(['PEN', 'USD']),
  exchangeRate: z.number().positive('El tipo de cambio debe ser mayor a 0'),
});

export const coilEntryFormSchema = z.object({
  coilId: z.string().min(1, 'El número de serie es obligatorio'),
  weight: z.coerce
    .number({ invalid_type_error: 'El peso debe ser un número' })
    .positive('El peso debe ser mayor a 0'),
  width: z.coerce
    .number({ invalid_type_error: 'El ancho debe ser un número' })
    .positive('El ancho debe ser mayor a 0'),
  thickness: z.coerce
    .number({ invalid_type_error: 'El espesor debe ser un número' })
    .positive('El espesor debe ser mayor a 0'),
  value: z.coerce
    .number({ invalid_type_error: 'El valor debe ser un número' })
    .positive('El valor debe ser mayor a 0'),
});

export type CoilInvoiceHeader = z.infer<typeof coilInvoiceHeaderSchema>;
export type CoilEntryValues = z.infer<typeof coilEntryFormSchema>;
