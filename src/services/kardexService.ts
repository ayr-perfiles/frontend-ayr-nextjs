import { db } from "@/lib/firebase/clientApp";
import { collection, getDocs, query, where } from "firebase/firestore";

export interface KardexMovement {
  id: string;
  date: Date;
  type: "IN" | "OUT";
  quantity: number;
  balance: number;
  reference: string; // Ej: V-00001 o PD03-08
  description: string;
  user: string;
}

export const getKardexHistory = async (
  sku: string,
): Promise<KardexMovement[]> => {
  try {
    // 1. OBTENER ENTRADAS (Producción)
    const qProd = query(
      collection(db, "production_logs"),
      where("sku", "==", sku),
    );
    const prodSnap = await getDocs(qProd);

    const prodMovements = prodSnap.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.timestamp?.toDate() || new Date(),
          type: "IN" as const,
          quantity: data.piecesProduced || 0,
          reference: data.parentCoilId || "Desconocido",
          description: "Producción de Bobina",
          user: data.operatorId || "Sistema",
          status: data.status,
        };
      })
      .filter((m) => m.status !== "VOIDED"); // Ignoramos producciones anuladas

    // 2. OBTENER SALIDAS (Ventas)
    // Como los items están dentro de un array, traemos las ventas completadas y filtramos en memoria
    const qSales = query(
      collection(db, "sales"),
      where("status", "==", "COMPLETED"),
    );
    const salesSnap = await getDocs(qSales);

    const salesMovements: any[] = [];
    salesSnap.docs.forEach((doc) => {
      const data = doc.data();
      // Buscamos si en esta venta se vendió el SKU que estamos consultando
      const item = data.items?.find((i: any) => i.sku === sku);

      if (item) {
        salesMovements.push({
          id: doc.id,
          date: data.timestamp?.toDate() || new Date(),
          type: "OUT" as const,
          quantity: item.quantity || 0,
          reference: doc.id,
          description: `Venta a ${data.customerName}`,
          user: data.sellerId || "Sistema",
        });
      }
    });

    // 3. FUSIONAR Y ORDENAR CRONOLÓGICAMENTE (Del más antiguo al más nuevo)
    const allMovements = [...prodMovements, ...salesMovements].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    // 4. CALCULAR SALDO CORRIENTE (Running Balance)
    let currentBalance = 0;
    const calculatedMovements = allMovements.map((m) => {
      if (m.type === "IN") {
        currentBalance += m.quantity;
      } else {
        currentBalance -= m.quantity;
      }
      return { ...m, balance: currentBalance };
    });

    // Devolvemos el array invertido para que el movimiento más reciente salga arriba
    return calculatedMovements.reverse();
  } catch (error) {
    console.error("Error obteniendo Kardex:", error);
    return [];
  }
};
