"use client";

import React, { useState } from "react";
import { X, Scissors, AlertTriangle, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { Coil } from "@/types";
import { splitCoilAction } from "@/core/coils/services/splitCoilService";
import { validateAndCalculateSplit } from "@/core/coils/domain/coilPricing";
import { useAuth } from "@/context/AuthContext";

interface SplitCoilModalProps {
  coil: Coil;
  onClose: () => void;
  onSuccess: () => void;
}

export function SplitCoilModal({ coil, onClose, onSuccess }: SplitCoilModalProps) {
  const { user } = useAuth();
  const [childWidthMm, setChildWidthMm] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const masterWidth = coil.masterWidth ?? 0;
  const widthNum = Number(childWidthMm);
  const isValidWidth = widthNum > 0 && widthNum < masterWidth;

  const preview = isValidWidth && masterWidth > 0
    ? validateAndCalculateSplit(
        { currentWeight: coil.currentWeight, masterWidth, status: coil.status },
        widthNum,
      )
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidWidth) return;

    setLoading(true);
    try {
      const { childId } = await splitCoilAction(coil.id, widthNum, user?.email ?? "admin");
      toast.success(`Slitting completado. Hija creada: ${childId}`);
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al partir la bobina.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2.5 rounded-xl">
              <Scissors size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Slitting de Bobina</h2>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">
                {coil.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Info bobina padre */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Ancho maestro:</span>
              <span className="font-black text-slate-800">{masterWidth} mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Peso actual:</span>
              <span className="font-black text-slate-800">
                {coil.currentWeight.toLocaleString("es-PE")} kg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Costo S/.kg:</span>
              <span className="font-black text-emerald-700">
                S/ {coil.pricePerKg.toFixed(4)}
              </span>
            </div>
            {coil.finish && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Acabado:</span>
                <span className="font-black text-blue-700">{coil.finish}</span>
              </div>
            )}
          </div>

          {/* Input ancho de la hija */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2">
              Ancho de la bobina hija (mm) *
            </label>
            <input
              type="number"
              step="1"
              min="1"
              max={masterWidth - 1}
              className={`w-full border-2 rounded-xl p-3 text-base font-black outline-none transition ${
                childWidthMm !== "" && !isValidWidth
                  ? "border-red-300 bg-red-50 text-red-800"
                  : "border-slate-200 bg-white focus:border-amber-400"
              }`}
              placeholder={`1 – ${masterWidth - 1} mm`}
              value={childWidthMm}
              onChange={(e) => setChildWidthMm(e.target.value)}
              autoFocus
            />
            {childWidthMm !== "" && !isValidWidth && (
              <p className="text-red-500 text-xs font-bold mt-1.5">
                Debe ser mayor a 0 y menor a {masterWidth} mm
              </p>
            )}
          </div>

          {/* Preview resultado */}
          {preview && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest">
                Resultado del slitting
              </p>
              <div className="flex items-stretch gap-3 text-sm">
                <div className="flex-1 bg-white rounded-lg p-3 border border-amber-200 space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Padre (queda)</p>
                  <p className="font-black text-slate-800">
                    {preview.newParentWidth} mm
                  </p>
                  <p className="text-slate-600 font-bold text-xs">
                    {preview.newParentWeight.toLocaleString("es-PE", { maximumFractionDigits: 2 })} kg
                  </p>
                  <p className="text-[10px] text-emerald-600 font-bold">
                    S/ {coil.pricePerKg.toFixed(4)}/kg
                  </p>
                </div>
                <div className="flex items-center">
                  <ChevronRight size={20} className="text-amber-400 shrink-0" />
                </div>
                <div className="flex-1 bg-white rounded-lg p-3 border border-amber-200 space-y-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Hija (nueva)</p>
                  <p className="font-black text-amber-700">
                    {widthNum} mm
                  </p>
                  <p className="text-slate-600 font-bold text-xs">
                    {preview.childWeight.toLocaleString("es-PE", { maximumFractionDigits: 2 })} kg
                  </p>
                  <p className="text-[10px] text-emerald-600 font-bold">
                    S/ {coil.pricePerKg.toFixed(4)}/kg
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[10px] text-amber-700">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                <span>
                  Costo S/.kg heredado sin recalcular. Peso proporcional al ancho. Ambas bobinas quedan DISPONIBLES.
                </span>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-black text-sm hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValidWidth || loading}
              className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-black text-sm hover:bg-amber-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Scissors size={16} />
              {loading ? "Procesando..." : "Confirmar Slitting"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
