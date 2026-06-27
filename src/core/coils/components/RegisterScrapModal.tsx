"use client";

import React, { useState } from "react";
import { X, AlertTriangle, Scale } from "lucide-react";
import toast from "react-hot-toast";
import { Coil } from "@/types";
import { registerCoilScrap } from "@/core/coils/services/scrapService";
import { calculateScrapCost, calculateNewWeight } from "@/core/coils/domain/scrap";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";

interface RegisterScrapModalProps {
  coil: Coil;
  onClose: () => void;
  onSuccess: () => void;
}

export function RegisterScrapModal({
  coil,
  onClose,
  onSuccess,
}: RegisterScrapModalProps) {
  const { user, role } = useAuth();
  const confirm = useConfirm();

  const [scrapWeightKgStr, setScrapWeightKgStr] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const scrapWeightKg = Number(scrapWeightKgStr);
  const isValidWeight = scrapWeightKg > 0;
  const isValidReason = reason.trim().length > 0;
  const canSubmit = isValidWeight && isValidReason && !loading;

  const currentWeight = coil.currentWeight ?? 0;
  const pricePerKg = coil.pricePerKg ?? 0;

  const costPreview = isValidWeight
    ? calculateScrapCost(scrapWeightKg, pricePerKg)
    : null;

  const newWeightPreview = isValidWeight
    ? calculateNewWeight(currentWeight, scrapWeightKg)
    : null;

  const willGoNegative =
    newWeightPreview !== null && newWeightPreview < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const confirmed = await confirm({
      title: "Confirmar Merma",
      message: (
        <div className="space-y-2 text-sm">
          <p>
            Se registrarán <strong>{scrapWeightKg} kg</strong> de merma en la
            bobina <strong>{coil.id}</strong>.
          </p>
          <p className="text-amber-700 font-bold">
            Costo de la merma: S/ {costPreview?.toFixed(2)}
          </p>
          {willGoNegative && (
            <p className="text-red-600 font-bold">
              ⚠ El peso quedará negativo ({newWeightPreview?.toFixed(2)} kg).
            </p>
          )}
          <p className="text-slate-500">Esta acción no se puede deshacer.</p>
        </div>
      ),
      variant: "warning",
      confirmLabel: "Registrar Merma",
    });

    if (!confirmed) return;

    setLoading(true);
    try {
      const result = await registerCoilScrap({
        coilId: coil.id,
        scrapWeightKg,
        reason,
      });

      if (result.hasNegativeCoilWarning) {
        toast.success(
          `Merma registrada. Peso resultante: ${result.newWeight.toFixed(2)} kg (bobina en negativo — revisar).`,
          { duration: 6000 },
        );
      } else {
        toast.success(
          `Merma de ${scrapWeightKg} kg registrada. S/ ${result.scrapCostPEN.toFixed(2)} contabilizados.`,
        );
      }

      onSuccess();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al registrar la merma.",
      );
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
              <Scale size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Registrar Merma
              </h2>
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
          {/* Info bobina */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Peso actual:</span>
              <span className="font-black text-slate-800">
                {currentWeight.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}{" "}
                kg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Costo S/.kg:</span>
              <span className="font-black text-emerald-700">
                S/ {pricePerKg.toFixed(4)}
              </span>
            </div>
          </div>

          {/* Peso de merma */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2">
              Peso de merma (kg) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className={`w-full border-2 rounded-xl p-3 text-base font-black outline-none transition ${
                scrapWeightKgStr !== "" && !isValidWeight
                  ? "border-red-300 bg-red-50 text-red-800"
                  : "border-slate-200 bg-white focus:border-amber-400"
              }`}
              placeholder="Ej: 25.50"
              value={scrapWeightKgStr}
              onChange={(e) => setScrapWeightKgStr(e.target.value)}
              autoFocus
            />
            {scrapWeightKgStr !== "" && !isValidWeight && (
              <p className="text-red-500 text-xs font-bold mt-1.5">
                Debe ser mayor a 0 kg
              </p>
            )}
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-2">
              Motivo de inspección *
            </label>
            <textarea
              rows={3}
              className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-medium outline-none transition focus:border-amber-400 resize-none"
              placeholder="Ej: Borde de slitting, defecto de laminación, despunte inicial…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {!isValidReason && reason.length > 0 && (
              <p className="text-red-500 text-xs font-bold mt-1.5">
                El motivo es obligatorio
              </p>
            )}
          </div>

          {/* Preview del costo */}
          {costPreview !== null && newWeightPreview !== null && (
            <div
              className={`rounded-xl p-4 space-y-2 border ${
                willGoNegative
                  ? "bg-red-50 border-red-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <p
                className={`text-[11px] font-black uppercase tracking-widest ${
                  willGoNegative ? "text-red-700" : "text-amber-700"
                }`}
              >
                Vista previa
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-bold">
                  Costo de la merma:
                </span>
                <span className="font-black text-slate-800">
                  S/ {costPreview.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-bold">
                  Peso resultante:
                </span>
                <span
                  className={`font-black ${
                    willGoNegative ? "text-red-700" : "text-slate-800"
                  }`}
                >
                  {newWeightPreview.toFixed(2)} kg
                </span>
              </div>

              {willGoNegative && (
                <div className="flex items-start gap-2 text-[11px] text-red-700 font-bold pt-1">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>
                    El peso quedará negativo. La bobina pasará a estado
                    PROCESADA. Verifique los datos antes de continuar.
                  </span>
                </div>
              )}
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
              disabled={!canSubmit}
              className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-black text-sm hover:bg-amber-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <AlertTriangle size={16} />
              {loading ? "Registrando..." : "Confirmar Merma"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
