"use client";
import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Database,
  AlertCircle,
} from "lucide-react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  writeBatch,
  doc,
  getDocs,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { StockSummary } from "@/types";

export function BulkUploadSales() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [parsedSales, setParsedSales] = useState<any[]>([]);
  const [parsedCustomers, setParsedCustomers] = useState<any[]>([]);
  const [exchangeRatesCache, setExchangeRatesCache] = useState<
    Record<string, number>
  >({});

  // REFERENCIAS PARA EL VOLUMEN Y COSTO REAL
  const [catalogRef, setCatalogRef] = useState<any[]>([]);
  const [stockRef, setStockRef] = useState<StockSummary[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Cargamos el catálogo y los costos actuales en memoria antes de leer el Excel
  useEffect(() => {
    const fetchReferences = async () => {
      try {
        const prodSnap = await getDocs(collection(db, "products"));
        const stockSnap = await getDocs(collection(db, "inventory_stock"));

        setCatalogRef(prodSnap.docs.map((d) => ({ sku: d.id, ...d.data() })));
        setStockRef(
          stockSnap.docs.map(
            (d) => ({ sku: d.id, ...d.data() }) as StockSummary,
          ),
        );
      } catch (error) {
        console.error("Error cargando referencias:", error);
      }
    };
    fetchReferences();
  }, []);

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

    if (catalogRef.length === 0) {
      toast.error("El catálogo aún está cargando, intenta en unos segundos.");
      return;
    }

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // --- 1. OBTENCIÓN DE TIPOS DE CAMBIO ---
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

      // --- 2. MAPEO Y AGRUPACIÓN DE VENTAS ---
      const salesMap = new Map<string, any>();
      const customersMap = new Map<string, any>();
      let anuladosCount = 0;

      jsonData.forEach((row: any) => {
        const serieNumero = row["SERIE - NÚMERO"];
        if (!serieNumero) return;

        // FILTRO ESTRICTO: IGNORAR ANULADOS
        const estadoStr = String(row["ESTADO COMPROBANTE"] || "").toUpperCase();
        if (
          !estadoStr.includes("DECLARADO") ||
          estadoStr.includes("ANULAD") ||
          estadoStr.includes("BAJA")
        ) {
          anuladosCount++;
          return; // Saltamos esta fila completamente
        }

        // LÓGICA DE SEPARACIÓN DE RUC Y RAZÓN SOCIAL
        const rawCustomer = String(row["CLIENTE"] || "");
        let rucStr = "00000000000";
        let nameStr = "Consumidor Final";

        if (rawCustomer.includes(" - ")) {
          const parts = rawCustomer.split(" - ");
          rucStr = parts[0].trim();
          nameStr = parts.slice(1).join(" - ").trim();
        } else {
          nameStr = rawCustomer.trim() || "Consumidor Final";
        }

        if (!customersMap.has(rucStr) && rucStr !== "00000000000") {
          customersMap.set(rucStr, {
            documentNumber: rucStr,
            name: nameStr,
            customerType: rucStr.length === 11 ? "RUC" : "DNI",
          });
        }

        // CONVERSIÓN DE MONEDA
        const moneda = String(row["MONEDA"] || "").toLowerCase();
        const isUSD = moneda.includes("dólar") || moneda.includes("usd");
        const apiDate = formatDateForApi(row["F. EMISIÓN"]);
        const exchangeRate = isUSD ? newRates[apiDate] || 3.75 : 1;
        const parseNum = (val: any) =>
          typeof val === "string"
            ? parseFloat(val.replace(/,/g, ""))
            : parseFloat(val) || 0;

        const cantidad = parseNum(row["CANTIDAD"]);
        const valorVentaSoles = parseNum(row["VALOR DE VENTA"]) * exchangeRate; // Sin IGV (Total)
        const precioVentaSoles =
          parseNum(row["PRECIO DE VENTA"]) * exchangeRate; // Con IGV (Total)

        // CÁLCULOS CRUZADOS CON EL CATÁLOGO (Peso y Costo real)
        const sku = row["CÓDIGO PRODUCTO"] || "GENERIC";
        const productInfo = catalogRef.find((p) => p.sku === sku);
        const stockInfo = stockRef.find((s) => s.sku === sku);

        const unitWeight = productInfo?.standardWeight || 0;
        const baseCost = stockInfo?.lastCostPerPiece || 0; // Costo de producción base (Sin IGV)

        // Adaptación a tu nueva interfaz financiera
        const unitValueWithoutIGV =
          cantidad > 0 ? valorVentaSoles / cantidad : 0;
        const unitPriceWithIGV = cantidad > 0 ? precioVentaSoles / cantidad : 0;

        const saleItem = {
          sku: sku,
          productName: row["NOMBRE PRODUCTO"] || "Sin nombre",
          quantity: cantidad,
          unitPrice: unitPriceWithIGV, // Precio Final Unitario (Con IGV)
          unitValue: unitValueWithoutIGV, // Valor Real Unitario (Sin IGV)
          baseCost: baseCost, // Costo Base Unitario (Sin IGV)
          unitWeight: unitWeight, // Peso traído del catálogo automáticamente
        };

        if (!salesMap.has(serieNumero)) {
          salesMap.set(serieNumero, {
            customerName: nameStr,
            customerDocument: rucStr,
            documentNumber: serieNumero,
            status: "COMPLETED", // Solo llegan aquí las declaradas
            sellerId: row["VENDEDOR"] || "SISTEMA",
            currency: isUSD ? "USD" : "PEN",
            exchangeRateApplied: exchangeRate,

            // TRUCO DEL MEDIODÍA PARA EVITAR EL DESFASE DE FECHA
            timestamp: (() => {
              if (row["F. EMISIÓN"] instanceof Date) {
                return new Date(
                  row["F. EMISIÓN"].getUTCFullYear(),
                  row["F. EMISIÓN"].getUTCMonth(),
                  row["F. EMISIÓN"].getUTCDate(),
                  12,
                  0,
                  0,
                );
              } else {
                return new Date(`${apiDate}T12:00:00`);
              }
            })(),

            items: [],
            totalAmount: 0,
            totalCost: 0,
            totalProfit: 0,
            totalWeight: 0,
            paymentStatus: "PAID",
          });
        }

        const sale = salesMap.get(serieNumero);
        sale.items.push(saleItem);
        sale.totalAmount += precioVentaSoles; // Acumula Factura Con IGV
        sale.totalCost += cantidad * baseCost; // Acumula Costo de Producción Puro
        sale.totalProfit += valorVentaSoles - cantidad * baseCost; // Ganancia = (Venta Sin IGV) - Costos
        sale.totalWeight += cantidad * unitWeight; // Volumen Despachado Automático
      });

      setParsedSales(Array.from(salesMap.values()));
      setParsedCustomers(Array.from(customersMap.values()));

      toast.success(
        `Procesado: ${salesMap.size} facturas y ${customersMap.size} clientes nuevos identificados.`,
      );
      if (anuladosCount > 0) {
        toast.success(
          `Se filtraron y descartaron ${anuladosCount} filas de facturas anuladas o no declaradas.`,
          { icon: "🧹" },
        );
      }
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

      // 1. PRIMERO CREAMOS LOS CLIENTES
      for (const customer of parsedCustomers) {
        checkBatchLimit(1);
        const customerRef = doc(db, "customers", customer.documentNumber);
        currentBatch.set(
          customerRef,
          { ...customer, lastUpdated: serverTimestamp() },
          { merge: true },
        );
        opCount++;
      }

      // 2. LUEGO CREAMOS LAS VENTAS Y DESCONTAMOS EL STOCK
      for (const sale of parsedSales) {
        const opsNeeded = 1 + sale.items.length;
        checkBatchLimit(opsNeeded);

        // A. Guardar la Venta con su ID basado en la serie (Ej: F001-234)
        const saleRef = doc(db, "sales", sale.documentNumber);
        const saleData = {
          ...sale,
          uploadedAt: serverTimestamp(),
          metadata: { isHistoricalMigration: true },
        };
        currentBatch.set(saleRef, saleData);
        opCount++;

        // B. Descontar el Stock
        for (const item of sale.items) {
          if (item.sku && item.sku !== "GENERIC") {
            const stockRef = doc(db, "inventory_stock", item.sku);
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
    <div className="w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <Database className="text-green-600" size={24} />
            Migración de Ventas Históricas
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Sube tu reporte en Excel. El sistema filtrará anulados, extraerá el
            Peso del catálogo automáticamente y cruzará el TC.
          </p>
        </div>

        <label className="cursor-pointer bg-green-50 text-green-700 hover:bg-green-100 transition px-6 py-3 rounded-xl font-black flex items-center gap-2 border border-green-200">
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

      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3 mb-6">
        <AlertCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm font-medium text-blue-800">
          <p className="font-bold mb-1">Cálculos Automatizados:</p>
          <p>
            Las filas con ESTADO COMPROBANTE en "Anulado" o vacío se ignorarán.
            El sistema calculará el peso buscando el CÓDIGO PRODUCTO en tu base
            de datos actual.
          </p>
        </div>
      </div>

      {parsedSales.length > 0 && (
        <div className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-emerald-100 pb-4 mb-4">
            <div>
              <p className="font-bold text-gray-800 text-sm uppercase tracking-widest mb-1">
                Validación completada:
              </p>
              <p className="text-emerald-700 font-black text-2xl">
                {parsedSales.length}{" "}
                <span className="text-sm font-bold text-emerald-600/70">
                  Facturas Válidas
                </span>{" "}
                | {parsedCustomers.length}{" "}
                <span className="text-sm font-bold text-emerald-600/70">
                  Clientes
                </span>
              </p>
            </div>
            <button
              onClick={handleUploadToFirebase}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-black flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-emerald-200 active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Upload />}
              Poblar Base de Datos
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto bg-white border border-gray-100 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase sticky top-0">
                <tr>
                  <th className="p-3">Documento</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3 text-center">Items</th>
                  <th className="p-3 text-right">Peso Total</th>
                  <th className="p-3 text-right">Total (S/)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parsedSales.slice(0, 50).map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-800">
                      {s.documentNumber}
                    </td>
                    <td className="p-3 text-gray-600 font-medium truncate max-w-[200px]">
                      {s.customerName}
                    </td>
                    <td className="p-3 text-center font-bold text-blue-600">
                      {s.items.length}
                    </td>
                    <td className="p-3 text-right font-medium text-orange-600">
                      {(s as any).totalWeight.toLocaleString("es-PE")} kg
                    </td>
                    <td className="p-3 text-right font-black text-emerald-600">
                      S/{" "}
                      {s.totalAmount.toLocaleString("es-PE", {
                        minimumFractionDigits: 2,
                      })}
                      {s.currency === "USD" && (
                        <div className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">
                          TC: {s.exchangeRateApplied}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedSales.length > 50 && (
              <p className="p-3 text-center text-xs font-bold text-gray-400 bg-gray-50">
                Mostrando los primeros 50 registros de {parsedSales.length}...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
