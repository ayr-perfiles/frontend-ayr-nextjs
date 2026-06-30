"use client";

import { History } from "lucide-react";

// ProduceTab deshabilitado (sprint 7): flujo bobina-directa deprecado, producir vía flejes. Destino final pendiente.
// import { ProduceTab } from "@/modules/drywall/components/operator/ProduceTab";
import { HistoryTab } from "@/modules/drywall/components/operator/HistoryTab";

export default function OperatorTerminal() {
  return (
    <div className="flex flex-col h-full bg-gray-50 min-h-screen lg:min-h-0 lg:rounded-3xl">
      {/* PESTAÑAS PARA PC (Ocultas en móvil) */}
      <div className="hidden md:flex justify-center gap-4 p-6 bg-white border-b border-gray-100 lg:rounded-t-3xl">
        <button
          className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center gap-2 bg-blue-600 text-white shadow-lg shadow-blue-200"
        >
          <History size={18} /> Historial
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-8">
        <HistoryTab />
      </div>

      {/* BARRA DE NAVEGACIÓN INFERIOR (Móvil) */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-around items-center fixed bottom-0 w-full md:hidden z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button
          className="flex flex-col items-center gap-1 transition text-blue-600"
        >
          <div className="p-2 rounded-xl bg-blue-50">
            <History size={24} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">
            Historial
          </span>
        </button>
      </div>
    </div>
  );
}
