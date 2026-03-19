"use client";

import { useState } from "react";
import { Coil } from "@/types";
import { processSingleStrip } from "@/services/productionService";
import { CheckCircle2, Factory } from "lucide-react";

export function ConsumeStripForm({
  coil,
  onClose,
}: {
  coil: Coil;
  onClose: () => void;
}) {
  const availableStrips =
    coil.plannedStrips?.filter((s) => s.pendingCount > 0) || [];
  const [selectedSku, setSelectedSku] = useState<string>(
    availableStrips[0]?.sku || "",
  );
  const [pieces, setPieces] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedSku || !pieces) return;
    setIsSubmitting(true);
    try {
      await processSingleStrip(
        coil.id,
        selectedSku,
        Number(pieces),
        "OPERADOR_ACTUAL",
      );
      alert(`¡Completado! Se sumaron ${pieces} piezas al stock.`);
      onClose();
    } catch (error: any) {
      alert(error.message || "Error procesando el fleje.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (availableStrips.length === 0)
    return (
      <div className="p-6 text-center text-gray-500">No quedan flejes.</div>
    );

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 space-y-6">
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
          <h3 className="font-black text-orange-900 flex items-center gap-2">
            <Factory size={20} /> Paso 2: Conformadora
          </h3>
          <p className="text-sm text-orange-700">
            Consumo de flejes de la bobina {coil.id}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
              Selecciona el fleje a procesar
            </label>
            <div className="grid gap-2">
              {availableStrips.map((strip) => (
                <label
                  key={strip.sku}
                  className={`p-4 border-2 rounded-xl cursor-pointer flex justify-between items-center transition-all ${selectedSku === strip.sku ? "border-orange-500 bg-orange-50" : "border-gray-200"}`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked={selectedSku === strip.sku}
                      onChange={() => setSelectedSku(strip.sku)}
                      className="w-5 h-5 text-orange-600"
                    />
                    <span className="font-bold text-lg text-gray-800">
                      {strip.sku}
                    </span>
                  </div>
                  <span className="bg-white px-3 py-1 rounded-full text-sm font-bold border">
                    Quedan {strip.pendingCount}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
              Cantidad de piezas resultantes
            </label>
            <input
              type="number"
              className="w-full p-4 border-2 border-green-300 rounded-xl text-2xl font-black text-green-700 focus:ring-green-500 outline-none"
              placeholder="Ej: 390"
              value={pieces}
              onChange={(e) =>
                setPieces(e.target.value ? Number(e.target.value) : "")
              }
            />
          </div>
        </div>
      </div>
      <div className="p-6 bg-gray-50 border-t mt-auto">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !pieces}
          className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-300"
        >
          {isSubmitting ? (
            "Procesando..."
          ) : (
            <>
              <CheckCircle2 size={20} /> Consumir 1 Fleje y Sumar Stock
            </>
          )}
        </button>
      </div>
    </div>
  );
}
