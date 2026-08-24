"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Calendar,
  Building2,
  Scale,
  DollarSign,
  ArrowRightLeft,
  FileText,
  Hash,
  Scissors,
  Layers,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Truck,
  AlertCircle,
} from "lucide-react";
import {
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import { Coil, CutOrder } from "@/types";
import { useFinishes } from "@/core/coils/hooks/useFinishes";
import { useCoilYield } from "@/modules/metallic-roofing/hooks/useCoilYield";
import { useCoilScraps } from "@/core/coils/hooks/useCoilScraps";
import { voidCoilScrap } from "@/core/coils/services/coilService";
import { useAuth } from "@/context/AuthContext";
import { useConfirm } from "@/context/ConfirmContext";
import toast from "react-hot-toast";
import Link from "next/link";
import { useKardex } from "@/core/hooks/useKardex";
import { KardexTable } from "@/components/kardex/KardexTable";
import { TablePagination } from "@/components/ui/TablePagination";
import { TableSkeleton } from "@/components/ui/TableSkeleton";

interface CoilDetailsModalProps {
  coil: Coil;
  onClose: () => void;
}

// Función auxiliar para fechas
const formatDate = (dateValue: Timestamp | Date | string | null | undefined) => {
  if (!dateValue) return "Sin fecha";
  const date =
    dateValue instanceof Timestamp
      ? dateValue.toDate()
      : new Date(dateValue as string | number | Date);
  if (isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export function CoilDetailsModal({ coil, onClose }: CoilDetailsModalProps) {
  const { finishes } = useFinishes(false);
  const finishName =
    finishes.find((f) => f.id === coil.finish)?.label || coil.finish || "N/A";

  const isConverted = coil.metadata?.currency === "USD";
  const exchangeRate = coil.metadata?.exchangeRate || 1;
  const originalCurrencyValue = coil.metadata?.originalCurrencyValue || 0;
  const isVoided = coil.status === "VOIDED";

  const { role } = useAuth();
  const confirm = useConfirm();

  // --- TABS Y HOOKS DE DATOS ---
  const [activeTab, setActiveTab] = useState<"general" | "cortes" | "mermas" | "movimientos">("general");
  const { scraps, loading: scrapsLoading, error: scrapsError, refresh: refreshScraps } = useCoilScraps(
    activeTab === "mermas" ? coil.id : undefined
  );

  const [kardexPageSize, setKardexPageSize] = useState(15);
  const kardex = useKardex({
    selectedSku: activeTab === "movimientos" ? coil.id : "",
    pageSize: kardexPageSize,
    startDate: "",
    endDate: "",
  });

  // --- NUEVA LÓGICA DE ORDEN DE CORTE ---
  const [linkedOrder, setLinkedOrder] = useState<CutOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);

  const handleVoidScrap = async (scrapLogId: string) => {
    if (
      await confirm({
        title: "Anular merma",
        message: `Esto revierte la merma y restaura el peso a la bobina. Acción de ADMIN.`,
        variant: "danger",
        confirmLabel: "Anular",
        requireInput: { label: 'Escribe "ANULAR"', matchValue: "ANULAR" },
      })
    ) {
      toast
        .promise(voidCoilScrap(scrapLogId), {
          loading: "Anulando merma...",
          success: "Merma anulada correctamente.",
          error: (err: any) => err.message,
        })
        .then(() => {
          refreshScraps();
        });
    }
  };

  useEffect(() => {
    const fetchLinkedOrder = async () => {
      setLoadingOrder(true);
      try {
        // Consultar órdenes recientes y buscar la bobina localmente
        const q = query(
          collection(db, "cut_orders"),
          orderBy("sentAt", "desc"),
          limit(50),
        );
        const snap = await getDocs(q);
        const orders = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as CutOrder,
        );
        const found = orders.find((o) =>
          o.coils.some((c) => c.coilId === coil.id),
        );
        setLinkedOrder(found || null);
      } catch (error) {
        console.error("Error al buscar orden de corte vinculada:", error);
      } finally {
        setLoadingOrder(false);
      }
    };

    fetchLinkedOrder();
  }, [coil.id]);

  const coilInOrder = linkedOrder?.coils.find((c) => c.coilId === coil.id);
  const coilReceivedWeight = linkedOrder?.receivedStrips
    ?.filter((s) => s.coilId === coil.id)
    .reduce((sum, s) => sum + s.weight, 0);

  // --- RENDIMIENTO TEÓRICO VS REAL ---
  const { result: yieldResult, loading: yieldLoading } = useCoilYield(coil);

  return (
    <div className="flex flex-col bg-slate-50 w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl">
      {" "}
      {/* HEADER OSCURO */}
      <div
        className={`p-6 flex justify-between items-start ${isVoided ? "bg-red-950" : "bg-slate-900"} text-white shrink-0 relative`}
      >
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl font-black tracking-tight">{coil.id}</h2>
            <span
              className={`px-3 py-1 rounded-full text-xs font-black tracking-widest border ${
                isVoided
                  ? "bg-red-500/20 text-red-300 border-red-500/30"
                  : coil.status === "AVAILABLE"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : coil.status === "EN_TERCERO"
                      ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      : "bg-orange-500/20 text-orange-300 border-orange-500/30"
              }`}
            >
              {coil.status}
            </span>
          </div>
          <p className="text-slate-400 text-xs font-medium flex items-center gap-1">
            Registrado en sistema el {formatDate(coil.createdAt)} por{" "}
            {coil.registeredBy}
          </p>
          
          {yieldResult && (
            <div className="mt-3 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${yieldResult.yieldAlert ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {yieldResult.yieldAlert && <AlertCircle size={12} />}
                ≈ {Math.round(yieldResult.mlTeorico)} ML teóricos · {Math.round(yieldResult.mlProducido)} ML producidos · {(yieldResult.desviacionPct * 100).toFixed(1)}%
              </span>
              {yieldResult.yieldAlert && (
                <span className="text-xs font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                  Revisar rendimiento
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white"
        >
          <X size={24} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* TABS NAVEGACIÓN */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab("general")}
            className={`px-4 py-2 text-sm font-black tracking-widest uppercase transition-colors rounded-t-lg ${
              activeTab === "general"
                ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab("cortes")}
            className={`px-4 py-2 text-sm font-black tracking-widest uppercase transition-colors rounded-t-lg ${
              activeTab === "cortes"
                ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            Cortes
          </button>
          <button
            onClick={() => setActiveTab("mermas")}
            className={`px-4 py-2 text-sm font-black tracking-widest uppercase transition-colors rounded-t-lg ${
              activeTab === "mermas"
                ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            Mermas
          </button>
          <button
            onClick={() => setActiveTab("movimientos")}
            className={`px-4 py-2 text-sm font-black tracking-widest uppercase transition-colors rounded-t-lg ${
              activeTab === "movimientos"
                ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            Movimientos
          </button>
        </div>

        {activeTab === "general" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* ALERTA DE CONVERSIÓN DE MONEDA (Solo si es USD) */}
            {isConverted && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
            <ArrowRightLeft
              className="text-blue-500 mt-0.5 shrink-0"
              size={18}
            />
            <div>
              <p className="text-sm font-bold text-blue-900">
                Conversión Automática a Soles Aplicada
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Esta bobina fue comprada en Dólares (USD). El sistema la ha
                convertido a Soles (PEN) usando el tipo de cambio de{" "}
                <strong>S/ {exchangeRate}</strong> para mantener el Kardex
                unificado.
              </p>
            </div>
          </div>
        )}

        {/* 1. INFORMACIÓN DE ORIGEN */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <header className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building2 size={16} className="text-slate-500" />
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Información de Origen
            </h3>
          </header>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase">
                Razón Social
              </label>
              <p className="text-sm font-black text-slate-800 uppercase">
                {coil.metadata?.provider || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase">
                Documento
              </label>
              <p className="text-sm font-bold text-slate-700">
                {coil.metadata?.providerDoc || "N/A"}
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase">
                Factura N°
              </label>
              <p className="text-sm font-bold text-slate-700">
                {coil.metadata?.invoiceNumber || "S/N"}
              </p>
            </div>

            <div className="col-span-2 md:col-span-4 bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-blue-500" />
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">
                    Fecha de Facturación Oficial
                  </label>
                  <p className="text-sm font-black text-blue-900">
                    {formatDate(coil.metadata?.invoiceDate)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  Método Ingreso
                </label>
                <p className="text-xs font-bold text-slate-600">
                  {coil.metadata?.isManualEntry
                    ? "Formulario Manual"
                    : "Carga XML (SUNAT)"}
                </p>
              </div>
            </div>

            {coil.metadata?.originalDescription && (
              <div className="col-span-2 md:col-span-4">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  Descripción Original (Factura)
                </label>
                <p className="text-xs font-mono bg-slate-100 p-2 rounded-lg text-slate-600 mt-1 break-words">
                  {coil.metadata.originalDescription}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 2. DIMENSIONES Y PESO */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <header className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Scale size={16} className="text-blue-500" />
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Físico y Stock
              </h3>
            </header>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  Peso Inicial
                </label>
                <p className="text-xl font-black text-slate-800">
                  {coil.initialWeight}{" "}
                  <span className="text-xs text-slate-500">kg</span>
                </p>
              </div>
              <div
                className={`p-3 rounded-xl border ${coil.currentWeight === 0 ? "bg-slate-100 border-slate-200" : "bg-emerald-50 border-emerald-100"}`}
              >
                <label
                  className={`block text-[10px] font-bold uppercase ${coil.currentWeight === 0 ? "text-slate-400" : "text-emerald-600"}`}
                >
                  Stock Restante
                </label>
                <p
                  className={`text-xl font-black ${coil.currentWeight === 0 ? "text-slate-500" : "text-emerald-700"}`}
                >
                  {coil.currentWeight}{" "}
                  <span className="text-xs opacity-70">kg</span>
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  Ancho Maestro
                </label>
                <p className="text-sm font-black text-slate-700">
                  {coil.masterWidth} mm
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase">
                  Espesor
                </label>
                <p className="text-sm font-black text-slate-700">
                  {coil.thickness} mm
                </p>
              </div>
              <div className="col-span-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex items-center gap-2">
                <Layers size={14} className="text-blue-500" />
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase">
                    Acabado / Material
                  </label>
                  <p className="text-xs font-black text-blue-700 uppercase">
                    {finishName}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. VALORIZACIÓN (CONTABILIDAD) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <header className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <DollarSign size={16} className="text-emerald-500" />
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Valorización (Sin IGV)
              </h3>
            </header>

            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-xs font-bold text-slate-500">
                  Costo Unitario (Soles)
                </span>
                <span className="text-sm font-black text-slate-800">
                  S/ {Number(coil.pricePerKg).toFixed(4)}{" "}
                  <span className="text-[10px] text-slate-400">x Kg</span>
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span className="text-xs font-bold text-slate-500">
                  Valorización Inicial
                </span>
                <span className="text-sm font-black text-slate-800">
                  S/{" "}
                  {(
                    (coil.initialWeight || 0) * (coil.pricePerKg || 0)
                  ).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                <span className="text-xs font-black text-slate-600">
                  Valorización del Saldo
                </span>
                <span className="text-base font-black text-emerald-600">
                  S/{" "}
                  {(
                    (coil.currentWeight || 0) * (coil.pricePerKg || 0)
                  ).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* AUDITORÍA DE COMPRA ORIGINAL */}
              {isConverted && originalCurrencyValue > 0 && (
                <div className="mt-4 pt-3 border-t border-dashed border-slate-200">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                    Auditoría de Compra Original
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-500">
                      Monto Facturado (USD)
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      ${" "}
                      {originalCurrencyValue.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs font-medium text-slate-500">
                      Tipo de Cambio Aplicado
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {exchangeRate}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
          </div>
        )}

        {/* 4. CORTE TERCERIZADO (TAB CORTES) */}
        {activeTab === "cortes" && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-in fade-in duration-300">
            <header className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Scissors size={16} className="text-purple-500" />
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Corte Tercerizado
            </h3>
          </header>

          {loadingOrder ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 size={24} className="animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">
                Buscando orden de corte...
              </p>
            </div>
          ) : !linkedOrder ? (
            <div className="bg-slate-50 border border-slate-200 border-dashed p-8 rounded-xl text-center">
              <p className="text-slate-500 font-bold">
                Esta bobina no ha sido enviada a corte externo.
              </p>
              {coil.status === "AVAILABLE" && (
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  Puedes enviarla a corte desde la tabla de inventario
                  seleccionando la bobina.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      linkedOrder.status === "RECIBIDO"
                        ? "bg-emerald-100 text-emerald-600"
                        : linkedOrder.status === "ANULADA"
                          ? "bg-red-100 text-red-600"
                          : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {linkedOrder.status === "RECIBIDO" ? (
                      <CheckCircle2 size={20} />
                    ) : linkedOrder.status === "ANULADA" ? (
                      <AlertCircle size={20} />
                    ) : (
                      <Truck size={20} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                          linkedOrder.status === "RECIBIDO"
                            ? "bg-emerald-600 text-white"
                            : linkedOrder.status === "ANULADA"
                              ? "bg-red-600 text-white"
                              : "bg-blue-600 text-white"
                        }`}
                      >
                        {linkedOrder.status === "RECIBIDO"
                          ? "Procesada"
                          : linkedOrder.status === "ANULADA"
                            ? "Orden Anulada"
                            : "En Corte Externo"}
                      </span>
                      <span className="text-xs font-black text-slate-400">
                        #{linkedOrder.id?.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-black text-slate-800 uppercase mt-0.5">
                      {linkedOrder.tercero.nombre}
                    </p>
                  </div>
                </div>

                <Link
                  href="/admin/coils/cut-orders"
                  className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black text-slate-600 hover:bg-slate-50 transition shadow-sm"
                >
                  <ExternalLink size={14} /> Ver Orden
                </Link>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                    Fecha Envío
                  </label>
                  <p className="text-sm font-bold text-slate-700">
                    {formatDate(linkedOrder.sentAt)}
                  </p>
                </div>
                <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                    Peso Enviado (Bobina)
                  </label>
                  <p className="text-sm font-black text-slate-800">
                    {coilInOrder?.sentWeight} kg
                  </p>
                </div>
                {linkedOrder.status === "RECIBIDO" && (
                  <>
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg shadow-sm">
                      <label className="block text-[9px] font-black text-emerald-600 uppercase tracking-tighter">
                        Peso Recibido
                      </label>
                      <p className="text-sm font-black text-emerald-700">
                        {coilReceivedWeight || 0} kg
                      </p>
                    </div>
                    <div className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                        Factura Corte
                      </label>
                      <p className="text-sm font-black text-blue-600">
                        {linkedOrder.invoice?.number || "Pendiente"}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {coilInOrder?.cutPlan && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-3 text-[10px] font-black text-slate-500 uppercase">
                          Plan de Corte Enviado
                        </th>
                        <th className="p-3 text-[10px] font-black text-slate-500 uppercase text-center">
                          Ancho
                        </th>
                        <th className="p-3 text-[10px] font-black text-slate-500 uppercase text-center">
                          Cant. Flejes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {coilInOrder.cutPlan.map((plan, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-3 text-xs font-medium text-slate-500">
                            Fleje Estándar
                          </td>
                          <td className="p-3 text-center text-sm font-black text-slate-700">
                            {plan.widthMm} mm
                          </td>
                          <td className="p-3 text-center text-sm font-black text-blue-600">
                            {plan.count} un.
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* 5. MERMAS (TAB MERMAS) */}
        {activeTab === "mermas" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {scrapsError && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-700 font-bold text-sm">
                {scrapsError}
              </div>
            )}
            {scrapsLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-xs font-bold uppercase tracking-widest">Cargando mermas...</p>
              </div>
            ) : scraps.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 border-dashed p-8 rounded-xl text-center">
                <p className="text-slate-500 font-bold">Sin mermas registradas</p>
                <p className="text-xs text-slate-400 mt-2 font-medium">Esta bobina no tiene historial de mermas.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Fecha</th>
                      <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Motivo</th>
                      <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Peso</th>
                      <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Costo (S/)</th>
                      {role === "ADMIN" && (
                        <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scraps.map((scrap) => (
                      <tr key={scrap.id} className={`hover:bg-slate-50 transition ${scrap.isVoided ? "opacity-60 bg-slate-50" : ""}`}>
                        <td className="p-3">
                          <span className={`text-xs font-medium ${scrap.isVoided ? "line-through text-slate-400" : "text-slate-700"}`}>
                            {formatDate(scrap.timestamp)}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${scrap.isVoided ? "line-through text-slate-400" : "text-slate-700"}`}>
                              {scrap.reason}
                            </span>
                            {scrap.isVoided && (
                              <span className="bg-red-100 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Anulada</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`text-sm font-black ${scrap.isVoided ? "line-through text-slate-400" : "text-red-600"}`}>
                            {scrap.scrapWeightKg} kg
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`text-sm font-black ${scrap.isVoided ? "line-through text-slate-400" : "text-slate-700"}`}>
                            {Number(scrap.scrapCostPEN).toFixed(2)}
                          </span>
                        </td>
                        {role === "ADMIN" && (
                          <td className="p-3 text-right">
                            {!scrap.isVoided && (
                              <button
                                onClick={() => handleVoidScrap(scrap.id)}
                                className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded transition"
                              >
                                Anular merma
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {/* 6. KARDEX (TAB MOVIMIENTOS) */}
        {activeTab === "movimientos" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="relative">
              {kardex.loading && kardex.movements.length === 0 ? (
                <TableSkeleton rows={8} columns={6} />
              ) : (
                <KardexTable 
                  movements={kardex.movements} 
                  currentPage={kardex.currentPage} 
                  pageSize={kardexPageSize} 
                  isLoading={kardex.loading && kardex.movements.length > 0} 
                />
              )}
            </div>

            <TablePagination
              currentPage={kardex.currentPage}
              pageSize={kardexPageSize}
              totalItems={kardex.totalCount}
              totalLabel="movimientos"
              onPageChange={(page) => {
                if (page > kardex.currentPage) kardex.nextPage();
                else kardex.prevPage();
              }}
              pageSizeOptions={[15, 50]}
              onPageSizeChange={setKardexPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}
