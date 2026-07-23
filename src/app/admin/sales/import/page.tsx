"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Database,
  RefreshCw,
  Trash2,
  Download,
  AlertCircle,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Info,
  X,
  FileText,
  DollarSign,
  Scale,
  Calendar,
  AlertTriangle,
  TrendingUp,
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
  setDoc,
  addDoc,
  runTransaction,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { BusinessLine } from "@/types";
import { classifyLine } from "@/core/import/catalogImport";
import { getStockStrategy } from "@/core/sales/strategies";
import {
  calcPesoKg,
  normalizeDocType,
  classifyNCStockAction,
  NormalizedDocType,
  NcStockAction
} from "@/utils/importHelpers";
import { buildImportWrites } from "@/core/import/salesImportLogic";

// ── Types & Constants ─────────────────────────────────────────────────────


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

interface MissingSku {
  sku: string;
  productName: string;
  suggestedLine: BusinessLine | "coil" | "skip" | "unclassified";
  unitOfMeasure: string;
  standardWeight: number;
  initialCost: number;
  
  // Dynamic fields
  family?: string;
  finish?: string;
  color?: string;
  thickness?: number;
  width?: number;
  length?: number;
  material?: string;
  spec?: string;
  category?: string;
  description?: string;
  stripWidth?: number;

  resolved: boolean;
  omitted: boolean;
}

type ImportStatus = 'IMPORTED' | 'REPLACED' | 'SKIPPED_ACTIVE' | 'ERROR';

interface ImportRowResult {
  documentNumber: string;
  documentType: string;
  status: ImportStatus;
  message: string;
  amount?: number;
  weightKg?: number;
}

const REQUIRED_COLUMNS = [
  { name: "F. EMISIÓN", desc: "DD/MM/AAAA", req: true },
  { name: "TIPO COMPROBANTE", desc: "Factura/Boleta/Nota Crédito/Nota Débito", req: true },
  { name: "SERIE - NÚMERO", desc: "ej. FFA1-1059 (clave de idempotencia)", req: true },
  { name: "DOCUMENTO AJUSTADO", desc: "solo NC/ND: serie-número original", req: false },
  { name: "CLIENTE", desc: "RUC/DNI - Razón Social", req: true },
  { name: "MONEDA", desc: "Soles / Dólares (USD se convierte por fecha)", req: true },
  { name: "CÓDIGO PRODUCTO", desc: "SKU exacto del catálogo", req: true },
  { name: "NOMBRE PRODUCTO", desc: "Descripción", req: true },
  { name: "UNIDAD MEDIDA", desc: "UNIDAD/METRO LINEAL/KG/TN (CRÍTICA)", req: true, critical: true },
  { name: "CANTIDAD", desc: "Numérico", req: true },
  { name: "VALOR DE VENTA", desc: "Base gravada SIN IGV", req: true },
  { name: "IGV", desc: "Numérico", req: true },
  { name: "PRECIO DE VENTA", desc: "Con IGV", req: true },
  { name: "AFECTA_STOCK", desc: "solo NC: SI=devuelve stock / NO (CRÍTICA)", req: true, critical: true },
  { name: "ESTADO COMPROBANTE", desc: "Solo se importa 'Declarado'", req: true },
];

// ── Page Component ────────────────────────────────────────────────────────

export default function SalesImportPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [parsedSales, setParsedSales] = useState<any[]>([]);
  const [parsedCustomers, setParsedCustomers] = useState<any[]>([]);
  const [missingSkus, setMissingSkus] = useState<MissingSku[]>([]);
  const [exchangeRatesCache, setExchangeRatesCache] = useState<Record<string, number>>({});
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [catalogRef, setCatalogRef] = useState<CatalogRef[]>([]);
  const [stockRef, setStockRef] = useState<StockRef[]>([]);
  const [importResults, setImportResults] = useState<ImportRowResult[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultFilter, setResultFilter] = useState<ImportStatus | 'ALL'>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDrawerOpen(false);
        setShowResultModal(false);
      }
    };
    if (isDrawerOpen || showResultModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, showResultModal]);

  // ── Initial Data ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetchReferences();
  }, []);

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

  // ── Helpers ──────────────────────────────────────────────────────────────

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

  // ── File Handling ────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (catalogRef.length === 0) {
      toast.error("El catálogo aún está cargando...");
      return;
    }

    setLoading(true);
    setMissingSkus([]);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      
      if (workbook.SheetNames.length === 0) {
        toast.error("El archivo está vacío. Suba la plantilla con datos.");
        return;
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });
      if (rawData.length === 0) {
        toast.error("El archivo está vacío. Suba la plantilla con datos.");
        return;
      }
      if (rawData.length === 1) {
        toast.error("El archivo no contiene filas de venta.");
        return;
      }

      const headers = (rawData[0] || []).map((h) => String(h || "").trim().toUpperCase());
      const missingCols = REQUIRED_COLUMNS.map(c => c.name).filter(
        col => !headers.includes(col.toUpperCase())
      );

      if (missingCols.length > 0) {
        toast.error(`Faltan columnas obligatorias: ${missingCols.join(", ")}. Descargue la plantilla.`);
        return;
      }

      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      const hasValidRow = jsonData.some((row) => {
        const estadoStr = String(row["ESTADO COMPROBANTE"] || "").toUpperCase();
        return estadoStr.includes("DECLARADO") && !estadoStr.includes("ANULAD") && !estadoStr.includes("BAJA");
      });

      if (!hasValidRow) {
        toast.error("No hay comprobantes válidos para importar (0 declarados).");
        return;
      }

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
            if (rateData && rateData.venta) {
              newRates[date] = parseFloat(rateData.venta);
            } else {
              newRates[date] = 0;
            }
          } catch (err) {
            newRates[date] = 0;
          }
        }
      }
      setExchangeRatesCache(newRates);

      const salesMap = new Map<string, any>();
      const customersMap = new Map<string, any>();
      const tempMissingSkus = new Map<string, MissingSku>();

      jsonData.forEach((row: any) => {
        const docNumber = row["SERIE - NÚMERO"];
        if (!docNumber) return;

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
        const exchangeRate = isUSD ? newRates[apiDate] : 1;
        const hasExchangeRateError = isUSD && (!exchangeRate || exchangeRate === 0);

        const rawDocType = row["TIPO COMPROBANTE"] || "Factura";
        const docType = normalizeDocType(rawDocType);
        const adjustedDoc = row["DOCUMENTO AJUSTADO"] || "";
        const ncStockAction: NcStockAction = docType === 'NOTA CRÉDITO' ? classifyNCStockAction(row["AFECTA_STOCK"] || "") : 'MONEY_ONLY';

        const multiplier = docType === 'NOTA CRÉDITO' ? -1 : 1;

        const rawValorVenta = parseNum(row["VALOR DE VENTA"]);
        const rawPrecioVenta = parseNum(row["PRECIO DE VENTA"]);
        const valorVentaSoles = rawValorVenta * (exchangeRate || 1) * multiplier;
        const precioVentaSoles = rawPrecioVenta * (exchangeRate || 1) * multiplier;
        const cantidad = parseNum(row["CANTIDAD"]);

        let bLine: BusinessLine = "drywall";
        if (["drywall", "roofing", "metallic-roofing", "trading", "services"].includes(targetLine)) {
          bLine = targetLine as BusinessLine;
        }

        const productInfo = catalogRef.find((p) => p.sku === sku && p.businessLine === bLine);
        const stockInfo = stockRef.find((s) => s.sku === sku && s.businessLine === bLine);

        const flags: string[] = [];
        if (!productInfo && targetLine !== "coil") {
          flags.push("sin catálogo");
          if (!tempMissingSkus.has(sku)) {
            tempMissingSkus.set(sku, {
              sku,
              productName,
              suggestedLine: bLine,
              unitOfMeasure: row["UNIDAD MEDIDA"] || "UNIDAD",
              standardWeight: 0,
              initialCost: 0,
              resolved: false,
              omitted: false,
            });
          }
        }
        if (targetLine === "coil") flags.push("bobina (requiere ajuste manual)");
        if (hasExchangeRateError) flags.push(`TC no obtenido para ${apiDate}`);
        if (docType === 'NOTA CRÉDITO' && ncStockAction === 'UNDECIDED') {
          flags.push("NC: acción de stock no decidida");
        }
        
        const catalogWeight = productInfo?.standardWeight || productInfo?.weight || 0;
        const baseCost = stockInfo?.lastCostPerPiece || stockInfo?.avgCost || 0;
        
        const rawUnitMeasure = row["UNIDAD MEDIDA"] || "UNIDAD";
        const { weight: weightKg, flag: umFlag } = calcPesoKg(rawUnitMeasure, cantidad, catalogWeight);
        if (umFlag) flags.push(umFlag);

        if (baseCost === 0 && bLine !== "services" && targetLine !== "coil") flags.push("sin costo");

        const saleItem = {
          sku: sku,
          productName: productName,
          quantity: cantidad,
          unitPrice: cantidad > 0 ? (precioVentaSoles / multiplier) / cantidad : 0,
          unitValue: cantidad > 0 ? (valorVentaSoles / multiplier) / cantidad : 0,
          baseCost: baseCost,
          unitWeight: catalogWeight,
          calculatedWeight: weightKg,
          unitOfMeasure: rawUnitMeasure,
          businessLine: bLine,
          isCoil: targetLine === "coil",
          flags
        };

        if (!salesMap.has(docNumber)) {
          salesMap.set(docNumber, {
            customerName: nameStr,
            customerDocument: rucStr,
            documentNumber: docNumber,
            status: "COMPLETED",
            sellerId: row["VENDEDOR"] || "SISTEMA",
            currency: isUSD ? "USD" : "PEN",
            exchangeRateApplied: exchangeRate || 0,
            documentType: docType,
            adjustedDocument: adjustedDoc,
            ncStockAction,
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

        const sale = salesMap.get(docNumber);
        sale.items.push(saleItem);
        sale.totalAmount += precioVentaSoles;
        sale.totalCost += (cantidad * baseCost) * multiplier;
        sale.totalProfit += valorVentaSoles - ((cantidad * baseCost) * multiplier);
        const weightMult = docType !== 'NOTA CRÉDITO' ? 1 : (ncStockAction === 'RETURNS_STOCK' ? -1 : 0);
        sale.totalWeight += weightKg * weightMult;
        sale.businessLines.add(bLine);
        saleItem.flags.forEach(f => sale.allFlags.add(f));

        if (isUSD) {
          sale.originalCurrencyAmount += rawPrecioVenta * multiplier;
        }
      });

      setParsedSales(Array.from(salesMap.values()).map(s => ({
        ...s,
        businessLines: Array.from(s.businessLines),
        allFlags: Array.from(s.allFlags)
      })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()));
      
      setParsedCustomers(Array.from(customersMap.values()));
      setMissingSkus(Array.from(tempMissingSkus.values()));
      toast.success(`Archivo procesado.`);
    } catch (error) {
      toast.error("Error al analizar el Excel.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Missing SKU Resolution ───────────────────────────────────────────────

  const handleResolveSku = async (skuToResolve: string) => {
    const missing = missingSkus.find(m => m.sku === skuToResolve);
    if (!missing) return;

    if (!missing.standardWeight || missing.standardWeight <= 0) {
      toast.error("El peso estándar es obligatorio para normalizar el sistema.");
      return;
    }

    try {
      setLoading(true);
      const line = missing.suggestedLine as BusinessLine;
      const collectionName = line === 'drywall' ? 'products' : 
                            line === 'roofing' ? 'roofing_catalog' :
                            line === 'metallic-roofing' ? 'metallic_roofing_catalog' :
                            line === 'trading' ? 'trading_catalog' :
                            'services_catalog';

      const baseDoc: any = {
        sku: missing.sku,
        displayName: missing.productName,
        active: true,
        status: 'ACTIVE', // retrocompatibility
        createdAt: serverTimestamp(),
      };

      if (line === 'drywall') {
        baseDoc.name = missing.productName; // drywall uses name too
        baseDoc.stripWidth = missing.stripWidth || 0;
        baseDoc.standardWeight = missing.standardWeight;
        baseDoc.lengthMeters = missing.length || 0;
        baseDoc.isActive = true;
      } else if (line === 'roofing') {
        baseDoc.family = missing.family || 'COBERTURA';
        baseDoc.material = missing.material || 'UPVC';
        baseDoc.color = missing.color || '';
        baseDoc.spec = missing.spec || '';
        baseDoc.thickness = missing.thickness || 0;
        baseDoc.width = missing.width || 0;
        baseDoc.length = missing.length || 0;
        baseDoc.weight = missing.standardWeight; // Roofing uses 'weight'
        baseDoc.unit = 'PIEZA';
        baseDoc.avgCost = 0;
      } else if (line === 'metallic-roofing') {
        baseDoc.family = missing.family || 'COBERTURA';
        baseDoc.finish = missing.finish || 'ALUZINC';
        baseDoc.color = missing.color || '';
        baseDoc.thickness = missing.thickness || 0;
        baseDoc.width = missing.width || 0;
        baseDoc.length = missing.length || 0;
        baseDoc.unit = 'PIEZA';
        baseDoc.avgCost = 0;
      } else if (line === 'trading') {
        baseDoc.category = missing.category || 'OTRO';
        baseDoc.color = missing.color || '';
        baseDoc.spec = missing.spec || '';
        baseDoc.unit = 'PIEZA';
        baseDoc.avgCost = 0;
      } else if (line === 'services') {
        baseDoc.description = missing.description || '';
        baseDoc.unit = 'TONELADA';
      }

      await setDoc(doc(db, collectionName, missing.sku), baseDoc);

      await addDoc(collection(db, "audit_logs"), {
        action: 'PRODUCT_CREATED_FROM_IMPORT',
        entityId: missing.sku,
        userEmail: user?.email || 'sistema',
        details: `Producto ${missing.sku} creado durante importación de ventas en línea ${line}.`,
        timestamp: serverTimestamp(),
      });

      const newProduct: CatalogRef = {
        sku: missing.sku,
        businessLine: line,
        standardWeight: missing.standardWeight,
        displayName: missing.productName
      };
      setCatalogRef(prev => [...prev, newProduct]);

      setMissingSkus(prev => prev.map(m => m.sku === skuToResolve ? { ...m, resolved: true } : m));
      
      setParsedSales(prev => prev.map(sale => {
        let hasChanges = false;
        const newItems = sale.items.map((item: any) => {
          if (item.sku === skuToResolve) {
            hasChanges = true;
            const { weight } = calcPesoKg(item.unitOfMeasure || "UNIDAD", item.quantity, missing.standardWeight);
            return { 
              ...item, 
              flags: item.flags.filter((f: string) => f !== "sin catálogo"),
              unitWeight: missing.standardWeight,
              calculatedWeight: weight
            };
          }
          return item;
        });

        if (hasChanges) {
          const newAllFlags = new Set<string>();
          newItems.forEach((it: any) => it.flags.forEach((f: string) => newAllFlags.add(f)));
          
          const newTotalWeight = newItems.reduce((acc: number, it: any) => {
            const wm = sale.documentType !== 'NOTA CRÉDITO' ? 1 : (sale.ncStockAction === 'RETURNS_STOCK' ? -1 : 0);
            return acc + (it.calculatedWeight * wm);
          }, 0);

          return { ...sale, items: newItems, allFlags: Array.from(newAllFlags), totalWeight: newTotalWeight };
        }
        return sale;
      }));

      toast.success(`SKU ${skuToResolve} creado.`);
    } catch (error) {
      toast.error("Error creando el producto.");
    } finally {
      setLoading(false);
    }
  };

  const handleOmitSku = (skuToOmit: string) => {
    setMissingSkus(prev => prev.map(m => m.sku === skuToOmit ? { ...m, omitted: true } : m));
    toast.success("SKU omitido. Las facturas con este SKU no podrán guardarse.");
  };

  const handleUpdateNcAction = (documentNumber: string, action: NcStockAction) => {
    if (!action) return;
    setParsedSales(prev => prev.map(s => {
      if (s.documentNumber === documentNumber) {
        const newFlags = s.allFlags.filter((f: string) => f !== "NC: acción de stock no decidida");
        const wm = action === 'RETURNS_STOCK' ? -1 : 0;
        const newTotalWeight = s.items.reduce((acc: number, it: any) => acc + (it.calculatedWeight * wm), 0);
        return { ...s, ncStockAction: action, allFlags: newFlags, manuallyResolvedNC: true, totalWeight: newTotalWeight };
      }
      return s;
    }));
  };

  // ── Firebase Upload ──────────────────────────────────────────────────────

  const handleUploadToFirebase = async () => {
    if (parsedSales.length === 0) return;

    const criticalFlags = ["no decidida", "TC no obtenido", "sin catálogo"];
    const hasUnresolvedErrors = parsedSales.some(sale => 
      sale.allFlags.some((f: string) => criticalFlags.some(cf => f.includes(cf)))
    );

    if (hasUnresolvedErrors) {
      toast.error("Existen errores pendientes (SKUs faltantes, TC no obtenido o NC en revisión).");
      return;
    }

    setLoading(true);
    setStatusMessage("Guardando ventas y verificando idempotencia...");

    try {
      const customerBatch = writeBatch(db);
      for (const customer of parsedCustomers) {
        customerBatch.set(doc(db, "customers", customer.documentNumber), { ...customer, lastUpdated: serverTimestamp() }, { merge: true });
      }
      await customerBatch.commit();

      const results: ImportRowResult[] = [];

      for (const sale of parsedSales) {
        try {
          const result = await runTransaction(db, async (tx) => {
            const saleRef = doc(db, "sales", sale.documentNumber);
            const existingSaleSnap = await tx.get(saleRef);
            let isReplacement = false;

            if (existingSaleSnap.exists()) {
              const existingData = existingSaleSnap.data();
              if (existingData.status === "COMPLETED") {
                return "OMITTED";
              } else if (existingData.status === "VOIDED") {
                isReplacement = true;
              } else {
                return "OMITTED";
              }
            }

            const stockRefsToRead = new Map<string, any>();
            for (const item of sale.items) {
              if (item.sku && item.sku !== "GENERIC" && !item.isCoil) {
                const strategy = getStockStrategy(item.businessLine);
                const stockRef = strategy.getStockRef(item.sku);
                stockRefsToRead.set(stockRef.path, { ref: stockRef, strategy, sku: item.sku });
              }
            }

            const stockSnaps = new Map<string, DocumentSnapshot>();
            for (const [path, info] of Array.from(stockRefsToRead.entries())) {
               const snap = await tx.get(info.ref);
               stockSnaps.set(path, snap as DocumentSnapshot);
            }

            if (isReplacement) {
              const existingData = existingSaleSnap.data()!;
              const historyRef = doc(collection(saleRef, "history"));
              tx.set(historyRef, {
                ...existingData,
                archivedAt: serverTimestamp(),
                archivedReason: 're-import correction',
                archivedByUserId: user?.uid || 'sistema',
                archivedByUserEmail: user?.email || 'sistema'
              });

              const auditRef = doc(collection(db, "audit_logs"));
              tx.set(auditRef, {
                action: 'SALE_REPLACED',
                documentNumber: sale.documentNumber,
                previousStatus: existingData.status,
                historyPath: historyRef.path,
                reason: 're-import correction',
                userId: user?.uid || 'sistema',
                userEmail: user?.email || 'sistema',
                timestamp: serverTimestamp(),
              });
            }

            const saleInputWithMeta = {
              ...sale,
              metadata: {
                isReplacement,
                uploadedBy: user?.email,
              },
            };
            const { saleDoc, quotationDoc } = buildImportWrites(saleInputWithMeta, serverTimestamp());
            tx.set(saleRef, saleDoc);
            if (quotationDoc) {
              const quoteRef = doc(db, "sales", `COT-${sale.documentNumber}`);
              tx.set(quoteRef, quotationDoc);
            }



            if (sale.manuallyResolvedNC) {
              const auditRef = doc(collection(db, "audit_logs"));
              tx.set(auditRef, {
                action: 'SALE_IMPORTED_WITH_MANUAL_NC_ACTION',
                entityId: sale.documentNumber,
                userEmail: user?.email || 'sistema',
                details: `El usuario decidió manualmente la acción de stock para la NC importada: ${sale.ncStockAction}`,
                timestamp: serverTimestamp(),
              });
            }

            for (const item of sale.items) {
              if (item.sku && item.sku !== "GENERIC" && !item.isCoil) {
                const strategy = getStockStrategy(item.businessLine);
                const stockRef = strategy.getStockRef(item.sku);
                const stockSnap = stockSnaps.get(stockRef.path)!;
                const currentQty = strategy.extractQuantity(stockSnap);
                const isNCWithStock = sale.documentType === 'NOTA CRÉDITO' && sale.ncStockAction === 'RETURNS_STOCK';
                const shouldMoveStock = (sale.documentType === 'FACTURA' || sale.documentType === 'BOLETA') || isNCWithStock;

                if (shouldMoveStock) {
                  const newBalance = isNCWithStock ? currentQty + item.quantity : currentQty - item.quantity;
                  const writeParams = { 
                    sku: item.sku, 
                    quantity: item.quantity, 
                    newBalance, 
                    saleId: sale.documentNumber, 
                    customerName: sale.customerName, 
                    sellerId: sale.sellerId || 'SISTEMA', 
                    avgCost: item.baseCost,
                    motivo: isNCWithStock ? `NC ${sale.documentNumber}` : undefined,
                    ref: sale.adjustedDocument || undefined,
                    frozenCost: item.baseCost ?? 0,
                  };
                  if (isNCWithStock) strategy.writeSaleReversal(writeParams, stockSnap, tx);
                  else strategy.writeSaleDecrement(writeParams, stockSnap, tx);
                }
              }
            }
            return isReplacement ? "REPLACED" : "IMPORTED";
          });

          if (result === "OMITTED") {
            results.push({ documentNumber: sale.documentNumber, documentType: sale.documentType, status: 'SKIPPED_ACTIVE', message: 'Omitida: ya existe activa', amount: sale.totalAmount, weightKg: sale.totalWeight });
          } else if (result === "REPLACED") {
            results.push({ documentNumber: sale.documentNumber, documentType: sale.documentType, status: 'REPLACED', message: 'Reemplazo de anulada (archivada en history)', amount: sale.totalAmount, weightKg: sale.totalWeight });
          } else {
            results.push({ documentNumber: sale.documentNumber, documentType: sale.documentType, status: 'IMPORTED', message: 'Importada', amount: sale.totalAmount, weightKg: sale.totalWeight });
          }
        } catch (error: unknown) {
          const txError = error as Error;
          results.push({ documentNumber: sale.documentNumber, documentType: sale.documentType, status: 'ERROR', message: txError.message || 'Error en transacción', amount: sale.totalAmount, weightKg: sale.totalWeight });
        }
      }

      setImportResults(results);
      setShowResultModal(true);
      setParsedSales([]);
      setMissingSkus([]);
    } catch (error) {
      toast.error("Error general en la subida.");
    } finally {
      setLoading(false);
      setStatusMessage("");
    }
  };

  // ── KPI Calculations ─────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    let invoices = 0, receipts = 0, creditNotes = 0, debitNotes = 0;
    let totalItems = 0, totalAmount = 0, totalUsdAmount = 0, totalWeight = 0, totalCost = 0, totalProfit = 0;
    let minDate = new Date(8640000000000000), maxDate = new Date(-8640000000000000);
    let alertMissingSku = 0, alertMissingTc = 0, alertUnresolvedNc = 0;

    parsedSales.forEach(sale => {
      if (sale.documentType === 'FACTURA') invoices++;
      else if (sale.documentType === 'BOLETA') receipts++;
      else if (sale.documentType === 'NOTA CRÉDITO') creditNotes++;
      else if (sale.documentType === 'NOTA DÉBITO') debitNotes++;
      totalItems += sale.items.length;
      totalAmount += sale.totalAmount;
      if (sale.currency === 'USD') totalUsdAmount += sale.originalCurrencyAmount;
      totalWeight += sale.totalWeight;
      totalCost += sale.totalCost;
      totalProfit += sale.totalProfit;
      if (sale.timestamp < minDate) minDate = sale.timestamp;
      if (sale.timestamp > maxDate) maxDate = sale.timestamp;
      if (sale.allFlags.includes("TC no obtenido para " + formatDateForApi(sale.timestamp))) alertMissingTc++;
      if (sale.allFlags.includes("NC: acción de stock no decidida")) alertUnresolvedNc++;
    });

    alertMissingSku = missingSkus.filter(m => !m.resolved && !m.omitted).length;
    const totalDocs = invoices + receipts + creditNotes + debitNotes;
    let dateRange = "N/A";
    if (totalDocs > 0) {
      dateRange = minDate.getTime() === maxDate.getTime() ? minDate.toLocaleDateString("es-PE") : `${minDate.toLocaleDateString("es-PE")} - ${maxDate.toLocaleDateString("es-PE")}`;
    }

    return {
      invoices, receipts, creditNotes, debitNotes, totalDocs, totalItems, totalAmount, totalUsdAmount, totalWeight, totalCost, totalProfit, dateRange,
      alertMissingSku, alertMissingTc, alertUnresolvedNc, hasBlockingAlerts: alertMissingSku > 0 || alertMissingTc > 0 || alertUnresolvedNc > 0
    };
  }, [parsedSales, missingSkus]);

  // ── Result Stats & Filtering ──────────────────────────────────────────

  const filteredResults = useMemo(() => {
    let list = [...importResults];
    const priority = { ERROR: 0, REPLACED: 1, SKIPPED_ACTIVE: 2, IMPORTED: 3 };
    list.sort((a, b) => priority[a.status] - priority[b.status]);
    if (resultFilter !== 'ALL') list = list.filter(r => r.status === resultFilter);
    return list;
  }, [importResults, resultFilter]);

  const resultStats = useMemo(() => {
    return {
      total: importResults.length,
      imported: importResults.filter(r => r.status === 'IMPORTED').length,
      replaced: importResults.filter(r => r.status === 'REPLACED').length,
      skipped: importResults.filter(r => r.status === 'SKIPPED_ACTIVE').length,
      errors: importResults.filter(r => r.status === 'ERROR').length,
    };
  }, [importResults]);

  // ── Render Helpers ───────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
              <Upload className="text-blue-600" size={32} /> Importador de Ventas
            </h1>
            <p className="text-slate-500 font-medium mt-1">
              Migración masiva asistida con validación de catálogo y tipo de cambio.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsDrawerOpen(true)} className="flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 w-12 h-[46px] rounded-xl transition shadow-sm"><Info size={20} /></button>
            <a href="/templates/Plantilla_Importacion_Ventas_AYR.xlsx" download className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-bold hover:bg-slate-50 transition shadow-sm"><Download size={18} /> Descargar Plantilla</a>
            <label className="cursor-pointer bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition shadow-lg shadow-blue-200">
              {loading ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
              Subir Reporte
              <input type="file" accept=".xlsx" className="hidden" ref={fileInputRef} onChange={handleFileUpload} disabled={loading} />
            </label>
          </div>
        </div>
      </div>

      <div className={`max-w-7xl mx-auto grid grid-cols-1 ${missingSkus.filter(m => !m.resolved && !m.omitted).length > 0 ? 'lg:grid-cols-3' : ''} gap-8`}>
        {/* LEFT COLUMN: MISSING SKUS */}
        {missingSkus.filter(m => !m.resolved && !m.omitted).length > 0 && (
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm animate-in slide-in-from-left duration-300">
              <h3 className="text-amber-800 font-black text-lg flex items-center gap-2 mb-4"><AlertCircle size={20} /> SKUs Faltantes ({missingSkus.filter(m => !m.resolved && !m.omitted).length})</h3>
              <p className="text-amber-700 text-xs mb-6 font-medium">Detectamos productos que no existen en el catálogo. Debes crearlos para poder normalizar el peso y el stock.</p>
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {missingSkus.filter(m => !m.resolved && !m.omitted).map((sku) => (
                  <div key={sku.sku} className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
                    <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase">{sku.sku}</span>
                    <h4 className="text-xs font-bold text-slate-800 mt-1 line-clamp-1">{sku.productName}</h4>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div><label className="text-[9px] font-black text-slate-400 uppercase">Línea Sugerida</label><select className="w-full text-xs p-1.5 border border-slate-200 rounded bg-slate-50 font-bold" value={sku.suggestedLine} onChange={(e) => setMissingSkus(prev => prev.map(m => m.sku === sku.sku ? { ...m, suggestedLine: e.target.value as any } : m))}><option value="drywall">Drywall</option><option value="roofing">Roofing (UPVC)</option><option value="metallic-roofing">Aluzinc</option><option value="trading">Trading</option><option value="services">Servicios</option></select></div>
                      <div><label className="text-[9px] font-black text-slate-400 uppercase">Peso Estándar (KG)*</label><input type="number" step="0.001" className="w-full text-xs p-1.5 border border-amber-300 rounded outline-none font-black" value={sku.standardWeight || ""} onChange={(e) => setMissingSkus(prev => prev.map(m => m.sku === sku.sku ? { ...m, standardWeight: parseFloat(e.target.value) || 0 } : m))} /></div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => handleResolveSku(sku.sku)} disabled={loading} className="flex-1 bg-blue-600 text-white text-[11px] font-black py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-1"><PlusCircle size={14} /> Crear</button>
                      <button onClick={() => handleOmitSku(sku.sku)} className="bg-slate-100 text-slate-500 p-2 rounded-lg hover:bg-slate-200 transition"><XCircle size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: PREVIEW TABLE */}
        <div className={`${missingSkus.filter(m => !m.resolved && !m.omitted).length > 0 ? 'lg:col-span-2' : ''} space-y-6 w-full`}>
          {parsedSales.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <FileSpreadsheet className="text-slate-300" size={40} />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2">Esperando archivo...</h2>
              <p className="text-slate-400 max-w-sm font-medium">
                Sube tu reporte de ventas en formato .xlsx para comenzar la validación técnica.
              </p>
            </div>
          ) : (
            <>
              {/* KPI BAR */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Comprobantes</span>
                    <FileText className="text-blue-500" size={16} />
                  </div>
                  <div>
                    <span className="text-xl font-black text-slate-800">{kpis.totalDocs}</span>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {kpis.invoices > 0 && <span className="text-[9px] font-bold text-slate-500">{kpis.invoices} Fac</span>}
                      {kpis.receipts > 0 && <span className="text-[9px] font-bold text-slate-500">{kpis.receipts} Bol</span>}
                      {kpis.creditNotes > 0 && <span className="text-[9px] font-bold text-purple-500">{kpis.creditNotes} NC</span>}
                      {kpis.debitNotes > 0 && <span className="text-[9px] font-bold text-orange-500">{kpis.debitNotes} ND</span>}
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Monto Total a Importar</span>
                    <DollarSign className="text-emerald-500" size={16} />
                  </div>
                  <div>
                    <span className="text-xl font-black text-emerald-600">
                      S/ {kpis.totalAmount.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </span>
                    {kpis.totalUsdAmount > 0 && (
                      <p className="text-[9px] font-bold text-slate-500 mt-1">Incluye $ {kpis.totalUsdAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} convertidos</p>
                    )}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Peso Total y Utilidad</span>
                    <Scale className="text-slate-500" size={16} />
                  </div>
                  <div>
                    <span className="text-xl font-black text-slate-800">
                      {kpis.totalWeight.toLocaleString("es-PE", { minimumFractionDigits: 3 })} <span className="text-xs">KG</span>
                    </span>
                    <p className="text-[10px] font-bold text-emerald-500 mt-1 flex items-center gap-1">
                      <TrendingUp size={10} /> + S/ {kpis.totalProfit.toLocaleString("es-PE", { minimumFractionDigits: 2 })} est.
                    </p>
                  </div>
                </div>
                <div className={`p-4 rounded-2xl border shadow-sm flex flex-col justify-between ${kpis.hasBlockingAlerts ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-black uppercase ${kpis.hasBlockingAlerts ? 'text-red-500' : 'text-slate-500'}`}>Alertas Bloqueantes</span>
                    <AlertTriangle className={kpis.hasBlockingAlerts ? 'text-red-500 animate-pulse' : 'text-slate-400'} size={16} />
                  </div>
                  <div>
                    {kpis.hasBlockingAlerts ? (
                      <div className="flex flex-col gap-1">
                        {kpis.alertMissingSku > 0 && <span className="text-[10px] font-bold text-red-700 leading-tight">• {kpis.alertMissingSku} SKU(s) faltantes</span>}
                        {kpis.alertMissingTc > 0 && <span className="text-[10px] font-bold text-red-700 leading-tight">• {kpis.alertMissingTc} TC no obtenidos</span>}
                        {kpis.alertUnresolvedNc > 0 && <span className="text-[10px] font-bold text-red-700 leading-tight">• {kpis.alertUnresolvedNc} NC sin decidir</span>}
                      </div>
                    ) : (
                      <span className="text-sm font-black text-emerald-600 flex items-center gap-1 mt-1">
                        <CheckCircle2 size={14} /> Listo para procesar
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-350px)] animate-in fade-in duration-500">
                {/* TABLE ACTIONS */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <span className="text-sm font-black text-slate-700">{kpis.totalItems} Ítems en lote</span>
                    <div className="flex items-center gap-2 mt-0.5">
                       <Calendar size={12} className="text-slate-400" />
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{kpis.dateRange}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUploadToFirebase}
                    disabled={loading || kpis.hasBlockingAlerts}
                    className={`px-8 py-3 rounded-xl font-black flex items-center gap-2 transition shadow-lg active:scale-95 ${
                      kpis.hasBlockingAlerts 
                        ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100'
                    }`}
                  >
                    {loading ? <RefreshCw className="animate-spin" /> : <Database size={18} />}
                    {loading ? statusMessage : "Procesar Todo"}
                  </button>
                </div>

                {/* TABLE CONTENT */}
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white text-[10px] font-black text-slate-400 uppercase sticky top-0 z-10 border-b border-slate-100">
                      <tr>
                        <th className="p-4">Documento</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Líneas / Alertas</th>
                        <th className="p-4 text-right">Peso (KG)</th>
                        <th className="p-4 text-right">Total (S/)</th>
                        <th className="p-4 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                      {parsedSales.map((sale, i) => (
                        <tr key={sale.documentNumber} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="p-4">
                            <p className="text-[13px] font-black text-slate-900 leading-none">{sale.documentNumber}</p>
                            <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[120px] font-medium">{sale.customerName}</p>
                          </td>
                          <td className="p-4">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border ${
                              sale.documentType === 'NOTA CRÉDITO' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                              sale.documentType === 'NOTA DÉBITO' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                              'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                              {sale.documentType}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 mb-1">
                              {sale.businessLines.map((bl: string) => (
                                <span key={bl} className="text-[9px] font-black text-slate-400">{bl}</span>
                              ))}
                            </div>
                            {sale.allFlags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {sale.allFlags.map((f: string) => (
                                  <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold border border-amber-100 flex items-center gap-1 italic">
                                    ⚠ {f}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <p className="text-[13px] font-black text-slate-700">
                              {sale.totalWeight.toLocaleString("es-PE", { minimumFractionDigits: 3 })}
                            </p>
                          </td>
                          <td className="p-4 text-right">
                            {sale.currency === 'USD' ? (
                               <div className="flex flex-col items-end">
                                  <p className="text-[11px] text-slate-500 font-bold">$ {sale.originalCurrencyAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                                  <p className="text-[13px] font-black text-emerald-600">
                                    S/ {sale.totalAmount.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                                  </p>
                                  {sale.exchangeRateApplied > 0 ? (
                                    <p className="text-[9px] text-blue-500 font-bold bg-blue-50 inline-block px-1 rounded mt-0.5">TC {sale.exchangeRateApplied.toFixed(3)}</p>
                                  ) : (
                                    <p className="text-[9px] text-red-500 font-bold bg-red-50 border border-red-200 inline-block px-1 rounded mt-0.5" title="Tipo de cambio no encontrado">TC ?</p>
                                  )}
                               </div>
                            ) : (
                               <div className="flex flex-col items-end">
                                  <p className="text-[9px] text-slate-400 font-bold bg-slate-100 inline-block px-1.5 rounded mb-0.5">PEN</p>
                                  <p className="text-[13px] font-black text-emerald-600">
                                    S/ {sale.totalAmount.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                                  </p>
                               </div>
                            )}
                          </td>
                          <td className="p-4 text-center align-top">
                            <div className="flex flex-col items-center gap-2">
                              {sale.documentType === 'NOTA CRÉDITO' && sale.allFlags.includes("NC: acción de stock no decidida") && (
                                 <div className="flex flex-col gap-1 w-[130px]">
                                    <span className="text-[9px] font-black text-red-500 uppercase leading-none text-left">¿Afecta stock?</span>
                                    <select
                                       className="text-[10px] p-1 border border-red-200 bg-red-50 text-red-700 rounded outline-none font-bold w-full"
                                       onChange={(e) => handleUpdateNcAction(sale.documentNumber, e.target.value as NcStockAction)}
                                       value={sale.ncStockAction === 'UNDECIDED' ? '' : sale.ncStockAction}
                                    >
                                       <option value="" disabled>Seleccione...</option>
                                       <option value="RETURNS_STOCK">Devuelve stock (SI)</option>
                                       <option value="MONEY_ONLY">Solo dinero (NO)</option>
                                    </select>
                                 </div>
                              )}
                              <button
                                onClick={() => setParsedSales(prev => prev.filter((_, idx) => idx !== i))}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition self-center"
                                title="Eliminar fila"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* DRAWER LATERAL */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 z-[100] backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white shadow-2xl z-[110] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-slate-800">Columnas de Plantilla</h3>
              <button onClick={() => setIsDrawerOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full transition"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="space-y-4">{REQUIRED_COLUMNS.map((col) => (<div key={col.name} className={`flex flex-col gap-1 p-4 rounded-xl border ${col.critical ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}><span className="text-[13px] font-black text-slate-800">{col.name}</span><p className="text-[11px] font-medium text-slate-500">{col.desc}</p></div>))}</div>
            </div>
          </div>
        </>
      )}

      {/* MODAL DE RESULTADOS */}
      {showResultModal && (
        <>
          <div className="fixed inset-0 bg-slate-900/60 z-[200] backdrop-blur-sm animate-in fade-in duration-300" />
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 md:p-8 pointer-events-none">
            <div className="bg-white w-full max-w-5xl max-h-full rounded-3xl shadow-2xl flex flex-col pointer-events-auto animate-in zoom-in-95 duration-300 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3"><CheckCircle2 className="text-emerald-500" size={28} /> Resultado de Importación</h2>
                <button onClick={() => setShowResultModal(false)} className="p-2 hover:bg-slate-200 text-slate-400 rounded-full transition"><X size={24} /></button>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-4 bg-white">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total</p><p className="text-xl font-black text-slate-700">{resultStats.total}</p></div>
                <div className={`p-4 rounded-2xl border cursor-pointer transition ${resultFilter === 'IMPORTED' ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500' : 'bg-white border-slate-100'}`} onClick={() => setResultFilter(prev => prev === 'IMPORTED' ? 'ALL' : 'IMPORTED')}><p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Importadas</p><p className="text-xl font-black text-emerald-700">{resultStats.imported}</p></div>
                <div className={`p-4 rounded-2xl border cursor-pointer transition ${resultFilter === 'REPLACED' ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500' : 'bg-white border-slate-100'}`} onClick={() => setResultFilter(prev => prev === 'REPLACED' ? 'ALL' : 'REPLACED')}><p className="text-[10px] font-black text-blue-600 uppercase mb-1">Reimportadas</p><p className="text-xl font-black text-blue-700">{resultStats.replaced}</p></div>
                <div className={`p-4 rounded-2xl border cursor-pointer transition ${resultFilter === 'SKIPPED_ACTIVE' ? 'bg-slate-100 border-slate-200 ring-2 ring-slate-400' : 'bg-white border-slate-100'}`} onClick={() => setResultFilter(prev => prev === 'SKIPPED_ACTIVE' ? 'ALL' : 'SKIPPED_ACTIVE')}><p className="text-[10px] font-black text-slate-500 uppercase mb-1">Omitidas</p><p className="text-xl font-black text-slate-600">{resultStats.skipped}</p></div>
                <div className={`p-4 rounded-2xl border cursor-pointer transition ${resultFilter === 'ERROR' ? 'bg-red-50 border-red-200 ring-2 ring-red-500' : 'bg-white border-slate-100'}`} onClick={() => setResultFilter(prev => prev === 'ERROR' ? 'ALL' : 'ERROR')}><p className="text-[10px] font-black text-red-600 uppercase mb-1">Errores</p><p className="text-xl font-black text-red-700">{resultStats.errors}</p></div>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col px-6 pb-6">
                <div className="border border-slate-100 rounded-2xl overflow-hidden flex flex-col h-full bg-slate-50/30">
                  <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar max-h-[500px]">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-100 text-[10px] font-black text-slate-500 uppercase sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="p-4 w-32">Doc. Número</th>
                          <th className="p-4 w-28">Tipo</th>
                          <th className="p-4 w-36">Estado</th>
                          <th className="p-4">Motivo</th>
                          <th className="p-4 text-right w-24">Peso (KG)</th>
                          <th className="p-4 text-right w-32">Monto (S/)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredResults.map((row, i) => (
                          <tr key={`${row.documentNumber}-${i}`} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-[13px] font-black text-slate-800">{row.documentNumber}</td>
                            <td className="p-4 text-[11px] font-bold text-slate-500">{row.documentType}</td>
                            <td className="p-4">
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border flex items-center gap-1 w-fit ${
                                row.status === 'IMPORTED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                row.status === 'REPLACED' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                row.status === 'ERROR' ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-slate-50 text-slate-500 border-slate-100'
                              }`}>
                                {row.status === 'IMPORTED' && <CheckCircle2 size={10} />}
                                {row.status === 'REPLACED' && <RefreshCw size={10} />}
                                {row.status === 'ERROR' && <XCircle size={10} />}
                                {row.status === 'SKIPPED_ACTIVE' && <Info size={10} />}
                                {row.status}
                              </span>
                            </td>
                            <td className="p-4 text-[12px] font-medium text-slate-600">{row.message}</td>
                            <td className="p-4 text-right text-[12px] font-bold text-slate-500">
                              {row.weightKg?.toLocaleString("es-PE", { minimumFractionDigits: 3 })}
                            </td>
                            <td className="p-4 text-right text-[13px] font-black text-slate-700">
                              {row.amount?.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button onClick={() => setShowResultModal(false)} className="px-8 py-3 bg-slate-800 text-white font-black rounded-xl hover:bg-slate-900 transition shadow-lg active:scale-95">Cerrar</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
