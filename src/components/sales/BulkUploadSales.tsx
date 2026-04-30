"use client";
import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  writeBatch,
  doc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import toast from "react-hot-toast";

export function BulkUploadSales() {
  const [loading, setLoading] = useState(false);
  const [parsedSales, setParsedSales] = useState<any[]>([]);
  const [parsedCustomers, setParsedCustomers] = useState<any[]>([]);
  const [exchangeRatesCache, setExchangeRatesCache] = useState<
    Record<string, number>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const usdDates = new Set<string>();
      jsonData.forEach((row: any) => {
        const moneda = String(row["MONEDA"] || "").toLowerCase();
        if (moneda.includes("dólar") || moneda.includes("usd")) {
          usdDates.add(formatDateForApi(row["F. EMISIÓN"]));
        }
      });

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

      const salesMap = new Map<string, any>();
      const customersMap = new Map<string, any>(); // Mapa para no repetir clientes

      jsonData.forEach((row: any) => {
        const serieNumero = row["SERIE - NÚMERO"];
        if (!serieNumero) return;

        // --- LÓGICA DE SEPARACIÓN DE RUC Y RAZÓN SOCIAL ---
        const rawCustomer = String(row["CLIENTE"] || "");
        let rucStr = "00000000000";
        let nameStr = "Consumidor Final";

        if (rawCustomer.includes(" - ")) {
          const parts = rawCustomer.split(" - ");
          rucStr = parts[0].trim();
          nameStr = parts.slice(1).join(" - ").trim(); // Por si el nombre tiene guiones
        } else {
          nameStr = rawCustomer.trim() || "Consumidor Final";
        }

        // Guardamos el cliente único en el mapa
        if (!customersMap.has(rucStr) && rucStr !== "00000000000") {
          customersMap.set(rucStr, {
            documentNumber: rucStr,
            name: nameStr,
            customerType: rucStr.length === 11 ? "RUC" : "DNI",
          });
        }
        // ----------------------------------------------------

        const moneda = String(row["MONEDA"] || "").toLowerCase();
        const isUSD = moneda.includes("dólar") || moneda.includes("usd");
        const apiDate = formatDateForApi(row["F. EMISIÓN"]);
        const exchangeRate = isUSD ? newRates[apiDate] || 3.75 : 1;
        const parseNum = (val: any) =>
          typeof val === "string"
            ? parseFloat(val.replace(/,/g, ""))
            : parseFloat(val) || 0;

        const cantidad = parseNum(row["CANTIDAD"]);
        const valorVentaSoles = parseNum(row["VALOR DE VENTA"]) * exchangeRate;
        const precioVentaSoles =
          parseNum(row["PRECIO DE VENTA"]) * exchangeRate;

        const saleItem = {
          sku: row["CÓDIGO PRODUCTO"] || "GENERIC",
          productName: row["NOMBRE PRODUCTO"] || "Sin nombre",
          quantity: cantidad,
          unitPrice: cantidad > 0 ? precioVentaSoles / cantidad : 0,
          unitCost: 0,
          subtotal: valorVentaSoles,
          profit: valorVentaSoles,
        };

        if (!salesMap.has(serieNumero)) {
          salesMap.set(serieNumero, {
            customerName: nameStr,
            customerDocument: rucStr, // Guardamos el RUC limpio en la venta
            documentNumber: serieNumero,
            status: String(row["ESTADO COMPROBANTE"])
              .toLowerCase()
              .includes("anul")
              ? "CANCELLED"
              : "COMPLETED",
            sellerId: row["VENDEDOR"] || "SISTEMA",
            currency: isUSD ? "USD" : "PEN",
            exchangeRateApplied: exchangeRate,
            timestamp:
              row["F. EMISIÓN"] instanceof Date
                ? row["F. EMISIÓN"]
                : new Date(apiDate),
            items: [],
            totalAmount: 0,
            totalCost: 0,
            totalProfit: 0,
          });
        }

        const sale = salesMap.get(serieNumero);
        sale.items.push(saleItem);
        sale.totalAmount += precioVentaSoles;
        sale.totalProfit += saleItem.profit;
      });

      setParsedSales(Array.from(salesMap.values()));
      setParsedCustomers(Array.from(customersMap.values()));
      toast.success(
        `Procesado: ${salesMap.size} facturas y ${customersMap.size} clientes nuevos identificados.`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Error al analizar el Excel. Verifica el formato.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUploadToFirebase = async () => {
    if (parsedSales.length === 0) return;
    setLoading(true);

    try {
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      const checkBatchLimit = (neededOps: number) => {
        if (opCount + neededOps > 480) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      };

      // 1. PRIMERO CREAMOS LOS CLIENTES (Si no existen)
      for (const customer of parsedCustomers) {
        checkBatchLimit(1);
        const customerRef = doc(db, "customers", customer.documentNumber);
        // merge: true hace que si el cliente ya existe, no lo sobreescriba, solo agregue/actualice
        currentBatch.set(
          customerRef,
          {
            ...customer,
            lastUpdated: serverTimestamp(),
          },
          { merge: true },
        );
        opCount++;
      }

      // 2. LUEGO CREAMOS LAS VENTAS Y DESCONTAMOS EL STOCK
      for (const sale of parsedSales) {
        const opsNeeded = 1 + sale.items.length;
        checkBatchLimit(opsNeeded);

        // Guardar la Venta
        const saleRef = doc(collection(db, "sales"));
        const saleData = { ...sale, uploadedAt: serverTimestamp() };
        currentBatch.set(saleRef, saleData);
        opCount++;

        // Descontar el Stock (Permitiendo negativos)
        if (sale.status === "COMPLETED") {
          for (const item of sale.items) {
            if (item.sku && item.sku !== "GENERIC") {
              const stockRef = doc(db, "stock_summaries", item.sku);
              currentBatch.set(
                stockRef,
                {
                  sku: item.sku,
                  totalQuantity: increment(-item.quantity),
                  lastUpdate: serverTimestamp(),
                },
                { merge: true },
              );
              opCount++;
            }
          }
        }
      }

      if (opCount > 0) batches.push(currentBatch);

      await Promise.all(batches.map((b) => b.commit()));

      toast.success(
        `${parsedSales.length} ventas y ${parsedCustomers.length} clientes procesados con éxito.`,
      );
      setParsedSales([]);
      setParsedCustomers([]);
    } catch (error) {
      console.error("Error en subida masiva:", error);
      toast.error("Hubo un error subiendo los datos a Firebase.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-black text-gray-800">
            Carga Histórica (Excel)
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Sube tus ventas. Separaremos RUCs, crearemos clientes y ajustaremos
            el stock automáticamente.
          </p>
        </div>

        <label className="cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 transition px-4 py-2 rounded-xl font-bold flex items-center gap-2">
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={18} />
          )}
          Seleccionar Reporte
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

      {parsedSales.length > 0 && (
        <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 animate-in fade-in">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-gray-800 text-sm">
                Validación completada:
              </p>
              <p className="text-blue-600 font-black text-xl">
                {parsedSales.length}{" "}
                <span className="text-sm font-medium">Facturas</span> |{" "}
                {parsedCustomers.length}{" "}
                <span className="text-sm font-medium">Clientes</span>
              </p>
            </div>
            <button
              onClick={handleUploadToFirebase}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Upload />}
              Subir a Base de Datos
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
