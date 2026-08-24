import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  Package, 
  DollarSign, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Save,
  Building2,
  FileCode
} from "lucide-react";
import { functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";
import { getSkuSuggestion } from "@/services/purchases/mappingService";

interface StagedLine {
  description: string;
  quantity: number;
  unitCode: string;
  unitPrice: number;
  totalValue: number;
  sku?: string;
  productName?: string;
}

interface StagedPurchase {
  uid: string;
  rucProveedor: string;
  razonSocialProveedor: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  moneda: "PEN" | "USD";
  tipoCambio: number;
  baseImponible: number;
  igv: number;
  total: number;
  lines: StagedLine[];
  businessLine: "trading" | "roofing";
}

interface Props {
  initialPurchases: any[];
  onFinished: () => void;
}

export function PurchaseStagingReview({ initialPurchases, onFinished }: Props) {
  const [purchases, setPurchases] = useState<StagedPurchase[]>(
    initialPurchases.map((p, idx) => ({ 
      ...p, 
      uid: `${Date.now()}-${idx}`,
      businessLine: "trading",
      tipoCambio: 1
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedUid, setExpandedUid] = useState<string | null>(purchases[0]?.uid || null);

  // Cargar sugerencias de SKU al montar
  useEffect(() => {
    const loadSuggestions = async () => {
      const updated = [...purchases];
      for (let p of updated) {
        for (let line of p.lines) {
          if (!line.sku) {
            const suggestion = await getSkuSuggestion(p.rucProveedor, line.description);
            if (suggestion) line.sku = suggestion;
          }
        }
      }
      setPurchases(updated);
    };
    loadSuggestions();
  }, []);

  const updateHeader = (uid: string, field: keyof StagedPurchase, value: any) => {
    setPurchases(prev => prev.map(p => p.uid === uid ? { ...p, [field]: value } : p));
  };

  const updateLine = (purchaseUid: string, lineIdx: number, field: keyof StagedLine, value: any) => {
    setPurchases(prev => prev.map(p => {
      if (p.uid === purchaseUid) {
        const newLines = [...p.lines];
        newLines[lineIdx] = { ...newLines[lineIdx], [field]: value };
        return { ...p, lines: newLines };
      }
      return p;
    }));
  };

  const handleConfirm = async () => {
    // Validar que todos tengan SKU
    for (const p of purchases) {
      if (p.lines.some(l => !l.sku)) {
        toast.error(`La factura ${p.serie}-${p.numero} tiene ítems sin mapear.`);
        setExpandedUid(p.uid);
        return;
      }
    }

    setIsSubmitting(true);
    const confirmFn = httpsCallable(functions, "confirmPurchaseStaging");
    toast.loading("Registrando compras y stock...", { id: "confirm-staging" });

    try {
      const result: any = await confirmFn({ purchases });
      if (result.data.success) {
        const { success, errors, details } = result.data.results;
        if (errors === 0) {
          toast.success(`Se registraron ${success} compras exitosamente.`, { id: "confirm-staging" });
          onFinished();
        } else {
          toast.error(`Finalizado con errores: ${success} OK, ${errors} fallidas.`, { id: "confirm-staging" });
          console.error("Detalles de error:", details);
        }
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Error al confirmar compras", { id: "confirm-staging" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-lg font-black text-slate-800">Revisión de Compras XML</h3>
          <p className="text-xs text-slate-500 font-medium">Mapea los productos del proveedor a tus SKUs internos.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={onFinished}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
          >
            CANCELAR
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            CONFIRMAR {purchases.length} COMPRAS
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {purchases.map((p) => (
          <div key={p.uid} className={`bg-white rounded-2xl border transition-all ${expandedUid === p.uid ? "border-blue-300 shadow-lg ring-4 ring-blue-50" : "border-slate-200 shadow-sm"}`}>
            <div 
              className="p-4 flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedUid(expandedUid === p.uid ? null : p.uid)}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${expandedUid === p.uid ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  <FileCode size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Factura {p.serie}-{p.numero}</p>
                  <p className="font-bold text-slate-700">{p.razonSocialProveedor}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Total</p>
                  <p className="font-black text-slate-800">{p.moneda} {p.total.toFixed(2)}</p>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${p.lines.every(l => l.sku) ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-orange-50 text-orange-600 border-orange-100"}`}>
                  {p.lines.every(l => l.sku) ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {p.lines.every(l => l.sku) ? "LISTO" : "FALTA MAPEO"}
                </div>
                {expandedUid === p.uid ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
              </div>
            </div>

            {expandedUid === p.uid && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/30 space-y-6">
                {/* Header Edit */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-100">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Línea de Destino</label>
                    <select 
                      value={p.businessLine}
                      onChange={(e) => updateHeader(p.uid, "businessLine", e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                    >
                      <option value="trading">Trading (Reventa)</option>
                      <option value="roofing">Roofing (UPVC)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Tipo de Cambio</label>
                    <input 
                      type="number"
                      step="0.001"
                      disabled={p.moneda === "PEN"}
                      value={p.tipoCambio}
                      onChange={(e) => updateHeader(p.uid, "tipoCambio", parseFloat(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Fecha Emisión</label>
                    <input 
                      type="date"
                      value={p.fechaEmision}
                      onChange={(e) => updateHeader(p.uid, "fechaEmision", e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-end">
                    <button 
                      onClick={() => setPurchases(prev => prev.filter(x => x.uid !== p.uid))}
                      className="p-2 text-red-400 hover:text-red-600 transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Lines Mapping */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Detalle de Productos</p>
                  {p.lines.map((line, lIdx) => (
                    <div key={lIdx} className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                      <div className="md:col-span-5">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Descripción Proveedor</p>
                        <p className="text-xs font-bold text-slate-700 leading-tight">{line.description}</p>
                      </div>
                      <div className="md:col-span-4">
                        <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Mapear a SKU AYR</p>
                        <input 
                          placeholder="Ingresa SKU (ej: PVC-001)"
                          value={line.sku || ""}
                          onChange={(e) => updateLine(p.uid, lIdx, "sku", e.target.value.toUpperCase())}
                          className="w-full p-2 bg-blue-50 border border-blue-100 rounded-lg text-xs font-black text-blue-700 outline-none focus:border-blue-300 placeholder:text-blue-200"
                        />
                      </div>
                      <div className="md:col-span-1 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Cant.</p>
                        <p className="text-xs font-black text-slate-600">{line.quantity} <span className="text-[9px] text-slate-400">{line.unitCode}</span></p>
                      </div>
                      <div className="md:col-span-2 text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Costo Unit ({p.moneda})</p>
                        <p className="text-xs font-black text-slate-800">S/ {line.unitPrice.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
