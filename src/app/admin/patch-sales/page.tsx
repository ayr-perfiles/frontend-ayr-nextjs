"use client";

import { useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import {
  Loader2,
  DatabaseZap,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

import { useConfirm } from "@/context/ConfirmContext";

export default function PatchSalesPage() {
  const confirm = useConfirm();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const runPatch = async () => {
    if (
      !(await confirm({
        title: "Parche Estructural",
        message: "⚠️ ¿Deseas actualizar la estructura de las ventas antiguas?",
        variant: "warning",
      }))
    )
      return;

    setIsLoading(true);
    setProgress("Descargando historial de ventas...");

    try {
      // 1. Obtener todas las ventas
      const salesSnap = await getDocs(collection(db, "sales"));
      const salesDocs = salesSnap.docs;

      setProgress(`Procesando ${salesDocs.length} facturas...`);

      // 2. Preparar los lotes de actualización (Límite 500 por lote)
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      let actualizadas = 0;

      for (const saleDoc of salesDocs) {
        const data = saleDoc.data();

        // Si ya tiene el array de skus, la saltamos para ahorrar recursos
        if (data.skus && Array.isArray(data.skus) && data.skus.length > 0) {
          continue;
        }

        // Si tiene items, extraemos los SKUs únicos
        if (data.items && Array.isArray(data.items)) {
          const skusArray = Array.from(
            new Set(data.items.map((i: any) => i.sku).filter(Boolean)),
          );

          if (skusArray.length > 0) {
            if (opCount >= 450) {
              batches.push(currentBatch);
              currentBatch = writeBatch(db);
              opCount = 0;
            }

            // Actualizamos el documento añadiendo el campo 'skus'
            currentBatch.update(doc(db, "sales", saleDoc.id), {
              skus: skusArray,
            });

            opCount++;
            actualizadas++;
          }
        }
      }

      if (opCount > 0) batches.push(currentBatch);

      setProgress(`Subiendo ${actualizadas} ventas actualizadas a Firebase...`);

      // 3. Subir a Firebase
      await Promise.all(batches.map((b) => b.commit()));

      setIsSuccess(true);
      toast.success(`Parche completado: ${actualizadas} ventas actualizadas.`);
    } catch (error: any) {
      console.error(error);
      toast.error("Error durante el parche: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-20 p-8 bg-white rounded-3xl shadow-xl border border-slate-200 text-center">
      <div className="flex justify-center mb-6">
        <div className="bg-purple-50 p-4 rounded-full text-purple-600">
          <DatabaseZap size={48} />
        </div>
      </div>

      <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">
        Parche Estructural de Ventas
      </h1>
      <p className="text-slate-500 font-medium mb-8">
        Este script inyectará el índice{" "}
        <code className="bg-slate-100 px-2 py-1 rounded text-slate-700">
          skus: []
        </code>{" "}
        en tus ventas antiguas para que el nuevo Kardex súper rápido pueda
        encontrarlas.
      </p>

      {isSuccess ? (
        <div className="bg-emerald-50 text-emerald-700 p-6 rounded-2xl border border-emerald-200 flex flex-col items-center">
          <CheckCircle2 size={48} className="mb-4" />
          <h2 className="text-xl font-black">¡Datos Parcheados!</h2>
          <p className="mt-2 font-medium">
            Tus ventas antiguas ya son 100% compatibles con la nueva
            arquitectura. Ya puedes borrar este archivo.
          </p>
        </div>
      ) : (
        <button
          onClick={runPatch}
          disabled={isLoading}
          className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-purple-700 active:scale-95 transition disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" /> {progress}
            </>
          ) : (
            "🚀 INYECTAR ÍNDICE DE BÚSQUEDA AHORA"
          )}
        </button>
      )}
    </div>
  );
}
