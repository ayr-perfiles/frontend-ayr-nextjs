"use client";

import { useState } from "react";
import { Coil, CuttingPlanItem } from "@/types";
import { PRODUCT_CATALOG } from "@/config/products";
import { Plus, CheckCircle2 } from "lucide-react";

interface DailyProgressFormProps {
  coil: Coil;
  onClose: () => void;
}

export function DailyProgressForm({ coil, onClose }: DailyProgressFormProps) {
  // Estado para guardar cuántas piezas anota el operador HOY
  const [dailyEntries, setDailyEntries] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEntryChange = (itemId: string, value: string) => {
    setDailyEntries((prev) => ({
      ...prev,
      [itemId]: Number(value),
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Aquí llamaremos al nuevo servicio logDailyProduction
    // que sumará estas piezas al acumulado de la bobina y al stock de ventas.
    setTimeout(() => {
      alert("Avance de turno registrado correctamente.");
      setIsSubmitting(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 overflow-y-auto space-y-6">
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
          <h3 className="text-lg font-black text-orange-900">
            Registro de Turno - {coil.id}
          </h3>
          <p className="text-sm text-orange-700">
            Anota la cantidad de parantes producidos hoy.
          </p>
        </div>

        <div className="space-y-4">
          {coil.cuttingPlan?.map((item: CuttingPlanItem) => {
            const product =
              PRODUCT_CATALOG[item.sku as keyof typeof PRODUCT_CATALOG];
            const piecesToday = dailyEntries[item.id] || 0;

            return (
              <div
                key={item.id}
                className="p-4 border rounded-xl shadow-sm flex items-center justify-between gap-4"
              >
                {/* Info del Fleje */}
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-lg">
                    {item.sku} - {product.name}
                  </p>
                  <p className="text-xs text-gray-500 uppercase font-medium">
                    {item.stripCount} Flejes en máquina
                  </p>
                  <p className="text-xs text-blue-600 font-bold mt-1">
                    Acumulado histórico: {item.producedPieces} pzas
                  </p>
                </div>

                {/* Input de Producción de HOY */}
                <div className="w-40 text-right space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">
                    Producido HOY
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-bold">
                      <Plus size={16} />
                    </span>
                    <input
                      type="number"
                      min="0"
                      className="w-full p-2 border-2 border-green-200 rounded-md text-right font-bold text-green-700 focus:ring-green-500"
                      placeholder="Ej: 500"
                      value={piecesToday === 0 ? "" : piecesToday}
                      onChange={(e) =>
                        handleEntryChange(item.id, e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6 bg-gray-50 border-t mt-auto flex gap-3">
        <button className="px-4 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-100">
          Cerrar Bobina (Terminada)
        </button>
        <button
          onClick={handleSubmit}
          disabled={
            isSubmitting || Object.values(dailyEntries).every((v) => v === 0)
          }
          className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-300"
        >
          <CheckCircle2 size={20} /> Guardar Avance de Hoy
        </button>
      </div>
    </div>
  );
}
