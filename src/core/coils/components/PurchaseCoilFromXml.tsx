"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileCode2,
  Loader2,
  Database,
  X,
  Building2,
  Receipt,
  Factory,
  DollarSign,
  Trash2,
  Plus,
  Layers,
} from "lucide-react";
import { db, functions } from "@/lib/firebase/clientApp";
import { writeBatch, doc, serverTimestamp, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useFinishes } from "@/core/coils/hooks/useFinishes";
import { parseCoilDescription } from "@/core/coils/parseCoilDescription";
import { TOKEN_TO_FINISH } from "@/core/coils/bulkUploadLogic";
import { httpsCallable } from "firebase/functions";

interface CoilEntry {
  uid: string;
  coilId: string;
  weight: number | "";
  width: number | "";
  thickness: number | "";
  finish: string;
  value: number | "";
  originalDesc?: string;
}

export function PurchaseCoilFromXml() {
  const { user } = useAuth();
  const { finishes } = useFinishes(true);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- ESTADOS MAESTROS (FACTURA) ---
  const [docType, setDocType] = useState<"LOCAL" | "TAX_ID">("LOCAL");
  const [providerDoc, setProviderDoc] = useState("");
  const [providerName, setProviderName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [fetchingRate, setFetchingRate] = useState(false);

  // --- ESTADOS DETALLE (BOBINAS) ---
  const [coils, setCoils] = useState<CoilEntry[]>([]);

  // Función auxiliar para leer XML
  const getNodeText = (node: Element | Document, tagName: string): string => {
    const elements = node.getElementsByTagNameNS("*", tagName);
    if (elements.length > 0) return elements[0].textContent || "";
    const fallback = node.getElementsByTagName(tagName);
    if (fallback.length > 0) return fallback[0].textContent || "";
    const cbcFallback = node.getElementsByTagName(`cbc:${tagName}`);
    if (cbcFallback.length > 0) return cbcFallback[0].textContent || "";
    return "";
  };

  // --- CARGA DE XML ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading(true);

    try {
      const file = files[0]; // Tomamos el primer XML
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");

      // 1. Extraer Cabecera
      const invNumber = getNodeText(xmlDoc, "ID");
      const issueDate = getNodeText(xmlDoc, "IssueDate");
      const currencyCode = getNodeText(xmlDoc, "DocumentCurrencyCode"); // Extraer Moneda

      const supplierParty =
        xmlDoc.getElementsByTagNameNS("*", "AccountingSupplierParty")[0] ||
        xmlDoc.getElementsByTagName("cac:AccountingSupplierParty")[0];
      let pDoc = "",
        pName = "";

      if (supplierParty) {
        pDoc = getNodeText(supplierParty, "ID");
        pName =
          getNodeText(supplierParty, "RegistrationName") ||
          getNodeText(supplierParty, "Name");
      }

      setInvoiceNumber(invNumber);
      setInvoiceDate(issueDate);
      setProviderDoc(pDoc.replace(/\D/g, ""));
      setProviderName(pName);
      setDocType(pDoc.length === 11 ? "LOCAL" : "TAX_ID");
      setCurrency(currencyCode === "USD" ? "USD" : "PEN");

      // 2. Extraer Líneas
      const invoiceLines = xmlDoc.getElementsByTagNameNS("*", "InvoiceLine");
      const linesArray =
        invoiceLines.length > 0
          ? invoiceLines
          : xmlDoc.getElementsByTagName("cac:InvoiceLine");

      let parsedCoils: CoilEntry[] = [];

      Array.from(linesArray).forEach((line, index) => {
        const description = getNodeText(line, "Description").toUpperCase();
        if (
          !description.includes("BOB") &&
          !description.includes("ALUZINC") &&
          !description.includes("GALVANIZADO")
        )
          return;

        const rawQuantity =
          parseFloat(getNodeText(line, "InvoicedQuantity")) || 0;
        let weightInKg = rawQuantity < 100 ? rawQuantity * 1000 : rawQuantity;
        const totalValue =
          parseFloat(getNodeText(line, "LineExtensionAmount")) || 0;

        let thickness = 0.45;
        let width = 1200;
        const thicknessMatch = description.match(/0\.\d{2}/);
        if (thicknessMatch) thickness = parseFloat(thicknessMatch[0]);
        const widthMatch = description.match(/1[0-2]\d{2}/);
        if (widthMatch) width = parseFloat(widthMatch[0]);

        const parsedDesc = parseCoilDescription(description);
        const mappedFinish = parsedDesc.finishToken ? (TOKEN_TO_FINISH[parsedDesc.finishToken] ?? "") : "";

        parsedCoils.push({
          uid: Date.now().toString() + index,
          coilId: `${invNumber}-${index + 1}`,
          weight: Math.round(weightInKg),
          width: width,
          thickness: thickness,
          finish: mappedFinish,
          value: totalValue,
          originalDesc: description,
        });
      });

      setCoils(parsedCoils);
      if (parsedCoils.length > 0)
        toast.success(
          `XML Procesado: ${parsedCoils.length} bobinas detectadas.`,
        );
      else
        toast.error(`El XML se leyó, pero no se detectaron bobinas válidas.`);
    } catch (error) {
      toast.error("Error al analizar el XML.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- EFECTO TIPO DE CAMBIO AUTOMÁTICO ---
  useEffect(() => {
    if (currency === "USD" && invoiceDate) {
      const fetchRate = async () => {
        setFetchingRate(true);
        try {
          const res = await fetch(`/api/tipo-cambio?fecha=${invoiceDate}`);
          if (res.ok) {
            const data = await res.json();
            if (data.venta) setExchangeRate(data.venta);
          }
        } catch {
          toast.error("Error al obtener TC.");
        } finally {
          setFetchingRate(false);
        }
      };
      fetchRate();
    } else {
      setExchangeRate(1);
    }
  }, [currency, invoiceDate]);

  // --- MANEJO DE LA TABLA DINÁMICA ---
  const addCoilRow = () => {
    setCoils([
      ...coils,
      {
        uid: Date.now().toString(),
        coilId: "",
        weight: "",
        width: 1200,
        thickness: 0.45,
        finish: "",
        value: "",
      },
    ]);
  };

  const removeCoilRow = (uid: string) => {
    setCoils(coils.filter((c) => c.uid !== uid));
  };

  const updateCoil = (uid: string, field: keyof CoilEntry, val: CoilEntry[keyof CoilEntry]) => {
    setCoils(coils.map((c) => (c.uid === uid ? { ...c, [field]: val } : c)));
  };

  // --- GUARDADO MASIVO A FIREBASE ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceDate || coils.length === 0) {
      toast.error("Faltan datos de factura o bobinas.");
      return;
    }

    for (let i = 0; i < coils.length; i++) {
      const c = coils[i];
      if (!c.coilId || !c.weight || !c.width || !c.thickness || !c.value) {
        toast.error(
          `Completa todos los campos obligatorios en la fila #${i + 1}`,
        );
        return;
      }
    }

    setLoading(true);
    try {
      const payloadCoils = coils.map((coil) => ({
        coilId: coil.coilId.toString().toUpperCase(),
        weight: Number(coil.weight),
        width: Number(coil.width),
        thickness: Number(coil.thickness),
        finish: coil.finish,
        value: Number(coil.value),
      }));

      const payloadInvoice = {
        docType: docType,
        providerDoc: providerDoc || null,
        provider: providerName || "SIN PROVEEDOR",
        invoiceNumber: invoiceNumber || null,
        invoiceDate: invoiceDate,
        currency: currency,
        exchangeRate: currency === "USD" ? exchangeRate : 1,
        isManualEntry: false,
      };

      const registerCoilFn = httpsCallable(functions, "registerCoil");
      await registerCoilFn({ coils: payloadCoils, invoice: payloadInvoice });

      const isConverted = currency === "USD";
      toast.success(
        isConverted
          ? `¡${coils.length} bobinas guardadas! Se convirtieron los USD a Soles (TC: ${exchangeRate}).`
          : `Se registraron ${coils.length} bobinas correctamente.`,
      );
      setCoils([]); // Limpiar tras el guardado
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

  const totalInvoiceValue = coils.reduce(
    (sum, c) => sum + (Number(c.value) || 0),
    0,
  );
  const totalInvoiceWeight = coils.reduce(
    (sum, c) => sum + (Number(c.weight) || 0),
    0,
  );

  return (
    <div className="flex flex-col bg-slate-50 w-full rounded-xl overflow-hidden">
      {/* HEADER: ZONA DE SUBIDA */}
      <div className="p-6 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black leading-tight flex items-center gap-2">
            <FileCode2 className="text-blue-400" /> Carga Mágica XML (SUNAT)
          </h2>
          <p className="text-slate-400 text-xs font-bold mt-1">
            Sube la factura y edita las filas que necesites antes de registrar.
          </p>
        </div>
        <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 transition px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg w-full md:w-auto justify-center">
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Upload size={18} />
          )}
          SUBIR ARCHIVO XML
          <input
            type="file"
            accept=".xml"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={loading}
          />
        </label>
      </div>

      {coils.length > 0 && (
        <div className="p-4 md:p-6 space-y-6">
          {/* CABECERA DE FACTURA */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <header className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
              <Building2 size={18} className="text-blue-600" />
              <h3 className="text-sm font-black text-slate-700 uppercase">
                Datos Extraídos de la Factura
              </h3>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">
                  RUC Proveedor
                </label>
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold focus:border-blue-500 outline-none"
                  value={providerDoc}
                  onChange={(e) => setProviderDoc(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">
                  Razón Social
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none"
                  value={providerName}
                  onChange={(e) =>
                    setProviderName(e.target.value.toUpperCase())
                  }
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">
                  Factura N°
                </label>
                <input
                  type="text"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none"
                  value={invoiceNumber}
                  onChange={(e) =>
                    setInvoiceNumber(e.target.value.toUpperCase())
                  }
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-blue-600 mb-1 uppercase">
                  Fecha Factura *
                </label>
                <input
                  type="date"
                  className="w-full bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-sm font-bold text-blue-900 outline-none"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">
                  Moneda Detectada
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as "PEN" | "USD")}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-700 outline-none"
                >
                  <option value="PEN">Soles (S/)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase">
                  Tipo de Cambio {fetchingRate && "(...)"}
                </label>
                <input
                  type="number"
                  step="0.001"
                  disabled={currency === "PEN"}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-bold disabled:bg-slate-100 outline-none"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* LISTA DE BOBINAS EDITABLE */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <header className="flex justify-between items-center pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Factory size={18} className="text-orange-500" />
                <h3 className="text-sm font-black text-slate-700 uppercase">
                  Ajuste de Bobinas a Ingresar
                </h3>
              </div>
              <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-md">
                {coils.length} items
              </span>
            </header>

            <div className="space-y-3">
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 rounded-lg text-[11px] font-black text-slate-500 uppercase">
                <div className="col-span-2">N° Serie / ID *</div>
                <div className="col-span-2">Acabado *</div>
                <div className="col-span-2">Peso (kg) *</div>
                <div className="col-span-2">Ancho (mm) *</div>
                <div className="col-span-1">Espesor *</div>
                <div className="col-span-2">Valor ({currency}) *</div>
                <div className="col-span-1 text-center">Acción</div>
              </div>

              {coils.map((coil) => (
                <div
                  key={coil.uid}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-white border border-slate-100 rounded-lg relative hover:border-blue-200 transition"
                >
                  <div className="md:col-span-2">
                    <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1">
                      N° Serie *
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-md p-2.5 text-sm font-black uppercase outline-none focus:border-blue-500"
                      value={coil.coilId}
                      onChange={(e) =>
                        updateCoil(
                          coil.uid,
                          "coilId",
                          e.target.value.toUpperCase(),
                        )
                      }
                    />
                    {coil.originalDesc && (
                      <p
                        className="text-[9px] text-slate-400 mt-1 truncate"
                        title={coil.originalDesc}
                      >
                        XML: {coil.originalDesc}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1">
                      Acabado *
                    </label>
                    <select
                      required
                      value={coil.finish}
                      onChange={(e) => updateCoil(coil.uid, "finish", e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md p-2.5 text-sm font-bold outline-none focus:border-blue-500"
                    >
                      <option value="">Seleccionar...</option>
                      {finishes.map((f) => (
                        <option key={f.id} value={f.id}>{f.label || f.id}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1">
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
                    <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1">
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
                  <div className="md:col-span-1">
                    <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1">
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
                    <label className="md:hidden block text-[11px] font-bold text-slate-400 mb-1">
                      Valor {currency} *
                    </label>
                    <div className="relative">
                      <DollarSign
                        size={14}
                        className="absolute left-2.5 top-3 text-emerald-500"
                      />
                      <input
                        required
                        type="number"
                        step="0.01"
                        className="pl-8 w-full bg-emerald-50 border border-emerald-200 rounded-md p-2.5 text-sm font-black text-emerald-800 outline-none focus:border-emerald-500"
                        value={coil.value}
                        onChange={(e) =>
                          updateCoil(coil.uid, "value", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="md:col-span-1 flex items-start md:items-center justify-center pt-2 md:pt-0">
                    <button
                      type="button"
                      onClick={() => removeCoilRow(coil.uid)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Eliminar fila"
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
              <Plus size={16} /> AÑADIR FILA EXTRA (Desglosar Bobina)
            </button>
          </div>

          {/* BARRA DE GUARDADO */}
          <div className="bg-slate-900 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-8">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Peso Total Factura
                </p>
                <p className="text-xl font-black text-white">
                  {totalInvoiceWeight.toLocaleString("es-PE")}{" "}
                  <span className="text-xs text-slate-500">kg</span>
                </p>
              </div>
              <div className="w-px h-8 bg-slate-700"></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Monto Total Factura
                </p>
                <p className="text-2xl font-black text-emerald-400">
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
              className="w-full md:w-auto bg-blue-600 text-white px-10 py-4 rounded-xl text-sm font-black flex items-center justify-center gap-3 hover:bg-blue-500 transition shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Database size={20} />
              )}
              {loading ? "PROCESANDO..." : `GUARDAR ${coils.length} BOBINAS`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
