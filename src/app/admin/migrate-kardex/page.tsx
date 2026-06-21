"use client";

import { useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  where,
} from "firebase/firestore";
import {
  Loader2,
  DatabaseZap,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

import { useConfirm } from "@/context/ConfirmContext";

export default function MigrateKardexPage() {
  const confirm = useConfirm();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const runMigration = async () => {
    if (
      !(await confirm({
        title: "Recalcular Kardex",
        message: "⚠️ ¿Deseas recalcular todo el Kardex? Esto limpiará errores anteriores.",
        variant: "warning",
      }))
    )
      return;

    setIsLoading(true);
    setProgress("Iniciando escaneo de base de datos...");

    try {
      // 1. ELIMINAR EL KARDEX CORRUPTO ANTERIOR
      setProgress("Limpiando registros antiguos para evitar duplicados...");
      const oldKardexSnap = await getDocs(collection(db, "kardex_movements"));
      const oldKardexDocs = oldKardexSnap.docs;

      for (let i = 0; i < oldKardexDocs.length; i += 450) {
        const chunk = oldKardexDocs.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // 2. OBTENER PRODUCCIÓN Y VENTAS
      setProgress("Descargando historial de producción...");
      const prodSnap = await getDocs(collection(db, "production_logs"));

      setProgress("Descargando historial de ventas cerradas...");
      const salesQuery = query(
        collection(db, "sales"),
        where("status", "==", "COMPLETED"),
      );
      const salesSnap = await getDocs(salesQuery);

      setProgress("Procesando y agrupando movimientos...");
      const rawMovements: any[] = [];

      prodSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === "VOIDED") return;
        rawMovements.push({
          sku: data.sku,
          date: data.timestamp?.toDate() || new Date(),
          type: "IN",
          quantity: data.piecesProduced || 0,
          reference: data.parentCoilId || "Histórico",
          description: "Ingreso por Producción",
          user: data.operatorId || "Sistema",
        });
      });

      salesSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach((item: any) => {
            rawMovements.push({
              sku: item.sku,
              date: data.timestamp?.toDate() || new Date(),
              type: "OUT",
              quantity: item.quantity || 0,
              reference: docSnap.id,
              description: `Venta a ${data.customerName}`,
              user: data.sellerId || "Sistema",
            });
          });
        }
      });

      // 3. AGRUPAR, DESEMPATAR FECHAS IDÉNTICAS Y CALCULAR
      setProgress("Calculando saldos con precisión de milisegundos...");
      const movementsBySku: Record<string, any[]> = {};
      rawMovements.forEach((m) => {
        if (!movementsBySku[m.sku]) movementsBySku[m.sku] = [];
        movementsBySku[m.sku].push(m);
      });

      const finalKardexData: any[] = [];
      Object.keys(movementsBySku).forEach((sku) => {
        const skuMovements = movementsBySku[sku];

        // ORDEN SECUENCIAL CORRECTO (Entradas primero, luego fechas)
        skuMovements.sort((a, b) => {
          if (a.date.getTime() === b.date.getTime()) {
            if (a.type !== b.type) return a.type === "IN" ? -1 : 1;
            return a.reference.localeCompare(b.reference);
          }
          return a.date.getTime() - b.date.getTime();
        });

        let runningBalance = 0;
        let lastTime = 0;

        skuMovements.forEach((m) => {
          // EL TRUCO MAGISTRAL: Aseguramos que ninguna fecha sea matemáticamente idéntica
          let currentTime = m.date.getTime();
          if (currentTime <= lastTime) {
            currentTime = lastTime + 1; // Sumamos 1 milisegundo para desempatar
            m.date = new Date(currentTime);
          }
          lastTime = currentTime;

          runningBalance =
            m.type === "IN"
              ? runningBalance + m.quantity
              : runningBalance - m.quantity;

          finalKardexData.push({
            sku: m.sku,
            date: m.date,
            type: m.type,
            quantity: m.quantity,
            balance: runningBalance,
            reference: m.reference,
            description: m.description,
            user: m.user,
          });
        });
      });

      // 4. SUBIDA A FIREBASE
      setProgress(
        `Subiendo ${finalKardexData.length} registros estructurados...`,
      );
      const CHUNK_SIZE = 450;
      let chunksProcessed = 0;

      for (let i = 0; i < finalKardexData.length; i += CHUNK_SIZE) {
        const chunk = finalKardexData.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((mov) => {
          const newDocRef = doc(collection(db, "kardex_movements"));
          batch.set(newDocRef, mov);
        });

        await batch.commit();
        chunksProcessed++;
        setProgress(
          `Subiendo lote ${chunksProcessed} de ${Math.ceil(finalKardexData.length / CHUNK_SIZE)}...`,
        );
      }

      setIsSuccess(true);
      toast.success("Migración completada con éxito. Matemáticas corregidas.");
    } catch (error: any) {
      console.error(error);
      toast.error("Error durante la migración: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-20 p-8 bg-white rounded-3xl shadow-xl border border-slate-200 text-center">
      <div className="flex justify-center mb-6">
        <div className="bg-blue-50 p-4 rounded-full text-blue-600">
          <DatabaseZap size={48} />
        </div>
      </div>

      <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">
        Migración de Kardex (Reparación de Empates)
      </h1>
      <p className="text-slate-500 font-medium mb-8">
        Eliminará los registros corrompidos y recalculará la matemática
        agregando milisegundos a las fechas empatadas de los Excel.
      </p>

      {isSuccess ? (
        <div className="bg-emerald-50 text-emerald-700 p-6 rounded-2xl border border-emerald-200 flex flex-col items-center">
          <CheckCircle2 size={48} className="mb-4" />
          <h2 className="text-xl font-black">¡Datos Restaurados!</h2>
          <p className="mt-2 font-medium">
            Revisa la tabla, el orden ya debe ser el correcto.
          </p>
        </div>
      ) : (
        <button
          onClick={runMigration}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-95 transition disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" /> {progress}
            </>
          ) : (
            "🚀 RECALCULAR KARDEX AHORA"
          )}
        </button>
      )}
    </div>
  );
}
