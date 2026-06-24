import { X, Save, Building2, Lock, Calendar, Tag } from "lucide-react";
import { Coil } from "@/types";
import { useFinishes } from "@/core/coils/hooks/useFinishes";

export interface EditData {
  initialWeight: number;
  currentWeight: number;
  masterWidth: number;
  thickness: number;
  finish: string;
  pricePerKg: number;
  currency: "PEN" | "USD";
  exchangeRate: number;
  providerDocType: "LOCAL" | "TAX_ID";
  providerDoc: string;
  providerName: string;
  invoiceNumber: string;
  invoiceDate: string;
}

interface EditCoilModalProps {
  editingCoil: Coil;
  editData: EditData;
  setEditData: (data: EditData) => void;
  onClose: () => void;
  onSave: () => void;
}

export function EditCoilModal({
  editingCoil,
  editData,
  setEditData,
  onClose,
  onSave,
}: EditCoilModalProps) {
  const { finishes } = useFinishes(true);
  const isLocked = editingCoil.status !== "AVAILABLE";
  
  const isUSD = editData.currency === "USD";
  const currentTotalValue = editData.initialWeight * editData.pricePerKg;
  const currentTotalValueUSD = isUSD ? currentTotalValue / (editData.exchangeRate || 1) : 0;

  const handleTotalValueChange = (newTotal: number) => {
    const totalPEN = isUSD ? newTotal * editData.exchangeRate : newTotal;
    const newPrice = editData.initialWeight > 0 ? totalPEN / editData.initialWeight : 0;
    setEditData({ ...editData, pricePerKg: Number(newPrice.toFixed(6)) });
  };

  const handleInitialWeightChange = (newWeight: number) => {
    setEditData({
      ...editData,
      initialWeight: newWeight,
      currentWeight: newWeight,
    });
  };

  const selectedFinish = finishes.find((f) => f.id === editData.finish);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Editar Bobina</h2>
            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">
              Serie: {editingCoil.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {isLocked && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex gap-3">
              <Lock className="text-red-500 shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-red-800">
                  Campos Financieros Bloqueados
                </p>
                <p className="text-xs text-red-600 font-medium mt-1">
                  Esta bobina ya tiene cortes registrados o está en proceso externo.
                </p>
              </div>
            </div>
          )}

          {/* DATOS FÍSICOS Y FINANCIEROS */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b pb-2">
              Datos Base
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Acabado (Materia Prima)
                </label>
                <select
                  value={editData.finish}
                  onChange={(e) =>
                    setEditData({ ...editData, finish: e.target.value })
                  }
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
                >
                  <option value="">Seleccionar acabado...</option>
                  {finishes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {selectedFinish && (
                  <p className="text-[10px] text-gray-500 mt-1 px-1">
                    Disponible para: {selectedFinish.lines.join(", ")}
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Moneda
                </label>
                <select
                  disabled={isLocked}
                  value={editData.currency}
                  onChange={(e) =>
                    setEditData({ ...editData, currency: e.target.value as "PEN" | "USD" })
                  }
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 disabled:opacity-60"
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>

              {isUSD && (
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                    Tipo de Cambio
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    disabled={isLocked}
                    value={editData.exchangeRate}
                    onChange={(e) =>
                      setEditData({ ...editData, exchangeRate: Number(e.target.value) })
                    }
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Peso Inicial (kg)
                </label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={editData.initialWeight}
                  onChange={(e) =>
                    handleInitialWeightChange(Number(e.target.value))
                  }
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1 block">
                  Valor Total ({editData.currency}) (Sin IGV)
                </label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={isUSD ? Number(currentTotalValueUSD.toFixed(2)) : Number(currentTotalValue.toFixed(2))}
                  onChange={(e) =>
                    handleTotalValueChange(Number(e.target.value))
                  }
                  className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl font-bold text-blue-800 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Ancho (mm)
                </label>
                <input
                  type="number"
                  value={editData.masterWidth}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      masterWidth: Number(e.target.value),
                    })
                  }
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Espesor (mm)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editData.thickness}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      thickness: Number(e.target.value),
                    })
                  }
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* DATOS DE PROVEEDOR */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
              <Building2 size={14} /> Datos de Proveedor
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Razón Social
                </label>
                <input
                  type="text"
                  value={editData.providerName}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      providerName: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  RUC / Documento
                </label>
                <input
                  type="text"
                  value={editData.providerDoc}
                  onChange={(e) =>
                    setEditData({ ...editData, providerDoc: e.target.value })
                  }
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Factura N°
                </label>
                <input
                  type="text"
                  value={editData.invoiceNumber}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      invoiceNumber: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Calendar size={12} /> Fecha de Factura
                </label>
                <input
                  type="date"
                  value={editData.invoiceDate}
                  onChange={(e) =>
                    setEditData({ ...editData, invoiceDate: e.target.value })
                  }
                  className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl font-bold outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={onSave}
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-200"
          >
            <Save size={20} /> Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
