import { db } from '@/lib/firebase/clientApp';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { Coil } from '@/types';
import { validateAndCalculateSplit } from '@/core/coils/domain/coilPricing';

function generateChildId(parentId: string): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${parentId}-S${suffix}`;
}

/**
 * Slitting longitudinal: parte la bobina por ANCHO.
 * newChildWidthMm < parent.masterWidth (validado en dominio).
 * El peso de la hija es proporcional al ancho cortado.
 */
export async function splitCoilAction(
  coilId: string,
  newChildWidthMm: number,
  userEmail: string,
): Promise<{ childId: string }> {
  const parentRef = doc(db, 'coils', coilId);
  let resolvedChildId = '';

  await runTransaction(db, async (transaction) => {
    // ── FASE 1: LECTURAS ───────────────────────────────────────────────────
    const parentSnap = await transaction.get(parentRef);
    if (!parentSnap.exists()) throw new Error(`La bobina ${coilId} no existe.`);

    const parent = parentSnap.data() as Coil;

    if (parent.masterWidth == null) {
      throw new Error(`La bobina ${coilId} no tiene ancho maestro definido.`);
    }

    // ── FASE 2: CÁLCULOS (validación pura, sin I/O) ───────────────────────
    const { childWeight, newParentWeight, newParentWidth, newParentStatus } =
      validateAndCalculateSplit(
        { currentWeight: parent.currentWeight, masterWidth: parent.masterWidth, status: parent.status },
        newChildWidthMm,
      );

    const childId = generateChildId(coilId);
    resolvedChildId = childId;

    const childRef = doc(db, 'coils', childId);
    const kardexParentRef = doc(collection(db, 'kardex_movements'));
    const kardexChildRef = doc(collection(db, 'kardex_movements'));
    const auditRef = doc(collection(db, 'audit_logs'));

    // ── FASE 3: ESCRITURAS ─────────────────────────────────────────────────
    transaction.update(parentRef, {
      masterWidth: newParentWidth,
      currentWeight: newParentWeight,
      status: newParentStatus,
      updatedAt: serverTimestamp(),
    });

    transaction.set(childRef, {
      id: childId,
      initialWeight: childWeight,
      currentWeight: childWeight,
      masterWidth: newChildWidthMm,
      thickness: parent.thickness ?? null,
      finish: parent.finish ?? null,
      pricePerKg: parent.pricePerKg,
      status: 'AVAILABLE',
      parentCoilId: coilId,
      registeredBy: userEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      metadata: {
        ...(parent.metadata ?? {}),
        splitFrom: coilId,
        isManualEntry: false,
      },
    });

    // Kardex OUT del padre (peso que sale hacia la hija)
    transaction.set(kardexParentRef, {
      sku: coilId,
      date: serverTimestamp(),
      type: 'OUT',
      quantity: 1,
      weightKg: childWeight,
      costPerKg: parent.pricePerKg,
      balance: newParentWeight,
      reference: childId,
      description: `Slitting → hija ${childId} (${newChildWidthMm} mm / ${childWeight} kg)`,
      user: userEmail,
    });

    // Kardex IN de la hija
    transaction.set(kardexChildRef, {
      sku: childId,
      date: serverTimestamp(),
      type: 'IN',
      quantity: 1,
      weightKg: childWeight,
      costPerKg: parent.pricePerKg,
      balance: childWeight,
      reference: coilId,
      description: `Originada por slitting de ${coilId} (${newChildWidthMm} mm / ${childWeight} kg)`,
      user: userEmail,
    });

    transaction.set(auditRef, {
      action: 'SPLIT_COIL',
      entityId: coilId,
      userEmail,
      details: `Slitting: ${newChildWidthMm} mm → hija ${childId} (${childWeight} kg). Padre queda ${newParentWidth} mm / ${newParentWeight} kg (${newParentStatus}).`,
      timestamp: serverTimestamp(),
    });
  });

  return { childId: resolvedChildId };
}
