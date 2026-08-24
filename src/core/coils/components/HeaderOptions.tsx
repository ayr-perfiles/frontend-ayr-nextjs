"use client";

import { useState } from "react";
import {
  ChevronDown,
  Download,
  FileCode2,
  FileSpreadsheet,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface HeaderOptionsProps {
  role: string | null | undefined;
  onExport: () => void;
  onOpenXml: () => void;
}

export function HeaderOptions({
  role,
  onExport,
  onOpenXml,
}: HeaderOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative z-40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition font-bold shadow-sm"
      >
        Opciones{" "}
        <ChevronDown
          size={18}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95">
            <p className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Importar / Exportar
            </p>
            <button
              onClick={() => { setIsOpen(false); onExport(); }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <Download size={18} className="text-gray-400" /> Descargar Excel
            </button>
            <button
              onClick={() => { setIsOpen(false); onOpenXml(); }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
            >
              <FileCode2 size={18} className="text-blue-500" /> Ingresar vía Factura XML
            </button>
            {["ADMIN", "SUPERVISOR"].includes(role?.toUpperCase() || "") && (
              <button
                onClick={() => { setIsOpen(false); router.push("/admin/coils/bulk-import"); }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-3 font-medium transition"
              >
                <FileSpreadsheet size={18} className="text-green-500" /> Migración Masiva (Excel)
              </button>
            )}

          </div>
        </>
      )}
    </div>
  );
}
