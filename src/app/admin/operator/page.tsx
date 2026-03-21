"use client";

import { useState } from "react";
import { Wrench, History } from "lucide-react";

// Importamos nuestros nuevos componentes limpios
import { ProduceTab } from "@/components/operator/ProduceTab";
import { HistoryTab } from "@/components/operator/HistoryTab";

export default function OperatorTerminal() {
  const [activeTab, setActiveTab] = useState<"PRODUCE" | "HISTORY">("PRODUCE");

  return (
    <div className="flex flex-col h-full bg-gray-50 min-h-screen lg:min-h-0 lg:rounded-3xl">
      {/* PESTAÑAS PARA PC (Ocultas en móvil) */}
      <div className="hidden md:flex justify-center gap-4 p-6 bg-white border-b border-gray-100 lg:rounded-t-3xl">
        <button
          onClick={() => setActiveTab("PRODUCE")}
          className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center gap-2 ${activeTab === "PRODUCE" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
        >
          <Wrench size={18} /> Producir
        </button>
        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center gap-2 ${activeTab === "HISTORY" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}
        >
          <History size={18} /> Historial
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-8">
        {activeTab === "PRODUCE" ? <ProduceTab /> : <HistoryTab />}
      </div>

      {/* BARRA DE NAVEGACIÓN INFERIOR (Móvil) */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-around items-center fixed bottom-0 w-full md:hidden z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setActiveTab("PRODUCE")}
          className={`flex flex-col items-center gap-1 transition ${activeTab === "PRODUCE" ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <div
            className={`p-2 rounded-xl ${activeTab === "PRODUCE" ? "bg-blue-50" : "bg-transparent"}`}
          >
            <Wrench size={24} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">
            Producir
          </span>
        </button>
        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`flex flex-col items-center gap-1 transition ${activeTab === "HISTORY" ? "text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
        >
          <div
            className={`p-2 rounded-xl ${activeTab === "HISTORY" ? "bg-blue-50" : "bg-transparent"}`}
          >
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
