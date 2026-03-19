"use client";

import { useState, useMemo } from "react";
import { PRODUCT_CATALOG } from "@/config/products";
import { Coil } from "@/types";
import { saveCuttingPlan } from "@/services/productionService";
import { Trash2, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";

interface ProductionFormProps {
  coil: Coil;
  onClose: () => void;
}

export function ProductionForm({ coil, onClose }: ProductionFormProps) {
  const [items, setItems] = useState([{ sku: "P64", stripCount: 8 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculations = useMemo(() => {
    let totalUsedWidth = 0;
    items.forEach((item) => {
      const product = PRODUCT_CATALOG[item.sku as keyof typeof PRODUCT_CATALOG];
      // Añadimos un fallback por si el producto no existe en el catálogo
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
  }, [items, coil]);

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];

    if (field === "sku") {
      // Verificamos si el SKU seleccionado ya existe en otra fila por seguridad
      const alreadyExists = newItems.some(
        (item, i) => item.sku === value && i !== index,
      );
      if (alreadyExists) {
        alert(
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
    // Buscamos un producto que NO esté actualmente en la lista para usarlo por defecto
    const availableSkus = Object.keys(PRODUCT_CATALOG).filter(
      (sku) => !items.some((item) => item.sku === sku),
    );

    if (availableSkus.length === 0) {
      alert(
        "Ya has agregado todos los productos del catálogo al plan de corte.",
      );
      return;
    }

    // Agregamos una nueva fila con el primer producto disponible
    setItems([...items, { sku: availableSkus[0], stripCount: 1 }]);
  };

  const handleSubmit = async () => {
    if (!calculations.isWidthValid) return;
    setIsSubmitting(true);

    try {
      // Convertimos 'stripCount' a 'quantity' para que el servicio lo entienda
      const formattedItems = items.map((item) => ({
        sku: item.sku,
        quantity: Number(item.stripCount),
      }));

      // Enviamos los datos formateados
      await saveCuttingPlan(coil.id, formattedItems);

      alert("✅ Plan de corte registrado. La bobina ahora está EN PROCESO.");
      onClose();
    } catch (error: any) {
      alert(error.message || "Error al guardar el plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 space-y-6">
        <div className="bg-gray-50 p-4 rounded-xl border">
          <h3 className="text-lg font-black text-blue-900">
            Paso 1: Slitter - {coil.id}
          </h3>
          <p className="text-sm text-gray-500">
            Configura las cuchillas para esta bobina ({coil.masterWidth} mm
            disponibles).
          </p>
        </div>

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
                  className="w-full p-2 border rounded-md"
                  value={item.sku}
                  onChange={(e) => updateItem(index, "sku", e.target.value)}
                >
                  {Object.entries(PRODUCT_CATALOG).map(([sku, prod]) => {
                    // Comprobamos si este SKU ya está usado en OTRA fila
                    const isUsedByOtherRow = items.some(
                      (i, idx) => i.sku === sku && idx !== index,
                    );

                    return (
                      <option
                        key={sku}
                        value={sku}
                        disabled={isUsedByOtherRow}
                        className={isUsedByOtherRow ? "text-gray-400" : ""}
                      >
                        {sku} ({prod.stripWidth}mm){" "}
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
                  className="w-full p-2 border rounded-md"
                  value={item.stripCount || ""}
                  onChange={(e) =>
                    updateItem(index, "stripCount", e.target.value)
                  }
                />
              </div>
              {items.length > 1 && (
                <button
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                  className="p-2.5 text-red-500 hover:bg-red-50 rounded-md mb-0.5"
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
              {calculations.totalUsedWidth} mm / {coil.masterWidth || 1192} mm
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
          <CheckCircle2 size={20} /> Guardar Configuración de Flejes
        </button>
      </div>
    </div>
  );
}
