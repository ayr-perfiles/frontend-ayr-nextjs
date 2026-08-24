import { adminDb } from "@/services/firebase/admin";

/**
 * Obtiene el siguiente correlativo para una serie específica (Ej: "F001")
 * y actualiza el contador de forma atómica y segura.
 */
export async function getNextSequence(serie: string): Promise<string> {
  const counterRef = adminDb.collection("sunatCounters").doc(serie);

  return await adminDb.runTransaction(async (transaction) => {
    const doc = await transaction.get(counterRef);
    let nextValue = 1;

    if (doc.exists) {
      nextValue = (doc.data()?.current || 0) + 1;
    }

    // Guardamos el nuevo valor
    transaction.set(
      counterRef,
      {
        current: nextValue,
        updatedAt: new Date(),
      },
      { merge: true },
    );

    // La SUNAT exige 6 a 8 dígitos. Rellenamos con ceros a la izquierda (Ej: 000015)
    return nextValue.toString().padStart(6, "0");
  });
}
