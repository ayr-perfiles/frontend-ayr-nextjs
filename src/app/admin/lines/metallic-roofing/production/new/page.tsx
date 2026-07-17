"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import { useAuth } from "@/context/AuthContext";
import { useFinishes } from "@/core/coils/hooks/useFinishes";
import { listProducts } from "@/modules/metallic-roofing/services/catalogService";
import { produceFromCoils, getQuoteFulfillmentLogs } from "@/modules/metallic-roofing/services/productionService";
import { calcProductionFromCoils } from "@/modules/metallic-roofing/domain/coilProduction";
import { isThicknessWithinTolerance } from "@/modules/metallic-roofing/domain/thicknessMatch";
import { parsePositiveNumberInput, computeCoverageDeclaredMl } from "@/modules/metallic-roofing/domain/coverageProductionInput";
import type { MetallicProduct } from "@/modules/metallic-roofing/types";
import type { Coil, Sale, SaleItem } from "@/types";
import type { CoilFinish } from "@/core/coils/services/finishService";
import { useSales } from "@/core/hooks/useSales";
import {
  Factory,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Layers,
  ArrowLeft,
  FileText,
  Eye
} from "lucide-react";
import { SaleDetailsModal } from "@/components/sales/SaleDetailsModal";
import toast from "react-hot-toast";
import Link from "next/link";

interface CoilRow {
  rowId: string;
  coilId: string;
  /** PLANCHA_UND: piezas tipeadas directo. COBERTURA_ML: DERIVADO de cantidad×longitud, no editable a mano. */
  declared: string;
  /** Solo COBERTURA_ML: piezas. */
  cantidad: string;
  /** Solo COBERTURA_ML: longitud por pieza (m). Prellenado con selectedProduct.length si existe. */
  longitud: string;
  coilData: Coil | null;
  finish: CoilFinish | null;
  reportedWeight: string;
  loadError: string | null;
  isLoading: boolean;
}

function newRow(defaultLongitud: number | null = null): CoilRow {
  return {
    rowId: Math.random().toString(36).slice(2),
    coilId: "",
    declared: "",
    cantidad: "",
    longitud: defaultLongitud != null ? String(defaultLongitud) : "",
    coilData: null,
    finish: null,
    reportedWeight: "",
    loadError: null,
    isLoading: false,
  };
}

function MetallicProductionForm() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { finishes } = useFinishes(true);

  const [products, setProducts] = useState<MetallicProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [selectedQuoteLabel, setSelectedQuoteLabel] = useState<string>("");
  const [quoteItemPending, setQuoteItemPending] = useState<number | null>(null);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteLogs, setQuoteLogs] = useState<any[]>([]);
  
  const { sales: quotes, loading: loadingQuotes } = useSales({
    pageSize: 100,
    statusFilter: "QUOTATION",
    businessLine: "metallic-roofing",
    searchTerm: "",
    startDate: "",
    endDate: "",
    sunatFilter: "",
    skipAggregates: true,
  });

  const [selectedSku, setSelectedSku] = useState("");
  const [rows, setRows] = useState<CoilRow[]>([newRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<{
    cantidadProducida: number;
    costoUnitarioPEN: number;
    hasNegativeCoilWarning: boolean;
  } | null>(null);
  const requestIdRef = React.useRef<string | null>(null);

  // Cargar catálogo
  useEffect(() => {
    listProducts({ active: true })
      .then((all) => setProducts(all.filter((p) => p.family === "COBERTURA" || p.family === "PLANCHA")))
      .catch(() => toast.error("Error al cargar catálogo de productos"))
      .finally(() => setLoadingProducts(false));
  }, []);

  // ?sku= y ?quoteId= prefiltrado
  useEffect(() => {
    const sku = searchParams.get("sku");
    const qId = searchParams.get("quoteId");
    const qty = searchParams.get("qty");
    
    if (qId) {
      setSelectedQuoteId(qId);
      // Label should ideally be fetched, but we might not have it unless we query the quote doc. 
      // It's ok to leave it as qId if we don't have the customer name. 
      setSelectedQuoteLabel(qId); 
    }
    
    if (sku && products.find((p) => p.sku === sku)) {
      setSelectedSku(sku);
      
      const product = products.find((p) => p.sku === sku);
      const isCobertura = product?.family !== "PLANCHA";
      
      if (qty && Number(qty) > 0) {
        const defaultQty = Number(qty);
        setQuoteItemPending(defaultQty);
        
        // Setup initial row
        if (isCobertura) {
          // For COBERTURA, pending is ML. We can't pre-fill pieces without pieceLength.
          // Unless the user knows length. We'll leave `cantidad` empty and let user fill it.
          const newR = newRow(product?.length ?? null);
          newR.declared = String(defaultQty);
          setRows([newR]);
        } else {
          // PLANCHA, pending is UND
          const newR = newRow(product?.length ?? null);
          newR.declared = String(defaultQty);
          setRows([newR]);
        }
      } else {
        setRows([newRow(product?.length ?? null)]);
      }
    }
  }, [searchParams, products]);

  // Cargar logs de la cotización seleccionada
  useEffect(() => {
    if (selectedQuoteId) {
      getQuoteFulfillmentLogs(selectedQuoteId)
        .then(setQuoteLogs)
        .catch((err) => console.error("Error fetching quote logs", err));
    } else {
      setQuoteLogs([]);
    }
  }, [selectedQuoteId]);

  const selectedProduct = products.find((p) => p.sku === selectedSku) ?? null;
  const unitLabel = selectedProduct?.family === "PLANCHA" ? "piezas" : "ML";

  // ── Cargar datos de bobina ──────────────────────────────────────────────────

  const [eligibleCoils, setEligibleCoils] = useState<Coil[]>([]);
  const [loadingCoils, setLoadingCoils] = useState(false);

  useEffect(() => {
    if (!selectedProduct) {
      setEligibleCoils([]);
      return;
    }
    const fetchCoils = async () => {
      setLoadingCoils(true);
      try {
        const requiredFinish = selectedProduct.finish;
        
        const qSnap = await getDocs(query(collection(db, "coils"), where("status", "in", ["AVAILABLE", "IN_PROGRESS"])));
        const validFinishIds = finishes.filter(f => f.lines.includes('metallic-roofing')).map(f => f.id);
        
        const coils = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Coil)).filter(c =>
          c.currentWeight > 0 &&
          c.thickness != null &&
          isThicknessWithinTolerance(c.thickness, selectedProduct.thickness) &&
          c.finish === requiredFinish &&
          c.finish && validFinishIds.includes(c.finish)
        );
        setEligibleCoils(coils);
      } catch (err) {
        toast.error("Error al cargar bobinas compatibles");
      } finally {
        setLoadingCoils(false);
      }
    };
    fetchCoils();
  }, [selectedProduct, finishes]);

  const handleCoilSelect = useCallback((rowId: string, coilId: string) => {
    const coil = eligibleCoils.find(c => c.id === coilId);
    if (!coil) {
      setRows(prev => prev.map(r => r.rowId === rowId ? { ...r, coilId: "", coilData: null, finish: null, loadError: null } : r));
      return;
    }
    const finish = finishes.find(f => f.id === coil.finish) ?? null;
    let loadError: string | null = null;
    if (!finish?.densityFactor) loadError = `El acabado '${coil.finish}' no tiene factor de densidad configurado.`;
    setRows(prev => prev.map(r => r.rowId === rowId ? { ...r, coilId, coilData: coil, finish, loadError } : r));
  }, [eligibleCoils, finishes]);

  // ── Cálculo en vivo del resumen ────────────────────────────────────────────

  const preview = (() => {
    if (!selectedProduct) return null;
    const productKind = selectedProduct.family === "PLANCHA" ? "PLANCHA_UND" : "COBERTURA_ML";
    const lengthM = selectedProduct.length ?? null;

    const validRows = rows.filter(
      (r) =>
        r.coilData &&
        r.finish?.densityFactor &&
        r.coilData.masterWidth &&
        r.coilData.thickness &&
        Number(r.declared) > 0 &&
        !r.loadError,
    );

    if (validRows.length === 0) return null;

    try {
      return calcProductionFromCoils(
        { productKind, lengthM },
        validRows.map((r) => ({
          coilId: r.coilId,
          declared: Number(r.declared),
          thicknessMm: r.coilData!.thickness!,
          masterWidth: r.coilData!.masterWidth!,
          pricePerKg: r.coilData!.pricePerKg,
          coilDensityFactor: r.finish!.densityFactor!,
          reportedWeightKg: r.reportedWeight ? Number(r.reportedWeight) : undefined,
        })),
      );
    } catch {
      return null;
    }
  })();

  // ── Handlers ───────────────────────────────────────────────────────────────

  const updateRow = (rowId: string, patch: Partial<CoilRow>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  /** Solo COBERTURA_ML: al cambiar cantidad o longitud, recalcula `declared` (ML). Vacío/inválido → declared="" (bloquea submit, no autocompleta con 0). */
  const updateCoverageInputs = (rowId: string, patch: { cantidad?: string; longitud?: string }) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const next = { ...r, ...patch };
        const ml = computeCoverageDeclaredMl(
          parsePositiveNumberInput(next.cantidad),
          parsePositiveNumberInput(next.longitud),
        );
        return { ...next, declared: ml !== null ? String(ml) : "" };
      }),
    );
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  };

  const hasNegativeWarning =
    preview &&
    rows.some(
      (r) =>
        r.coilData &&
        r.finish?.densityFactor &&
        r.coilData.masterWidth &&
        r.coilData.thickness &&
        Number(r.declared) > 0 &&
        !r.loadError &&
        (() => {
          const ml =
            selectedProduct?.family === "PLANCHA"
              ? Number(r.declared) * (selectedProduct.length ?? 0)
              : Number(r.declared);
          const w =
            ml * r.coilData!.thickness! * r.coilData!.masterWidth! * r.finish!.densityFactor!;
          return w > r.coilData!.currentWeight;
        })(),
    );

  const canSubmit =
    selectedQuoteId !== "" &&
    selectedSku &&
    preview &&
    rows.every((r) => r.coilData && !r.loadError && Number(r.declared) > 0) &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedProduct) return;

    setSubmitting(true);
    setLastResult(null);

    if (!requestIdRef.current) {
      requestIdRef.current = crypto.randomUUID();
    }

    try {
      const isCobertura = selectedProduct.family !== "PLANCHA";
      const result = await produceFromCoils({
        targetSku: selectedSku,
        productKind: isCobertura ? "COBERTURA_ML" : "PLANCHA_UND",
        lengthM: selectedProduct.length ?? null,
        coilInputs: rows.map((r) => {
          const cantidadNum = parsePositiveNumberInput(r.cantidad);
          const longitudNum = parsePositiveNumberInput(r.longitud);
          return {
            coilId: r.coilId.trim(),
            declared: Number(r.declared),
            reportedWeightKg: r.reportedWeight ? Number(r.reportedWeight) : undefined,
            ...(isCobertura && cantidadNum !== null && longitudNum !== null
              ? { piecesCount: cantidadNum, pieceLengthM: longitudNum }
              : {}),
          };
        }),
        requestId: requestIdRef.current,
        source: selectedQuoteId ? { type: "QUOTE", id: selectedQuoteId, label: selectedQuoteLabel } : null,
      });

      if (result.hasNegativeCoilWarning) {
        toast.success(
          `Producción registrada. ⚠️ Una o más bobinas quedaron con peso negativo.`,
          { duration: 6000 },
        );
      } else {
        toast.success(
          `Producción registrada: ${result.cantidadProducida} ${unitLabel} a S/ ${result.costoUnitarioPEN.toFixed(4)}/u`,
        );
      }

      requestIdRef.current = null;
      router.push('/admin/lines/metallic-roofing/production');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al registrar producción.");
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/lines/metallic-roofing/production" className="p-2 hover:bg-slate-100 rounded-xl transition cursor-pointer">
            <ArrowLeft size={20} className="text-slate-500" />
          </Link>
          <div className="bg-blue-100 p-2.5 rounded-xl">
            <Factory size={22} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Nueva Producción
            </h1>
            <p className="text-slate-500 font-medium text-sm">
              Aluzinc · Conformado
            </p>
          </div>
        </div>
      </div>
      
      {/* 0. Producir contra Cotización (Obligatorio) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <FileText size={14} className="text-orange-500" /> Producir contra Cotización (Obligatorio)
        </h2>
        
        {loadingQuotes ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Cargando cotizaciones...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <select
                className="flex-1 border-2 border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-400 bg-white min-w-0"
                value={selectedQuoteId}
                onChange={(e) => {
                  const qId = e.target.value;
                  setSelectedQuoteId(qId);
                  const q = quotes.find((s) => s.id === qId);
                  if (q) {
                    setSelectedQuoteLabel(q.customerName || qId);
                  } else {
                    setSelectedQuoteLabel("");
                  }
                  setSelectedSku("");
                  setQuoteItemPending(null);
                  setRows([newRow()]);
                }}
              >
                <option value="">— Seleccionar Cotización —</option>
                {quotes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.id} — {q.customerName}
                  </option>
                ))}
              </select>

              {selectedQuoteId && (
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(true)}
                  title="Ver Detalles de Cotización"
                  className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-xl transition flex items-center justify-center shrink-0"
                >
                  <Eye size={20} />
                </button>
              )}
            </div>
            
            {selectedQuoteId && (
              <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                <p className="text-xs font-bold text-orange-800 mb-2">Selecciona un producto de la cotización:</p>
                <div className="grid gap-2">
                  {quotes.find(q => q.id === selectedQuoteId)?.items?.filter(item => item.businessLine === "metallic-roofing").map((item, idx) => {
                    const produced = quoteLogs.filter(l => l.sku === item.sku).reduce((acc, l) => acc + (l.piecesProduced || 0), 0);
                    const pending = Math.max(0, item.quantity - produced);
                    const isFulfilled = pending === 0;
                    const unit = products.find(p => p.sku === item.sku)?.family === "PLANCHA" ? "UND" : "ML";
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedSku(item.sku);
                          const prod = products.find((p) => p.sku === item.sku);
                          setQuoteItemPending(pending);
                          const newR = newRow(prod?.length ?? null);
                          newR.declared = pending > 0 ? String(pending) : "0";
                          setRows([newR]);
                        }}
                        className={`text-left p-3 rounded-lg border text-sm font-bold transition ${selectedSku === item.sku ? 'bg-orange-500 text-white border-orange-600' : 'bg-white text-slate-700 hover:border-orange-300 border-slate-200'}`}
                      >
                        {item.sku} — Pendiente: {pending} de {item.quantity} {unit}
                        {isFulfilled && <span className="ml-2 text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded uppercase tracking-widest inline-block">Ya cumplida</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 1. SKU Destino */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Layers size={14} className="text-blue-500" /> 1. SKU Destino
        </h2>

        {loadingProducts ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Cargando productos...
          </div>
        ) : (
          <select
            className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-400 bg-white"
            value={selectedSku}
            onChange={(e) => {
              const sku = e.target.value;
              setSelectedSku(sku);
              const product = products.find((p) => p.sku === sku);
              setRows([newRow(product?.length ?? null)]);
            }}
            required
          >
            <option value="">— Seleccionar SKU terminado (COBERTURA / PLANCHA) —</option>
            {products.map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.sku} — {p.displayName}
              </option>
            ))}
          </select>
        )}

        {selectedProduct && (
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="bg-blue-50 text-blue-700 font-black px-2.5 py-1 rounded-lg">
              {selectedProduct.family}
            </span>
            <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg">
              {selectedProduct.thickness} mm
            </span>
            {selectedProduct.width && (
              <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg">
                {selectedProduct.width} m ancho
              </span>
            )}
            {selectedProduct.length && (
              <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg">
                {selectedProduct.length} m largo
              </span>
            )}
            <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg">
              Input por bobina: {unitLabel}
            </span>
          </div>
        )}
      </div>

      {/* 2. Bobinas */}
      {selectedProduct && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">
            2. Bobinas utilizadas
          </h2>

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <CoilRowCard
                key={row.rowId}
                row={row}
                idx={idx}
                unitLabel={unitLabel}
                onCoilSelect={(coilId) => handleCoilSelect(row.rowId, coilId)}
                eligibleCoils={eligibleCoils}
                loadingCoils={loadingCoils}
                onDeclaredChange={(declared) => updateRow(row.rowId, { declared })}
                onCantidadChange={(cantidad) => updateCoverageInputs(row.rowId, { cantidad })}
                onLongitudChange={(longitud) => updateCoverageInputs(row.rowId, { longitud })}
                onReportedWeightChange={(reportedWeight) => updateRow(row.rowId, { reportedWeight })}
                onRemove={() => removeRow(row.rowId)}
                canRemove={rows.length > 1}
                selectedProduct={selectedProduct}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, newRow(selectedProduct.length ?? null)])}
            className="flex items-center gap-2 text-sm font-black text-blue-600 hover:text-blue-800 transition py-1"
          >
            <Plus size={16} /> Agregar Bobina
          </button>
        </div>
      )}

      {/* 3. Resumen */}
      {preview && selectedProduct && (
        <div
          className={`rounded-2xl border p-6 space-y-4 ${
            hasNegativeWarning
              ? "bg-amber-50 border-amber-200"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest">
            Resumen de Producción
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryKpi
              label="Cantidad"
              value={`${preview.cantidadProducida.toLocaleString("es-PE", { maximumFractionDigits: 2 })} ${unitLabel}`}
            />
            <SummaryKpi
              label="Metros totales"
              value={`${preview.totalMl.toLocaleString("es-PE", { maximumFractionDigits: 2 })} ML`}
            />
            <SummaryKpi
              label="Peso consumido"
              value={`${preview.pesoTotalKg.toLocaleString("es-PE", { maximumFractionDigits: 2 })} kg`}
            />
            <SummaryKpi
              label="Costo total"
              value={`S/ ${preview.costoTotalPEN.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          </div>

          <div className="bg-white rounded-xl p-4 flex justify-between items-center border border-emerald-200">
            <span className="text-sm font-black text-slate-600">Costo unitario (congelado)</span>
            <span className="text-lg font-black text-emerald-700">
              S/ {preview.costoUnitarioPEN.toFixed(4)} / {unitLabel.slice(0, -1)}
            </span>
          </div>

          {hasNegativeWarning && (
            <div className="flex items-start gap-2 text-amber-700 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span className="font-bold">
                Una o más bobinas quedarán con peso negativo. La operación se registrará igualmente.
              </span>
            </div>
          )}

          {quoteItemPending !== null && preview.cantidadProducida > quoteItemPending && (
            <div className="flex items-start gap-2 text-amber-700 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span className="font-bold">
                Aviso: Estás produciendo ({preview.cantidadProducida}) más de lo pendiente en la cotización ({quoteItemPending}).
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition disabled:opacity-40 flex items-center justify-center gap-2 text-sm"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Registrando...</>
            ) : (
              <><Factory size={16} /> Registrar Producción</>
            )}
          </button>
        </div>
      )}
      {/* Modal Detalles de Cotización */}
      {isQuoteModalOpen && selectedQuoteId && (
        <SaleDetailsModal
          sale={quotes.find((q) => q.id === selectedQuoteId)!}
          onClose={() => setIsQuoteModalOpen(false)}
        />
      )}
    </form>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function CoilRowCard({
  row,
  idx,
  unitLabel,
  onCoilSelect,
  onDeclaredChange,
  onCantidadChange,
  onLongitudChange,
  onReportedWeightChange,
  onRemove,
  canRemove,
  selectedProduct,
  eligibleCoils,
  loadingCoils,
}: {
  row: CoilRow;
  idx: number;
  unitLabel: string;
  onCoilSelect: (coilId: string) => void;
  onDeclaredChange: (v: string) => void;
  onCantidadChange: (v: string) => void;
  onLongitudChange: (v: string) => void;
  onReportedWeightChange: (v: string) => void;
  onRemove: () => void;
  canRemove: boolean;
  selectedProduct: MetallicProduct;
  eligibleCoils: Coil[];
  loadingCoils: boolean;
}) {
  const isCobertura = selectedProduct.family !== "PLANCHA";

  const preview = (() => {
    if (!row.coilData || !row.finish?.densityFactor || !Number(row.declared)) return null;
    const ml =
      selectedProduct.family === "PLANCHA"
        ? Number(row.declared) * (selectedProduct.length ?? 0)
        : Number(row.declared);
    const w = ml * row.coilData.thickness! * row.coilData.masterWidth! * row.finish.densityFactor;
    const finalW = row.reportedWeight ? Number(row.reportedWeight) : w;
    const willBeNegative = finalW > row.coilData.currentWeight;
    
    // Deviation warning if difference > 5%
    const diffKg = finalW - w;
    const deviationPct = Math.abs(diffKg / w);
    const hasDeviationWarning = row.reportedWeight && deviationPct > 0.05;
    
    return { theoreticalWeight: w, weightConsumed: finalW, willBeNegative, hasDeviationWarning, diffKg };
  })();

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        row.loadError ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          Bobina #{idx + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-slate-400 hover:text-red-500 transition"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className={`grid grid-cols-2 ${isCobertura ? "md:grid-cols-4" : "md:grid-cols-3"} gap-3`}>
        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
            ID Bobina *
          </label>
          {loadingCoils ? (
            <div className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-400 bg-slate-50 flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Buscando...
            </div>
          ) : eligibleCoils.length === 0 ? (
            <div className="w-full border border-red-200 rounded-lg p-2.5 text-sm font-bold text-red-500 bg-red-50">
              No hay bobinas {selectedProduct.finish} {selectedProduct.thickness} disponibles
            </div>
          ) : (
            <select
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-400 bg-white"
              value={row.coilId}
              onChange={(e) => onCoilSelect(e.target.value)}
            >
              <option value="">— Seleccionar bobina —</option>
              {eligibleCoils.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} ({c.currentWeight.toLocaleString("es-PE", { maximumFractionDigits: 2 })} kg disp. · {c.thickness} mm · {c.finish})
                </option>
              ))}
            </select>
          )}
        </div>

        {isCobertura ? (
          <>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                Cantidad (piezas) *
              </label>
              <input
                type="number"
                step="1"
                min="1"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-400 bg-white"
                placeholder="0"
                value={row.cantidad}
                onChange={(e) => onCantidadChange(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                Longitud (m/pieza) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-400 bg-white"
                placeholder="0.00"
                value={row.longitud}
                onChange={(e) => onLongitudChange(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
              {unitLabel} Declarados *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-400 bg-white"
              placeholder={`0 ${unitLabel}`}
              value={row.declared}
              onChange={(e) => onDeclaredChange(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
            Kg consumidos reales (Opcional)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full border border-slate-200 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-400 bg-white"
            placeholder="Dejar vacío para usar teórico"
            value={row.reportedWeight}
            onChange={(e) => onReportedWeightChange(e.target.value)}
          />
        </div>
      </div>

      {isCobertura && (row.cantidad || row.longitud) && (
        <p className="text-[11px] font-bold text-slate-500">
          {row.declared ? (
            <>ML calculado: <span className="text-slate-700">{Number(row.declared).toLocaleString("es-PE", { maximumFractionDigits: 2 })} ML</span></>
          ) : (
            <span className="text-amber-600 flex items-center gap-1">
              <AlertTriangle size={11} /> Completá cantidad y longitud (ambas &gt; 0) para calcular el ML.
            </span>
          )}
        </p>
      )}

      {/* Estado de carga */}
      {row.isLoading && (
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <Loader2 size={12} className="animate-spin" /> Cargando bobina...
        </div>
      )}

      {row.loadError && (
        <p className="text-red-600 text-xs font-bold flex items-center gap-1">
          <AlertTriangle size={12} /> {row.loadError}
        </p>
      )}

      {row.coilData && !row.loadError && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          <CoilInfoChip label="Peso actual" value={`${row.coilData.currentWeight.toLocaleString("es-PE", { maximumFractionDigits: 2 })} kg`} />
          <CoilInfoChip label="Ancho maestro" value={`${row.coilData.masterWidth} mm`} />
          <CoilInfoChip label="S/.kg" value={`S/ ${row.coilData.pricePerKg.toFixed(4)}`} />
          <CoilInfoChip
            label="Acabado δ"
            value={row.finish?.densityFactor ? row.finish.densityFactor.toString() : "—"}
          />
        </div>
      )}

      {preview && !row.loadError && (
        <div className="space-y-2">
          <div
            className={`rounded-lg p-2.5 text-xs font-bold border ${
              preview.willBeNegative
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
            }`}
          >
            {preview.willBeNegative && <AlertTriangle size={11} className="inline mr-1" />}
            Consumirá ≈ {preview.weightConsumed.toFixed(2)} kg
            {preview.willBeNegative &&
              ` → queda ${(row.coilData!.currentWeight - preview.weightConsumed).toFixed(2)} kg (negativo)`}
          </div>
          
          {preview.hasDeviationWarning && (
            <div className="rounded-lg p-2.5 text-xs font-bold border bg-amber-50 border-amber-200 text-amber-800">
              <AlertTriangle size={11} className="inline mr-1" />
              El consumo declarado {preview.diffKg > 0 ? 'supera' : 'queda bajo'} el teórico ({preview.theoreticalWeight.toFixed(2)} kg) en {Math.abs(preview.diffKg).toFixed(2)} kg.
              {preview.diffKg < 0 && " — registrar merma en Inventario de Bobinas si corresponde."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CoilInfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg p-2">
      <p className="text-slate-400 font-bold uppercase leading-none mb-0.5">{label}</p>
      <p className="text-slate-800 font-black">{value}</p>
    </div>
  );
}

function SummaryKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-emerald-100">
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}

export default function MetallicProductionNewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-16">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <MetallicProductionForm />
      </div>
    </Suspense>
  );
}
