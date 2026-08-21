"use client";

import {
  ShoppingCart,
  Trash2,
  FileText,
  CheckCircle2,
  Info,
  Scale,
  Percent,
} from "lucide-react";
import { type CartItem } from "@/services/salesService";

const LINE_BADGES: Record<string, { label: string; cls: string }> = {
  drywall: { label: "DRY", cls: "bg-blue-100 text-blue-700" },
  roofing: { label: "UPVC", cls: "bg-emerald-100 text-emerald-700" },
};

interface CartSummaryProps {
  cart: CartItem[];
  totalWeight: number;
  totalValue: number;
  totalIGV: number;
  totalAmount: number;
  projectedProfit: number;
  marginPercent: number;
  minMarginAlert: number;
  isSubmitting: boolean;
  onRemove: (idx: number) => void;
  /** Requeridos SOLO en el modo por defecto (2 botones COTIZAR/VENDER). Ignorados si viene `actions`. */
  onQuote?: () => void;
  onSell?: () => void;
  /**
   * E3: acciones a medida en el pie del resumen. Si viene, REEMPLAZA el grid de
   * COTIZAR/VENDER — lo usa la página de edición de cotización, que necesita un solo
   * botón (Guardar cambios). Si no viene, el componente se comporta igual que siempre.
   */
  actions?: React.ReactNode;
  /** #9-B.2a-2: intent sugerido al duplicar (null = comportamiento neutro, sin cambio visual). */
  suggestedIntent?: "SALE" | "QUOTE" | null;
  /** #9-B.2a-2: identificador del origen duplicado, solo para el label informativo. */
  originLabel?: string | null;
}

const CTA_GHOST =
  "flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-gray-700 text-white font-black hover:bg-gray-800 disabled:opacity-50 transition active:scale-95";
const CTA_QUOTE_PRIMARY =
  "flex items-center justify-center gap-2 p-4 rounded-xl bg-orange-500 text-white font-black hover:bg-orange-400 disabled:opacity-50 transition shadow-lg shadow-orange-900/40 active:scale-95 ring-2 ring-orange-300 ring-offset-2 ring-offset-gray-900";
const CTA_SELL_PRIMARY =
  "flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-500 disabled:opacity-50 transition shadow-lg shadow-blue-900/50 active:scale-95";

export function CartSummary({
  cart,
  totalWeight,
  totalValue,
  totalIGV,
  totalAmount,
  projectedProfit,
  marginPercent,
  minMarginAlert,
  isSubmitting,
  onRemove,
  onQuote,
  onSell,
  actions,
  suggestedIntent = null,
  originLabel = null,
}: CartSummaryProps) {
  const quoteClass = suggestedIntent === "QUOTE" ? CTA_QUOTE_PRIMARY : CTA_GHOST;
  const sellClass = suggestedIntent === "QUOTE" ? CTA_GHOST : CTA_SELL_PRIMARY;
  return (
    <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-100/50 border border-blue-100 flex flex-col h-full sticky top-6">
      <h2 className="text-xl font-black text-gray-800 mb-4 border-b border-gray-100 pb-4 flex justify-between items-center">
        <span>Resumen</span>
        {totalWeight > 0 && (
          <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full flex items-center gap-1">
            <Scale size={14} />{" "}
            {totalWeight.toLocaleString("es-PE", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            kg
          </span>
        )}
      </h2>

      <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px] mb-4">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
            <ShoppingCart size={48} className="mb-2" />
            <p className="text-sm font-bold">Carrito vacío</p>
          </div>
        ) : (
          cart.map((item, index) => {
            const itemProfit = (item.unitValue - item.baseCost) * item.quantity;
            const itemMargin =
              item.unitValue > 0
                ? ((item.unitValue - item.baseCost) / item.unitValue) * 100
                : 0;
            const isLoss = item.unitValue < item.baseCost;
            const isLowMargin = !isLoss && itemMargin < minMarginAlert - 0.5;
            const lineBadge = LINE_BADGES[item.businessLine ?? "drywall"];

            return (
              <div
                key={index}
                className={`flex justify-between items-center p-4 rounded-2xl border ${
                  isLoss || isLowMargin
                    ? "bg-red-50 border-red-100"
                    : "bg-gray-50 border-gray-100"
                }`}
              >
                <div>
                  <p className="font-black text-gray-800 text-lg leading-none flex items-center gap-2">
                    {item.sku}
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase font-black ${lineBadge?.cls ?? "bg-gray-100 text-gray-500"}`}
                    >
                      {lineBadge?.label ?? item.businessLine}
                    </span>
                    {item.isCoil && (
                      <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md uppercase">
                        M. Prima
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 font-medium mt-1">
                    {item.quantity} {item.isCoil ? "kg" : "pzas"} × S/{" "}
                    {item.unitPrice.toFixed(2)}
                  </p>
                  <p
                    className={`text-[9px] font-black uppercase tracking-widest mt-1.5 ${
                      isLoss || isLowMargin ? "text-red-500" : "text-emerald-500"
                    }`}
                  >
                    {isLoss
                      ? "⚠️ PÉRDIDA"
                      : isLowMargin
                        ? "⚠️ MARGEN BAJO"
                        : `+S/ ${itemProfit.toFixed(2)}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="font-mono font-black text-gray-900 text-lg">
                    S/ {(item.quantity * item.unitPrice).toFixed(2)}
                  </span>
                  <button
                    onClick={() => onRemove(index)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-gray-900 p-6 rounded-2xl text-white space-y-4">
        <div className="flex justify-between items-center text-gray-400 text-sm font-medium">
          <span>Subtotal (Valor Venta)</span>
          <span>S/ {totalValue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-gray-400 text-sm font-medium">
          <span>IGV (18%)</span>
          <span>S/ {totalIGV.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-700">
          <span className="font-bold text-gray-200 uppercase tracking-widest text-sm">
            TOTAL:
          </span>
          <span className="font-black text-3xl">S/ {totalAmount.toFixed(2)}</span>
        </div>
        {cart.length > 0 && (
          <div className="flex justify-between items-center pt-3 border-t border-gray-700">
            <div className="flex flex-col">
              <span className="font-bold text-emerald-400 flex items-center gap-1 text-xs">
                <Info size={14} /> Ganancia Neta Real:
              </span>
              <span
                className={`text-[10px] font-black mt-1 flex items-center gap-0.5 uppercase tracking-widest ${
                  marginPercent < minMarginAlert - 0.5
                    ? "text-red-400"
                    : "text-gray-400"
                }`}
              >
                <Percent size={10} /> Rentabilidad: {marginPercent.toFixed(1)}%
              </span>
            </div>
            <span
              className={`font-mono font-bold text-lg ${
                projectedProfit < 0 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              S/ {projectedProfit.toFixed(2)}
            </span>
          </div>
        )}
        {suggestedIntent && (
          <p className="text-[11px] font-bold text-gray-400 text-center -mb-1">
            Duplicando {suggestedIntent === "SALE" ? "venta" : "cotización"}
            {originLabel ? ` ${originLabel}` : ""} → sugerido{" "}
            <span className="text-white">
              {suggestedIntent === "SALE" ? "VENDER" : "COTIZAR"}
            </span>
          </p>
        )}
        {actions ? (
          <div className="pt-4">{actions}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-4">
            <button
              onClick={onQuote}
              disabled={isSubmitting || cart.length === 0}
              className={quoteClass}
            >
              <FileText size={18} /> COTIZAR
            </button>
            <button
              onClick={onSell}
              disabled={isSubmitting || cart.length === 0}
              className={sellClass}
            >
              <CheckCircle2 size={18} /> VENDER
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
