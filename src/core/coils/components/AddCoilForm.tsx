"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase/clientApp";
import { doc, writeBatch, serverTimestamp, getDoc } from "firebase/firestore";
import {
  Search,
  Loader2,
  Save,
  X,
  Building2,
  Plus,
  DollarSign,
  Trash2,
  Receipt,
  Factory,
  Tag,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { fetchTipoCambio } from "@/core/coils/services/tipoCambio";
import { useForm } from "@/core/hooks/useForm";
import {
  coilInvoiceHeaderSchema,
  coilEntryFormSchema,
  type CoilInvoiceHeader,
} from "@/core/coils/schemas/coil";
import { useFinishes } from "@/core/coils/hooks/useFinishes";
import { functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import { calcCoilTheoreticalML } from "@/modules/metallic-roofing/domain/yieldCalc";
import { NO_SPIN_CLASS, numericFieldHandlers } from "@/core/coils/utils/numericInput";

interface AddCoilFormProps {
  onOpenChange: (isOpen: boolean) => void;
}

interface CoilEntry {
  uid: string;
  coilId?: string;
  weight: number | "";
  width: number | "";
  thickness: number | "";
  finish: string;
  value: number | "";
}

type RowErrors = Partial<
  Record<
    "coilId" | "weight" | "width" | "thickness" | "finish" | "value",
    string
  >
>;

const localDate = () => {
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().split("T")[0];
};

export function AddCoilForm({ onOpenChange }: AddCoilFormProps) {
  const { user } = useAuth();
  const { finishes, loading: loadingFinishes } = useFinishes(true);
  const [loading, setLoading] = useState(false);
  const [searchingDoc, setSearchingDoc] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  
  const [requestId] = useState(() => crypto.randomUUID());

  // --- HEADER FORM ---
  const initialHeader: CoilInvoiceHeader = {
    docType: "LOCAL",
    providerDoc: "",
    providerName: "",
    invoiceDate: localDate(),
    invoiceNumber: "",
    currency: "PEN",
    exchangeRate: 1,
  };

  const { values, setValues, errors, setErrors, validate } =
    useForm<CoilInvoiceHeader>(coilInvoiceHeaderSchema, initialHeader);

  // --- COIL ROWS ---
  const [coils, setCoils] = useState<CoilEntry[]>([
    {
      uid: Date.now().toString(),
      weight: "",
      width: 1200,
      thickness: 0.45,
      finish: "",
      value: "",
    },
  ]);
  const [coilErrors, setCoilErrors] = useState<Record<string, RowErrors>>({});

  const provParts = (values.providerName || "PROV").toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const provCode = provParts.length > 0 ? provParts[0].substring(0, 6) : "PROV";



  // --- FETCH EXCHANGE RATE ---
  // Usa el servicio compartido `fetchTipoCambio` (mismo que EditCoilModal y
  // PurchaseCoilFromXml). Antes tenía su propia copia del fetch, y cuando la respuesta
  // no traía `venta` no decía NADA: el usuario quedaba con el TC viejo sin enterarse.
  // Ahora avisa explícitamente, igual que los otros dos forms.
  useEffect(() => {
    if (values.currency === "USD" && values.invoiceDate) {
      setFetchingRate(true);
      fetchTipoCambio(values.invoiceDate)
        .then(({ venta, fallback }) => {
          if (venta != null) {
            setValues((prev) => ({ ...prev, exchangeRate: venta }));
            if (fallback) toast.error(`TC Referencial: S/ ${venta}`);
            else toast.success(`TC Obtenido: S/ ${venta}`);
          } else {
            toast.error("TC real no disponible, ingresá el del día de la factura.");
          }
        })
        .finally(() => setFetchingRate(false));
    } else {
      setValues((prev) => ({ ...prev, exchangeRate: 1 }));
    }
  }, [values.currency, values.invoiceDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- RUC / DNI LOOKUP ---
  const handleSearchDoc = async () => {
    if (
      values.docType === "LOCAL" &&
      values.providerDoc.length !== 8 &&
      values.providerDoc.length !== 11
    ) {
      toast.error("El documento debe tener 8 (DNI) u 11 (RUC) dígitos.");
      return;
    }
    setSearchingDoc(true);
    setValues((prev) => ({ ...prev, providerName: "" }));

    const isRUC = values.providerDoc.length === 11;
    const consultFn = httpsCallable(
      functions,
      isRUC ? "consultarRuc" : "consultarDni",
    );

    try {
      const result: any = await consultFn(
        isRUC ? { ruc: values.providerDoc } : { dni: values.providerDoc },
      );
      if (result.data.success) {
        const data = result.data.data;
        const nombre = isRUC
          ? data.razonSocial || data.razon_social
          : `${data.full_name}`;

        if (nombre) {
          setValues((prev) => ({
            ...prev,
            providerName: nombre.toUpperCase(),
          }));
          toast.success("Proveedor encontrado");
        } else throw new Error("Desconocido");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "No se pudo encontrar el proveedor.");
    } finally {
      setSearchingDoc(false);
    }
  };

  // --- COIL ROW HELPERS ---
  const addCoilRow = () => {
    setCoils([
      ...coils,
      {
        uid: Date.now().toString(),
        weight: "",
        width: 1200,
        thickness: 0.45,
        finish: "",
        value: "",
      },
    ]);
  };

  const removeCoilRow = (uid: string) => {
    if (coils.length === 1) {
      toast.error("Debe ingresar al menos una bobina.");
      return;
    }
    setCoils(coils.filter((c) => c.uid !== uid));
    setCoilErrors((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  };

  const updateCoil = (
    uid: string,
    field: keyof CoilEntry,
    val: CoilEntry[keyof CoilEntry],
  ) => {
    setCoils(
      coils.map((c) => {
        if (c.uid !== uid) return c;
        return { ...c, [field]: val };
      })
    );
    if (coilErrors[uid]?.[field as keyof RowErrors]) {
      setCoilErrors((prev) => ({
        ...prev,
        [uid]: { ...prev[uid], [field]: undefined },
      }));
    }
  };

  // --- SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validate header
    if (!validate()) return;

    // 2. Bloquear si la moneda es USD y el TC no fue obtenido
    if (values.currency === 'USD' && values.exchangeRate <= 1) {
      toast.error('Tipo de cambio USD inválido. Verifica la fecha o ingresa el TC manualmente (debe ser mayor a 1).');
      setErrors((prev) => ({ ...prev, exchangeRate: 'TC inválido para USD — debe ser mayor a 1' }));
      return;
    }

    // 3. Validate coil rows
    const rowErrors: Record<string, RowErrors> = {};
    for (const coil of coils) {
      const result = coilEntryFormSchema.safeParse({
        coilId: "AUTO",
        weight: coil.weight,
        width: coil.width,
        thickness: coil.thickness,
        finish: coil.finish,
        value: coil.value,
      });
      if (!result.success) {
        const errs: RowErrors = {};
        for (const issue of result.error.issues) {
          const field = issue.path[0] as keyof RowErrors;
          if (!errs[field]) errs[field] = issue.message;
        }
        rowErrors[coil.uid] = errs;
      }
    }
    if (Object.keys(rowErrors).length > 0) {
      setCoilErrors(rowErrors);
      toast.error("Corrige los errores en las bobinas antes de continuar.");
      return;
    }
    setCoilErrors({});

    setLoading(true);
    try {
      const payloadCoils = coils.map((coil) => ({
        weight: Number(coil.weight),
        width: Number(coil.width),
        thickness: Number(coil.thickness),
        finish: coil.finish,
        value: Number(coil.value),
      }));

      const payloadInvoice = {
        docType: values.docType,
        providerDoc: values.providerDoc || null,
        provider: values.providerName || "SIN PROVEEDOR",
        invoiceNumber: values.invoiceNumber || null,
        invoiceDate: values.invoiceDate,
        currency: values.currency,
        exchangeRate: values.currency === "USD" ? values.exchangeRate : 1,
        isManualEntry: true,
      };

      const registerCoilFn = httpsCallable(functions, "registerCoil");
      await registerCoilFn({ coils: payloadCoils, invoice: payloadInvoice, requestId });

      const isConverted = values.currency === "USD";
      toast.success(
        isConverted
          ? `¡${coils.length} bobinas guardadas! Se convirtieron los USD a Soles (TC: ${values.exchangeRate}).`
          : `Se registraron ${coils.length} bobinas correctamente.`,
      );
      onOpenChange(false);
    } catch (error: any) {
      if (error.code === 'already-exists') {
        toast.error(error.message || 'Una o más bobinas ya existen. Revisa tus datos.');
      } else if (error.code === 'invalid-argument') {
        toast.error('Datos inválidos: ' + (error.message || 'Revisa el formulario.'));
      } else if (error.code === 'failed-precondition') {
        toast.error('Condición fallida: ' + (error.message || 'Error de estado.'));
      } else {
        toast.error("Error al guardar: " + (error.message || "Error desconocido"));
      }
    } finally {
      setLoading(false);
    }
  };

  const hasHeaderErrors = Object.values(errors).some(Boolean);
  const hasRowErrors = Object.values(coilErrors).some((errObj) => Object.values(errObj).some(Boolean));

  const totalInvoiceValue = coils.reduce(
    (sum, c) => sum + (Number(c.value) || 0),
    0,
  );
  const totalInvoiceWeight = coils.reduce(
    (sum, c) => sum + (Number(c.weight) || 0),
    0,
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 max-h-[90vh] w-full rounded-xl overflow-hidden shadow-2xl">
      {/* HEADER */}
      <div className="flex justify-between items-center p-6 bg-slate-900 text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2.5 rounded-lg">
            <Receipt size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black leading-tight">
              Factura de Compra
            </h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
              Ingreso de Materia Prima
            </p>
          </div>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="p-2 hover:bg-white/10 rounded-full transition"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* DATOS DEL PROVEEDOR */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <header className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 size={18} className="text-blue-600" />
            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">
              Datos del Proveedor
            </h3>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                Origen
              </label>
              <select
                value={values.docType}
                onChange={(e) => {
                  setValues((prev) => ({
                    ...prev,
                    docType: e.target.value as "LOCAL" | "TAX_ID",
                    providerDoc: "",
                    providerName: "",
                  }));
                  setErrors((prev) => ({ ...prev, docType: undefined }));
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="LOCAL">Nacional</option>
                <option value="TAX_ID">Extranjero</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                {values.docType === "LOCAL" ? "RUC / DNI" : "Tax ID"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold focus:border-blue-500 outline-none"
                  value={values.providerDoc}
                  onChange={(e) => {
                    setValues((prev) => ({
                      ...prev,
                      providerDoc:
                        values.docType === "LOCAL"
                          ? e.target.value.replace(/\D/g, "")
                          : e.target.value.toUpperCase(),
                    }));
                  }}
                />
                {values.docType === "LOCAL" && (
                  <button
                    type="button"
                    onClick={handleSearchDoc}
                    className="bg-slate-100 text-slate-600 px-3 rounded-lg hover:bg-blue-500 hover:text-white transition"
                  >
                    {searchingDoc ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Search size={18} />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                Razón Social
              </label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none"
                value={values.providerName}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    providerName: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>

            <div>
              <label
                className={`block text-[11px] font-bold mb-1.5 uppercase ${errors.invoiceDate ? "text-red-500" : "text-blue-600"}`}
              >
                Fecha Factura *
              </label>
              <input
                type="date"
                className={`w-full rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-500 border ${errors.invoiceDate ? "bg-red-50 border-red-300" : "bg-blue-50 border-blue-200 text-blue-900"}`}
                value={values.invoiceDate}
                onChange={(e) => {
                  setValues((prev) => ({
                    ...prev,
                    invoiceDate: e.target.value,
                  }));
                  setErrors((prev) => ({ ...prev, invoiceDate: undefined, exchangeRate: undefined }));
                }}
              />
              {errors.invoiceDate && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.invoiceDate}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                Factura N°
              </label>
              <input
                type="text"
                placeholder="F001-000"
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-500"
                value={values.invoiceNumber}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    invoiceNumber: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                Moneda
              </label>
              <select
                value={values.currency}
                onChange={(e) => {
                  setValues((prev) => ({
                    ...prev,
                    currency: e.target.value as "PEN" | "USD",
                  }));
                  setErrors((prev) => ({ ...prev, exchangeRate: undefined }));
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="PEN">Soles (S/)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>

            <div>
              <label
                className={`block text-[11px] font-bold mb-1.5 uppercase ${errors.exchangeRate ? "text-red-500" : (values.currency === "USD" && values.exchangeRate <= 1) ? "text-orange-500" : "text-slate-500"}`}
              >
                T. Cambio
              </label>
              <input
                type="number"
                step="0.001"
                disabled={values.currency === "PEN"}
                className={`w-full bg-white border rounded-lg p-2.5 text-sm font-bold disabled:bg-slate-100 outline-none focus:border-blue-500 ${errors.exchangeRate ? "border-red-300" : (values.currency === "USD" && values.exchangeRate <= 1) ? "border-orange-400 bg-orange-50" : "border-slate-200"}`}
                value={values.exchangeRate}
                onChange={(e) => {
                  setValues((prev) => ({
                    ...prev,
                    exchangeRate: Number(e.target.value),
                  }));
                  setErrors((prev) => ({ ...prev, exchangeRate: undefined }));
                }}
              />
              {fetchingRate && (
                <p className="text-xs text-blue-500 mt-1">Obteniendo TC...</p>
              )}
              {errors.exchangeRate && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.exchangeRate}
                </p>
              )}
              {values.currency === "USD" && values.exchangeRate <= 1 && !errors.exchangeRate && !fetchingRate && (
                <p className="text-orange-600 text-xs mt-1 font-semibold leading-tight">
                  TC real no disponible — ingresá el TC del día
                </p>
              )}
            </div>


          </div>
        </div>

        {/* DETALLE DE BOBINAS */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <header className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Factory size={18} className="text-orange-500" />
              <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                Detalle de Bobinas
              </h3>
            </div>
            <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-md">
              {coils.length} items
            </span>
          </header>

          <div className="space-y-3">
            <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] gap-4 px-4 py-3 bg-slate-50 rounded-lg text-[11px] font-black text-slate-500 uppercase">
              <div>N° Serie / ID *</div>
              <div>Acabado *</div>
              <div>Peso (kg) *</div>
              <div>Ancho (mm) *</div>
              <div>Espesor *</div>
              <div>Valor ({values.currency}) *</div>
              <div className="text-center">Acción</div>
            </div>

            {coils.map((coil) => {
              const rowErr = coilErrors[coil.uid] ?? {};
              const selectedFinish = finishes.find((f) => f.id === coil.finish);
              return (
                <div
                  key={coil.uid}
                  className={`grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,2.5fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] gap-4 p-4 bg-white border rounded-lg relative transition ${Object.values(rowErr).some(Boolean) ? "border-red-300 bg-red-50/20" : "border-slate-100 hover:border-blue-200 hover:shadow-md"}`}
                >
                  <div>
                    <label className="lg:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                      N° Serie *
                    </label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      className={`w-full border rounded-md p-2.5 text-sm font-black text-slate-400 uppercase outline-none bg-slate-100 border-slate-200 cursor-not-allowed`}
                      value={`${provCode}-${coil.finish ? coil.finish.toUpperCase().replace(/[^A-Z0-9-]/g, "") : "ACABADO"}-${coil.thickness ? Math.round(Number(coil.thickness) * 100).toString().padStart(3, "0") : "ESP"}-${coil.weight ? Math.round(Number(coil.weight)).toString() : "PESO"}-AUTO`}
                      title="Generado automáticamente por el sistema"
                    />
                  </div>

                  <div>
                    <label className="lg:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                      Acabado *
                    </label>
                    <select
                      className={`w-full border rounded-md p-2.5 text-sm font-bold outline-none focus:border-blue-500 ${rowErr.finish ? "bg-red-50 border-red-300" : "bg-white border-slate-200"}`}
                      value={coil.finish}
                      onChange={(e) =>
                        updateCoil(coil.uid, "finish", e.target.value)
                      }
                    >
                      <option value="">Seleccionar...</option>
                      {finishes.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    {selectedFinish && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        Disponible para: {selectedFinish.lines.join(", ")}
                      </p>
                    )}
                    {rowErr.finish && (
                      <p className="text-red-500 text-xs mt-1">
                        {rowErr.finish}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="lg:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                      Peso (kg) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`w-full border rounded-md p-2.5 text-sm font-bold outline-none focus:border-blue-500 ${NO_SPIN_CLASS} ${rowErr.weight ? "bg-red-50 border-red-300" : "bg-white border-slate-200"}`}
                      value={coil.weight}
                      onChange={(e) =>
                        updateCoil(coil.uid, "weight", e.target.value)
                      }
                      {...numericFieldHandlers((v) => updateCoil(coil.uid, "weight", v))}
                    />
                    {(() => {
                      if (!coil.weight || !coil.width || !coil.thickness || !selectedFinish?.densityFactor) {
                        return <p className="text-[10px] font-bold text-slate-400 mt-1">≈ — ML</p>;
                      }
                      const ml = calcCoilTheoreticalML({
                        weightKg: Number(coil.weight),
                        thicknessMm: Number(coil.thickness),
                        masterWidthMm: Number(coil.width),
                        densityFactor: selectedFinish.densityFactor,
                      });
                      return <p className="text-[10px] font-black text-blue-600 mt-1">≈ {ml.toFixed(2)} ML</p>;
                    })()}
                    {rowErr.weight && (
                      <p className="text-red-500 text-xs mt-1">
                        {rowErr.weight}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="lg:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                      Ancho (mm) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      className={`w-full border rounded-md p-2.5 text-sm font-bold outline-none focus:border-blue-500 ${NO_SPIN_CLASS} ${rowErr.width ? "bg-red-50 border-red-300" : "bg-white border-slate-200"}`}
                      value={coil.width}
                      onChange={(e) =>
                        updateCoil(coil.uid, "width", e.target.value)
                      }
                      {...numericFieldHandlers((v) => updateCoil(coil.uid, "width", v))}
                    />
                    {rowErr.width && (
                      <p className="text-red-500 text-xs mt-1">
                        {rowErr.width}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="lg:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                      Espesor (mm) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`w-full border rounded-md p-2.5 text-sm font-bold outline-none focus:border-blue-500 ${NO_SPIN_CLASS} ${rowErr.thickness ? "bg-red-50 border-red-300" : "bg-white border-slate-200"}`}
                      value={coil.thickness}
                      onChange={(e) =>
                        updateCoil(coil.uid, "thickness", e.target.value)
                      }
                      {...numericFieldHandlers((v) => updateCoil(coil.uid, "thickness", v))}
                    />
                    {rowErr.thickness && (
                      <p className="text-red-500 text-xs mt-1">
                        {rowErr.thickness}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="lg:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                      Valor {values.currency} *
                    </label>
                    <div className="relative">
                      <DollarSign
                        size={14}
                        className="absolute left-3 top-3 text-emerald-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className={`pl-8 w-full border rounded-md p-2.5 text-sm font-black outline-none ${NO_SPIN_CLASS} ${rowErr.value ? "bg-red-50 border-red-300 text-red-800" : "bg-emerald-50 border-emerald-200 text-emerald-800 focus:bg-white focus:border-emerald-500"}`}
                        value={coil.value}
                        onChange={(e) =>
                          updateCoil(coil.uid, "value", e.target.value)
                        }
                        {...numericFieldHandlers((v) => updateCoil(coil.uid, "value", v))}
                      />
                    </div>
                    {(() => {
                      const w = Number(coil.weight);
                      const v = Number(coil.value);
                      if (w > 0 && v > 0) {
                        const totalPEN = values.currency === 'USD' ? v * values.exchangeRate : v;
                        const pricePerKg = totalPEN / w;
                        return (
                          <p className="text-[10px] font-black text-emerald-600 mt-1">
                            Costo: S/ {pricePerKg.toFixed(4)}/kg
                          </p>
                        );
                      }
                      return null;
                    })()}
                    {rowErr.value && (
                      <p className="text-red-500 text-xs mt-1">
                        {rowErr.value}
                      </p>
                    )}
                  </div>

                  <div className="flex items-end justify-center pb-1">
                    <button
                      type="button"
                      onClick={() => removeCoilRow(coil.uid)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Quitar bobina"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addCoilRow}
            className="mt-4 text-xs font-black text-blue-600 bg-blue-50 px-5 py-2.5 rounded-lg hover:bg-blue-100 flex items-center gap-2 transition"
          >
            <Plus size={16} /> AGREGAR OTRA BOBINA A LA LISTA
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-white border-t border-slate-200 p-6 shrink-0 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-8">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              Peso Total Factura
            </p>
            <p className="text-xl font-black text-slate-800">
              {totalInvoiceWeight.toLocaleString("es-PE")}{" "}
              <span className="text-xs text-slate-500">kg</span>
            </p>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              Monto Total Factura
            </p>
            <p className="text-2xl font-black text-emerald-600">
              {values.currency}{" "}
              {totalInvoiceValue.toLocaleString("es-PE", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={
            loading || hasHeaderErrors || hasRowErrors || loadingFinishes
          }
          className="w-full md:w-auto bg-slate-900 text-white px-10 py-4 rounded-xl text-sm font-black flex items-center justify-center gap-3 hover:bg-blue-600 transition shadow-xl disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
          {loading ? "GUARDANDO..." : `REGISTRAR ${coils.length} BOBINAS`}
        </button>
      </div>
    </div>
  );
}
