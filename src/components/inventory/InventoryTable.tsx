"use client";
import React from "react";
import { Search } from "lucide-react";
import { Coil } from "@/types";
import { WeightIndicator } from "./WeightIndicator";
import InventoryActions from "./InventoryActions";

interface InventoryTableProps {
  displayCoils: Coil[];
  role: string | null | undefined;
  onProcess: (coil: Coil) => void;
  onEdit: (coil: Coil) => void;
  onVoid: (coilId: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    AVAILABLE: "bg-green-100 text-green-700 border-green-200",
    IN_PROGRESS: "bg-orange-100 text-orange-700 border-orange-200",
    PROCESSED: "bg-gray-100 text-gray-600 border-gray-200",
    VOIDED: "bg-red-100 text-red-700 border-red-200 line-through opacity-80",
  };
  const labels: Record<string, string> = {
    AVAILABLE: "DISPONIBLE",
    IN_PROGRESS: "EN PROCESO",
    PROCESSED: "PROCESADA",
    VOIDED: "ANULADA",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] font-black border tracking-widest ${styles[status]}`}
    >
      {labels[status] || status}
    </span>
  );
}

export default function InventoryTable({
  displayCoils,
  role,
  onProcess,
  onEdit,
  onVoid,
}: InventoryTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="w-full overflow-x-auto min-h-[250px]">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/80 border-b border-gray-100">
            <tr>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Serie
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Material{" "}
                <span className="text-gray-400 normal-case font-normal">
                  (Ancho x Esp)
                </span>
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap w-64">
                Stock Disponible
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Responsable
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Estado
              </th>
              <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap w-32">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayCoils.map((coil) => {
              const isVoided = coil.status === "VOIDED";

              // AHORA USAMOS coil.registeredBy EN LUGAR DE coil.createdBy
              const creatorEmail = coil.registeredBy || "Sistema";
              const initial = creatorEmail.charAt(0).toUpperCase();

              return (
                <tr
                  key={coil.id}
                  className={`group transition-colors ${isVoided ? "bg-red-50/10" : "hover:bg-blue-50/20"}`}
                >
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span
                        className={`font-black ${isVoided ? "text-red-400 line-through" : "text-blue-900"}`}
                      >
                        {coil.id}
                      </span>
                      {coil.metadata?.provider && (
                        <span className="text-xs text-gray-400 font-medium mt-0.5">
                          {coil.metadata.provider}
                        </span>
                      )}
                    </div>
                  </td>
                  <td
                    className={`p-4 text-sm font-medium ${isVoided ? "text-gray-400 line-through" : "text-gray-600"}`}
                  >
                    {coil.masterWidth}{" "}
                    <span className="text-gray-400 mx-0.5 text-xs">mm</span>
                    <span className="text-gray-300 mx-1">x</span>
                    {coil.thickness}{" "}
                    <span className="text-gray-400 mx-0.5 text-xs">mm</span>
                  </td>
                  <td
                    className={`p-4 ${isVoided ? "opacity-50 grayscale" : ""}`}
                  >
                    <WeightIndicator
                      current={coil.currentWeight || 0}
                      initial={coil.initialWeight || 0}
                    />
                  </td>

                  {/* CELDA DE RESPONSABLE ACTUALIZADA */}
                  <td
                    className={`p-4 ${isVoided ? "opacity-50 grayscale" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px] shrink-0">
                        {initial}
                      </div>
                      <span
                        className="text-xs font-medium text-gray-600 truncate max-w-[120px]"
                        title={creatorEmail}
                      >
                        {creatorEmail.split("@")[0]}
                      </span>
                    </div>
                  </td>

                  <td className="p-4">
                    <StatusBadge status={coil.status} />
                  </td>
                  <td className="p-4 relative">
                    <InventoryActions
                      coil={coil}
                      role={role}
                      isVoided={isVoided}
                      onProcess={() => onProcess(coil)}
                      onEdit={() => onEdit(coil)}
                      onVoid={() => onVoid(coil.id)}
                    />
                  </td>
                </tr>
              );
            })}

            {displayCoils.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 text-gray-400">
                    <Search size={24} />
                  </div>
                  <h3 className="text-gray-900 font-bold text-lg">
                    No hay resultados
                  </h3>
                  <p className="text-gray-500 mt-1 font-medium">
                    No se encontraron bobinas con los filtros actuales.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
