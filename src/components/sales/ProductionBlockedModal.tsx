"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

const PRODUCTION_QUEUE_PATH = "/admin/lines/metallic-roofing/production/queue";

/**
 * Modal de bloqueo por produccion activa. Lo usan DOS flujos:
 *   - anular venta (`SaleDetailsModal`), que no pasa copy y usa los defaults;
 *   - editar cotizacion (E3), que pasa su propia copy.
 * Por eso el nombre ya no dice "Annul": los defaults siguen siendo los de anular, asi
 * que el consumidor viejo no cambia de comportamiento.
 */
export interface ProductionBlockedModalProps {
  open: boolean;
  onClose: () => void;
  quotationId: string;
  activeLogIds?: string[];
  /** Copy opcional. Sin estas props, el modal muestra los textos de ANULAR (default historico). */
  title?: string;
  body?: React.ReactNode;
  ctaLabel?: string;
}

export function ProductionBlockedModal({
  open,
  onClose,
  quotationId,
  activeLogIds,
  title = "No se puede anular la venta",
  body,
  ctaLabel = "Ir a anular producción",
}: ProductionBlockedModalProps) {
  const router = useRouter();

  if (!open) return null;

  const handleGoToQueue = () => {
    router.push(PRODUCTION_QUEUE_PATH);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex justify-between items-start bg-red-50/50">
          <div className="flex gap-3">
            <div className="bg-red-100 p-2 rounded-xl text-red-600">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {title}
              </h3>
              <div className="text-slate-500 font-medium mt-1 text-sm leading-relaxed">
                {body ?? (
                  <>
                    La cotización vinculada <span className="font-bold text-slate-700">{quotationId}</span> tiene
                    producción activa.
                    <br />
                    Debés anular la producción primero para poder anular esta venta.
                  </>
                )}
                {activeLogIds && activeLogIds.length > 0 && (
                  <p className="mt-2 text-[10px] font-black text-red-500 uppercase tracking-widest">
                    {activeLogIds.length} proceso{activeLogIds.length === 1 ? "" : "s"} de producción activo
                    {activeLogIds.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 pt-2 flex flex-col-reverse sm:flex-row gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-50 rounded-xl transition"
          >
            Cerrar
          </button>
          <button
            onClick={handleGoToQueue}
            className="px-8 py-3 text-white rounded-xl text-xs font-black uppercase tracking-widest transition shadow-lg bg-red-600 hover:bg-red-700 shadow-red-100"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
