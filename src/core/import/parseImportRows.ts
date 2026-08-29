import { BusinessLine } from "@/types";
import { classifyLine } from "@/core/import/catalogImport";
import {
  calcPesoKg,
  normalizeDocType,
  classifyNCStockAction,
  NcStockAction
} from "@/utils/importHelpers";
import type { CoilFinish } from "@/core/coils/services/finishService";
import { calcCoverageWeightKg } from "@/modules/metallic-roofing/domain/coverageWeightCalc";

export interface CatalogRef {
  sku: string;
  businessLine: BusinessLine;
  standardWeight?: number;
  weight?: number;
  displayName: string;
  /** Solo metallic-roofing (COBERTURA/PLANCHA); las otras 3 líneas no lo traen. */
  finish?: string;
  family?: string;
  unit?: string;
  thickness?: number;
  widthMm?: number;
  length?: number;
}

export interface StockRef {
  sku: string;
  businessLine: BusinessLine;
  totalQuantity?: number;
  quantity?: number;
  lastCostPerPiece?: number;
  avgCost?: number;
}

export interface MissingSku {
  sku: string;
  productName: string;
  suggestedLine: BusinessLine | "coil" | "skip" | "unclassified";
  unitOfMeasure: string;
  standardWeight: number;
  initialCost: number;
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

export type SkipReason = "NO_DOC_NUMBER" | "INVALID_STATUS" | "UNRECOGNIZED_PRODUCT";

export interface SkippedRow {
  rowIndex: number;
  documentNumber: string | null;
  description: string;
  reason: SkipReason;
}

export function skipReasonLabel(reason: SkipReason): string {
  switch (reason) {
    case "NO_DOC_NUMBER":
      return "Sin n° de comprobante";
    case "INVALID_STATUS":
      return "Comprobante anulado / baja / no declarado";
    case "UNRECOGNIZED_PRODUCT":
      return "Producto no reconocido (no importable)";
    default:
      return "Motivo desconocido";
  }
}

export interface ParsedSaleItem {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitValue: number;
  baseCost: number;
  profit: number;
  unitWeight: number;
  calculatedWeight: number;
  unitOfMeasure: string;
  businessLine: BusinessLine;
  isCoil: boolean;
  flags: string[];
}

export interface ParsedSale {
  customerName: string;
  customerDocument: string;
  documentNumber: string;
  status: string;
  sellerId: string;
  currency: string;
  exchangeRateApplied: number;
  documentType: string;
  adjustedDocument: string;
  ncStockAction: string;
  originalCurrencyAmount: number;
  timestamp: Date;
  items: ParsedSaleItem[];
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  totalWeight: number;
  paymentStatus: string;
  businessLines: string[];
  allFlags: string[];
  manuallyResolvedNC?: boolean;
}

export interface ParseImportRowsOptions {
  catalogRef: CatalogRef[];
  stockRef: StockRef[];
  exchangeRates: Record<string, number>;
  finishRef: CoilFinish[];
}

export interface ParseImportRowsResult {
  parsedSales: ParsedSale[];
  parsedCustomers: any[];
  missingSkus: MissingSku[];
  skippedRows: SkippedRow[];
}

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

interface InternalParsedSale extends Omit<ParsedSale, 'businessLines' | 'allFlags'> {
  businessLines: Set<BusinessLine>;
  allFlags: Set<string>;
}

export function parseImportRows(jsonData: any[], opts: ParseImportRowsOptions): ParseImportRowsResult {
  const { catalogRef, stockRef, exchangeRates, finishRef } = opts;
  const salesMap = new Map<string, InternalParsedSale>();
  const customersMap = new Map<string, any>();
  const tempMissingSkus = new Map<string, MissingSku>();
  const skippedRows: SkippedRow[] = [];

  jsonData.forEach((row: any, index: number) => {
    // 0-indexed in JS, but excel rows usually start at 2 (1 for header). 
    // We'll just use index here, we can offset it if needed.
    const rowIndex = index;
    const docNumber = row["SERIE - NÚMERO"];
    const productName = String(row["NOMBRE PRODUCTO"] || "Sin nombre").trim();

    if (!docNumber) {
      skippedRows.push({
        rowIndex,
        documentNumber: null,
        description: productName,
        reason: "NO_DOC_NUMBER"
      });
      return;
    }

    const estadoStr = String(row["ESTADO COMPROBANTE"] || "").toUpperCase();
    if (
      !estadoStr.includes("DECLARADO") ||
      estadoStr.includes("ANULAD") ||
      estadoStr.includes("BAJA")
    ) {
      skippedRows.push({
        rowIndex,
        documentNumber: docNumber,
        description: productName,
        reason: "INVALID_STATUS"
      });
      return;
    }

    const sku = String(row["CÓDIGO PRODUCTO"] || "GENERIC").trim().toUpperCase();
    const targetLine = classifyLine(sku, productName);

    if (targetLine === "skip") {
      skippedRows.push({
        rowIndex,
        documentNumber: docNumber,
        description: productName,
        reason: "UNRECOGNIZED_PRODUCT"
      });
      return;
    }

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
    const exchangeRate = isUSD ? exchangeRates[apiDate] : 1;
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

    // [IMPORT-WEIGHT-BYPASS] metallic-roofing (COBERTURA/PLANCHA) no trae standardWeight/weight
    // en su catálogo (medido: 0/54 docs de metallic_roofing_catalog los tienen) — su peso sale
    // de densityFactor (coil_finishes) + dimensiones del catálogo, vía la misma fórmula que ya
    // usa el POS (ProductSelector.tsx). Las otras 3 líneas no entran acá, camino de hoy intacto.
    let metallicWeightOverrideKg: number | null = null;
    if (bLine === 'metallic-roofing' && (productInfo?.family === 'COBERTURA' || productInfo?.family === 'PLANCHA')) {
      const finishMeta = finishRef.find((f) => f.id === productInfo?.finish);
      const densityFactor = finishMeta?.densityFactor ?? null;
      const coverageCalc = calcCoverageWeightKg({
        family: productInfo!.family as 'COBERTURA' | 'PLANCHA',
        unit: (productInfo?.unit as 'PIEZA' | 'METRO' | 'KILOGRAMO' | 'TONELADA') ?? 'METRO',
        quantity: cantidad,
        thicknessMm: productInfo?.thickness ?? 0,
        widthMm: productInfo?.widthMm ?? 0,
        densityFactor,
        lengthM: productInfo?.length ?? null,
        colorFinish: productInfo?.finish ?? '',
      });
      if (coverageCalc.pesoKg !== null) {
        metallicWeightOverrideKg = coverageCalc.pesoKg;
      }
    }

    const baseCost = stockInfo?.lastCostPerPiece || stockInfo?.avgCost || 0;
    
    const rawUnitMeasure = row["UNIDAD MEDIDA"] || "UNIDAD";
    const { weight: weightKg, flag: umFlag } = calcPesoKg(rawUnitMeasure, cantidad, catalogWeight);
    if (umFlag) flags.push(umFlag);

    const hasUnknownCost = baseCost === 0 && bLine !== "services" && targetLine !== "coil";
    if (hasUnknownCost) flags.push("sin costo");

    const itemProfit = hasUnknownCost ? 0 : (valorVentaSoles - ((cantidad * baseCost) * multiplier));

    const saleItem = {
      sku: sku,
      productName: productName,
      quantity: cantidad,
      unitPrice: cantidad > 0 ? (precioVentaSoles / multiplier) / cantidad : 0,
      unitValue: cantidad > 0 ? (valorVentaSoles / multiplier) / cantidad : 0,
      baseCost: baseCost,
      profit: itemProfit,
      unitWeight: metallicWeightOverrideKg !== null ? (cantidad > 0 ? metallicWeightOverrideKg / cantidad : 0) : catalogWeight,
      calculatedWeight: metallicWeightOverrideKg !== null ? metallicWeightOverrideKg : weightKg,
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

    const sale = salesMap.get(docNumber)!;
    sale.items.push(saleItem);
    sale.totalAmount += precioVentaSoles;
    sale.totalCost += (cantidad * baseCost) * multiplier;
    sale.totalProfit += itemProfit;
    const weightMult = docType !== 'NOTA CRÉDITO' ? 1 : (ncStockAction === 'RETURNS_STOCK' ? -1 : 0);
    sale.totalWeight += weightKg * weightMult;
    sale.businessLines.add(bLine);
    saleItem.flags.forEach((f: string) => sale.allFlags.add(f));

    if (isUSD) {
      sale.originalCurrencyAmount += rawPrecioVenta * multiplier;
    }
  });

  const parsedSales = Array.from(salesMap.values()).map(s => ({
    ...s,
    businessLines: Array.from(s.businessLines),
    allFlags: Array.from(s.allFlags)
  })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return {
    parsedSales,
    parsedCustomers: Array.from(customersMap.values()),
    missingSkus: Array.from(tempMissingSkus.values()),
    skippedRows
  };
}
