"use client";

import { useState, useEffect, useMemo } from "react";
import { Coil } from "@/types";
import { processSingleStrip } from "@/services/productionService";
import { getCatalog, ProductConfig } from "@/services/catalogService";
import { useAuth } from "@/context/AuthContext"; // <-- Importamos el contexto de autenticación
import {
  CheckCircle2,
  Factory,
  X,
  Info,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

export function ConsumeStripForm({
  coil,
  onClose,
}: {
  coil: Coil;
  onClose: () => void;
}) {
  const { user } = useAuth(); // <-- Extraemos el usuario autenticado actual

  const availableStrips =
    coil.plannedStrips?.filter((s) => s.pendingCount > 0) || [];
  const [selectedSku, setSelectedSku] = useState<string>(
    availableStrips[0]?.sku || "",
  );
  const [pieces, setPieces] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- NUEVO ESTADO: CATÁLOGO PARA CÁLCULO DE RENDIMIENTO ---
  const [catalog, setCatalog] = useState<ProductConfig[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  useEffect(() => {
    const fetchCatalog = async () => {
      const data = await getCatalog();
      setCatalog(data);
      setIsLoadingCatalog(false);
    };
    fetchCatalog();
  }, []);

  // --- CÁLCULO DE PIEZAS ESPERADAS (MÁXIMO TEÓRICO) ---
  const expectedPieces = useMemo(() => {
    if (
      !selectedSku ||
      !catalog.length ||
      !coil.initialWeight ||
      !coil.masterWidth
    )
      return 0;

    const product = catalog.find((p) => p.sku === selectedSku);
    if (!product || !product.standardWeight) return 0;

    const activeStrip = availableStrips.find((s) => s.sku === selectedSku);
    if (!activeStrip) return 0;

    // Fórmula: Peso del fleje exacto dividido entre lo que pesa 1 pieza
    const weightPerMm = coil.initialWeight / coil.masterWidth;
    const stripWeight = activeStrip.width * weightPerMm;

    return Math.floor(stripWeight / product.standardWeight);
  }, [selectedSku, catalog, coil, availableStrips]);

  // Frontend validation (5% de tolerancia igual que en el backend)
  const isExceeding =
    typeof pieces === "number" && pieces > Math.ceil(expectedPieces * 1.05);

  const handleSubmit = async () => {
    if (!selectedSku || !pieces || isExceeding) return;
    setIsSubmitting(true);

    const processPromise = processSingleStrip(
      coil.id,
      selectedSku,
      Number(pieces),
      user?.email || "Operador", // <-- Usamos el email del usuario real aquí
    );

    toast
      .promise(processPromise, {
        loading: "Procesando fleje...",
        success: `¡Completado! Se sumaron ${pieces} piezas al stock.`,
        error: (err) => err.message || "Error procesando el fleje.",
      })
      .then(() => {
        onClose();
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (availableStrips.length === 0)
    return (
      <div className="p-6 text-center text-gray-500 font-bold relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 hover:bg-gray-100 rounded-full"
        >
          <X size={20} />
        </button>
        No quedan flejes disponibles en esta bobina.
      </div>
    );

  if (isLoadingCatalog) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl">
        <Loader2 size={32} className="animate-spin text-orange-600 mb-4" />
        <p className="text-gray-500 font-bold">
          Calculando parámetros de máquina...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* CABECERA */}
      <div className="flex justify-between items-center bg-orange-50 p-6 border-b border-orange-200">
        <div>
          <h3 className="font-black text-orange-900 flex items-center gap-2">
            <Factory size={20} /> Paso 2: Conformadora
          </h3>
          <p className="text-sm text-orange-700">
            Consumo de flejes de la bobina {coil.id}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-orange-200 rounded-full transition text-orange-800"
        >
          <X size={24} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="space-y-4">
          {/* SELECCIÓN DE FLEJE */}
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
                      className="w-5 h-5 text-orange-600 focus:ring-orange-500"
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

          {/* INPUT DE PIEZAS CON GUÍA VISUAL */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-xs font-bold text-gray-500 uppercase">
                Cantidad de piezas resultantes
              </label>
              {expectedPieces > 0 && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-1 rounded-md flex items-center gap-1">
                  <Info size={12} /> Máx. Esperado: ~{expectedPieces}
                </span>
              )}
            </div>

            <input
              type="number"
              className={`w-full p-4 border-2 rounded-xl text-4xl font-black text-center outline-none transition-colors ${
                isExceeding
                  ? "border-red-400 text-red-600 bg-red-50 focus:border-red-500"
                  : "border-green-300 text-green-700 focus:border-green-500 placeholder-gray-200"
              }`}
              placeholder="0"
              value={pieces}
              onChange={(e) =>
                setPieces(e.target.value ? Number(e.target.value) : "")
              }
            />

            {/* ALERTA DE EXCESO DE MERMA INVERSA (MAGIA/FRAUDE) */}
            {isExceeding && (
              <p className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1">
                <AlertTriangle size={14} />
                Físicamente imposible. Máximo permitido:{" "}
                {Math.ceil(expectedPieces * 1.05)} (incluye margen error
                balanza).
              </p>
            )}

            {/* MENSAJE DE EFICIENCIA NORMAL */}
            {typeof pieces === "number" &&
              !isExceeding &&
              expectedPieces > 0 && (
                <p className="mt-2 text-xs font-bold text-gray-400 flex justify-between">
                  <span>Eficiencia reportada:</span>
                  <span
                    className={
                      pieces < expectedPieces * 0.9
                        ? "text-orange-500"
                        : "text-green-500"
                    }
                  >
                    {((pieces / expectedPieces) * 100).toFixed(1)}%
                  </span>
                </p>
              )}
          </div>
        </div>
      </div>
      <div className="p-6 bg-gray-50 border-t mt-auto">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !pieces || isExceeding}
          className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 disabled:bg-gray-300 transition active:scale-95"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          {isSubmitting ? "REGISTRANDO..." : "REGISTRAR PRODUCCIÓN"}
        </button>
      </div>
    </div>
  );
}
