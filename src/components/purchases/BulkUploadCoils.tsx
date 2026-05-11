"use client";
import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Database,
  Trash2,
} from "lucide-react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

export function BulkUploadCoils() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [parsedCoils, setParsedCoils] = useState<any[]>([]);
  const [exchangeRatesCache, setExchangeRatesCache] = useState<
    Record<string, number>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Función inteligente para leer números con cualquier formato
  const parseNum = (val: any) => {
    if (typeof val === "number") return val;
    if (!val) return 0;
    let str = String(val).trim();
    str = str.replace(/[^\d.,-]/g, "");
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastComma > lastDot) {
      str = str.replace(/\./g, "");
      str = str.replace(/,/g, ".");
    } else if (lastDot > lastComma) {
      str = str.replace(/,/g, "");
    }
    return parseFloat(str) || 0;
  };

  // Función para formatear fechas para la API del Tipo de Cambio
  const formatDateForApi = (dateVal: any) => {
    if (!dateVal) return new Date().toISOString().split("T")[0];
    let d = dateVal;
    if (typeof dateVal === "string") {
      const parts = dateVal.split(" ")[0].split("/");
      if (parts.length >= 3)
        return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      d = new Date(dateVal);
    }
    if (d instanceof Date && !isNaN(d.getTime()))
      return d.toISOString().split("T")[0];
    return new Date().toISOString().split("T")[0];
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });

      // 1. PRIMERA PASADA: DETECTAR FECHAS CON DÓLARES
      const usdDates = new Set<string>();

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        jsonData.forEach((row: any) => {
          const moneda = String(row["MONEDA"] || "").toLowerCase();
          if (moneda.includes("dólar") || moneda.includes("usd")) {
            const rawDate =
              row["FECHA"] || row["F. EMISIÓN"] || row["FECHA EMISION"];
            usdDates.add(formatDateForApi(rawDate));
          }
        });
      });

      // 2. OBTENER TIPOS DE CAMBIO DESDE LA API
      const newRates = { ...exchangeRatesCache };
      for (const date of Array.from(usdDates)) {
        if (!newRates[date]) {
          try {
            const res = await fetch(`/api/tipo-cambio?fecha=${date}`);
            const rateData = await res.json();
            newRates[date] = parseFloat(rateData.venta) || 3.75;
          } catch (err) {
            newRates[date] = 3.75;
          }
        }
      }
      setExchangeRatesCache(newRates);

      // 3. SEGUNDA PASADA: PROCESAMIENTO REAL DE BOBINAS
      let allCoils: any[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        jsonData.forEach((row: any, index: number) => {
          const itemDescription = String(row["ITEM"] || "").toUpperCase();
          const serie = row["Serie del CDP"] || row["SERIE"];
          const nroDoc =
            row["Nro CP o Doc."] || row["NUMERO"] || row["NRO DOC"];

          if (!serie || !nroDoc || !itemDescription.includes("BOB")) return;

          let parsedCantidad = parseNum(row["CANTIDAD"]);
          let weightInKg =
            parsedCantidad < 100 ? parsedCantidad * 1000 : parsedCantidad;

          let thickness = 0.45;
          let width = 1200;

          const thicknessMatch = itemDescription.match(/0\.\d{2}/);
          if (thicknessMatch) thickness = parseFloat(thicknessMatch[0]);

          const widthMatch = itemDescription.match(/1[0-2]\d{2}/);
          if (widthMatch) width = parseFloat(widthMatch[0]);

          const moneda = String(row["MONEDA"] || "").toLowerCase();
          const isUSD = moneda.includes("dólar") || moneda.includes("usd");

          const rawDate =
            row["FECHA"] || row["F. EMISIÓN"] || row["FECHA EMISION"];
          const apiDate = formatDateForApi(rawDate);
          const exchangeRate = isUSD ? newRates[apiDate] || 3.75 : 1;

          const rawTotal = parseNum(
            row["VALOR TOTAL EN SOLES"] ||
              row["VALOR EN SOLES"] ||
              row["TOTAL"],
          );

          let totalCostSoles = rawTotal;
          let originalCurrencyValue = 0;

          if (isUSD) {
            originalCurrencyValue = rawTotal;
            totalCostSoles = rawTotal * exchangeRate;
          }

          let costPerKg = weightInKg > 0 ? totalCostSoles / weightInKg : 0;

          const rawRuc = String(
            row["RUC"] ||
              row["R.U.C."] ||
              row["RUC PROVEEDOR"] ||
              row["NRO DOC PROVEEDOR"] ||
              "",
          ).replace(/\D/g, "");

          const finalDate = (() => {
            if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
              return new Date(
                rawDate.getUTCFullYear(),
                rawDate.getUTCMonth(),
                rawDate.getUTCDate(),
                12,
                0,
                0,
              );
            } else if (typeof rawDate === "string") {
              const parts = rawDate.split(" ")[0].split("/");
              if (parts.length >= 3) {
                const isoDate = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
                const parsedDate = new Date(`${isoDate}T12:00:00`);
                return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
              }
              const fallbackDate = new Date(`${rawDate}T12:00:00`);
              return isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate;
            }
            return new Date();
          })();

          const generatedId = `${serie}-${nroDoc}-${index + 1}`;

          allCoils.push({
            id: generatedId,
            initialWeight: Math.round(weightInKg),
            currentWeight: Math.round(weightInKg),
            masterWidth: width,
            thickness: thickness,
            pricePerKg: Number(costPerKg.toFixed(6)),
            status: "AVAILABLE",
            provider: row["PROVEEDOR"] || row["RAZON SOCIAL"] || "SISTEMA",
            providerDoc: rawRuc,
            invoiceNumber: `${serie}-${nroDoc}`,
            invoiceDate: finalDate,
            originalDescription: itemDescription,
            currency: isUSD ? "USD" : "PEN",
            exchangeRate: exchangeRate,
            originalCurrencyValue: Number(originalCurrencyValue.toFixed(2)),
          });
        });
      });

      setParsedCoils(allCoils);
      toast.success(
        `Excel procesado: ${allCoils.length} bobinas listas para subir.`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Error al analizar el Excel. Verifica el formato.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 🚀 LÓGICA PARA BORRAR UN ITEM DE LA LISTA PREVIA
  const handleDeleteParsedCoil = (indexToRemove: number) => {
    setParsedCoils((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
    toast.success("Bobina removida de la lista.");
  };

  const handleUploadToFirebase = async () => {
    if (parsedCoils.length === 0) return;
    setLoading(true);

    try {
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      for (const coil of parsedCoils) {
        if (opCount === 490) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }

        const docRef = doc(db, "coils", coil.id);

        const docType =
          coil.providerDoc &&
          (coil.providerDoc.length === 8 || coil.providerDoc.length === 11)
            ? "LOCAL"
            : "TAX_ID";

        const coilData = {
          id: coil.id,
          initialWeight: coil.initialWeight,
          currentWeight: coil.currentWeight,
          masterWidth: coil.masterWidth,
          thickness: coil.thickness,
          pricePerKg: coil.pricePerKg,
          status: coil.status,
          registeredBy: user?.email || "Admin (Carga Masiva)",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          metadata: {
            providerDocType: docType,
            providerDoc: coil.providerDoc || null,
            provider: coil.provider,
            invoiceNumber: coil.invoiceNumber,
            invoiceDate: coil.invoiceDate,
            originalDescription: coil.originalDescription,
            isHistoricalMigration: true,
            // Guardamos la info de moneda exacta
            currency: coil.currency,
            exchangeRate: coil.exchangeRate,
            originalCurrencyValue: coil.originalCurrencyValue,
          },
        };

        currentBatch.set(docRef, coilData);
        opCount++;
      }

      if (opCount > 0) batches.push(currentBatch);
      await Promise.all(batches.map((b) => b.commit()));

      toast.success(
        `¡${parsedCoils.length} bobinas migradas al inventario con éxito!`,
      );
      setParsedCoils([]);
    } catch (error) {
      console.error("Error en migración:", error);
      toast.error("Hubo un error guardando los datos en la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <Database className="text-purple-600" size={20} />
            Migración Histórica de Bobinas (Compras)
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Sube tu Excel. El sistema detectará automáticamente si la moneda es
            USD, aplicará el tipo de cambio del día y guardará la auditoría
            original.
          </p>
        </div>

        <label className="cursor-pointer bg-purple-50 text-purple-700 hover:bg-purple-100 transition px-4 py-2 rounded-xl font-bold flex items-center gap-2 shrink-0">
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

      {parsedCoils.length > 0 && (
        <div className="bg-purple-50/50 rounded-xl p-6 border border-purple-100 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-purple-100 pb-4 mb-4">
            <p className="text-purple-700 font-black text-2xl">
              {parsedCoils.length} Bobinas Encontradas
            </p>
            <button
              onClick={handleUploadToFirebase}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 transition disabled:opacity-50 shadow-lg active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Upload />}
              Poblar Inventario
            </button>
          </div>

          {/* LA TABLA DE PRE-VISUALIZACIÓN CON DETALLES */}
          <div className="max-h-64 overflow-y-auto bg-white border border-gray-100 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3">Factura / ID</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3 text-center">Dimensiones</th>
                  <th className="p-3 text-right">Peso (Kg)</th>
                  <th className="p-3 text-right">Costo Total</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parsedCoils.map((coil, i) => {
                  const totalSoles = coil.initialWeight * coil.pricePerKg;
                  return (
                    <tr
                      key={coil.id}
                      className="hover:bg-purple-50/30 transition"
                    >
                      <td className="p-3">
                        <p className="font-bold text-gray-800">{coil.id}</p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {coil.invoiceNumber}
                        </p>
                      </td>
                      <td className="p-3 text-gray-600 font-medium truncate max-w-[200px]">
                        {coil.provider}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                          {coil.thickness}mm x {coil.masterWidth}mm
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium text-orange-600">
                        {coil.initialWeight.toLocaleString("es-PE")} kg
                      </td>
                      <td className="p-3 text-right">
                        <p className="font-black text-emerald-600">
                          S/{" "}
                          {totalSoles.toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        {/* 🔥 AQUÍ MUESTRA EL TIPO DE CAMBIO EN LA TABLA */}
                        {coil.currency === "USD" && (
                          <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                            ${" "}
                            {coil.originalCurrencyValue.toLocaleString(
                              "en-US",
                              { minimumFractionDigits: 2 },
                            )}{" "}
                            (TC: {coil.exchangeRate})
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteParsedCoil(i)}
                          className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                          title="Borrar de la lista"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
