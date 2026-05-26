"use client";

import React from "react";
import {
  X,
  Calendar,
  Building2,
  Scale,
  DollarSign,
  ArrowRightLeft,
  FileText,
  Hash,
  Scissors, // <-- Agregado para el ícono del plan de corte
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Coil } from "@/types";

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
  const isConverted = coil.metadata?.currency === "USD";
  const exchangeRate = coil.metadata?.exchangeRate || 1;
  const originalCurrencyValue = coil.metadata?.originalCurrencyValue || 0;
  const isVoided = coil.status === "VOIDED";

  // --- VARIABLES PARA EL PLAN DE CORTE ---
  const isPlanned = coil.plannedStrips && coil.plannedStrips.length > 0;
  const totalPlannedWidth = isPlanned
    ? coil.plannedStrips!.reduce(
        (sum, strip) => sum + strip.width * strip.initialCount,
        0,
      )
    : 0;
  const scrapWidth = coil.masterWidth
    ? coil.masterWidth - totalPlannedWidth
    : 0;

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
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white"
        >
          <X size={24} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
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

        {/* 4. PLAN DE CORTE (NUEVA SECCIÓN UNIFICADA) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <header className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Scissors size={16} className="text-purple-500" />
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Plan de Corte (Flejes Operativos)
            </h3>
          </header>

          {!isPlanned ? (
            <div className="bg-slate-50 border border-slate-200 border-dashed p-8 rounded-xl text-center">
              <p className="text-slate-500 font-bold">
                Esta bobina aún no tiene un plan de corte asignado.
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Debe procesarse desde la tabla principal para generar los
                flejes.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase">
                      Producto (SKU)
                    </th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase text-center">
                      Ancho Fleje
                    </th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase text-center">
                      Cortes (Progreso)
                    </th>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase text-right">
                      Costo Asignado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coil.plannedStrips!.map((strip, idx) => {
                    const completedCuts =
                      strip.initialCount - strip.pendingCount;
                    const isDone = strip.pendingCount === 0;

                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-slate-50 transition ${
                          isDone ? "opacity-60 bg-slate-50/50" : ""
                        }`}
                      >
                        <td className="p-3 font-bold text-slate-700 text-sm">
                          {strip.sku}
                          {isDone && (
                            <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Completado
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center text-sm font-medium text-slate-600">
                          {strip.width} mm
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-sm font-black text-blue-600">
                              {completedCuts}
                            </span>
                            <span className="text-xs text-slate-400">de</span>
                            <span className="text-sm font-bold text-slate-700">
                              {strip.initialCount}
                            </span>
                          </div>
                          {/* Barra de progreso visual */}
                          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isDone ? "bg-green-500" : "bg-blue-500"
                              }`}
                              style={{
                                width: `${(completedCuts / strip.initialCount) * 100}%`,
                              }}
                            ></div>
                          </div>
                        </td>
                        <td className="p-3 text-right text-sm font-black text-slate-700">
                          S/ {strip.costPerStrip.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50/50 border-t border-slate-200">
                  <tr>
                    <td
                      colSpan={2}
                      className="p-3 text-xs font-bold text-slate-500"
                    >
                      Ancho Consumido:{" "}
                      <span className="text-slate-800">
                        {totalPlannedWidth} mm
                      </span>
                    </td>
                    <td
                      colSpan={2}
                      className="p-3 text-xs font-bold text-slate-500 text-right"
                    >
                      Merma (Retazo):{" "}
                      <span className="text-red-500">{scrapWidth} mm</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
