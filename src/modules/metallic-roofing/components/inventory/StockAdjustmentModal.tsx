"use client";

import { X, AlertTriangle, TrendingUp, TrendingDown, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import { adjustStock, type AdjustStockInput } from "../../services/stockAdjustmentService";
import type { InventoryItem } from "../../services/inventoryService";
import { useForm } from "@/core/hooks/useForm";
import { stockAdjustmentFormSchema, type StockAdjustmentFormValues } from "@/modules/metallic-roofing/schemas/stockAdjustment";

interface Props {
  item: InventoryItem;
  performedBy: string;
  onClose: () => void;
  onSuccess: () => void;
}

type AdjustmentType = AdjustStockInput["type"];

const TYPE_CONFIG: Record<AdjustmentType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  ENTRY: {
    label: "Entrada",
    icon: <TrendingUp size={14} />,
    color: "bg-emerald-600 text-white",
    description: "Recepción por compra u otras fuentes",
  },
  EXIT: {
    label: "Salida",
    icon: <TrendingDown size={14} />,
    color: "bg-red-600 text-white",
    description: "Salida por daño, merma o devolución",
  },
  ADJUSTMENT: {
    label: "Ajuste",
    icon: <SlidersHorizontal size={14} />,
    color: "bg-blue-600 text-white",
    description: "Corrección por inventario físico",
  },
};

export default function StockAdjustmentModal({ item, performedBy, onClose, onSuccess }: Props) {
  const initialValues: StockAdjustmentFormValues = {
    type: "ENTRY",
    quantity: "",
    unitCost: "",
    reason: "",
  };

  const { values, setValues, errors, setErrors, validate, isSubmitting, setIsSubmitting } =
    useForm<StockAdjustmentFormValues>(stockAdjustmentFormSchema, initialValues);

  const qty = parseFloat(values.quantity) || 0;
  const cost = parseFloat(values.unitCost) || 0;

  const currentQty = item.quantity;
  const previewDelta =
    values.type === "ENTRY" ? qty : values.type === "EXIT" ? -qty : qty - currentQty;
  const previewQty = currentQty + previewDelta;
  const willBeNegative = previewQty < 0;

  let previewAvgCost = item.avgCost;
  if (values.type === "ENTRY" && cost > 0 && qty > 0) {
    const existingValue = currentQty > 0 ? currentQty * item.avgCost : 0;
    const totalQtyAfter = (currentQty > 0 ? currentQty : 0) + qty;
    previewAvgCost = (existingValue + qty * cost) / totalQtyAfter;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await adjustStock({
        sku: item.sku,
        type: values.type,
        quantity: qty,
        unitCost: values.type === "ENTRY" ? cost : undefined,
        reason: values.reason.trim(),
        performedBy,
      });
      toast.success(`Stock de ${item.sku} ajustado correctamente.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al ajustar stock.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 bg-blue-600 text-white flex justify-between items-start">
          <div>
            <h2 className="text-lg font-black">Ajustar Stock</h2>
            <p className="text-blue-200 text-xs font-bold mt-0.5">
              {item.sku} · {item.product?.displayName ?? item.productName}
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-5">
          {/* Type selector */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Tipo de ajuste
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["ENTRY", "EXIT", "ADJUSTMENT"] as AdjustmentType[]).map((t) => {
                const cfg = TYPE_CONFIG[t];
                const isActive = values.type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setValues((prev) => ({ ...prev, type: t }));
                      setErrors((prev) => ({ ...prev, unitCost: undefined }));
                    }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition font-bold text-xs ${
                      isActive
                        ? `border-transparent ${cfg.color}`
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 font-medium mt-1.5">{TYPE_CONFIG[values.type].description}</p>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Cantidad ({item.product?.unit ?? "unidades"})
            </label>
            <input
              type="number" min="1" step="1"
              value={values.quantity}
              onChange={(e) => {
                setValues((prev) => ({ ...prev, quantity: e.target.value }));
                setErrors((prev) => ({ ...prev, quantity: undefined }));
              }}
              placeholder="0"
              className={`w-full px-4 py-2.5 border rounded-xl font-bold text-sm outline-none transition ${
                errors.quantity
                  ? "bg-red-50 border-red-300 focus:border-red-400"
                  : "bg-gray-50 border-gray-200 focus:border-blue-400 focus:bg-white"
              }`}
            />
            {errors.quantity && <p className="text-red-500 text-xs mt-1">{errors.quantity}</p>}
          </div>

          {/* Unit cost — only for ENTRY */}
          {values.type === "ENTRY" && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                Costo unitario (S/)
              </label>
              <input
                type="number" min="0.01" step="0.01"
                value={values.unitCost}
                onChange={(e) => {
                  setValues((prev) => ({ ...prev, unitCost: e.target.value }));
                  setErrors((prev) => ({ ...prev, unitCost: undefined }));
                }}
                placeholder="0.00"
                className={`w-full px-4 py-2.5 border rounded-xl font-bold text-sm outline-none transition ${
                  errors.unitCost
                    ? "bg-red-50 border-red-300 focus:border-red-400"
                    : "bg-gray-50 border-gray-200 focus:border-blue-400 focus:bg-white"
                }`}
              />
              {errors.unitCost && <p className="text-red-500 text-xs mt-1">{errors.unitCost}</p>}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Motivo (obligatorio)
            </label>
            <textarea
              rows={2}
              value={values.reason}
              onChange={(e) => {
                setValues((prev) => ({ ...prev, reason: e.target.value }));
                setErrors((prev) => ({ ...prev, reason: undefined }));
              }}
              placeholder="Ej: Recepción OC-2025-001, merma por transporte…"
              className={`w-full px-4 py-2.5 border rounded-xl font-medium text-sm outline-none transition resize-none ${
                errors.reason
                  ? "bg-red-50 border-red-300 focus:border-red-400"
                  : "bg-gray-50 border-gray-200 focus:border-blue-400 focus:bg-white"
              }`}
            />
            {errors.reason && <p className="text-red-500 text-xs mt-1">{errors.reason}</p>}
          </div>

          {/* Preview */}
          {qty > 0 && (
            <div className={`rounded-xl p-4 border ${willBeNegative ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                Vista previa del nuevo balance
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Stock actual</p>
                  <p className="font-black text-gray-700 tabular-nums">{currentQty.toLocaleString("es-PE")} {item.product?.unit ?? "u"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Stock nuevo</p>
                  <p className={`font-black tabular-nums ${willBeNegative ? "text-red-600" : "text-emerald-700"}`}>
                    {previewQty.toLocaleString("es-PE")} {item.product?.unit ?? "u"}
                  </p>
                </div>
                {values.type === "ENTRY" && cost > 0 && (
                  <>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Costo prom. actual</p>
                      <p className="font-bold text-gray-700">S/ {item.avgCost.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Costo prom. nuevo</p>
                      <p className="font-bold text-emerald-700">S/ {previewAvgCost.toFixed(2)}</p>
                    </div>
                  </>
                )}
              </div>
              {willBeNegative && (
                <div className="flex items-center gap-2 mt-3 text-red-600 text-xs font-bold">
                  <AlertTriangle size={13} />
                  <span>Esta operación generará stock negativo. Está permitido por política de negocio.</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || hasErrors}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition disabled:opacity-60"
            >
              {isSubmitting ? "Guardando…" : "Confirmar ajuste"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
