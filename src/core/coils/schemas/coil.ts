import { z } from 'zod';
import { BusinessLine } from '@/types';

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
  weight: z.coerce.number().positive('El peso debe ser mayor a 0'),
  width: z.coerce.number().positive('El ancho debe ser mayor a 0'),
  thickness: z.coerce.number().positive('El espesor debe ser mayor a 0'),
  finish: z.string().min(1, 'El acabado es obligatorio'), // ID del acabado
  value: z.coerce.number().positive('El valor debe ser mayor a 0'),
});

export type CoilInvoiceHeader = z.infer<typeof coilInvoiceHeaderSchema>;
export type CoilEntryValues = z.infer<typeof coilEntryFormSchema>;
