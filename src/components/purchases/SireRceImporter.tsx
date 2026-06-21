import React, { useState } from "react";
import { FileUp, Loader2, CheckCircle2, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";

interface ImportResults {
  nuevos: number;
  reconciliados: number;
  discrepancias: number;
  omitidos: number;
}

export function SireRceImporter({ onFinished }: { onFinished: () => void }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [showReport, setShowReport] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      await processFile(content, file.name);
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = "";
  };

  const processFile = async (content: string, fileName: string) => {
    setIsProcessing(true);
    setResults(null);
    const importFn = httpsCallable(functions, "importSireRce");
    toast.loading("Procesando archivo SIRE/RCE...", { id: "sire-import" });

    try {
      const result: any = await importFn({ content, fileName });
      if (result.data.success) {
        setResults(result.data.results);
        toast.success("Importación finalizada correctamente", { id: "sire-import" });
        onFinished();
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al importar SIRE", { id: "sire-import" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4 shadow-inner">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md shadow-blue-200">
            <FileUp size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Importar SIRE/RCE</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Validación y Reconciliación SUNAT</p>
          </div>
        </div>

        <label className={`relative flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-xs text-slate-600 hover:bg-slate-50 transition cursor-pointer shadow-sm ${isProcessing ? "opacity-50 pointer-events-none" : ""}`}>
          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
          SUBIR TXT / CSV
          <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} disabled={isProcessing} />
        </label>
      </div>

      {results && (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-4 divide-x divide-slate-100 p-4 bg-slate-50/50">
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase">Nuevos</span>
              <span className="text-lg font-black text-blue-600">{results.nuevos}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase">Reconciliados</span>
              <span className="text-lg font-black text-emerald-600">{results.reconciliados}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase">Discrepancias</span>
              <span className="text-lg font-black text-orange-600">{results.discrepancias}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-slate-400 uppercase">Omitidos</span>
              <span className="text-lg font-black text-slate-400">{results.omitidos}</span>
            </div>
          </div>

          {(results.discrepancias > 0 || results.nuevos > 0) && (
            <div className="p-3 bg-blue-50/30 flex items-center justify-between">
              <p className="text-[10px] font-bold text-blue-700 flex items-center gap-2">
                <AlertCircle size={14} /> 
                {results.nuevos > 0 && "Se crearon compras sin stock. "}
                {results.discrepancias > 0 && "Se detectaron diferencias en montos."}
              </p>
              <button 
                onClick={() => setShowReport(!showReport)}
                className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1"
              >
                VER DETALLES {showReport ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>
          )}
          
          {showReport && (
            <div className="p-4 bg-white text-[11px] font-medium text-slate-600 max-h-40 overflow-y-auto">
               <p>Los comprobantes nuevos fueron marcados como 'Origen: SIRE'.</p>
               <p className="mt-1">Las discrepancias pueden verse en el detalle de cada compra marcada con advertencia.</p>
            </div>
          )}
        </div>
      )}

      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
        <p className="text-[10px] font-bold text-blue-600 flex items-start gap-2 leading-relaxed">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            Este importador reconcilia los datos de SUNAT con tu registro manual. No afecta el stock.
            Si un comprobante no existe, se creará una cabecera marcada como "Stock Pendiente".
          </span>
        </p>
      </div>
    </div>
  );
}
