import type { SaleTwinPath } from "./resolveSaleTwinPath";

/**
 * Copia server-side de src/core/sales/annulment/buildAnnulmentCascade.ts — ver nota
 * de duplicación en saleQuotationLink.ts. Simplificación consciente vs la copia
 * cliente: el original tipa `sale: Sale & {id, relatedQuotationId?, originQuoteId?}`
 * (Sale importado de "@/types", también cross-boundary); acá alcanza con los 4
 * campos que la función realmente lee.
 */

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

export interface AnnulmentSaleInput {
  id: string;
  documentNumber?: string;
  relatedQuotationId?: string;
  originQuoteId?: string;
}

export interface BuildCascadeInput {
  sale: AnnulmentSaleInput;
  twinPath: SaleTwinPath;
  userEmail: string;
  reason?: string;
}

export function buildAnnulmentCascade(input: BuildCascadeInput): AnnulmentCascadePlan {
  const { sale, twinPath, userEmail, reason } = input;

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
        annulledSaleRefs: `ARRAY_UNION:${JSON.stringify(ref)}`,
      },
    });
  }

  const auditDetails = `Se anulo la venta ${sale.id} (path: ${twinPath}). Stock devuelto.${
    reason ? ` Motivo: ${reason}.` : ""
  }`;

  return {
    writes,
    auditAction: "VOID_SALE",
    auditDetails,
  };
}
