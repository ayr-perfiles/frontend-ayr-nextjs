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
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

interface AddCoilFormProps {
  onOpenChange: (isOpen: boolean) => void;
}

interface CoilEntry {
  uid: string;
  coilId: string;
  weight: number | "";
  width: number | "";
  thickness: number | "";
  value: number | "";
}

export function AddCoilForm({ onOpenChange }: AddCoilFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // --- 1. ESTADOS DE LA FACTURA ---
  const [searchingDoc, setSearchingDoc] = useState(false);
  const [docType, setDocType] = useState<"LOCAL" | "TAX_ID">("LOCAL");
  const [providerDoc, setProviderDoc] = useState("");
  const [providerName, setProviderName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [invoiceDate, setInvoiceDate] = useState(() => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    const localISOTime = new Date(Date.now() - tzOffset)
      .toISOString()
      .split("T")[0];
    return localISOTime;
  });

  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [fetchingRate, setFetchingRate] = useState(false);

  // --- 2. ESTADOS DE LAS BOBINAS ---
  const [coils, setCoils] = useState<CoilEntry[]>([
    {
      uid: Date.now().toString(),
      coilId: "",
      weight: "",
      width: 1200,
      thickness: 0.45,
      value: "",
    },
  ]);

  // --- EFECTOS: API TIPO DE CAMBIO ---
  useEffect(() => {
    if (currency === "USD" && invoiceDate) {
      const fetchRate = async () => {
        setFetchingRate(true);
        try {
          const res = await fetch(`/api/tipo-cambio?fecha=${invoiceDate}`);
          if (res.ok) {
            const data = await res.json();
            if (data.venta) {
              setExchangeRate(data.venta);
              if (data.fallback)
                toast.error(`TC Referencial: S/ ${data.venta}`);
              else toast.success(`TC Obtenido: S/ ${data.venta}`);
            }
          }
        } catch {
          toast.error("Error de conexión TC");
        } finally {
          setFetchingRate(false);
        }
      };
      fetchRate();
    } else {
      setExchangeRate(1);
    }
  }, [currency, invoiceDate]);

  // --- BÚSQUEDA RUC / DNI ---
  const handleSearchDoc = async () => {
    if (
      docType === "LOCAL" &&
      providerDoc.length !== 8 &&
      providerDoc.length !== 11
    ) {
      toast.error("El documento debe tener 8 (DNI) u 11 (RUC) dígitos.");
      return;
    }
    setSearchingDoc(true);
    setProviderName("");
    try {
      const response = await fetch(`/api/consulta-doc?numero=${providerDoc}`);
      const data = await response.json();
      if (!response.ok) throw new Error("No encontrado");
      const isRUC = providerDoc.length === 11;
      const nombre = isRUC
        ? data.razon_social || data.razonSocial
        : `${data.first_name} ${data.first_last_name} ${data.second_last_name}`;
      if (nombre) {
        setProviderName(nombre.toUpperCase());
        toast.success("Proveedor encontrado");
      } else throw new Error("Desconocido");
    } catch {
      toast.error("No se pudo encontrar el proveedor.");
    } finally {
      setSearchingDoc(false);
    }
  };

  // --- FUNCIONES DEL DETALLE ---
  const addCoilRow = () => {
    setCoils([
      ...coils,
      {
        uid: Date.now().toString(),
        coilId: "",
        weight: "",
        width: 1200,
        thickness: 0.45,
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
  };

  const updateCoil = (uid: string, field: keyof CoilEntry, val: any) => {
    setCoils(coils.map((c) => (c.uid === uid ? { ...c, [field]: val } : c)));
  };

  // --- GUARDADO BATCH ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceDate) {
      toast.error("La fecha de factura es obligatoria.");
      return;
    }

    for (let i = 0; i < coils.length; i++) {
      const c = coils[i];
      if (!c.coilId || !c.weight || !c.width || !c.thickness || !c.value) {
        toast.error(
          `Completa todos los campos obligatorios en la bobina #${i + 1}`,
        );
        return;
      }
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const finalInvoiceDate = new Date(`${invoiceDate}T12:00:00`);

      for (const coil of coils) {
        const docRef = doc(db, "coils", coil.coilId.toUpperCase());

        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          toast.error(
            `La serie ${coil.coilId.toUpperCase()} ya existe. Revisa tus datos.`,
          );
          setLoading(false);
          return;
        }

        const weight = Number(coil.weight);
        const inputVal = Number(coil.value);

        const finalTotalValuePEN =
          currency === "USD" ? inputVal * exchangeRate : inputVal;
        const exactCostPerKg = weight > 0 ? finalTotalValuePEN / weight : 0;

        batch.set(docRef, {
          id: coil.coilId.toUpperCase(),
          initialWeight: weight,
          currentWeight: weight,
          masterWidth: Number(coil.width),
          thickness: Number(coil.thickness),
          pricePerKg: Number(exactCostPerKg.toFixed(6)),
          status: "AVAILABLE",
          registeredBy: user?.email || "Admin",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          metadata: {
            providerDocType: docType,
            providerDoc: providerDoc || null,
            provider: providerName || "SIN PROVEEDOR",
            invoiceNumber: invoiceNumber || null,
            invoiceDate: finalInvoiceDate,
            currency,
            exchangeRate: currency === "USD" ? exchangeRate : 1,
            originalCurrencyValue: inputVal,
            isManualEntry: true,
          },
        });
      }

      await batch.commit();
      // Reemplaza el toast.success actual por esto:
      const isConverted = currency === "USD";
      toast.success(
        isConverted
          ? `¡${coils.length} bobinas guardadas! Se convirtieron los USD a Soles (TC: ${exchangeRate}).`
          : `Se registraron ${coils.length} bobinas correctamente.`,
      );
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

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
        {/* SECCIÓN MAESTRA: FACTURA */}
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
                value={docType}
                onChange={(e) => {
                  setDocType(e.target.value as any);
                  setProviderDoc("");
                  setProviderName("");
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="LOCAL">Nacional</option>
                <option value="TAX_ID">Extranjero</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                {docType === "LOCAL" ? "RUC / DNI" : "Tax ID"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold focus:border-blue-500 outline-none"
                  value={providerDoc}
                  onChange={(e) =>
                    setProviderDoc(
                      docType === "LOCAL"
                        ? e.target.value.replace(/\D/g, "")
                        : e.target.value.toUpperCase(),
                    )
                  }
                />
                {docType === "LOCAL" && (
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
                value={providerName}
                onChange={(e) => setProviderName(e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-blue-600 mb-1.5 uppercase">
                Fecha Factura *
              </label>
              <input
                type="date"
                required
                className="w-full bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-sm font-bold text-blue-900 outline-none focus:border-blue-500"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                Factura N°
              </label>
              <input
                type="text"
                placeholder="F001-000"
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-500"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                Moneda
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-500"
              >
                <option value="PEN">Soles (S/)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase">
                T. Cambio
              </label>
              <input
                type="number"
                step="0.001"
                disabled={currency === "PEN"}
                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold disabled:bg-slate-100 outline-none focus:border-blue-500"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN DETALLE: BOBINAS (AHORA USA GRID-COLS-12 PARA ENCAJE PERFECTO) */}
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
            {/* Cabecera Desktop alineada perfectamente */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 rounded-lg text-[11px] font-black text-slate-500 uppercase">
              <div className="col-span-3">N° Serie / ID *</div>
              <div className="col-span-2">Peso (kg) *</div>
              <div className="col-span-2">Ancho (mm) *</div>
              <div className="col-span-2">Espesor *</div>
              <div className="col-span-2">Valor ({currency}) *</div>
              <div className="col-span-1 text-center">Acción</div>
            </div>

            {/* Filas */}
            {coils.map((coil) => (
              <div
                key={coil.uid}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-white border border-slate-100 rounded-lg relative hover:border-blue-200 hover:shadow-md transition"
              >
                <div className="md:col-span-3">
                  <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                    N° Serie *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="F001-..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-md p-2.5 text-sm font-black uppercase outline-none focus:bg-white focus:border-blue-500"
                    value={coil.coilId}
                    onChange={(e) =>
                      updateCoil(
                        coil.uid,
                        "coilId",
                        e.target.value.toUpperCase(),
                      )
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                    Peso (kg) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-white border border-slate-200 rounded-md p-2.5 text-sm font-bold outline-none focus:border-blue-500"
                    value={coil.weight}
                    onChange={(e) =>
                      updateCoil(coil.uid, "weight", e.target.value)
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                    Ancho (mm) *
                  </label>
                  <input
                    required
                    type="number"
                    className="w-full bg-white border border-slate-200 rounded-md p-2.5 text-sm font-bold outline-none focus:border-blue-500"
                    value={coil.width}
                    onChange={(e) =>
                      updateCoil(coil.uid, "width", e.target.value)
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                    Espesor (mm) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="w-full bg-white border border-slate-200 rounded-md p-2.5 text-sm font-bold outline-none focus:border-blue-500"
                    value={coil.thickness}
                    onChange={(e) =>
                      updateCoil(coil.uid, "thickness", e.target.value)
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1.5">
                    Valor {currency} *
                  </label>
                  <div className="relative">
                    <DollarSign
                      size={14}
                      className="absolute left-3 top-3 text-emerald-500"
                    />
                    <input
                      required
                      type="number"
                      step="0.01"
                      className="pl-8 w-full bg-emerald-50 border border-emerald-200 rounded-md p-2.5 text-sm font-black text-emerald-800 outline-none focus:bg-white focus:border-emerald-500"
                      value={coil.value}
                      onChange={(e) =>
                        updateCoil(coil.uid, "value", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="md:col-span-1 flex items-end justify-center pb-1">
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
            ))}
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
          <div className="w-px h-8 bg-slate-200"></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">
              Monto Total Factura
            </p>
            <p className="text-2xl font-black text-emerald-600">
              {currency}{" "}
              {totalInvoiceValue.toLocaleString("es-PE", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full md:w-auto bg-slate-900 text-white px-10 py-4 rounded-xl text-sm font-black flex items-center justify-center gap-3 hover:bg-blue-600 transition shadow-xl disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
          {loading ? "GUARDANDO..." : `REGISTRAR ${coils.length} BOBINAS`}
        </button>
      </div>
    </div>
  );
}
