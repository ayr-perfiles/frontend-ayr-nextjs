import { NextResponse } from 'next/server';
import { initAdmin } from "@/lib/firebase/adminApp";

/**
 * GET /api/scripts/backfill-coil-finish
 * Actualiza bobinas masivamente:
 * - finish: "GALVANIZADO" si no existe.
 * - metadata.currency: "PEN" si no existe.
 * - metadata.exchangeRate: 1 si no existe.
 */
export async function GET() {
  try {
    const adminApp = initAdmin();
    const db = adminApp.firestore();

    const collRef = db.collection("coils");
    const snap = await collRef.get();

    const batch = db.batch();
    let count = 0;

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const updates: any = {};
      let hasChanges = false;

      // 1. Backfill Finish
      if (!data.finish) {
        updates.finish = "GALVANIZADO";
        hasChanges = true;
      }

      // 2. Backfill Financial Metadata
      if (!data.metadata?.currency) {
        updates["metadata.currency"] = "PEN";
        hasChanges = true;
      }
      
      const currentRate = data.metadata?.exchangeRate;
      const currentCurrency = updates["metadata.currency"] || data.metadata?.currency;

      if (!currentRate && currentCurrency === "PEN") {
        updates["metadata.exchangeRate"] = 1;
        hasChanges = true;
      } else if (!currentRate && !currentCurrency) {
        updates["metadata.exchangeRate"] = 1;
        hasChanges = true;
      }

      if (hasChanges) {
        batch.update(docSnap.ref, updates);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      return NextResponse.json({ 
        message: `Backfill completado: ${count} bobinas actualizadas con acabado y/o metadatos financieros.` 
      });
    } else {
      return NextResponse.json({ message: "No se encontraron bobinas que requieran actualización." });
    }
  } catch (error: any) {
    console.error("[API Backfill Coil Finish]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
