"use client";

import { useEffect } from "react";
import { X, Save, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { generateSKU } from "@/modules/metallic-roofing/domain/skuGenerator";
import {
  generateDisplayName,
  createProduct,
} from "@/modules/metallic-roofing/services/catalogService";
import {
  addMetallicProductFormSchema,
  type AddMetallicProductFormState,
} from "@/modules/metallic-roofing/schemas/catalog";
import type { MetallicProductInput } from "@/modules/metallic-roofing/schemas/catalog";
import type { MetallicFamily } from "@/modules/metallic-roofing/types";
import { useForm } from "@/core/hooks/useForm";

const FAMILY_OPTIONS: MetallicFamily[] = ["COBERTURA", "PLANCHA", "BOBINA", "ACCESORIO"];
const FINISH_SUGGESTIONS = ["GALV", "ALUZINC", "NATURAL", "PREPINTADO"];
const COLOR_SUGGESTIONS = ["ROJO", "AZUL", "VERDE", "BLANCO", "GRIS", "AMARILLO"];
const UNIT_OPTIONS = ["PIEZA", "METRO", "KILOGRAMO", "TONELADA"] as const;

interface AddProductModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddProductModal({ onClose, onSuccess }: AddProductModalProps) {
  const initialValues: AddMetallicProductFormState = {
    family: "COBERTURA",
    finish: "GALV",
    color: "",
    thickness: "0.35",
    width: "",
    length: "",
    unit: "PIEZA",
    sku: "",
    displayName: "",
  };

  const { values: form, setValues: setForm, errors, setErrors, validate, isSubmitting, setIsSubmitting } =
    useForm<AddMetallicProductFormState>(addMetallicProductFormSchema, initialValues);

  function set(key: keyof AddMetallicProductFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function buildPreview() {
    const thickness = parseFloat(form.thickness);
    if (!form.family || !form.finish || isNaN(thickness)) return null;

    let sku = "";
    try {
      sku = generateSKU({
        family: form.family as MetallicFamily,
        finish: form.finish,
        thickness,
        color: form.color || undefined,
        length: form.length ? parseFloat(form.length) : undefined,
      });
    } catch {
      sku = "";
    }

    const displayName = generateDisplayName({
      family: form.family as MetallicFamily,
      finish: form.finish,
      color: form.color || undefined,
      thickness,
      width: form.width ? parseFloat(form.width) : undefined,
      length: form.length ? parseFloat(form.length) : undefined,
    });

    return { sku, displayName };
  }

  function applyPreview() {
    const preview = buildPreview();
    if (!preview) return;
    setForm((prev) => ({ ...prev, sku: preview.sku, displayName: preview.displayName }));
  }

  useEffect(() => {
    applyPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.family, form.finish, form.color, form.thickness, form.width, form.length]);

  async function handleSubmit() {
    if (!validate()) return;

    const input: MetallicProductInput = {
      family: form.family as MetallicFamily,
      finish: form.finish,
      color: form.color || undefined,
      thickness: parseFloat(form.thickness),
      unit: form.unit as MetallicProductInput["unit"],
      active: true,
      ...(form.width ? { width: parseFloat(form.width) } : {}),
      ...(form.length ? { length: parseFloat(form.length) } : {}),
      ...(form.sku ? { sku: form.sku } : {}),
      ...(form.displayName ? { displayName: form.displayName } : {}),
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
  const isPlancha = form.family === "PLANCHA";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 bg-zinc-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Nuevo Producto Aluzinc</h2>
            <p className="text-zinc-300 text-xs font-bold uppercase tracking-widest">
              Catálogo Coberturas
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Familia + Acabado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Familia
              </label>
              <select
                value={form.family}
                onChange={(e) => set("family", e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-zinc-500"
              >
                {FAMILY_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              {errors.family && <p className="text-red-500 text-xs mt-1">{errors.family}</p>}
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Acabado
              </label>
              <input
                list="add-finish-suggestions"
                value={form.finish}
                onChange={(e) => set("finish", e.target.value.toUpperCase())}
                className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-zinc-500 ${errors.finish ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
                placeholder="GALV"
              />
              <datalist id="add-finish-suggestions">
                {FINISH_SUGGESTIONS.map((f) => <option key={f} value={f} />)}
              </datalist>
              {errors.finish && <p className="text-red-500 text-xs mt-1">{errors.finish}</p>}
            </div>
          </div>

          {/* Color + Unidad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Color <span className="normal-case font-normal">— opcional</span>
              </label>
              <input
                list="add-color-suggestions"
                value={form.color}
                onChange={(e) => set("color", e.target.value.toUpperCase())}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-zinc-500"
                placeholder="ROJO"
              />
              <datalist id="add-color-suggestions">
                {COLOR_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Unidad
              </label>
              <select
                value={form.unit}
                onChange={(e) => set("unit", e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-zinc-500"
              >
                {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Dimensiones */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              Dimensiones
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">Espesor (mm)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.thickness}
                  onChange={(e) => set("thickness", e.target.value)}
                  className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-zinc-500 ${errors.thickness ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
                />
                {errors.thickness && <p className="text-red-500 text-xs mt-1">{errors.thickness}</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">
                  Ancho (m) <span className="text-gray-300">opt.</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.width}
                  onChange={(e) => set("width", e.target.value)}
                  className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-zinc-500 ${errors.width ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
                  placeholder="—"
                />
                {errors.width && <p className="text-red-500 text-xs mt-1">{errors.width}</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">
                  Largo (m){isPlancha && <span className="text-red-500"> *</span>}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.length}
                  onChange={(e) => set("length", e.target.value)}
                  className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-zinc-500 ${errors.length ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"}`}
                  placeholder={isPlancha ? "req." : "—"}
                />
                {errors.length && <p className="text-red-500 text-xs mt-1">{errors.length}</p>}
              </div>
            </div>
          </div>

          {/* SKU + DisplayName preview */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-zinc-800 uppercase tracking-widest">Vista Previa</h3>
              <button
                type="button"
                onClick={applyPreview}
                className="flex items-center gap-1 text-xs font-bold text-zinc-700 hover:text-zinc-900 transition"
              >
                <RefreshCw size={12} /> Regenerar SKU
              </button>
            </div>

            <div>
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">
                SKU <span className="normal-case font-normal text-zinc-500">(editable)</span>
              </label>
              <input
                type="text"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value.toUpperCase())}
                placeholder="Auto-generado"
                className="w-full p-3 bg-white border border-zinc-300 rounded-xl font-black font-mono text-zinc-900 outline-none focus:border-zinc-600"
              />
              {errors.sku && <p className="text-red-500 text-xs mt-1">{errors.sku}</p>}
            </div>

            <div>
              <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">
                Nombre <span className="normal-case font-normal text-zinc-500">(editable)</span>
              </label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="Auto-generado"
                className="w-full p-3 bg-white border border-zinc-300 rounded-xl font-bold text-zinc-900 outline-none focus:border-zinc-600"
              />
              {errors.displayName && <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>}
            </div>
          </div>

          <button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || hasErrors}
            className="w-full bg-zinc-700 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-zinc-800 transition active:scale-95 shadow-md shadow-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed"
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
