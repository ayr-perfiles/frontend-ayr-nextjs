import type { Sale } from "@/types";
import type { SaleTwinPath } from "./resolveSaleTwinPath";

export interface CascadeWriteOp {
  target: "sale" | "quote";
  docPath: string;
  op: "update";
  fields: Record<string, unknown>;
}

export interface AnnulmentCascadePlan {
  writes: CascadeWriteOp[];
  auditAction: "VOID_SALE";
  auditDetails: string;
}

/**
 * Extensión de lectura: `relatedQuotationId`/`originQuoteId` no están en el `Sale`
 * canónico (mismo patrón que `SaleQuotationLinkInput`, saleProductionLink.ts) — acá
 * además se exige `id` no-opcional porque el plan de cascada necesita armar docPaths.
 */
export type AnnulmentSaleInput = Sale & {
  id: string;
  relatedQuotationId?: string;
  originQuoteId?: string;
};

/**
 * Qué le pasó REALMENTE al stock al anular. Solo afecta el texto del audit.
 *  - `returned`   venta normal: se devolvió el stock que la venta había descontado.
 *  - `withdrawn`  NOTA DE CRÉDITO con `ncStockAction: 'RETURNS_STOCK'`: la NC había
 *                 REPUESTO stock al importarse, así que anularla lo retira.
 *  - `none`       no se tocó stock (cotización que nunca descontó, NC money-only,
 *                 venta sin ítems de stock).
 */
export type StockEffect = "returned" | "withdrawn" | "none";

export interface BuildCascadeInput {
  sale: AnnulmentSaleInput;
  twinPath: SaleTwinPath;
  userEmail: string;
  reason?: string;
  /** Default `"returned"`: preserva byte a byte el detalle histórico del audit. */
  stockEffect?: StockEffect;
}

const STOCK_EFFECT_LABEL: Record<StockEffect, string> = {
  returned: "Stock devuelto.",
  withdrawn: "Stock retirado.",
  none: "Sin efecto en stock.",
};

export function buildAnnulmentCascade(input: BuildCascadeInput): AnnulmentCascadePlan {
  const { sale, twinPath, userEmail, reason, stockEffect = "returned" } = input;

  const saleWrite: CascadeWriteOp = {
    target: "sale",
    docPath: `sales/${sale.id}`,
    op: "update",
    fields: {
      status: "VOIDED",
      voidedAt: "SERVER_TIMESTAMP",
      voidedBy: userEmail,
      ...(reason ? { voidedReason: reason } : {}),
    },
  };

  const writes: CascadeWriteOp[] = [saleWrite];
  const saleNumber = sale.documentNumber ?? sale.id;

  if (twinPath === "native") {
    writes.push({
      target: "quote",
      docPath: `sales/${sale.originQuoteId}`,
      op: "update",
      fields: {
        status: "QUOTATION",
        updatedAt: "SERVER_TIMESTAMP",
        annulledSaleRef: {
          saleId: sale.id,
          saleNumber,
          annulledAt: "SERVER_TIMESTAMP",
          annulledBy: userEmail,
          ...(reason ? { reason } : {}),
        },
        convertedToId: "DELETE_FIELD",
        approvedAt: "DELETE_FIELD",
        costSyncedAt: "DELETE_FIELD",
      },
    });
  } else if (twinPath === "imported") {
    const ref = {
      saleId: sale.id,
      saleNumber,
      annulledAt: "SERVER_TIMESTAMP",
      annulledBy: userEmail,
      ...(reason ? { reason } : {}),
    };

    writes.push({
      target: "quote",
      docPath: `sales/${sale.relatedQuotationId}`,
      op: "update",
      fields: {
        // Cumple lo que `cancelQuotation` ya le promete al usuario ("para revertir,
        // anule la venta"): la percha de una venta anulada deja de matchear
        // PRODUCTION_QUEUE_FILTER (exige status==='QUOTATION') y sale de la cola.
        status: "CANCELLED",
        annulledSaleRefs: `ARRAY_UNION:${JSON.stringify(ref)}`,
      },
    });
  }

  const auditDetails = `Se anulo la venta ${sale.id} (path: ${twinPath}). ${
    STOCK_EFFECT_LABEL[stockEffect]
  }${reason ? ` Motivo: ${reason}.` : ""}`;

  return {
    writes,
    auditAction: "VOID_SALE",
    auditDetails,
  };
}
