import { BusinessLine, SaleItem } from "@/types";
import { buildSaleDoc, buildQuotationDoc } from "../sales/domain/saleDocBuilder";

export interface ImportWritesResult {
  saleDoc: any;
  quotationDoc: any | null;
}

export function isImportedQuotation(sale: any): boolean {
  return Boolean(sale && (sale.relatedSaleId || sale.metadata?.isQuotation));
}

export function buildImportWrites(sale: any, injectedUploadedAt?: any): ImportWritesResult {
  const items = sale.items || [];
  const uploadedAt = injectedUploadedAt || sale.uploadedAt || null;
  const timestamp = sale.timestamp;

  const hasMetallicItem = items.some((i: any) => i.businessLine === "metallic-roofing");

  // Call the builder — pass timestamp as the injected value
  const baseSaleDoc = buildSaleDoc({
    ...sale,
    timestamp
  }, timestamp);

  const importMetadata = {
    isHistorical: true,
    isReplacement: Boolean(sale.metadata?.isReplacement),
    uploadedBy: sale.metadata?.uploadedBy || null,
    documentType: sale.documentType,
    adjustedDocument: sale.adjustedDocument || "",
    currency: sale.currency,
    exchangeRate: sale.exchangeRateApplied || 1,
    originalCurrencyAmount:
      sale.currency === "USD" ? Number((sale.originalCurrencyAmount || 0).toFixed(2)) : null,
  };

  const saleDoc = {
    ...baseSaleDoc,
    ...(hasMetallicItem ? { relatedQuotationId: `COT-${sale.documentNumber}` } : {}),
    ...(uploadedAt ? { uploadedAt } : {}),
    metadata: importMetadata,
    currency: sale.currency,
    exchangeRateApplied: sale.exchangeRateApplied || 1,
    documentType: sale.documentType
  };

  let quotationDoc: any | null = null;

  if (hasMetallicItem) {
    const baseQuotationDoc = buildQuotationDoc({
      ...sale,
      timestamp
    }, timestamp);

    quotationDoc = {
      ...baseQuotationDoc,
      productionStatus: 'CONFIRMED',
      relatedSaleId: sale.documentNumber,
      ...(uploadedAt ? { uploadedAt } : {}),
      metadata: {
        ...importMetadata,
        isQuotation: true,
      },
      currency: sale.currency,
      exchangeRateApplied: sale.exchangeRateApplied || 1,
      documentType: sale.documentType,
      createdBy: sale.createdBy || "SISTEMA" // Added from legacy
    };
  }

  return {
    saleDoc,
    quotationDoc,
  };
}
