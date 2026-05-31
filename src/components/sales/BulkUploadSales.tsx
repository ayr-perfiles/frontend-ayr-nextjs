"use client";
import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Database,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  writeBatch,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
  DocumentSnapshot,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { BusinessLine } from "@/types";
import { classifyLine } from "@/core/import/catalogImport";
import { getStockStrategy } from "@/core/sales/strategies";

interface CatalogRef {
  sku: string;
  businessLine: BusinessLine;
  standardWeight?: number;
  weight?: number;
  displayName: string;
}

interface StockRef {
  sku: string;
  businessLine: BusinessLine;
  totalQuantity?: number;
  quantity?: number;
  lastCostPerPiece?: number;
  avgCost?: number;
}

export function BulkUploadSales() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [parsedSales, setParsedSales] = useState<any[]>([]);
  const [parsedCustomers, setParsedCustomers] = useState<any[]>([]);
  const [exchangeRatesCache, setExchangeRatesCache] = useState<
    Record<string, number>
  >({});

  const [catalogRef, setCatalogRef] = useState<CatalogRef[]>([]);
  const [stockRef, setStockRef] = useState<StockRef[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchReferences = async () => {
      try {
        const [
          drywallProd, drywallStock,
          roofingProd, roofingStock,
          metallicProd, metallicStock,
          tradingProd, tradingStock,
          servicesProd
        ] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "inventory_stock")),
          getDocs(collection(db, "roofing_catalog")),
          getDocs(collection(db, "roofing_stock")),
          getDocs(collection(db, "metallic_roofing_catalog")),
          getDocs(collection(db, "metallic_roofing_stock")),
          getDocs(collection(db, "trading_catalog")),
          getDocs(collection(db, "trading_stock")),
          getDocs(collection(db, "services_catalog"))
        ]);

        const catalogs: CatalogRef[] = [
          ...drywallProd.docs.map(d => ({ sku: d.id, businessLine: 'drywall' as const, ...d.data() } as any)),
          ...roofingProd.docs.map(d => ({ sku: d.id, businessLine: 'roofing' as const, ...d.data() } as any)),
          ...metallicProd.docs.map(d => ({ sku: d.id, businessLine: 'metallic-roofing' as const, ...d.data() } as any)),
          ...tradingProd.docs.map(d => ({ sku: d.id, businessLine: 'trading' as const, ...d.data() } as any)),
          ...servicesProd.docs.map(d => ({ sku: d.id, businessLine: 'services' as const, ...d.data() } as any)),
        ];

        const stocks: StockRef[] = [
          ...drywallStock.docs.map(d => ({ sku: d.id, businessLine: 'drywall' as const, ...d.data() } as any)),
          ...roofingStock.docs.map(d => ({ sku: d.id, businessLine: 'roofing' as const, ...d.data() } as any)),
          ...metallicStock.docs.map(d => ({ sku: d.id, businessLine: 'metallic-roofing' as const, ...d.data() } as any)),
          ...tradingStock.docs.map(d => ({ sku: d.id, businessLine: 'trading' as const, ...d.data() } as any)),
        ];

        setCatalogRef(catalogs);
        setStockRef(stocks);
      } catch (error) {
        console.error("Error cargando referencias multi-línea:", error);
        toast.error("Error cargando catálogos de productos.");
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

  const parseNum = (val: any) =>
    typeof val === "string"
      ? parseFloat(val.replace(/,/g, ""))
      : parseFloat(val) || 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (catalogRef.length === 0) {
      toast.error("El catálogo aún está cargando...");
      return;
    }

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const usdDates = new Set<string>();
      jsonData.forEach((row: any) => {
        const moneda = String(row["MONEDA"] || "").toLowerCase();
        if (moneda.includes("dólar") || moneda.includes("usd"))
          usdDates.add(formatDateForApi(row["F. EMISIÓN"]));
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
      const customersMap = new Map<string, any>();

      jsonData.forEach((row: any) => {
        const serieNumero = row["SERIE - NÚMERO"];
        if (!serieNumero) return;

        const estadoStr = String(row["ESTADO COMPROBANTE"] || "").toUpperCase();
        if (
          !estadoStr.includes("DECLARADO") ||
          estadoStr.includes("ANULAD") ||
          estadoStr.includes("BAJA")
        )
          return;

        const sku = String(row["CÓDIGO PRODUCTO"] || "GENERIC").trim().toUpperCase();
        const productName = String(row["NOMBRE PRODUCTO"] || "Sin nombre").trim();
        const targetLine = classifyLine(sku, productName);

        // 6. CASOS ESPECIALES: ANTI (anticipos) -> EXCLUIR
        if (targetLine === "skip") return;

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

        const moneda = String(row["MONEDA"] || "").toLowerCase();
        const isUSD = moneda.includes("dólar") || moneda.includes("usd");
        const apiDate = formatDateForApi(row["F. EMISIÓN"]);
        const exchangeRate = isUSD ? newRates[apiDate] || 3.75 : 1;

        const rawValorVenta = parseNum(row["VALOR DE VENTA"]);
        const rawPrecioVenta = parseNum(row["PRECIO DE VENTA"]);

        const valorVentaSoles = rawValorVenta * exchangeRate;
        const precioVentaSoles = rawPrecioVenta * exchangeRate;
        const cantidad = parseNum(row["CANTIDAD"]);

        // CLASIFICACIÓN FINAL para businessLine
        let bLine: BusinessLine = "drywall";
        if (["drywall", "roofing", "metallic-roofing", "trading", "services"].includes(targetLine)) {
          bLine = targetLine as BusinessLine;
        }

        // LOOKUP DE REFERENCIAS
        const productInfo = catalogRef.find((p) => p.sku === sku && p.businessLine === bLine);
        const stockInfo = stockRef.find((s) => s.sku === sku && s.businessLine === bLine);

        const flags: string[] = [];
        if (!productInfo && targetLine !== "coil") flags.push("sin catálogo");
        if (targetLine === "coil") flags.push("bobina (requiere ajuste manual)");
        
        // baseCost & unitWeight POR LÍNEA
        const unitWeight = productInfo?.standardWeight || productInfo?.weight || 0;
        const baseCost = stockInfo?.lastCostPerPiece || stockInfo?.avgCost || 0;
        
        if (baseCost === 0 && bLine !== "services" && targetLine !== "coil") flags.push("sin costo");

        const saleItem = {
          sku: sku,
          productName: productName,
          quantity: cantidad,
          unitPrice: cantidad > 0 ? precioVentaSoles / cantidad : 0,
          unitValue: cantidad > 0 ? valorVentaSoles / cantidad : 0,
          baseCost: baseCost,
          unitWeight: unitWeight,
          businessLine: bLine,
          isCoil: targetLine === "coil",
          flags
        };

        if (!salesMap.has(serieNumero)) {
          salesMap.set(serieNumero, {
            customerName: nameStr,
            customerDocument: rucStr,
            documentNumber: serieNumero,
            status: "COMPLETED",
            sellerId: row["VENDEDOR"] || "SISTEMA",
            currency: isUSD ? "USD" : "PEN",
            exchangeRateApplied: exchangeRate,
            originalCurrencyAmount: 0,
            timestamp:
              row["F. EMISIÓN"] instanceof Date
                ? new Date(row["F. EMISIÓN"].setHours(12, 0, 0))
                : new Date(`${apiDate}T12:00:00`),
            items: [],
            totalAmount: 0,
            totalCost: 0,
            totalProfit: 0,
            totalWeight: 0,
            paymentStatus: "PAID",
            businessLines: new Set<BusinessLine>(),
            allFlags: new Set<string>()
          });
        }

        const sale = salesMap.get(serieNumero);
        sale.items.push(saleItem);
        sale.totalAmount += precioVentaSoles;
        sale.totalCost += cantidad * baseCost;
        sale.totalProfit += valorVentaSoles - (cantidad * baseCost);
        sale.totalWeight += cantidad * unitWeight;
        sale.businessLines.add(bLine);
        saleItem.flags.forEach(f => sale.allFlags.add(f));

        if (isUSD) {
          sale.originalCurrencyAmount += rawPrecioVenta;
        }
      });

      let sortedSales = Array.from(salesMap.values()).map(s => ({
        ...s,
        businessLines: Array.from(s.businessLines),
        allFlags: Array.from(s.allFlags)
      })).sort((a, b) => {
        const d = a.timestamp.getTime() - b.timestamp.getTime();
        return d === 0
          ? a.documentNumber.localeCompare(b.documentNumber, undefined, {
              numeric: true,
            })
          : d;
      });

      let lastTime = 0;
      sortedSales.forEach((s) => {
        if (s.timestamp.getTime() <= lastTime)
          s.timestamp = new Date(lastTime + 1000);
        lastTime = s.timestamp.getTime();
      });

      setParsedSales(sortedSales);
      setParsedCustomers(Array.from(customersMap.values()));
      toast.success(`Excel procesado listos para cargar.`);
    } catch (error) {
      toast.error("Error al analizar el Excel.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteParsedSale = (indexToRemove: number) => {
    setParsedSales((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
    toast.success("Factura removida de la lista de subida.");
  };

  const syncKardexForSkus = async (skus: string[]) => {
    setStatusMessage("Sincronizando Kardex matemático (solo Drywall)...");
    for (const sku of skus) {
      if (!sku || sku === "GENERIC") continue;

      // Solo sincronizar Kardex para productos de Drywall
      const product = catalogRef.find((p) => p.sku === sku);
      if (product?.businessLine !== "drywall") continue;

      const prodSnap = await getDocs(
        query(collection(db, "production_logs"), where("sku", "==", sku)),
      );
      const salesSnap = await getDocs(
        query(collection(db, "sales"), where("skus", "array-contains", sku)),
      );

      const allMovements: any[] = [];

      prodSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.status !== "VOIDED")
          allMovements.push({
            sku,
            type: "IN",
            quantity: data.piecesProduced,
            date: data.timestamp.toDate(),
            reference: data.parentCoilId,
            description: "Ingreso por Producción",
            user: data.operatorId,
          });
      });

      salesSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.status === "COMPLETED") {
          const item = data.items?.find((i: any) => i.sku === sku);
          if (item)
            allMovements.push({
              sku,
              type: "OUT",
              quantity: item.quantity,
              date: data.timestamp.toDate(),
              reference: d.id,
              description: `Venta a ${data.customerName}`,
              user: data.sellerId,
            });
        }
      });

      allMovements.sort((a, b) => a.date.getTime() - b.date.getTime());
      let balance = 0;
      let lastT = 0;

      const finalKardex = allMovements.map((m) => {
        if (m.date.getTime() <= lastT) m.date = new Date(lastT + 1);
        lastT = m.date.getTime();
        balance = m.type === "IN" ? balance + m.quantity : balance - m.quantity;
        return { ...m, balance };
      });

      const oldKardex = await getDocs(
        query(collection(db, "kardex_movements"), where("sku", "==", sku)),
      );
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      const checkLimit = () => {
        if (opCount >= 450) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      };

      oldKardex.docs.forEach((d) => {
        checkLimit();
        currentBatch.delete(d.ref);
        opCount++;
      });
      finalKardex.forEach((m) => {
        checkLimit();
        currentBatch.set(doc(collection(db, "kardex_movements")), m);
        opCount++;
      });

      if (opCount > 0) batches.push(currentBatch);
      await Promise.all(batches.map((b) => b.commit()));
    }
  };

  const handleUploadToFirebase = async () => {
    if (parsedSales.length === 0) return;
    setLoading(true);
    setStatusMessage("Guardando ventas y actualizando stock por estrategia...");

    try {
      const uniqueSkus = new Set<string>();
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      const checkLimit = (n: number) => {
        if (opCount + n > 480) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }
      };

      // 1. Clientes
      for (const customer of parsedCustomers) {
        checkLimit(1);
        currentBatch.set(
          doc(db, "customers", customer.documentNumber),
          { ...customer, lastUpdated: serverTimestamp() },
          { merge: true },
        );
        opCount++;
      }

      // 2. Ventas e Items (Stock)
      for (const sale of parsedSales) {
        // --- IDEMPOTENCY CHECK ---
        const existingSaleSnap = await getDoc(doc(db, "sales", sale.documentNumber));
        if (existingSaleSnap.exists()) {
          console.log(`Venta ${sale.documentNumber} ya existe. Omitiendo.`);
          continue;
        }

        checkLimit(1 + (sale.items.length * 2));

        const skusArray = Array.from(
          new Set(sale.items.map((i: any) => i.sku)),
        );

        currentBatch.set(doc(db, "sales", sale.documentNumber), {
          ...sale,
          skus: skusArray,
          uploadedAt: serverTimestamp(),
          metadata: {
            isHistorical: true,
            currency: sale.currency,
            exchangeRate: sale.exchangeRateApplied,
            originalCurrencyAmount:
              sale.currency === "USD"
                ? Number(sale.originalCurrencyAmount.toFixed(2))
                : null,
          },
        });
        opCount++;

        for (const item of sale.items) {
          if (item.sku && item.sku !== "GENERIC") {
            uniqueSkus.add(item.sku);
            
            // 4. DESCUENTO de stock por STRATEGY
            if (!item.isCoil) {
              const strategy = getStockStrategy(item.businessLine);
              const stockEntry = stockRef.find(s => s.sku === item.sku && s.businessLine === item.businessLine);
              
              const mockSnap = stockEntry ? {
                exists: () => true,
                data: () => ({ ...stockEntry })
              } : {
                exists: () => false,
                data: () => ({})
              };

              const currentQty = strategy.extractQuantity(mockSnap as DocumentSnapshot);
              const newBalance = currentQty - item.quantity;

              if (stockEntry) {
                if (stockEntry.totalQuantity !== undefined) stockEntry.totalQuantity = newBalance;
                if (stockEntry.quantity !== undefined) stockEntry.quantity = newBalance;
              } else {
                stockRef.push({ 
                  sku: item.sku, 
                  businessLine: item.businessLine, 
                  quantity: newBalance,
                  totalQuantity: newBalance 
                } as any);
              }

              strategy.writeSaleDecrement(
                {
                  sku: item.sku,
                  quantity: item.quantity,
                  newBalance,
                  saleId: sale.documentNumber,
                  customerName: sale.customerName,
                  sellerId: sale.sellerId,
                  avgCost: item.baseCost
                },
                mockSnap as any,
                currentBatch as any
              );
              opCount += 2;
            }
          }
        }
      }

      if (opCount > 0) batches.push(currentBatch);
      await Promise.all(batches.map((b) => b.commit()));

      // 5. KARDEX (Solo Drywall)
      await syncKardexForSkus(Array.from(uniqueSkus));

      toast.success("✅ ¡Carga masiva multi-línea completada!");
      setParsedSales([]);
      setParsedCustomers([]);
    } catch (error) {
      console.error(error);
      toast.error("Error en la subida masiva.");
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  return (
    <div className="w-full p-6 md:p-8 pt-12 md:pt-14">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="pr-8 md:pr-0">
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <Database className="text-green-600" size={24} /> Migración
            Inteligente
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Sube tus ventas y el sistema reconstruirá el Kardex matemático
            automáticamente. Se guardarán los T.C. de las ventas en USD.
          </p>
        </div>
        <label className="cursor-pointer bg-green-50 text-green-700 hover:bg-green-100 transition px-6 py-3 rounded-xl font-black flex items-center gap-2 border border-green-200 shrink-0">
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={18} />
          )}{" "}
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
        <div className="bg-emerald-50/50 rounded-2xl p-6 border border-emerald-100 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-emerald-100 pb-4 mb-4">
            <p className="text-emerald-700 font-black text-2xl">
              {parsedSales.length} Facturas | {parsedCustomers.length} Clientes
            </p>
            <button
              onClick={handleUploadToFirebase}
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-black flex items-center gap-2 transition disabled:opacity-50 shadow-lg active:scale-95"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" /> {statusMessage}
                </>
              ) : (
                <>
                  <Upload /> Procesar Todo
                </>
              )}
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto bg-white border border-gray-100 rounded-xl">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase sticky top-0 z-10">
                <tr>
                  <th className="p-3">Documento</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Líneas / Alertas</th>
                  <th className="p-3 text-center">Hora Asignada</th>
                  <th className="p-3 text-right">Peso Total</th>
                  <th className="p-3 text-right">Total Contable</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {parsedSales.map((s, i) => (
                  <tr key={s.documentNumber} className="hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-800">
                      {s.documentNumber}
                    </td>
                    <td className="p-3 text-gray-600 font-medium truncate max-w-[150px]">
                      {s.customerName}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 mb-1">
                        {s.businessLines.map((bl: string) => (
                          <span key={bl} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold uppercase border border-blue-100">
                            {bl}
                          </span>
                        ))}
                      </div>
                      {s.allFlags && s.allFlags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.allFlags.map((f: string) => (
                            <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold border border-amber-100 italic">
                              ⚠ {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-blue-600">
                      {s.timestamp.toLocaleTimeString("es-PE")}
                    </td>
                    <td className="p-3 text-right font-medium text-orange-600">
                      {(s as any).totalWeight.toLocaleString("es-PE", {
                        minimumFractionDigits: 3,
                        maximumFractionDigits: 3,
                      })}{" "}
                      kg{" "}
                    </td>
                    <td className="p-3 text-right">
                      <p className="font-black text-emerald-600">
                        S/{" "}
                        {s.totalAmount.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      {s.currency === "USD" && (
                        <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                          ${" "}
                          {s.originalCurrencyAmount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          (TC: {s.exchangeRateApplied})
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteParsedSale(i)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition"
                        title="Borrar de la lista"
                      >
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
