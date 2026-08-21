import { BusinessLine, SaleItem } from "@/types";
import { buildSaleDoc, buildQuotationDoc } from "../sales/domain/saleDocBuilder";

export interface ImportWritesResult {
  saleDoc: any;
  quotationDoc: any | null;
}

/** documentType que puede generar percha de producción (COT-*). NC/ND/POS quedan fuera. */
const PRODUCTION_DOC_TYPES = ["FACTURA", "BOLETA"] as const;

export function isImportedQuotation(sale: any): boolean {
  return Boolean(sale && (sale.relatedSaleId || sale.metadata?.isQuotation));
}

export function buildImportWrites(sale: any, injectedUploadedAt?: any): ImportWritesResult {
  const items = sale.items || [];
  const uploadedAt = injectedUploadedAt || sale.uploadedAt || null;
  const timestamp = sale.timestamp;

  const hasMetallicItem = items.some((i: any) => i.businessLine === "metallic-roofing");

  // La percha COT-* (quotationDoc) solo aplica a un comprobante de VENTA real: una NC ya
  // movió stock vía writeSaleReversal al importarse (nada que producir) y un POS sin
  // documentType es venta de mostrador, no el flujo cotización→venta de metallic-roofing.
  const createsProductionPercha = hasMetallicItem && PRODUCTION_DOC_TYPES.includes(sale.documentType);

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

  // P1 — `ncStockAction` se PERSISTE, top-level, mismo patrón literal que `documentType`.
  // Se computa en parseImportRows.ts:229 y decide el signo del movimiento de stock en
  // import/page.tsx:564 (`isNCWithStock`), pero hasta v6.53.1 moría con la transacción de
  // import: este objeto enumera sus campos (sin spread de `sale`) y no lo incluía, y el
  // builder tampoco (retorna un literal de 18 claves). Medido en prod: 0 de 329 docs lo
  // tenían. Sin él, `annulSale` no puede saber si una NC repuso stock al entrar, que es
  // justo lo que necesita para hacer el replay inverso.
  //
  // Se omite la clave si el ParsedSale no la trae: Firestore rechaza `undefined`.
  const ncStockActionField =
    sale.ncStockAction !== undefined ? { ncStockAction: sale.ncStockAction } : {};

  const saleDoc = {
    ...baseSaleDoc,
    ...(createsProductionPercha ? { relatedQuotationId: `COT-${sale.documentNumber}` } : {}),
    ...(uploadedAt ? { uploadedAt } : {}),
    metadata: importMetadata,
    currency: sale.currency,
    exchangeRateApplied: sale.exchangeRateApplied || 1,
    documentType: sale.documentType,
    ...ncStockActionField
  };

  let quotationDoc: any | null = null;

  if (createsProductionPercha) {
    const baseQuotationDoc = buildQuotationDoc({
      ...sale,
      timestamp
    }, timestamp);

    quotationDoc = {
      ...baseQuotationDoc,
      productionStatus: 'CONFIRMED',
      isFulfilled: false,
      relatedSaleId: sale.documentNumber,
      ...(uploadedAt ? { uploadedAt } : {}),
      metadata: {
        ...importMetadata,
        isQuotation: true,
      },
      currency: sale.currency,
      exchangeRateApplied: sale.exchangeRateApplied || 1,
      documentType: sale.documentType,
      ...ncStockActionField,
      createdBy: sale.createdBy || "SISTEMA" // Added from legacy
    };
  }

  return {
    saleDoc,
    quotationDoc,
  };
}
