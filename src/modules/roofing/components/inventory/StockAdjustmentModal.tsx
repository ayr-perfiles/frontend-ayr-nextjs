"use client";

import { useState } from "react";
import { X, AlertTriangle, TrendingUp, TrendingDown, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import { adjustStock, type AdjustStockInput } from "../../services/stockAdjustmentService";
import type { InventoryItem } from "../../services/inventoryService";

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
  const [type, setType] = useState<AdjustmentType>("ENTRY");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const qty = parseFloat(quantity) || 0;
  const cost = parseFloat(unitCost) || 0;

  // Preview new balance
  const currentQty = item.quantity;
  const previewDelta =
    type === "ENTRY" ? qty : type === "EXIT" ? -qty : qty - currentQty;
  const previewQty = currentQty + previewDelta;
  const willBeNegative = previewQty < 0;

  // Preview new avg cost (only for ENTRY)
  let previewAvgCost = item.avgCost;
  if (type === "ENTRY" && cost > 0 && qty > 0) {
    const existingValue = currentQty > 0 ? currentQty * item.avgCost : 0;
    const totalQtyAfter = (currentQty > 0 ? currentQty : 0) + qty;
    previewAvgCost = (existingValue + qty * cost) / totalQtyAfter;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity || qty <= 0) {
      toast.error("Ingresa una cantidad mayor a 0.");
      return;
    }
    if (!reason.trim()) {
      toast.error("El motivo es obligatorio.");
      return;
    }
    if (type === "ENTRY" && (!unitCost || cost <= 0)) {
      toast.error("El costo unitario es obligatorio para una entrada.");
      return;
    }

    setSaving(true);
    try {
      await adjustStock({
        sku: item.sku,
        type,
        quantity: qty,
        unitCost: type === "ENTRY" ? cost : undefined,
        reason: reason.trim(),
        performedBy,
      });
      toast.success(`Stock de ${item.sku} ajustado correctamente.`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al ajustar stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 bg-blue-600 text-white flex justify-between items-start">
          <div>
            <h2 className="text-lg font-black">Ajustar Stock</h2>
            <p className="text-blue-200 text-xs font-bold mt-0.5">{item.sku} · {item.product?.displayName ?? item.productName}</p>
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
                const isActive = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
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
            <p className="text-[11px] text-gray-400 font-medium mt-1.5">{TYPE_CONFIG[type].description}</p>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Cantidad (piezas)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-blue-400 focus:bg-white transition"
              required
            />
          </div>

          {/* Unit cost — only for ENTRY */}
          {type === "ENTRY" && (
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
                Costo unitario (S/)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-blue-400 focus:bg-white transition"
                required
              />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">
              Motivo (obligatorio)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Recepción OC-2025-001, merma por transporte…"
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-blue-400 focus:bg-white transition resize-none"
              required
            />
          </div>

          {/* Preview */}
          {qty > 0 && (
            <div className={`rounded-xl p-4 border ${willBeNegative ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Vista previa del nuevo balance</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Stock actual</p>
                  <p className="font-black text-gray-700 tabular-nums">{currentQty.toLocaleString("es-PE")} pzs</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium">Stock nuevo</p>
                  <p className={`font-black tabular-nums ${willBeNegative ? "text-red-600" : "text-emerald-700"}`}>
                    {previewQty.toLocaleString("es-PE")} pzs
                  </p>
                </div>
                {type === "ENTRY" && cost > 0 && (
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
              disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Confirmar ajuste"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
