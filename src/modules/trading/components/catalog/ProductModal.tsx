"use client";

import { useEffect, useState } from "react";
import { X, Save, Lock, AlertTriangle } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import toast from "react-hot-toast";
import { generateDisplayName } from "../../domain/skuGenerator";
import {
  createProduct,
  updateProduct,
} from "../../services/catalogService";
import {
  addTradingProductFormSchema,
  type AddTradingProductFormState,
} from "../../schemas/catalog";
import type { TradingProductInput } from "../../schemas/catalog";
import type { TradingProduct, TradingCategory } from "../../types";
import { useForm } from "@/core/hooks/useForm";

const CATEGORY_OPTIONS: TradingCategory[] = ['POLICARBONATO', 'TUBO', 'AUTOPERFORANTE', 'ACCESORIO', 'OTRO'];
const UNIT_OPTIONS = ["PIEZA", "METRO", "ROLLO"] as const;

interface ProductModalProps {
  mode: "create" | "edit";
  product?: TradingProduct;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductModal({ mode, product, onClose, onSuccess }: ProductModalProps) {
  const isCreate = mode === "create";

  const initialValues: AddTradingProductFormState = isCreate || !product
    ? {
        sku: "",
        displayName: "",
        category: "POLICARBONATO",
        color: "",
        spec: "",
        unit: "PIEZA",
      }
    : {
        sku: product.sku,
        displayName: product.displayName,
        category: product.category,
        color: product.color ?? "",
        spec: product.spec ?? "",
        unit: product.unit,
      };

  const {
    values: form,
    setValues: setForm,
    errors,
    setErrors,
    validate,
    isSubmitting,
    setIsSubmitting,
  } = useForm<AddTradingProductFormState>(addTradingProductFormSchema, initialValues);

  const [stockQty, setStockQty] = useState<number>(0);
  const [stockLoading, setStockLoading] = useState(!isCreate);

  useEffect(() => {
    if (mode === "edit" && product) {
      getDoc(doc(db, "trading_stock", product.sku))
        .then((snap) => {
          if (snap.exists()) setStockQty((snap.data().quantity as number) ?? 0);
        })
        .catch(() => {})
        .finally(() => setStockLoading(false));
    }
  }, [mode, product]);

  function set(key: keyof AddTradingProductFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // Auto-refresh displayName when spec fields change, ONLY if it hasn't been manually edited or if creating
  useEffect(() => {
    if (isCreate || !product) {
       const newName = generateDisplayName({
        category: form.category as TradingCategory,
        color: form.color,
        spec: form.spec,
      });
      setForm((prev) => ({ ...prev, displayName: newName }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category, form.color, form.spec]);

  async function handleSubmit() {
    if (!validate()) return;

    const input: TradingProductInput = {
      sku: form.sku.toUpperCase(),
      displayName: form.displayName.toUpperCase(),
      category: form.category as TradingCategory,
      color: form.color?.toUpperCase() || undefined,
      spec: form.spec?.toUpperCase() || undefined,
      unit: form.unit as TradingProductInput["unit"],
      active: true,
      avgCost: product?.avgCost ?? 0,
    };

    setIsSubmitting(true);
    try {
      if (isCreate) {
        await createProduct(input);
        toast.success("Producto creado exitosamente");
      } else if (product) {
        await updateProduct(product.sku, input);
        toast.success("Producto actualizado");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Error al ${isCreate ? "crear" : "actualizar"} producto`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  const title = isCreate ? "Nuevo Producto Reventa" : "Editar Producto Reventa";
  const submitLabel = isCreate ? "Crear Producto" : "Guardar Cambios";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 bg-amber-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            <p className="text-amber-200 text-xs font-bold uppercase tracking-widest">
              {isCreate ? "Catálogo Compra-venta" : `SKU: ${product?.sku}`}
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* SKU block */}
          {isCreate ? (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                SKU <span className="normal-case font-normal">— manual</span>
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value.toUpperCase())}
                placeholder="Ej: POLI600"
                className={`w-full p-3 border rounded-xl font-black font-mono text-zinc-900 outline-none focus:border-amber-500 ${errors.sku ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
              />
              {errors.sku && <p className="text-red-500 text-xs mt-1">{errors.sku}</p>}
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Lock size={10} /> SKU <span className="normal-case font-normal">— no modificable</span>
              </label>
              <div className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl font-black font-mono text-gray-400 select-all">
                {product?.sku}
              </div>
            </div>
          )}

          {/* Stock warning */}
          {!isCreate && !stockLoading && stockQty > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-bold text-amber-800">Producto con stock activo</p>
                <p className="text-xs text-amber-700 font-medium mt-1">
                  Hay <span className="font-black">{stockQty} {stockQty === 1 ? "unidad" : "unidades"}</span> en inventario.
                </p>
              </div>
            </div>
          )}

          {/* Categoria + Unidad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Categoría
              </label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-amber-500"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Unidad
              </label>
              <select
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-amber-500"
              >
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Color + Especificación */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Color <span className="normal-case font-normal">— opcional</span>
              </label>
              <input
                type="text"
                value={form.color}
                onChange={(e) => set("color", e.target.value.toUpperCase())}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-amber-500"
                placeholder="Ej: GRIS"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Especificación <span className="normal-case font-normal">— opcional</span>
              </label>
              <input
                type="text"
                value={form.spec}
                onChange={(e) => set("spec", e.target.value.toUpperCase())}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-amber-500"
                placeholder="Ej: 2.5MM X 100MT"
              />
            </div>
          </div>

          {/* DisplayName */}
          <div>
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">
              Nombre <span className="normal-case font-normal text-zinc-500">(editable)</span>
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => set("displayName", e.target.value.toUpperCase())}
              placeholder="Auto-generado"
              className="w-full p-3 bg-white border border-zinc-200 rounded-xl font-bold text-zinc-900 outline-none focus:border-amber-500"
            />
            {errors.displayName && <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>}
          </div>

          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || hasErrors}
            className="w-full bg-amber-600 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-amber-700 transition active:scale-95 shadow-md shadow-amber-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Save size={20} /> {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
