import { algoliaClient, ALGOLIA_INDICES } from '@/lib/algoliaClient';
import { db } from '@/lib/firebase/clientApp';
import { buildAggregateStatusFilter, buildListStatusFilter } from '@/core/sales/salesAggregateLogic';
import {
  collection,
  doc,
  documentId,
  endBefore,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  count,
  getDocs,
  limit,
  limitToLast,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getStockStrategy } from '../strategies';
import type { BusinessLine, SaleItem } from '@/types';

// Re-export para compatibilidad con consumidores que usen el tipo directamente
export type { BusinessLine };

/** CartItem es SaleItem enriquecido — lo que la UI pone en el carrito */
export type CartItem = SaleItem;

const SETTINGS_DOC_ID = 'general_settings';

import { buildSaleDoc, buildQuotationDoc } from '../domain/saleDocBuilder';

// ─── processSale ──────────────────────────────────────────────────────────────

export const processSale = async (
  customerName: string,
  customerDocument: string,
  documentNumber: string,
  cart: CartItem[],
  sellerId: string,
  customerAddress = '',
  contactName = '',
  contactPhone = '',
): Promise<{ success: true; id: string }> => {
  let generatedSaleId = '';

  await runTransaction(db, async (transaction) => {
    // ── FASE 1: TODAS LAS LECTURAS ──────────────────────────────────────────
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const settingsDoc = await transaction.get(settingsRef);

    // key = "businessLine:sku" para evitar colisiones entre líneas con mismo SKU
    const stockSnapshots = new Map<string, DocumentSnapshot>();
    const coilSnapshots = new Map<string, DocumentSnapshot>();

    for (const item of cart) {
      if (item.isCoil) {
        coilSnapshots.set(item.sku, await transaction.get(doc(db, 'coils', item.sku)));
      } else {
        const line: BusinessLine = item.businessLine ?? 'drywall';
        const key = `${line}:${item.sku}`;
        if (!stockSnapshots.has(key)) {
          const strategy = getStockStrategy(line);
          stockSnapshots.set(key, await transaction.get(strategy.getStockRef(item.sku)));
        }
      }
    }

    // ── FASE 2: CÁLCULOS (sin I/O) ──────────────────────────────────────────
    const nextNum: number = settingsDoc.exists() ? (settingsDoc.data().nextSaleNumber ?? 1) : 1;
    const saleId = `V-${String(nextNum).padStart(6, '0')}`;
    const saleRef = doc(db, 'sales', saleId);
    generatedSaleId = saleId;

    let totalAmount = 0;
    let totalCost = 0;
    let totalWeight = 0;
    const businessLines = new Set<BusinessLine>();

    for (const item of cart) {
      totalAmount += item.quantity * item.unitPrice;
      totalCost += item.quantity * item.baseCost;
      totalWeight += item.quantity * (item.unitWeight ?? 0);
      businessLines.add(item.businessLine ?? 'drywall');
    }

    // ── FASE 3: ESCRITURAS ──────────────────────────────────────────────────
    transaction.set(settingsRef, { nextSaleNumber: nextNum + 1 }, { merge: true });

    for (const item of cart) {
      if (item.isCoil) {
        const snap = coilSnapshots.get(item.sku);
        if (!snap?.exists()) throw new Error(`La bobina ${item.sku} no existe.`);
        if (snap.data().status !== 'AVAILABLE') throw new Error(`La bobina ${item.sku} no está disponible.`);

        const coilData = snap.data();
        transaction.update(doc(db, 'coils', item.sku), {
          status: 'SOLD',
          soldAt: serverTimestamp(),
          soldBy: sellerId,
          saleReference: saleId,
        });
        transaction.set(doc(collection(db, 'kardex_movements')), {
          sku: item.sku,
          date: serverTimestamp(),
          type: 'OUT',
          quantity: 1,
          weightKg: coilData.currentWeight ?? 0,
          costPerKg: coilData.pricePerKg ?? 0,
          balance: 0,
          reference: saleId,
          description: `Venta de Materia Prima a ${customerName}`,
          user: sellerId,
        });
      } else {
        const line: BusinessLine = item.businessLine ?? 'drywall';
        const strategy = getStockStrategy(line);
        const snap = stockSnapshots.get(`${line}:${item.sku}`) ?? null;
        const currentQty = snap ? strategy.extractQuantity(snap) : 0;
        const avgCost = snap ? strategy.extractAvgCost(snap) : item.baseCost;
        const newBalance = currentQty - item.quantity;

        // Stock negativo permitido — ADR-005: decisión de negocio
        strategy.writeSaleDecrement(
          { sku: item.sku, quantity: item.quantity, newBalance, saleId, customerName, sellerId, avgCost },
          snap,
          transaction,
        );
      }
    }

    const saleDocData = buildSaleDoc({
      customerName,
      customerDocument,
      documentNumber,
      contactName,
      contactPhone,
      customerAddress,
      items: cart,
      sellerId,
    }, serverTimestamp());

    transaction.set(saleRef, saleDocData);
  });

  return { success: true, id: generatedSaleId };
};

// ─── createQuotation ──────────────────────────────────────────────────────────

export const createQuotation = async (
  customerName: string,
  customerDocument: string,
  documentNumber: string,
  cart: CartItem[],
  sellerId: string,
  customerAddress = '',
  contactName = '',
  contactPhone = '',
): Promise<{ success: true; id: string }> => {
  let generatedId = '';

  await runTransaction(db, async (transaction) => {
    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const settingsDoc = await transaction.get(settingsRef);

    const nextNum: number = settingsDoc.exists() ? (settingsDoc.data().nextQuotationNumber ?? 1) : 1;
    const quoteId = `C-${String(nextNum).padStart(6, '0')}`;
    generatedId = quoteId;

    let totalAmount = 0;
    let totalCost = 0;
    let totalWeight = 0;
    const businessLines = new Set<BusinessLine>();

    for (const item of cart) {
      totalAmount += item.quantity * item.unitPrice;
      totalCost += item.quantity * item.baseCost;
      totalWeight += item.quantity * (item.unitWeight ?? 0);
      businessLines.add(item.businessLine ?? 'drywall');
    }

    const skusArray = Array.from(new Set(cart.map((i) => i.sku)));

    transaction.set(settingsRef, { nextQuotationNumber: nextNum + 1 }, { merge: true });

    const quoteDocData = buildQuotationDoc({
      customerName,
      customerDocument,
      documentNumber,
      contactName,
      contactPhone,
      customerAddress,
      items: cart,
      sellerId,
    }, serverTimestamp());

    transaction.set(doc(db, 'sales', quoteId), quoteDocData);
  });

  return { success: true, id: generatedId };
};

// ─── confirmQuotationForProduction ─────────────────────────────────────────────

/**
 * Confirma una cotización para producción: NO aprueba la venta (eso es
 * approveQuotation), solo habilita el paso a producción para las líneas
 * metallic-roofing. Idempotente: si ya está CONFIRMED, no pisa
 * confirmedForProductionAt/confirmedBy originales (early-return, mismo patrón
 * que voidCoilScrap/reverseCoilSplit).
 */
export const confirmQuotationForProduction = async (
  quotationId: string,
  userEmail: string,
): Promise<{ success: true }> => {
  const quoteRef = doc(db, 'sales', quotationId);

  await runTransaction(db, async (transaction) => {
    const quoteDoc = await transaction.get(quoteRef);
    if (!quoteDoc.exists()) throw new Error('La cotización no existe.');

    const quoteData = quoteDoc.data();
    if (quoteData.productionStatus === 'CONFIRMED') {
      return;
    }

    transaction.update(quoteRef, {
      productionStatus: 'CONFIRMED',
      isFulfilled: false,
      confirmedForProductionAt: serverTimestamp(),
      confirmedBy: userEmail,
    });
  });

  return { success: true };
};

// ─── approveQuotation ─────────────────────────────────────────────────────────

export const approveQuotation = async (quotationId: string): Promise<{ success: true }> => {
  const quoteRef = doc(db, 'sales', quotationId);

  await runTransaction(db, async (transaction) => {
    // ── LECTURAS ────────────────────────────────────────────────────────────
    const quoteDoc = await transaction.get(quoteRef);
    if (!quoteDoc.exists()) throw new Error('La cotización no existe.');

    const quoteData = quoteDoc.data();
    if (quoteData.status === 'COMPLETED' || quoteData.status === 'CONVERTED') {
      throw new Error('Esta cotización ya fue aprobada.');
    }
    if (quoteData.relatedSaleId || quoteData.metadata?.isQuotation || quoteData.metadata?.isHistorical) {
      throw new Error('Esta cotización proviene de una venta ya facturada; no se aprueba, solo sirve para registrar producción.');
    }


    const settingsRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const settingsDoc = await transaction.get(settingsRef);

    const stockSnapshots = new Map<string, DocumentSnapshot>();
    const coilSnapshots = new Map<string, DocumentSnapshot>();

    for (const item of quoteData.items as CartItem[]) {
      if (item.isCoil) {
        coilSnapshots.set(item.sku, await transaction.get(doc(db, 'coils', item.sku)));
      } else {
        const line: BusinessLine = item.businessLine ?? 'drywall';
        const key = `${line}:${item.sku}`;
        if (!stockSnapshots.has(key)) {
          const strategy = getStockStrategy(line);
          stockSnapshots.set(key, await transaction.get(strategy.getStockRef(item.sku)));
        }
      }
    }

    // ── ESCRITURAS ──────────────────────────────────────────────────────────
    const nextNum: number = settingsDoc.exists() ? (settingsDoc.data().nextSaleNumber ?? 1) : 1;
    const newSaleId = `V-${String(nextNum).padStart(6, '0')}`;
    const newSaleRef = doc(db, 'sales', newSaleId);

    transaction.set(settingsRef, { nextSaleNumber: nextNum + 1 }, { merge: true });

    const businessLines = new Set<BusinessLine>();

    for (const item of quoteData.items as CartItem[]) {
      businessLines.add(item.businessLine ?? 'drywall');

      if (item.isCoil) {
        const snap = coilSnapshots.get(item.sku);
        if (!snap?.exists()) throw new Error(`La bobina ${item.sku} no existe.`);
        if (snap.data().status !== 'AVAILABLE') throw new Error(`La bobina ${item.sku} no está disponible.`);

        const coilData = snap.data();
        transaction.update(doc(db, 'coils', item.sku), {
          status: 'SOLD',
          soldAt: serverTimestamp(),
          soldBy: quoteData.sellerId ?? 'sistema',
          saleReference: newSaleId,
        });
        transaction.set(doc(collection(db, 'kardex_movements')), {
          sku: item.sku,
          date: serverTimestamp(),
          type: 'OUT',
          quantity: 1,
          weightKg: coilData.currentWeight ?? 0,
          costPerKg: coilData.pricePerKg ?? 0,
          balance: 0,
          reference: newSaleId,
          description: `Conversión Cot. ${quotationId} (Materia Prima)`,
          user: quoteData.sellerId ?? 'sistema',
        });
      } else {
        const line: BusinessLine = item.businessLine ?? 'drywall';
        const strategy = getStockStrategy(line);
        const snap = stockSnapshots.get(`${line}:${item.sku}`) ?? null;
        const currentQty = snap ? strategy.extractQuantity(snap) : 0;
        const avgCost = snap ? strategy.extractAvgCost(snap) : (item.baseCost ?? 0);
        const newBalance = currentQty - item.quantity;

        // Stock negativo permitido — ADR-005
        strategy.writeSaleDecrement(
          {
            sku: item.sku,
            quantity: item.quantity,
            newBalance,
            saleId: newSaleId,
            customerName: quoteData.customerName,
            sellerId: quoteData.sellerId ?? 'sistema',
            avgCost,
          },
          snap,
          transaction,
        );
      }
    }

    const skusArray = Array.from(new Set((quoteData.items as CartItem[]).map((i) => i.sku)));

    transaction.set(newSaleRef, {
      ...quoteData,
      skus: skusArray,
      businessLines: Array.from(businessLines),
      status: 'COMPLETED',
      approvedAt: serverTimestamp(),
      originQuoteId: quotationId,
    });

    transaction.update(quoteRef, {
      status: 'CONVERTED',
      convertedToId: newSaleId,
      updatedAt: serverTimestamp(),
    });
  });

  return { success: true };
};

// ─── annulSale ────────────────────────────────────────────────────────────────

export interface AnnulSaleParams {
  saleId: string;
  userEmail: string;
}

export const annulSale = async ({ saleId, userEmail }: AnnulSaleParams): Promise<{ success: true }> => {
  const saleRef = doc(db, 'sales', saleId);
  const auditRef = doc(collection(db, 'audit_logs'));

  await runTransaction(db, async (transaction) => {
    // ── LECTURAS ────────────────────────────────────────────────────────────
    const saleDoc = await transaction.get(saleRef);
    if (!saleDoc.exists()) throw new Error('La venta no existe.');

    const saleData = saleDoc.data();
    if (saleData.status === 'VOIDED') throw new Error('Esta venta ya ha sido anulada.');

    const stockSnapshots = new Map<string, DocumentSnapshot>();
    const coilSnapshots = new Map<string, DocumentSnapshot>();

    for (const item of saleData.items as CartItem[]) {
      if (item.isCoil) {
        coilSnapshots.set(item.sku, await transaction.get(doc(db, 'coils', item.sku)));
      } else if (item.sku && item.sku !== 'GENERIC') {
        const line: BusinessLine = item.businessLine ?? 'drywall';
        const key = `${line}:${item.sku}`;
        if (!stockSnapshots.has(key)) {
          const strategy = getStockStrategy(line);
          stockSnapshots.set(key, await transaction.get(strategy.getStockRef(item.sku)));
        }
      }
    }

    let quoteSnap = null;
    let quoteRef = null;
    if (saleData.originQuoteId) {
      quoteRef = doc(db, 'sales', saleData.originQuoteId);
      quoteSnap = await transaction.get(quoteRef);
    }

    // ── ESCRITURAS ──────────────────────────────────────────────────────────
    for (const item of saleData.items as CartItem[]) {
      if (item.isCoil) {
        const coilSnap = coilSnapshots.get(item.sku);
        const coilData = coilSnap?.data();
        transaction.update(doc(db, 'coils', item.sku), {
          status: 'AVAILABLE',
          soldAt: null,
          soldBy: null,
          saleReference: null,
          updatedAt: serverTimestamp(),
        });
        transaction.set(doc(collection(db, 'kardex_movements')), {
          sku: item.sku,
          date: serverTimestamp(),
          type: 'IN',
          quantity: 1,
          weightKg: coilData?.currentWeight ?? 0,
          costPerKg: coilData?.pricePerKg ?? 0,
          balance: 1,
          reference: saleId,
          description: `Anulación Venta MP: ${saleData.customerName}`,
          user: userEmail,
        });
      } else if (item.sku && item.sku !== 'GENERIC') {
        const line: BusinessLine = item.businessLine ?? 'drywall';
        const strategy = getStockStrategy(line);
        const snap = stockSnapshots.get(`${line}:${item.sku}`) ?? null;
        const currentQty = snap ? strategy.extractQuantity(snap) : 0;
        const newBalance = currentQty + item.quantity;

        strategy.writeSaleReversal(
          {
            sku: item.sku,
            quantity: item.quantity,
            newBalance,
            saleId,
            customerName: saleData.customerName,
            sellerId: userEmail,
            frozenCost: item.baseCost ?? 0,
          },
          snap,
          transaction,
        );
      }
    }

    if (quoteRef && quoteSnap?.exists()) {
      transaction.update(quoteRef, {
        status: 'QUOTATION',
        updatedAt: serverTimestamp(),
        annulledSaleRef: saleId,
      });
    }

    transaction.update(saleRef, {
      status: 'VOIDED',
      voidedAt: serverTimestamp(),
      voidedBy: userEmail,
    });

    transaction.set(auditRef, {
      action: 'VOID_SALE',
      entityId: saleId,
      userEmail,
      details: `Se anuló la venta ${saleId}. El stock fue devuelto.`,
      timestamp: serverTimestamp(),
    });
  });

  return { success: true };
};

// ─── fetchSales ───────────────────────────────────────────────────────────────

export interface FetchSalesParams {
  pageSize: number;
  statusFilter: string;
  searchTerm: string;
  startDate: string;
  endDate: string;
  customerDoc?: string | null;
  businessLine?: BusinessLine | 'ALL' | '';
  sunatFilter?: string;
  /** Filtro exacto opcional sobre sales.productionStatus (ej. selector de producción metallic). */
  productionStatusFilter?: string;
  direction?: 'first' | 'next' | 'prev';
  cursorDoc?: QueryDocumentSnapshot<DocumentData> | null;
  page?: number;
  skipAggregates?: boolean;
}

export const fetchSales = async (params: FetchSalesParams) => {
  const {
    pageSize,
    statusFilter,
    searchTerm,
    startDate,
    endDate,
    customerDoc,
    businessLine,
    sunatFilter,
    productionStatusFilter,
    direction = 'first',
    cursorDoc,
    page = 0,
    skipAggregates = false,
  } = params;

  // ── MOTOR ALGOLIA ─────────────────────────────────────────────────────────
  if (searchTerm.trim().length > 0 && !customerDoc) {
    let filters = statusFilter !== 'ALL' ? `status:${statusFilter}` : '';
    if (sunatFilter && sunatFilter !== 'ALL') {
      filters += (filters ? ' AND ' : '') + `sunat.estado:${sunatFilter}`;
    }

    const { hits, nbPages, page: currentPage, nbHits } = await algoliaClient.searchSingleIndex({
      indexName: ALGOLIA_INDICES.SALES ?? 'sales_index',
      searchParams: { query: searchTerm, filters, hitsPerPage: pageSize, page },
    });

    const hitIds = (hits as Array<{ objectID: string }>).map((h) => h.objectID);
    let sales: Record<string, unknown>[] = [];

    if (hitIds.length > 0) {
      const snap = await getDocs(query(collection(db, 'sales'), where(documentId(), 'in', hitIds)));
      const firestoreDocs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));

      sales = hitIds
        .map((id) => firestoreDocs.find((d) => d.id === id))
        .filter(Boolean) as Record<string, unknown>[];
    }

    return { sales, isAlgolia: true, algoliaData: { totalPages: nbPages, currentPage, nbHits }, firstDoc: null, lastDoc: null, totalCount: nbHits, aggregates: null };
  }

  // ── MOTOR FIRESTORE ───────────────────────────────────────────────────────
  const collRef = collection(db, 'sales');
  const commonConstraints: QueryConstraint[] = [];
  const hasDateFilter = !!startDate && !!endDate;

  if (customerDoc) {
    commonConstraints.push(where('documentNumber', '==', customerDoc));
  }

  if (businessLine && businessLine !== 'ALL') {
    commonConstraints.push(where('businessLines', 'array-contains', businessLine));
  }

  if (productionStatusFilter) {
    commonConstraints.push(where('productionStatus', '==', productionStatusFilter));
  }

  if (sunatFilter && sunatFilter !== 'ALL') {
    commonConstraints.push(where('sunat.estado', '==', sunatFilter));
  }

  if (hasDateFilter) {
    commonConstraints.push(where('timestamp', '>=', new Date(`${startDate}T00:00:00`)));
    commonConstraints.push(where('timestamp', '<=', new Date(`${endDate}T23:59:59`)));
  }

  // 1. Constraints para la LISTA (tabla)
  const listStatusList = buildListStatusFilter(statusFilter);
  const listConstraints: QueryConstraint[] = [];
  if (statusFilter === 'ALL') {
    if (!customerDoc) {
      listConstraints.push(where('status', 'in', listStatusList));
    }
  } else {
    listConstraints.push(where('status', '==', statusFilter));
  }
  listConstraints.push(...commonConstraints);
  listConstraints.push(orderBy('timestamp', 'desc'));

  // 2. Constraints para AGREGADOS
  const { statuses: aggregateStatuses, label: metricLabel } = buildAggregateStatusFilter(statusFilter);

  let totalCount = 0;
  let listTotalCount = 0;
  let aggregates = { totalAmount: 0, totalProfit: 0, totalWeight: 0 };

  if (!skipAggregates) {
    // A. Count para la LISTA (tabla / paginación)
    if (listStatusList.length > 0) {
      const listCountSnap = await getCountFromServer(query(collRef, ...listConstraints));
      listTotalCount = listCountSnap.data().count;
    } else {
      listTotalCount = 0;
    }

    // B. Count + Sum para los AGREGADOS (tarjetas de métricas)
    if (aggregateStatuses.length > 0) {
      const aggregateConstraints: QueryConstraint[] = [];
      if (aggregateStatuses.length === 1) {
        aggregateConstraints.push(where('status', '==', aggregateStatuses[0]));
      } else {
        aggregateConstraints.push(where('status', 'in', aggregateStatuses));
      }
      aggregateConstraints.push(...commonConstraints);

      const aggregateSnapshot = await getAggregateFromServer(query(collRef, ...aggregateConstraints), {
        count: count(),
        totalAmount: sum('totalAmount'),
        totalProfit: sum('totalProfit'),
        totalWeight: sum('totalWeight'),
      });

      const aggregateData = aggregateSnapshot.data();
      totalCount = aggregateData.count;
      aggregates = {
        totalAmount: aggregateData.totalAmount || 0,
        totalProfit: aggregateData.totalProfit || 0,
        totalWeight: aggregateData.totalWeight || 0,
      };
    } else {
      totalCount = 0;
      aggregates = { totalAmount: 0, totalProfit: 0, totalWeight: 0 };
    }
  }

  const paginationConstraints = [...listConstraints];

  if (direction === 'next' && cursorDoc) {
    paginationConstraints.push(startAfter(cursorDoc));
    paginationConstraints.push(limit(pageSize));
  } else if (direction === 'prev' && cursorDoc) {
    paginationConstraints.push(endBefore(cursorDoc));
    paginationConstraints.push(limitToLast(pageSize));
  } else {
    paginationConstraints.push(limit(pageSize));
  }

  const snapshot = await getDocs(query(collRef, ...paginationConstraints));
  let sales = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as Record<string, unknown>[];


  if (statusFilter === 'ALL' && customerDoc) {
    sales = sales.filter((s) => ['COMPLETED', 'QUOTATION', 'CONVERTED'].includes(s.status as string));
  }

  return {
    sales,
    isAlgolia: false,
    firstDoc: snapshot.docs.length > 0 ? snapshot.docs[0] : null,
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    totalCount,
    listTotalCount,
    aggregates,
    metricLabel,
  };
};



// ─── getProductionQueueCount ──────────────────────────────────────────────────

/**
 * Criterio único de la cola de producción (ETAPA 1, /production/queue).
 * Fuente compartida para que el count del badge nunca diverja del filtro real de la página.
 */
export const PRODUCTION_QUEUE_FILTER = {
  status: 'QUOTATION',
  productionStatus: 'CONFIRMED',
  businessLine: 'metallic-roofing',
} as const;

/** Count barato (agregación, cero lectura de docs) de cotizaciones en la cola de producción. */
export const getProductionQueueCount = async (): Promise<number> => {
  const collRef = collection(db, 'sales');
  const snap = await getCountFromServer(
    query(
      collRef,
      where('status', '==', PRODUCTION_QUEUE_FILTER.status),
      where('productionStatus', '==', PRODUCTION_QUEUE_FILTER.productionStatus),
      where('businessLines', 'array-contains', PRODUCTION_QUEUE_FILTER.businessLine),
      where('isFulfilled', '==', false),
    ),
  );
  return snap.data().count;
};

// ─── updateQuotation ──────────────────────────────────────────────────────────

export const updateQuotation = async (
  quotationId: string,
  customerName: string,
  documentNumber: string,
  cart: CartItem[],
  customerAddress = '',
  contactName = '',
  contactPhone = '',
): Promise<{ success: true }> => {
  const quoteRef = doc(db, 'sales', quotationId);

  await runTransaction(db, async (transaction) => {
    const quoteDoc = await transaction.get(quoteRef);
    if (!quoteDoc.exists()) throw new Error('La cotización no existe.');
    if (quoteDoc.data().status !== 'QUOTATION') {
      throw new Error('Solo puedes editar documentos en estado COTIZACIÓN.');
    }

    let totalAmount = 0;
    let totalCost = 0;
    let totalWeight = 0;
    const businessLines = new Set<BusinessLine>();

    for (const item of cart) {
      totalAmount += item.quantity * item.unitPrice;
      totalCost += item.quantity * item.baseCost;
      totalWeight += item.quantity * (item.unitWeight ?? 0);
      businessLines.add(item.businessLine ?? 'drywall');
    }

    const skusArray = Array.from(new Set(cart.map((i) => i.sku)));

    transaction.update(quoteRef, {
      customerName,
      documentNumber,
      customerAddress,
      contactName,
      contactPhone,
      items: cart,
      skus: skusArray,
      businessLines: Array.from(businessLines),
      totalAmount,
      totalCost,
      totalProfit: totalAmount - totalCost,
      totalWeight,
      updatedAt: serverTimestamp(),
    });
  });

  return { success: true };
};

// ─── cancelQuotation ──────────────────────────────────────────────────────────

export const cancelQuotation = async (
  quotationId: string,
  userEmail: string,
): Promise<{ success: true }> => {
  const quoteRef = doc(db, 'sales', quotationId);
  const auditRef = doc(collection(db, 'audit_logs'));

  await runTransaction(db, async (transaction) => {
    const quoteDoc = await transaction.get(quoteRef);
    if (!quoteDoc.exists()) throw new Error('La cotización no existe.');
    if (quoteDoc.data().status !== 'QUOTATION') throw new Error('Solo puedes cancelar Cotizaciones.');

    transaction.update(quoteRef, {
      status: 'CANCELLED',
      cancelledAt: serverTimestamp(),
      cancelledBy: userEmail,
    });
    transaction.set(auditRef, {
      action: 'CANCEL_QUOTATION',
      entityId: quotationId,
      userEmail,
      details: `El cliente rechazó/canceló la cotización ${quotationId}.`,
      timestamp: serverTimestamp(),
    });
  });

  return { success: true };
};

