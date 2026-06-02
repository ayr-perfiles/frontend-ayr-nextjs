import { z } from 'zod';

export const saleCustomerSchema = z.object({
  customerName: z.string().min(1, 'El nombre del cliente es obligatorio'),
  documentNumber: z
    .string()
    .min(8, 'El documento debe tener 8 (DNI) u 11 (RUC) dígitos')
    .max(11, 'El documento debe tener 8 (DNI) u 11 (RUC) dígitos')
    .regex(/^\d+$/, 'El documento debe contener solo números'),
});

export type SaleCustomerForm = z.infer<typeof saleCustomerSchema>;
