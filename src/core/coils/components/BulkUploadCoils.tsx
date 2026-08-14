"use client";
import React, { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Database,
  Trash2,
  Layers,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import { useFinishes } from "@/core/coils/hooks/useFinishes";
import { parseCoilDescription } from "@/core/coils/parseCoilDescription";
import {
  TOKEN_TO_FINISH,
  validateCoilRow,
  buildInvoicesPayload,
  CoilRow,
  normalizeFecha,
  parseWeightToKg,
  isValidUsdExchangeRate,
  WEIGHT_MIN_KG,
  WEIGHT_MAX_KG
} from "@/core/coils/bulkUploadLogic";
import { parseNumValue } from "@/core/import/catalogImport";

interface InvoiceResult {
  invoiceId: string;
  status: "created" | "skipped-dup" | "failed";
  count?: number;
  error?: string;
}

export function BulkUploadCoils() {
  const { finishes } = useFinishes(true);
  const liveFinishKeys = useMemo(() => finishes.map((f) => f.id), [finishes]);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CoilRow[]>([]);
  const [results, setResults] = useState<InvoiceResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResults([]);
    try {
      const data = await file.arrayBuffer();
      // OBLIGATORIO raw: true, cellDates NO.
      const workbook = XLSX.read(data, { type: "array", raw: true });

      let parsedRows: CoilRow[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(
          worksheet,
          { defval: "", raw: true }
        );

        jsonData.forEach((row) => {
          const itemDescription = String(row["ITEM"] || "");
          const serie = String(row["Serie del CDP"] || row["SERIE"] || "").trim();
          const nroDoc = String(
            row["Nro CP o Doc."] || row["NUMERO"] || row["NRO DOC"] || ""
          ).trim();

          // Solo tomar filas que tengan al menos serie o documento para no leer filas vacías
          if (!serie && !nroDoc && !itemDescription) return;

          const parsedDesc = parseCoilDescription(itemDescription);
          const parsedFinish = parsedDesc.finishToken
            ? TOKEN_TO_FINISH[parsedDesc.finishToken] ?? ""
            : "";
          const width = parsedDesc.width ?? "";
          const thickness = parsedDesc.thickness ?? "";

          const weightRaw = String(row["CANTIDAD"] || "").trim();
          const unitRaw = String(row["UNIDAD DE MEDIDA"] || "").trim();
          const parsedWeight = parseWeightToKg(weightRaw, unitRaw);

          parsedRows.push({
            serie,
            nroDoc,
            fecha: String(row["FECHA"] || row["F. EMISION"] || "").trim(),
            provider: String(row["PROVEEDOR"] || "").trim(),
            providerDoc: String(row["RUC"] || row["R.U.C."] || "").trim(),
            currencyRaw: String(row["MONEDA"] || "").trim(),
            exchangeRateRaw: String(row["MONEDA TIPO DE CAMBIO"] || "").trim(),
            finish: parsedFinish,
            widthRaw: parsedDesc.width ? String(parsedDesc.width) : "",
            thicknessRaw: parsedDesc.thickness ? String(parsedDesc.thickness) : "",
            weightRaw,
            unitRaw,
            weightKgRaw: parsedWeight !== null ? String(parsedWeight) : "",
            valueRaw: String(row["VALOR TOTAL"] || "").trim(),
          });
        });
      });

      setRows(parsedRows);
      toast.success(`Excel procesado: ${parsedRows.length} filas listas.`);
    } catch (error) {
      console.error(error);
      toast.error("Error al analizar el Excel. Verifica el formato.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRowChange = (index: number, field: keyof CoilRow, value: string | boolean) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const handleSuggestTC = async (index: number) => {
    const row = rows[index];
    const fechaNorm = normalizeFecha(row.fecha);
    if (!fechaNorm) {
      toast.error("Fecha inválida para consultar TC");
      return;
    }
    const toastId = toast.loading("Consultando TC...");
    try {
      const res = await fetch(`/api/tipo-cambio?fecha=${fechaNorm}`);
      const data = await res.json();
      if (data && data.venta && !data.fallback && isValidUsdExchangeRate(data.venta)) {
        toast.success(`TC obtenido: ${data.venta}`, { id: toastId });

        // Apply to all rows in the same invoice
        const newRows = [...rows];
        newRows.forEach((r, i) => {
          if (r.serie === row.serie && r.nroDoc === row.nroDoc) {
            newRows[i] = { ...newRows[i], exchangeRateRaw: String(data.venta) };
          }
        });
        setRows(newRows);
      } else {
        toast.error(
          data.error || "TC real no disponible, ingresá el del día de la factura.",
          { id: toastId },
        );
      }
    } catch (err: any) {
      toast.error("Error de red consultando TC", { id: toastId });
    }
  };

  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rows.length === 0) return;

    const { invoices, invalidCount } = buildInvoicesPayload(rows, liveFinishKeys);
    if (invalidCount > 0) {
      toast.error(`Existen ${invalidCount} filas inválidas. Por favor corrige o elimínalas.`);
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const registerCoilsBulk = httpsCallable<
        { invoices: any[] },
        { results: InvoiceResult[] }
      >(functions, "registerCoilsBulk");

      const response = await registerCoilsBulk({ invoices });
      const invoiceResults = response.data.results || [];
      
      setResults(invoiceResults);

      const created = invoiceResults.filter((r) => r.status === "created").length;
      const skipped = invoiceResults.filter((r) => r.status === "skipped-dup").length;
      const failed = invoiceResults.filter((r) => r.status === "failed").length;

      toast.success(`${created} facturas creadas, ${skipped} duplicadas, ${failed} fallidas`);
      
      if (failed === 0 && invoiceResults.length > 0) {
          // Opcional: limpiar filas si todo salió bien
          // setRows([]); 
      }
    } catch (error: any) {
      console.error("Error llamando a registerCoilsBulk:", error);
      toast.error(error?.message || "Error al registrar las bobinas");
    } finally {
      setLoading(false);
    }
  };

  // Validaciones reactivas de la UI
  const rowsWithValidation = rows.map((row) => ({
    row,
    validation: validateCoilRow(row, liveFinishKeys),
  }));

  const validCount = rowsWithValidation.filter((r) => r.validation.valid).length;
  const invalidCount = rowsWithValidation.length - validCount;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <Database className="text-purple-600" size={20} />
            Subida Masiva de Bobinas (Thin-Client)
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Sube tu Excel. Verifica y edita los datos antes de enviar.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <label className="cursor-pointer bg-purple-50 text-purple-700 hover:bg-purple-100 transition px-4 py-2 rounded-xl font-bold flex items-center gap-2 shrink-0 justify-center">
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={18} />
            )}
            Seleccionar Excel
            <input
              type="file"
              accept=".xlsx, .csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
              disabled={loading}
            />
          </label>
        </div>
      </div>

      {results.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-2">
          <h3 className="font-bold text-gray-700 mb-3">Resultados por Factura</h3>
          {results.map((res, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                res.status === "created"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : res.status === "skipped-dup"
                  ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {res.status === "created" && <CheckCircle2 size={18} className="text-green-600" />}
              {res.status === "skipped-dup" && <AlertCircle size={18} className="text-yellow-600" />}
              {res.status === "failed" && <XCircle size={18} className="text-red-600" />}
              
              <div className="flex-1">
                <p className="font-bold">{res.invoiceId || "Factura Desconocida"}</p>
                <p className="text-sm opacity-90">
                  {res.status === "created"
                    ? `Registrada con éxito (${res.count} bobinas)`
                    : res.status === "skipped-dup"
                    ? "Omitida: Factura ya existente"
                    : `Falló: ${res.error || "Error desconocido"}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-purple-50/50 rounded-xl p-6 border border-purple-100 animate-in fade-in space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-purple-100 pb-4">
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-black text-gray-800">{rows.length}</p>
                <p className="text-xs font-bold text-gray-500 uppercase">Filas</p>
              </div>
              <div className="w-px bg-purple-200" />
              <div className="text-center">
                <p className="text-2xl font-black text-green-600">{validCount}</p>
                <p className="text-xs font-bold text-green-600/70 uppercase">Válidas</p>
              </div>
              <div className="w-px bg-purple-200" />
              <div className="text-center">
                <p className={`text-2xl font-black ${invalidCount > 0 ? "text-red-600" : "text-gray-400"}`}>
                  {invalidCount}
                </p>
                <p className={`text-xs font-bold uppercase ${invalidCount > 0 ? "text-red-600/70" : "text-gray-400"}`}>
                  Inválidas
                </p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || invalidCount > 0}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Upload />}
              Enviar a Firestore
            </button>
          </div>

          <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-2 border-b">Estado</th>
                  <th className="p-2 border-b">Serie</th>
                  <th className="p-2 border-b">Nro Doc</th>
                  <th className="p-2 border-b">Fecha</th>
                  <th className="p-2 border-b">Proveedor</th>
                  <th className="p-2 border-b">RUC</th>
                  <th className="p-2 border-b">Moneda</th>
                  <th className="p-2 border-b">TC</th>
                  <th className="p-2 border-b">Acabado</th>
                  <th className="p-2 border-b">Ancho</th>
                  <th className="p-2 border-b">Espesor</th>
                  <th className="p-2 border-b">Peso (Kg)</th>
                  <th className="p-2 border-b">Unidad/Orig.</th>
                  <th className="p-2 border-b">Valor T.</th>
                  <th className="p-2 border-b text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rowsWithValidation.map(({ row, validation }, i) => (
                  <tr key={i} className={`hover:bg-gray-50/50 transition ${!validation.valid ? "bg-red-50/30" : ""}`}>
                    <td className="p-2 border-r border-gray-100">
                      {validation.valid ? (
                        <div className="flex items-center justify-center bg-green-100 text-green-700 rounded-full w-6 h-6" title="Fila válida">
                          <CheckCircle2 size={14} />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 text-red-600">
                          <div className="flex items-center justify-center bg-red-100 rounded-full w-6 h-6" title={validation.errors.join("\n")}>
                            <XCircle size={14} />
                          </div>
                          <span className="text-[10px] max-w-[80px] whitespace-normal leading-tight font-medium">
                            {validation.errors[0]}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-1">
                      <input type="text" value={row.serie} onChange={(e) => handleRowChange(i, "serie", e.target.value)} className="w-16 p-1 border rounded text-xs" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={row.nroDoc} onChange={(e) => handleRowChange(i, "nroDoc", e.target.value)} className="w-20 p-1 border rounded text-xs" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={(() => {
                        const norm = normalizeFecha(row.fecha);
                        if (!norm) return String(row.fecha ?? "");
                        const [y, m, d] = norm.split("-");
                        return `${d}/${m}/${y}`;
                      })()} onChange={(e) => handleRowChange(i, "fecha", e.target.value)} className="w-20 p-1 border rounded text-xs" title="DD/MM/YYYY o YYYY-MM-DD" placeholder="DD/MM/YYYY" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={row.provider} onChange={(e) => handleRowChange(i, "provider", e.target.value)} className="w-32 p-1 border rounded text-xs" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={row.providerDoc} onChange={(e) => handleRowChange(i, "providerDoc", e.target.value)} className="w-24 p-1 border rounded text-xs" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={row.currencyRaw} onChange={(e) => handleRowChange(i, "currencyRaw", e.target.value)} className="w-16 p-1 border rounded text-xs" placeholder="USD/PEN" />
                    </td>
                    <td className="p-1 text-center">
                      {row.currencyRaw.toUpperCase().includes('SOLES') || row.currencyRaw.toUpperCase().includes('PEN') || row.currencyRaw === 'S/.' ? (
                        <span className="text-gray-500 font-bold px-2">1</span>
                      ) : (
                        <div className="flex items-center gap-1 w-[80px]">
                          <input type="text" value={row.exchangeRateRaw} onChange={(e) => handleRowChange(i, "exchangeRateRaw", e.target.value)} className="w-full p-1 border rounded text-xs" />
                          <button onClick={() => handleSuggestTC(i)} className="text-blue-600 hover:bg-blue-50 p-1 rounded transition" title="Sugerir TC por factura">
                            <RefreshCw size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-1">
                      <select value={row.finish} onChange={(e) => handleRowChange(i, "finish", e.target.value)} className="w-28 p-1 border rounded text-xs bg-white">
                        <option value="">Seleccionar...</option>
                        {finishes.map((f) => (
                          <option key={f.id} value={f.id}>{f.label || f.id}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1">
                      <input type="text" value={row.widthRaw} onChange={(e) => handleRowChange(i, "widthRaw", e.target.value)} className="w-16 p-1 border rounded text-xs" />
                    </td>
                    <td className="p-1">
                      <input type="text" value={row.thicknessRaw} onChange={(e) => handleRowChange(i, "thicknessRaw", e.target.value)} className="w-16 p-1 border rounded text-xs" />
                    </td>
                    <td className="p-1">
                      {(() => {
                        const isMissing = !row.weightKgRaw || row.weightKgRaw.trim() === "";
                        
                        let effectiveWeight: number | null = null;
                        if (!isMissing) {
                          effectiveWeight = parseNumValue(row.weightKgRaw);
                        } else {
                          effectiveWeight = parseWeightToKg(row.weightRaw, row.unitRaw);
                        }
                        
                        const isResolvable = effectiveWeight !== null && !isNaN(effectiveWeight) && effectiveWeight > 0;
                        const isOutOfRange = isResolvable && (effectiveWeight! < WEIGHT_MIN_KG || effectiveWeight! > WEIGHT_MAX_KG);

                        return (
                          <div className="flex flex-col gap-1 items-start">
                            <input 
                              type="text" 
                              value={row.weightKgRaw} 
                              onChange={(e) => handleRowChange(i, "weightKgRaw", e.target.value)} 
                              className={`w-20 p-1 border rounded text-xs ${isMissing ? 'border-red-400 bg-red-50' : ''}`}
                              placeholder="En Kg..."
                            />
                            {isOutOfRange && (
                              <label className="flex items-center gap-1 text-[10px] whitespace-nowrap cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={row.weightOverride || false}
                                  onChange={(e) => handleRowChange(i, "weightOverride", e.target.checked)}
                                  className="w-3 h-3"
                                />
                                {row.weightOverride ? (
                                  <span className="text-amber-600 font-medium bg-amber-50 px-1 rounded">Peso autorizado</span>
                                ) : (
                                  <span className="text-red-600 font-medium">Autorizar ({effectiveWeight} kg)</span>
                                )}
                              </label>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-1 text-[10px] text-gray-500 max-w-[80px] overflow-hidden text-ellipsis">
                      {row.weightRaw} {row.unitRaw}
                    </td>
                    <td className="p-1">
                      <input type="text" value={row.valueRaw} onChange={(e) => handleRowChange(i, "valueRaw", e.target.value)} className="w-24 p-1 border rounded text-xs" />
                    </td>
                    <td className="p-1 text-center">
                      <button onClick={() => handleRemoveRow(i)} className="text-red-400 hover:text-red-600 p-1 rounded transition" title="Quitar fila">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
