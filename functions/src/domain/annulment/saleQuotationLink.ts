/**
 * Copia server-side (Admin SDK, sin dependencias de Firebase) de
 * `src/core/sales/saleProductionLink.ts`. Dominio 100% puro — la duplicación es el
 * patrón sancionado del repo (ver ADR "Dominio puro: copia canónica en
 * functions/src/domain/ + TEST DE PARIDAD vs copia cliente", CLAUDE.md §10).
 * Import cross-boundary directo NO es viable: functions/tsconfig.json tiene
 * rootDir:"src" — cualquier archivo fuera de functions/src/ rompe `tsc` (TS6059) y,
 * aunque compilara, firebase.json acota `source:"functions"` para el deploy (el zip
 * subido nunca incluiría ../../../src/). Mantener en sync a mano; el parity test
 * (__tests__/saleQuotationLink.parity.test.ts) es la única red de seguridad.
 */

export type SaleQuotationLink =
  | { mode: "self"; quotationId: string }
  | { mode: "linked"; quotationId: string }
  | { mode: "none" };

export interface SaleQuotationLinkInput {
  id?: string;
  status?: string;
  relatedQuotationId?: string;
  originQuoteId?: string;
}

export function resolveSaleQuotationLink(sale: SaleQuotationLinkInput): SaleQuotationLink {
  if (sale.status === "QUOTATION") {
    return { mode: "self", quotationId: sale.id ?? "" };
  }

  const relatedQuotationId = sale.relatedQuotationId?.trim();
  if (relatedQuotationId) {
    return { mode: "linked", quotationId: relatedQuotationId };
  }

  const originQuoteId = sale.originQuoteId?.trim();
  if (originQuoteId) {
    return { mode: "linked", quotationId: originQuoteId };
  }

  return { mode: "none" };
}
