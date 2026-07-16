import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/clientApp";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { listProducts } from "@/modules/metallic-roofing/services/catalogService";
import type { MetallicProduct } from "@/modules/metallic-roofing/types";
import { useAuth } from "@/context/AuthContext";
import { Loader2, X } from "lucide-react";

interface RequestModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function RequestModal({ onClose, onSuccess }: RequestModalProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<MetallicProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [selectedSku, setSelectedSku] = useState("");
  const [piecesCount, setPiecesCount] = useState<number | "">("");
  const [pieceLengthM, setPieceLengthM] = useState<number | "">("");
  const [qty, setQty] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await listProducts({ active: true });
        setProducts(data);
      } catch (e: any) {
        toast.error("Error al cargar el catálogo de aluzinc");
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProducts();
  }, []);

  const selectedProduct = products.find(p => p.sku === selectedSku);
  const isCobertura = selectedProduct?.family === "COBERTURA";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSku) {
      toast.error("Seleccione un producto");
      return;
    }

    let requestedQty = 0;
    if (isCobertura) {
      if (!piecesCount || !pieceLengthM || piecesCount <= 0 || pieceLengthM <= 0) {
        toast.error("Ingrese piezas y longitud válidas para cobertura");
        return;
      }
      requestedQty = piecesCount * pieceLengthM;
    } else {
      if (!qty || qty <= 0) {
        toast.error("Ingrese una cantidad válida");
        return;
      }
      requestedQty = qty;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "production_requests"), {
        targetSku: selectedSku,
        businessLine: "metallic-roofing",
        requestedQty,
        piecesCount: isCobertura ? piecesCount : null,
        pieceLengthM: isCobertura ? pieceLengthM : null,
        notes: notes.trim() || null,
        requestedBy: user?.email || "unknown",
        status: "OPEN",
        createdAt: serverTimestamp()
      });
      toast.success("Solicitud creada exitosamente");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al crear la solicitud");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Nueva Solicitud de Producción</h2>
            <p className="text-sm text-slate-500 font-medium">Genera un pedido manual para enviar a planta (conformado aluzinc).</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {loadingProducts ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : (
            <form id="request-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Producto</label>
                <select
                  required
                  className="w-full border border-slate-200 rounded-lg text-sm p-2.5 bg-slate-50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  value={selectedSku}
                  onChange={e => {
                    setSelectedSku(e.target.value);
                    setPiecesCount("");
                    setPieceLengthM("");
                    setQty("");
                  }}
                >
                  <option value="">-- Seleccionar --</option>
                  {products.map(p => (
                    <option key={p.sku} value={p.sku}>
                      {p.sku} ({p.finish})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSku && isCobertura && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Piezas</label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full border border-slate-200 rounded-lg text-sm p-2.5 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      value={piecesCount}
                      onChange={e => setPiecesCount(Number(e.target.value) || "")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Longitud (m)</label>
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="0.01"
                      className="w-full border border-slate-200 rounded-lg text-sm p-2.5 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      value={pieceLengthM}
                      onChange={e => setPieceLengthM(Number(e.target.value) || "")}
                    />
                  </div>
                  <div className="col-span-2 bg-blue-50/50 border border-blue-100 text-blue-800 p-3 rounded-lg text-sm flex justify-between items-center">
                    <span className="font-semibold">Metros Lineales (ML):</span>
                    <span className="font-black text-lg">
                      {piecesCount && pieceLengthM ? (piecesCount * pieceLengthM).toFixed(2) : "0.00"}
                    </span>
                  </div>
                </div>
              )}

              {selectedSku && !isCobertura && (
                <div className="animate-in fade-in duration-200">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Cantidad (UND)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="w-full border border-slate-200 rounded-lg text-sm p-2.5 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    value={qty}
                    onChange={e => setQty(Number(e.target.value) || "")}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notas / Observaciones</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg text-sm p-2.5 bg-white min-h-[80px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                  placeholder="Opcional..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </form>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-semibold text-sm hover:bg-slate-200 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="request-form"
            disabled={submitting || !selectedSku}
            className="px-6 py-2 bg-blue-600 text-white font-black uppercase tracking-wider text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            Guardar Solicitud
          </button>
        </div>
      </div>
    </div>
  );
}
