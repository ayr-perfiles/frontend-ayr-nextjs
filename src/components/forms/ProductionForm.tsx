"use client";

import { useState, useMemo, useEffect } from "react";
import { Coil } from "@/types";
import { saveCuttingPlan } from "@/services/productionService";
import { getCatalog, ProductConfig } from "@/services/catalogService";
import {
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X, // <-- Icono añadido
} from "lucide-react";
import toast from "react-hot-toast/headless";

interface ProductionFormProps {
  coil: Coil;
  onClose: () => void;
}

export function ProductionForm({ coil, onClose }: ProductionFormProps) {
  // --- ESTADO DEL CATÁLOGO ---
  const [catalog, setCatalog] = useState<ProductConfig[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // --- ESTADO DEL FORMULARIO ---
  const [items, setItems] = useState([{ sku: "", stripCount: 8 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. CARGAR CATÁLOGO DE FIREBASE
  useEffect(() => {
    const fetchCatalog = async () => {
      const data = await getCatalog();
      const activeProducts = data.filter((p) => p.isActive);
      setCatalog(activeProducts);

      if (activeProducts.length > 0) {
        setItems([{ sku: activeProducts[0].sku, stripCount: 8 }]);
      }
      setIsLoadingCatalog(false);
    };
    fetchCatalog();
  }, []);

  // 2. CÁLCULOS EN TIEMPO REAL
  const calculations = useMemo(() => {
    let totalUsedWidth = 0;
    items.forEach((item) => {
      const product = catalog.find((p) => p.sku === item.sku);
      if (product) {
        totalUsedWidth += product.stripWidth * item.stripCount;
      }
    });

    const isWidthValid = totalUsedWidth <= (coil.masterWidth || 1192);

    return {
      totalUsedWidth,
      isWidthValid,
      scrapWidth: (coil.masterWidth || 1192) - totalUsedWidth,
    };
  }, [items, coil, catalog]);

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];

    if (field === "sku") {
      const alreadyExists = newItems.some(
        (item, i) => item.sku === value && i !== index,
      );
      if (alreadyExists) {
        toast.error(
          "Este producto ya está en el plan de corte. Por favor, modifica la cantidad en la fila existente.",
        );
        return;
      }
      newItems[index].sku = value as string;
    } else {
      newItems[index].stripCount = Number(value);
    }

    setItems(newItems);
  };

  const handleAddItem = () => {
    const availableSkus = catalog
      .map((p) => p.sku)
      .filter((sku) => !items.some((item) => item.sku === sku));

    if (availableSkus.length === 0) {
      toast.error(
        "Ya has agregado todos los productos del catálogo al plan de corte.",
      );
      return;
    }

    setItems([...items, { sku: availableSkus[0], stripCount: 1 }]);
  };

  const handleSubmit = async () => {
    if (!calculations.isWidthValid) return;
    setIsSubmitting(true);

    try {
      const formattedItems = items.map((item) => ({
        sku: item.sku,
        quantity: Number(item.stripCount),
      }));

      await saveCuttingPlan(coil.id, formattedItems);

      toast.success(
        "✅ Plan de corte registrado. La bobina ahora está EN PROCESO.",
      );
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Error al guardar el plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingCatalog) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white">
        <Loader2 size={32} className="animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500 font-bold">
          Cargando catálogo de perfiles...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* --- CABECERA ACTUALIZADA CON BOTÓN DE CIERRE --- */}
      <div className="flex justify-between items-center bg-gray-50 p-6 border-b">
        <div>
          <h3 className="text-lg font-black text-blue-900">
            Paso 1: Slitter - {coil.id}
          </h3>
          <p className="text-sm text-gray-500">
            Configura las cuchillas para esta bobina ({coil.masterWidth} mm
            disponibles).
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500"
        >
          <X size={24} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        <div className="space-y-4">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex gap-3 items-end p-4 border rounded-xl"
            >
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-400 uppercase">
                  Producto
                </label>
                <select
                  className="w-full p-2 border rounded-md font-medium text-gray-800 outline-none focus:border-blue-500"
                  value={item.sku}
                  onChange={(e) => updateItem(index, "sku", e.target.value)}
                >
                  {catalog.map((prod) => {
                    const isUsedByOtherRow = items.some(
                      (i, idx) => i.sku === prod.sku && idx !== index,
                    );

                    return (
                      <option
                        key={prod.sku}
                        value={prod.sku}
                        disabled={isUsedByOtherRow}
                        className={isUsedByOtherRow ? "text-gray-400" : ""}
                      >
                        {prod.sku} ({prod.stripWidth}mm){" "}
                        {isUsedByOtherRow ? "- Ya agregado" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="w-32">
                <label className="text-xs font-bold text-gray-400 uppercase">
                  N° Flejes
                </label>
                <input
                  type="number"
                  min="1"
                  className="w-full p-2 border rounded-md font-bold text-center outline-none focus:border-blue-500"
                  value={item.stripCount || ""}
                  onChange={(e) =>
                    updateItem(index, "stripCount", e.target.value)
                  }
                />
              </div>
              {items.length > 1 && (
                <button
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                  className="p-2.5 text-red-500 hover:bg-red-50 rounded-md mb-0.5 transition"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddItem}
            className="text-sm text-blue-600 font-bold flex items-center gap-1 hover:text-blue-700 transition"
          >
            <Plus size={16} /> Añadir otro perfil
          </button>
        </div>

        <div className="pt-2 border-t">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500 font-medium">Ancho consumido:</span>
            <span
              className={`font-mono font-bold ${!calculations.isWidthValid ? "text-red-600" : "text-gray-800"}`}
            >
              {calculations.totalUsedWidth.toFixed(1)} mm /{" "}
              {coil.masterWidth || 1192} mm
            </span>
          </div>
          {!calculations.isWidthValid && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
              <AlertTriangle size={18} /> Plan excede el ancho físico.
            </div>
          )}
        </div>
      </div>
      <div className="p-6 bg-gray-50 border-t mt-auto">
        <button
          onClick={handleSubmit}
          disabled={!calculations.isWidthValid || isSubmitting}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-gray-300 transition"
        >
          {isSubmitting ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <CheckCircle2 size={20} />
          )}{" "}
          {isSubmitting ? "Procesando..." : "Guardar Configuración de Flejes"}
        </button>
      </div>
    </div>
  );
}
