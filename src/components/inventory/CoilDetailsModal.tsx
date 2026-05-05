import React from "react";
import {
  X,
  Building2,
  Ruler,
  DollarSign,
  Clock,
  Hash,
  Tag,
} from "lucide-react";
import { Coil } from "@/types";

interface CoilDetailsModalProps {
  coil: Coil;
  onClose: () => void;
}

export function CoilDetailsModal({ coil, onClose }: CoilDetailsModalProps) {
  // Cálculos financieros
  const totalValue = coil.initialWeight * coil.pricePerKg;
  const currentValue = coil.currentWeight * coil.pricePerKg;

  // Formateador de moneda peruana
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95">
        {/* CABECERA */}
        <div className="p-6 bg-slate-800 text-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black">{coil.id}</h2>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest ${
                  coil.status === "AVAILABLE"
                    ? "bg-green-500/20 text-green-300 border border-green-500/30"
                    : coil.status === "IN_PROGRESS"
                      ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      : "bg-gray-500/20 text-gray-300 border border-gray-500/30"
                }`}
              >
                {coil.status}
              </span>
            </div>
            <p className="text-slate-400 text-xs font-medium flex items-center gap-1">
              <Clock size={12} /> Registrado el:{" "}
              {coil.createdAt?.toDate
                ? coil.createdAt.toDate().toLocaleDateString()
                : "N/A"}{" "}
              por {coil.registeredBy}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-700 p-2 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* SECCIÓN 1: DATOS DEL PROVEEDOR */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Building2 size={16} className="text-gray-500" /> Información de
              Origen
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
              <div className="col-span-2 md:col-span-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Razón Social
                </p>
                <p className="font-bold text-gray-800">
                  {coil.metadata?.provider || "SISTEMA / NO REGISTRADO"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Documento ({coil.metadata?.providerDocType || "RUC"})
                </p>
                <p className="font-bold text-gray-800">
                  {coil.metadata?.providerDoc ||
                    coil.metadata?.providerRuc ||
                    "-"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Factura N°
                </p>
                <p className="font-bold text-gray-800">
                  {coil.metadata?.invoiceNumber || "-"}
                </p>
              </div>
            </div>
            {coil.metadata?.originalDescription && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Tag size={12} /> Descripción Original (XML/Excel)
                </p>
                <p className="text-sm font-medium text-gray-600 bg-white p-2 rounded border border-gray-200 italic">
                  {coil.metadata.originalDescription}
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SECCIÓN 2: DATOS FÍSICOS */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
                <Ruler size={16} className="text-blue-500" /> Dimensiones y Peso
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Peso Inicial
                  </p>
                  <p className="font-black text-gray-800 text-lg">
                    {coil.initialWeight}{" "}
                    <span className="text-xs text-gray-500">kg</span>
                  </p>
                </div>
                <div className="bg-green-50/50 p-3 rounded-lg border border-green-100">
                  <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Kilos Restantes
                  </p>
                  <p className="font-black text-green-700 text-lg">
                    {coil.currentWeight}{" "}
                    <span className="text-xs text-green-600">kg</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Ancho Maestro
                  </p>
                  <p className="font-bold text-gray-700">
                    {coil.masterWidth} mm
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Espesor
                  </p>
                  <p className="font-bold text-gray-700">{coil.thickness} mm</p>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: DATOS FINANCIEROS (KARDEX VALORIZADO) */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
                <DollarSign size={16} className="text-green-600" /> Valorización
                (Sin IGV)
              </h3>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500">
                    Costo Unitario (por Kg)
                  </span>
                  <span className="font-black text-gray-800">
                    {formatMoney(coil.pricePerKg)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <span className="text-xs font-bold text-gray-500">
                    Valor Total de Compra
                  </span>
                  <span className="font-black text-gray-800">
                    {formatMoney(totalValue)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <span className="text-xs font-bold text-green-600">
                    Valor del Saldo Actual
                  </span>
                  <span className="font-black text-green-700">
                    {formatMoney(currentValue)}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-gray-400 font-medium text-center italic">
                * Valores base para contabilidad y cálculo de márgenes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
