/**
 * Copia server-side (dominio 100% puro, sin dependencias) de `isImportedQuotation`
 * (`src/core/import/salesImportLogic.ts:9-11`).
 *
 * Duplicación: patrón sancionado del repo (ADR "Dominio puro" + parity test). Los 4
 * bloqueos al import cross-boundary están detallados en `../catalog/classifyLine.ts`;
 * acá aplican los mismos, y el archivo de origen además arrastra el importador entero.
 *
 * ── Por qué las DOS señales y no una ──
 * `buildImportWrites` (`salesImportLogic.ts:56-66`) escribe SIEMPRE y sin condición ambas
 * al crear una percha:
 *     relatedSaleId: sale.documentNumber
 *     metadata: { ...importMetadata, isQuotation: true }
 * Chequear solo una dejaría pasar un doc al que le falte esa. Verificado en prod
 * (v6.51.0): 130/130 perchas importadas tienen `relatedSaleId`; la única cotización
 * nativa no tiene ninguna de las dos.
 *
 * ── Por qué NO el prefijo `COT-` ──
 * Descartado como criterio frágil en v6.48.2: es una convención de id, no un dato.
 */

export interface ImportedQuotationInput {
  relatedSaleId?: string;
  metadata?: { isQuotation?: boolean } | null;
}

export function isImportedQuotation(sale: ImportedQuotationInput | null | undefined): boolean {
  return Boolean(sale && (sale.relatedSaleId || sale.metadata?.isQuotation));
}
