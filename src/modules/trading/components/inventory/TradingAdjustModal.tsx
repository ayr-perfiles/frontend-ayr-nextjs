"use client";

import { useState } from "react";
import { X, Save, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { adjustStock } from "../../services/stockAdjustmentService";
import { TradingStockAdjustmentSchema } from "../../schemas/stockAdjustment";
import type { InventoryItem } from "../../services/inventoryService";

interface Props {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TradingAdjustModal({ item, onClose, onSuccess }: Props) {
  const [type, setType] = useState<"ENTRY" | "EXIT" | "ADJUSTMENT">("ENTRY");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdjust() {
    const qty = parseFloat(quantity);
    const cost = unitCost ? parseFloat(unitCost) : undefined;

    const validation = TradingStockAdjustmentSchema.safeParse({
      sku: item.sku,
      type,
      quantity: qty,
      unitCost: cost,
      reason,
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      await adjustStock({
        sku: item.sku,
        type,
        quantity: qty,
        unitCost: cost,
        reason,
      });
      toast.success("Ajuste procesado con éxito");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar ajuste");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-5 bg-amber-600 text-white flex justify-between items-center">
          <h2 className="text-lg font-black">Ajuste de Stock (Reventa)</h2>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm font-medium">
          <div className="bg-gray-50 border border-gray-100 p-3 rounded-xl">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Producto</p>
            <p className="text-gray-900 font-bold">{item.productName}</p>
            <p className="text-xs font-mono text-amber-700">{item.sku}</p>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Tipo de Ajuste</label>
            <div className="grid grid-cols-3 gap-2">
              {(["ENTRY", "EXIT", "ADJUSTMENT"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`py-2 px-1 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition ${
                    type === t ? "border-amber-500 bg-amber-50 text-amber-700" : "border-gray-100 text-gray-400"
                  }`}
                >
                  {t === "ENTRY" ? "Entrada" : t === "EXIT" ? "Salida" : "Ajuste"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                {type === "ADJUSTMENT" ? "Nuevo Stock Físico" : "Cantidad"}
              </label>
              <input
                type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-amber-400 font-black text-gray-800"
              />
            </div>

            {type === "ENTRY" && (
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Costo Unitario (S/)</label>
                <input
                  type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-emerald-400 font-black text-emerald-700"
                />
              </div>
            )}
          </div>

          {type === "ENTRY" && unitCost && (
             <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-start gap-2">
               <AlertTriangle className="text-emerald-500 shrink-0" size={16} />
               <p className="text-[10px] text-emerald-800 leading-tight">
                 Esta entrada disparará un recálculo automático del <strong>Costo Promedio Ponderado</strong> para este producto.
               </p>
             </div>
          )}

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Motivo</label>
            <textarea
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Compra según factura F001-123"
              rows={3}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-amber-400 resize-none font-medium text-gray-700"
            />
          </div>

          <button
            onClick={handleAdjust} disabled={saving}
            className="w-full bg-amber-600 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-amber-700 transition active:scale-95 shadow-md shadow-amber-200 disabled:opacity-60"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Save size={18} /> Procesar Ajuste</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
