import { BusinessLine, SaleItem } from "@/types";

export interface ImportWritesResult {
  saleDoc: any;
  quotationDoc: any | null;
}

export function isImportedQuotation(sale: any): boolean {
  return Boolean(sale && (sale.relatedSaleId || sale.metadata?.isQuotation));
}


/**
 * Función pura que construye las estructuras de datos para las escrituras en Firestore
 * durante la importación de ventas.
 *
 * @param sale Datos procesados de la venta desde el Excel
 * @param injectedTimestamp Timestamp opcional inyectado (para tests puros sin Firestore)
 */
export function buildImportWrites(sale: any, injectedUploadedAt?: any): ImportWritesResult {
  const items = sale.items || [];
  const skusArray = Array.from(new Set(items.map((i: any) => i.sku)));
  const uploadedAt = injectedUploadedAt || sale.uploadedAt || null;
  const timestamp = sale.timestamp;


  const hasMetallicItem = items.some((i: any) => i.businessLine === "metallic-roofing");
  const allFlagsSet = new Set<string>();

  let calculatedTotalProfit = 0;

  const updatedItems = items.map((item: any) => {
    const flags: string[] = [...(item.flags || [])];

    // Flag "sin peso" para ítems de aluzinc / metallic-roofing con peso 0
    if (item.businessLine === "metallic-roofing" && (!item.unitWeight || item.unitWeight === 0)) {
      if (!flags.includes("sin peso")) {
        flags.push("sin peso");
      }
    }

    // Flag "sin costo" si baseCost es 0
    if (!item.baseCost || item.baseCost === 0) {
      if (!flags.includes("sin costo")) {
        flags.push("sin costo");
      }
    }

    // Calcular profit por ítem
    let itemProfit = 0;
    if (flags.includes("sin costo") || !item.baseCost || item.baseCost === 0) {
      itemProfit = 0;
    } else {
      const priceOrValue = item.unitValue ?? item.unitPrice ?? 0;
      itemProfit = (priceOrValue - item.baseCost) * (item.quantity || 0);
    }

    flags.forEach((f) => allFlagsSet.add(f));

    return {
      ...item,
      profit: itemProfit,
      flags,
    };
  });

  calculatedTotalProfit = updatedItems.reduce((acc: number, curr: any) => acc + (curr.profit || 0), 0);

  const allFlags = Array.from(allFlagsSet);

  const saleDoc = {

    ...sale,
    status: "COMPLETED",
    items: updatedItems,
    totalProfit: calculatedTotalProfit,
    allFlags,
    skus: skusArray,
    ...(hasMetallicItem ? { relatedQuotationId: `COT-${sale.documentNumber}` } : {}),
    ...(uploadedAt ? { uploadedAt } : {}),
    metadata: {
      isHistorical: true,
      isReplacement: Boolean(sale.metadata?.isReplacement),
      uploadedBy: sale.metadata?.uploadedBy || null,
      documentType: sale.documentType,
      adjustedDocument: sale.adjustedDocument || "",
      currency: sale.currency,
      exchangeRate: sale.exchangeRateApplied || 1,
      originalCurrencyAmount:
        sale.currency === "USD" ? Number((sale.originalCurrencyAmount || 0).toFixed(2)) : null,
    },
  };
  delete (saleDoc as any).id;

  let quotationDoc: any | null = null;

  if (hasMetallicItem) {
    quotationDoc = {
      status: "QUOTATION",

      customerName: sale.customerName,
      documentNumber: sale.documentNumber,
      customerDocument: sale.customerDocument,
      customerAddress: sale.customerAddress || "",
      contactName: sale.contactName || "",
      contactPhone: sale.contactPhone || "",
      sellerId: sale.sellerId || "SISTEMA",
      currency: sale.currency,
      exchangeRateApplied: sale.exchangeRateApplied || 1,
      documentType: sale.documentType,
      items: updatedItems,
      skus: skusArray,
      businessLines: sale.businessLines,
      totalAmount: sale.totalAmount,
      totalCost: sale.totalCost,
      totalProfit: calculatedTotalProfit,
      totalWeight: sale.totalWeight || 0,
      paymentStatus: sale.paymentStatus || "PAID",
      allFlags,
      timestamp,
      ...(uploadedAt ? { uploadedAt } : {}),
      createdBy: sale.createdBy || "SISTEMA",

      relatedSaleId: sale.documentNumber,
      metadata: {
        ...saleDoc.metadata,
        isQuotation: true,
      },
    };
  }

  return {
    saleDoc,
    quotationDoc,
  };
}

