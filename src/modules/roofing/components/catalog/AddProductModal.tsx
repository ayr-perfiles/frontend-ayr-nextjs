"use client";

import { useEffect } from "react";
import { X, Save, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { generateSKU } from "@/modules/roofing/domain/skuGenerator";
import {
  generateDisplayName,
  createProduct,
} from "@/modules/roofing/services/catalogService";
import {
  addProductFormSchema,
  type AddProductFormState,
} from "@/modules/roofing/schemas/catalog";
import type { RoofingProductInput } from "@/modules/roofing/schemas/catalog";
import { useForm } from "@/core/hooks/useForm";

const MATERIAL_OPTIONS = ["UPVC", "ACERO_GALV", "POLICARBONATO"] as const;
const COLOR_SUGGESTIONS = ["ROJO", "AZUL", "VERDE", "BLANCO", "GRIS", "AMARILLO"];

interface AddProductModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddProductModal({ onClose, onSuccess }: AddProductModalProps) {
  const initialValues: AddProductFormState = {
    material: "UPVC",
    color: "ROJO",
    thickness: "1.5",
    width: "1.075",
    length: "6",
    weight: "",
    sku: "",
    displayName: "",
  };

  const { values: form, setValues: setForm, errors, setErrors, validate, isSubmitting, setIsSubmitting } =
    useForm<AddProductFormState>(addProductFormSchema, initialValues);

  function set(key: keyof AddProductFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function buildPreview() {
    const thickness = parseFloat(form.thickness);
    const width = parseFloat(form.width);
    const length = parseFloat(form.length);
    if (!form.material || isNaN(thickness) || isNaN(width) || isNaN(length)) return null;

    let sku = "";
    try {
      sku = generateSKU({ material: form.material, length, color: form.color || "ROJO" });
    } catch {
      sku = "";
    }

    const displayName = generateDisplayName({
      family: "TC5",
      material: form.material,
      color: form.color,
      thickness,
      width,
      length,
    });

    return { sku, displayName };
  }

  function applyPreview() {
    const preview = buildPreview();
    if (!preview) return;
    setForm((prev) => ({ ...prev, sku: preview.sku, displayName: preview.displayName }));
  }

  // Auto-update preview when spec fields change
  useEffect(() => {
    applyPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.material, form.color, form.thickness, form.width, form.length]);

  async function handleSubmit() {
    if (!validate()) return;

    const input: RoofingProductInput = {
      material: form.material,
      color: form.color || undefined,
      thickness: parseFloat(form.thickness),
      width: parseFloat(form.width),
      length: parseFloat(form.length),
      unit: "PIEZA",
      ...(form.sku ? { sku: form.sku } : {}),
      ...(form.displayName ? { displayName: form.displayName } : {}),
      ...(form.weight ? { weight: parseFloat(form.weight) } : {}),
    };

    setIsSubmitting(true);
    try {
      await createProduct(input);
      toast.success("Producto creado exitosamente");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear producto");
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Nuevo Producto PVC</h2>
            <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest">
              Catálogo Coberturas
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Material + Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Material
              </label>
              <select
                value={form.material}
                onChange={(e) =>
                  set("material", e.target.value as (typeof MATERIAL_OPTIONS)[number])
                }
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-emerald-500"
              >
                {MATERIAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {errors.material && (
                <p className="text-red-500 text-xs mt-1">{errors.material}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Color
              </label>
              <input
                list="add-color-suggestions"
                value={form.color}
                onChange={(e) => set("color", e.target.value.toUpperCase())}
                className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-emerald-500 ${errors.color ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
                placeholder="ROJO"
              />
              <datalist id="add-color-suggestions">
                {COLOR_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {errors.color && (
                <p className="text-red-500 text-xs mt-1">{errors.color}</p>
              )}
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Dimensiones
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">
                  Espesor (mm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.thickness}
                  onChange={(e) => set("thickness", e.target.value)}
                  className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-emerald-500 ${errors.thickness ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
                />
                {errors.thickness && (
                  <p className="text-red-500 text-xs mt-1">{errors.thickness}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">
                  Ancho (m)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.width}
                  onChange={(e) => set("width", e.target.value)}
                  className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-emerald-500 ${errors.width ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
                />
                {errors.width && (
                  <p className="text-red-500 text-xs mt-1">{errors.width}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">
                  Largo (m)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.length}
                  onChange={(e) => set("length", e.target.value)}
                  className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-emerald-500 ${errors.length ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
                />
                {errors.length && (
                  <p className="text-red-500 text-xs mt-1">{errors.length}</p>
                )}
              </div>
            </div>
          </div>

          {/* Weight optional */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
              Peso por unidad (kg){" "}
              <span className="normal-case font-normal">— opcional</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.weight}
              onChange={(e) => set("weight", e.target.value)}
              placeholder="Dejar vacío si no aplica"
              className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-emerald-500 ${errors.weight ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
            />
            {errors.weight && (
              <p className="text-red-500 text-xs mt-1">{errors.weight}</p>
            )}
          </div>

          {/* SKU & DisplayName preview */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-emerald-800 uppercase tracking-widest">
                Vista Previa
              </h3>
              <button
                type="button"
                onClick={applyPreview}
                className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 transition"
              >
                <RefreshCw size={12} /> Regenerar SKU
              </button>
            </div>

            <div>
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 block">
                SKU{" "}
                <span className="normal-case font-normal text-emerald-500">(editable)</span>
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value.toUpperCase())}
                placeholder="Auto-generado"
                className="w-full p-3 bg-white border border-emerald-300 rounded-xl font-black font-mono text-emerald-900 outline-none focus:border-emerald-600"
              />
              {errors.sku && (
                <p className="text-red-500 text-xs mt-1">{errors.sku}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 block">
                Nombre{" "}
                <span className="normal-case font-normal text-emerald-500">(editable)</span>
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="Auto-generado"
                className="w-full p-3 bg-white border border-emerald-300 rounded-xl font-bold text-emerald-900 outline-none focus:border-emerald-600"
              />
              {errors.displayName && (
                <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>
              )}
            </div>
          </div>

          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || hasErrors}
            className="w-full bg-emerald-600 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-emerald-700 transition active:scale-95 shadow-md shadow-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Save size={20} /> Crear Producto
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
