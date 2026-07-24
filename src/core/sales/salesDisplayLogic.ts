import { Sale } from "@/types";

export interface ResolvedSaleDocument {
  rucDni: string;
  comprobante: string | null;
}

export function resolveCustomerDoc(sale: Partial<Sale>): ResolvedSaleDocument {
  const isDigitsOnly = (str?: string) => /^\d+$/.test(str || "");
  const fallbackToDoc = !sale.customerDocument && isDigitsOnly(sale.documentNumber);
  
  const rucDni = sale.customerDocument || (fallbackToDoc ? sale.documentNumber : "---");
  const comprobante = (!fallbackToDoc && sale.documentNumber) ? sale.documentNumber : null;

  return {
    rucDni: rucDni as string,
    comprobante,
  };
}
