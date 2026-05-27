"use client";

import { PackageSearch, Factory, Weight } from "lucide-react";

interface InventoryMetricsProps {
  available: number;
  inProgress: number;
  totalWeight: number;
}

export function InventoryMetrics({
  available,
  inProgress,
  totalWeight,
}: InventoryMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center gap-4">
        <div className="bg-green-100 p-3 rounded-xl text-green-600">
          <PackageSearch size={24} />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
            Disponibles
          </p>
          <p className="text-2xl font-black text-gray-800">
            {available}{" "}
            <span className="text-sm font-medium text-gray-500">bobinas</span>
          </p>
        </div>
      </div>
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center gap-4">
        <div className="bg-orange-100 p-3 rounded-xl text-orange-600">
          <Factory size={24} />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
            En Producción
          </p>
          <p className="text-2xl font-black text-gray-800">
            {inProgress}{" "}
            <span className="text-sm font-medium text-gray-500">bobinas</span>
          </p>
        </div>
      </div>
      <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex items-center gap-4">
        <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
          <Weight size={24} />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
            Stock Físico
          </p>
          <p className="text-2xl font-black text-gray-800">
            {(totalWeight / 1000).toFixed(1)}{" "}
            <span className="text-sm font-medium text-gray-500">Toneladas</span>
          </p>
        </div>
      </div>
    </div>
  );
}
