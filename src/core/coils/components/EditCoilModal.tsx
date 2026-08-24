import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { X, Save, Building2, Lock, Calendar, Tag } from "lucide-react";
import toast from "react-hot-toast";
import { Coil } from "@/types";
import { useFinishes } from "@/core/coils/hooks/useFinishes";
import { NO_SPIN_CLASS, numericFieldHandlers } from "@/core/coils/utils/numericInput";
import { validateCoilCurrencyForm } from "@/core/coils/utils/coilCurrencyForm";
import { fetchTipoCambio } from "@/core/coils/services/tipoCambio";
import { computePricePerKg } from "@/core/coils/domain/coilPricing";

export interface EditData {
  initialWeight: number;
  currentWeight: number;
  masterWidth: number;
  thickness: number;
  finish: string;
  pricePerKg: number;
  currency: "PEN" | "USD";
  exchangeRate: number;
  originalCurrencyValue?: number;
  providerDocType: "LOCAL" | "TAX_ID";
  providerDoc: string;
  providerName: string;
  invoiceNumber: string;
  invoiceDate: string;
}

interface EditCoilModalProps {
  editingCoil: Coil;
  editData: EditData;
  setEditData: Dispatch<SetStateAction<EditData>>;
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
  const [fetchingRate, setFetchingRate] = useState(false);
  const fetchSeq = useRef(0);

  const isUSD = editData.currency === "USD";
  const currentTotalValue = editData.initialWeight * editData.pricePerKg;
  const currentTotalValueUSD = isUSD ? currentTotalValue / (editData.exchangeRate || 1) : 0;
  const currencyValidation = validateCoilCurrencyForm(editData);

  // Autofill del TC por fecha de factura (mismo mecanismo que AddCoilForm, /api/tipo-cambio).
  // Disparado SOLO por acción explícita del usuario (toggle moneda / cambio de fecha) — NUNCA en mount,
  // para no pisar el exchangeRate ya guardado de una bobina USD al solo abrir el modal.
  // Forma funcional: usa siempre el estado más reciente al resolver, nunca un snapshot capturado
  // al momento del disparo (evita pisar ediciones concurrentes de otros campos).
  const runTipoCambioLookup = (invoiceDate: string) => {
    const seq = ++fetchSeq.current;
    setFetchingRate(true);
    fetchTipoCambio(invoiceDate)
      .then(({ venta, fallback }) => {
        if (fetchSeq.current !== seq) return; // superado por un fetch más nuevo
        if (venta != null) {
          setEditData((prev) => {
            const valor = prev.originalCurrencyValue ?? 0;
            const pricePerKg =
              prev.initialWeight > 0 && valor > 0
                ? computePricePerKg(valor, prev.initialWeight, "USD", venta)
                : prev.pricePerKg;
            return { ...prev, exchangeRate: venta, pricePerKg };
          });
          if (fallback) toast.error(`TC Referencial: S/ ${venta}`);
          else toast.success(`TC Obtenido: S/ ${venta}`);
        } else {
          toast.error("TC real no disponible, ingresá el del día de la factura.");
        }
      })
      .finally(() => {
        if (fetchSeq.current === seq) setFetchingRate(false);
      });
  };

  const handleTotalValueChange = (newTotal: number) => {
    const canCompute = editData.initialWeight > 0 && (!isUSD || editData.exchangeRate > 1);
    const pricePerKg = canCompute
      ? computePricePerKg(newTotal, editData.initialWeight, editData.currency, editData.exchangeRate)
      : editData.pricePerKg;
    setEditData({
      ...editData,
      pricePerKg,
      originalCurrencyValue: isUSD ? newTotal : editData.originalCurrencyValue,
    });
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
                  onChange={(e) => {
                    const nextCurrency = e.target.value as "PEN" | "USD";
                    if (nextCurrency === "PEN") {
                      // Reinterpreta el monto mostrado (hoy en USD) como el nuevo total en PEN.
                      const valor = currentTotalValueUSD;
                      const pricePerKg =
                        editData.initialWeight > 0 && valor > 0
                          ? computePricePerKg(valor, editData.initialWeight, "PEN", 1)
                          : editData.pricePerKg;
                      setEditData({
                        ...editData,
                        currency: "PEN",
                        exchangeRate: 1,
                        originalCurrencyValue: undefined,
                        pricePerKg,
                      });
                      return;
                    }
                    // Reinterpreta el monto mostrado (hoy en PEN) como el nuevo total en USD.
                    const valor = currentTotalValue;
                    const nextData: EditData = {
                      ...editData,
                      currency: "USD",
                      exchangeRate: 0,
                      originalCurrencyValue: valor,
                    };
                    setEditData(nextData);
                    if (nextData.invoiceDate) {
                      runTipoCambioLookup(nextData.invoiceDate);
                    }
                  }}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 disabled:opacity-60"
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>

              {isUSD && (
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                    Tipo de Cambio {fetchingRate && "(buscando...)"}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    disabled={isLocked || fetchingRate}
                    value={editData.exchangeRate || ""}
                    onChange={(e) =>
                      setEditData({ ...editData, exchangeRate: Number(e.target.value) })
                    }
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                  {!currencyValidation.ok && (
                    <p className="text-[10px] text-red-500 font-bold mt-1">{currencyValidation.message}</p>
                  )}
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Peso Inicial (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isLocked}
                  value={editData.initialWeight}
                  onChange={(e) =>
                    handleInitialWeightChange(Number(e.target.value))
                  }
                  className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed ${NO_SPIN_CLASS}`}
                  {...numericFieldHandlers((v) => handleInitialWeightChange(Number(v)))}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1 block">
                  Valor Total ({editData.currency}) (Sin IGV)
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={isLocked}
                  value={isUSD ? Number(currentTotalValueUSD.toFixed(2)) : Number(currentTotalValue.toFixed(2))}
                  onChange={(e) =>
                    handleTotalValueChange(Number(e.target.value))
                  }
                  className={`w-full p-3 bg-blue-50 border border-blue-200 rounded-xl font-bold text-blue-800 outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed ${NO_SPIN_CLASS}`}
                  {...numericFieldHandlers((v) => handleTotalValueChange(Number(v)))}
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
                  min="0"
                  value={editData.masterWidth}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      masterWidth: Number(e.target.value),
                    })
                  }
                  className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 ${NO_SPIN_CLASS}`}
                  {...numericFieldHandlers((v) => setEditData({ ...editData, masterWidth: Number(v) }))}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                  Espesor (mm)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editData.thickness}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      thickness: Number(e.target.value),
                    })
                  }
                  className={`w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 ${NO_SPIN_CLASS}`}
                  {...numericFieldHandlers((v) => setEditData({ ...editData, thickness: Number(v) }))}
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
                  onChange={(e) => {
                    const nextInvoiceDate = e.target.value;
                    const nextData: EditData = { ...editData, invoiceDate: nextInvoiceDate };
                    setEditData(nextData);
                    if (nextData.currency === "USD" && nextInvoiceDate) {
                      runTipoCambioLookup(nextInvoiceDate);
                    }
                  }}
                  className="w-full p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl font-bold outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={onSave}
            disabled={!currencyValidation.ok}
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={20} /> Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
