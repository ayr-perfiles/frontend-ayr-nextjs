"use client";

import { useEffect } from "react";
import { X, Save, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { generateDisplayName } from "../../domain/skuGenerator";
import {
  createProduct,
  updateProduct,
} from "../../services/catalogService";
import {
  addServiceProductFormSchema,
  type AddServiceProductFormState,
} from "../../schemas/catalog";
import type { ServiceProductInput } from "../../schemas/catalog";
import type { ServiceProduct } from "../../types";
import { useForm } from "@/core/hooks/useForm";

interface ProductModalProps {
  mode: "create" | "edit";
  product?: ServiceProduct;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductModal({ mode, product, onClose, onSuccess }: ProductModalProps) {
  const isCreate = mode === "create";

  const initialValues: AddServiceProductFormState = isCreate || !product
    ? {
        sku: "",
        displayName: "",
        description: "",
        unit: "TONELADA",
        pricePerUnit: "",
      }
    : {
        sku: product.sku,
        displayName: product.displayName,
        description: product.description ?? "",
        unit: product.unit,
        pricePerUnit: product.pricePerUnit?.toString() ?? "",
      };

  const {
    values: form,
    setValues: setForm,
    errors,
    setErrors,
    validate,
    isSubmitting,
    setIsSubmitting,
  } = useForm<AddServiceProductFormState>(addServiceProductFormSchema, initialValues);

  function set(key: keyof AddServiceProductFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // Auto-refresh displayName when description changes, ONLY if creating
  useEffect(() => {
    if (isCreate) {
       const newName = generateDisplayName({
        description: form.description,
      });
      setForm((prev) => ({ ...prev, displayName: newName }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.description]);

  async function handleSubmit() {
    if (!validate()) return;

    const input: ServiceProductInput = {
      sku: form.sku.toUpperCase(),
      displayName: form.displayName.toUpperCase(),
      description: form.description?.toUpperCase() || undefined,
      unit: form.unit as ServiceProductInput["unit"],
      pricePerUnit: form.pricePerUnit ? parseFloat(form.pricePerUnit) : undefined,
      active: true,
    };

    setIsSubmitting(true);
    try {
      if (isCreate) {
        await createProduct(input);
        toast.success("Servicio creado exitosamente");
      } else if (product) {
        await updateProduct(product.sku, input);
        toast.success("Servicio actualizado");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Error al ${isCreate ? "crear" : "actualizar"} servicio`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasErrors = Object.keys(errors).length > 0;
  const title = isCreate ? "Nuevo Servicio" : "Editar Servicio";
  const submitLabel = isCreate ? "Crear Servicio" : "Guardar Cambios";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 bg-violet-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            <p className="text-violet-200 text-xs font-bold uppercase tracking-widest">
              {isCreate ? "Catálogo de Servicios" : `SKU: ${product?.sku}`}
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
                placeholder="Ej: CONFORMADO"
                className={`w-full p-3 border rounded-xl font-black font-mono text-zinc-900 outline-none focus:border-violet-500 ${errors.sku ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
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

          {/* Description */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
              Descripción <span className="normal-case font-normal">— opcional</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set("description", e.target.value.toUpperCase())}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-violet-500"
              placeholder="Ej: SERVICIO DE CONFORMADO"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Unidad
              </label>
              <select
                value={form.unit}
                disabled
                className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl font-bold outline-none cursor-not-allowed text-gray-500"
              >
                <option value="TONELADA">TONELADA</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Precio Sugerido <span className="normal-case font-normal">— opcional</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.pricePerUnit}
                onChange={(e) => set("pricePerUnit", e.target.value)}
                className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-violet-500 ${errors.pricePerUnit ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
                placeholder="0.00"
              />
              {errors.pricePerUnit && <p className="text-red-500 text-xs mt-1">{errors.pricePerUnit}</p>}
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
              className="w-full p-3 bg-white border border-zinc-200 rounded-xl font-bold text-zinc-900 outline-none focus:border-violet-500"
            />
            {errors.displayName && <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>}
          </div>

          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || hasErrors}
            className="w-full bg-violet-600 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-violet-700 transition active:scale-95 shadow-md shadow-violet-200 disabled:opacity-60 disabled:cursor-not-allowed"
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
