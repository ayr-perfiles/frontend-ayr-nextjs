"use client";

import { useEffect, useState } from "react";
import { X, Save, RefreshCw, Lock, AlertTriangle, Cpu, Pencil } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import toast from "react-hot-toast";
import { generateSKU } from "@/modules/metallic-roofing/domain/skuGenerator";
import {
  generateDisplayName,
  createProduct,
  updateProduct,
} from "@/modules/metallic-roofing/services/catalogService";
import {
  addMetallicProductFormSchema,
  type AddMetallicProductFormState,
} from "@/modules/metallic-roofing/schemas/catalog";
import type { MetallicProductInput } from "@/modules/metallic-roofing/schemas/catalog";
import type { MetallicProduct, MetallicFamily } from "@/modules/metallic-roofing/types";
import { useForm } from "@/core/hooks/useForm";
import { useFinishes } from "@/core/coils/hooks/useFinishes";

const FAMILY_OPTIONS: MetallicFamily[] = ["COBERTURA", "PLANCHA"];
const UNIT_OPTIONS = ["PIEZA", "METRO", "KILOGRAMO", "TONELADA"] as const;

interface ProductModalProps {
  mode: "create" | "edit";
  product?: MetallicProduct;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductModal({ mode, product, onClose, onSuccess }: ProductModalProps) {
  const isCreate = mode === "create";

  const { finishes, loading: finishesLoading } = useFinishes(true);
  const metallicFinishIds = finishes.filter(f => f.active && f.lines.includes("metallic-roofing")).map(f => f.id);

  const isLegacyFamily = !isCreate && product?.family && !FAMILY_OPTIONS.includes(product.family as any);
  const isLegacyFinish = !isCreate && product?.finish && !finishesLoading && !metallicFinishIds.includes(product.finish);

  const initialValues: AddMetallicProductFormState = isCreate || !product
    ? {
        family: "COBERTURA",
        finish: "",
        thickness: "0.35",
        width: "",
        length: "",
        unit: "PIEZA",
        sku: "",
        displayName: "",
        widthMm: "",
      }
    : {
        family: product.family,
        finish: product.finish,
        thickness: product.thickness.toString(),
        width: product.width?.toString() ?? "",
        length: product.length?.toString() ?? "",
        unit: product.unit,
        sku: product.sku,
        displayName: product.displayName,
        widthMm: product.widthMm?.toString() ?? "",
      };

  const {
    values: form,
    setValues: setForm,
    errors,
    setErrors,
    validate,
    isSubmitting,
    setIsSubmitting,
  } = useForm<AddMetallicProductFormState>(addMetallicProductFormSchema, initialValues);

  const [stockQty, setStockQty] = useState<number>(0);
  const [stockLoading, setStockLoading] = useState(!isCreate);

  useEffect(() => {
    if (mode === "edit" && product) {
      getDoc(doc(db, "metallic_roofing_stock", product.sku))
        .then((snap) => {
          if (snap.exists()) setStockQty((snap.data().quantity as number) ?? 0);
        })
        .catch(() => {})
        .finally(() => setStockLoading(false));
    }
  }, [mode, product]);

  // densityFactor resolves from the finish catalog — not stored on the SKU
  const selectedFinishFactor = finishes.find((f) => f.id === form.finish)?.densityFactor ?? null;

  function set(key: keyof AddMetallicProductFormState, value: string) {
    let next = { ...form, [key]: value };

    // Auto-fill widthMm from width (round to mm)
    if (key === "width" && value) {
      const wm = Math.round(parseFloat(value) * 1000);
      if (!isNaN(wm) && wm > 0) next = { ...next, widthMm: String(wm) };
    }

    setForm(next);

    // Re-validate all fields if there are already errors (keeps button enabled when fixed)
    if (Object.keys(errors).length > 0) {
      const res = addMetallicProductFormSchema.safeParse(next);
      if (res.success) {
        setErrors({});
      } else {
        const errs: Partial<Record<keyof AddMetallicProductFormState, string>> = {};
        res.error.issues.forEach((e) => {
          errs[e.path[0] as keyof AddMetallicProductFormState] = e.message;
        });
        setErrors(errs);
      }
    } else {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  }

  function buildPreview() {
    const thickness = parseFloat(form.thickness);
    if (!form.family || !form.finish || isNaN(thickness)) return null;

    let sku = "";
    if (isCreate) {
      try {
        sku = generateSKU({
          family: form.family as MetallicFamily,
          finish: form.finish,
          thickness,

          length: form.length ? parseFloat(form.length) : undefined,
        });
      } catch {
        sku = "";
      }
    } else {
      sku = form.sku;
    }

    const displayName = generateDisplayName({
      family: form.family as MetallicFamily,
      finish: form.finish,

      thickness,
      width: form.width ? parseFloat(form.width) : undefined,
      length: form.length ? parseFloat(form.length) : undefined,
    });

    return { sku, displayName };
  }

  function applyPreview() {
    const preview = buildPreview();
    if (!preview) return;
    setForm((prev) => ({
      ...prev,
      sku: isCreate ? preview.sku : prev.sku,
      displayName: preview.displayName,
    }));
  }

  useEffect(() => {
    applyPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.family, form.finish, form.thickness, form.width, form.length]);

  async function handleSubmit() {
    if (!validate()) return;

    const input: MetallicProductInput = {
      family: form.family as MetallicFamily,
      finish: form.finish,

      thickness: parseFloat(form.thickness),
      unit: form.unit as MetallicProductInput["unit"],
      active: true,
      ...(form.width ? { width: parseFloat(form.width) } : {}),
      ...(form.length ? { length: parseFloat(form.length) } : {}),
      ...(form.sku ? { sku: form.sku } : {}),
      ...(form.displayName ? { displayName: form.displayName } : {}),
      ...(form.widthMm ? { widthMm: parseFloat(form.widthMm), metaSource: "manual" as const } : {}),
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
  const isPlancha = form.family === "PLANCHA";
  const showMetaSection = form.family === "COBERTURA" || form.family === "PLANCHA";
  const metaSource = !isCreate && product?.metaSource;
  const title = isCreate ? "Nuevo Producto Aluzinc" : "Editar Producto Aluzinc";
  const submitLabel = isCreate ? "Crear Producto" : "Guardar Cambios";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 bg-zinc-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">{title}</h2>
            <p className="text-zinc-300 text-xs font-bold uppercase tracking-widest">
              {isCreate ? "Catálogo Coberturas" : `SKU: ${product?.sku}`}
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* SKU block */}
          {isCreate ? (
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
                  Hay <span className="font-black">{stockQty} {stockQty === 1 ? "unidad" : "unidades"}</span> en inventario. Los cambios afectarán reportes futuros.
                </p>
              </div>
            </div>
          )}

          {/* Legacy Warning */}
          {!isCreate && (isLegacyFamily || isLegacyFinish) && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3">
              <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-bold text-amber-800">Este producto tiene datos obsoletos</p>
                <p className="text-xs text-amber-700 font-medium mt-1">
                  Revisa los campos marcados como <strong>(obsoleto/heredado)</strong> y selecciona una opción válida actual antes de guardar.
                </p>
              </div>
            </div>
          )}

          {/* Familia + Acabado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Familia
              </label>
              <select
                value={form.family}
                onChange={(e) => set("family", e.target.value)}
                className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-zinc-500 ${errors.family ? "bg-red-50 border-red-300" : isLegacyFamily && form.family === product?.family ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-gray-50 border-gray-200"}`}
              >
                {isLegacyFamily && <option value={product.family}>{product.family} (obsoleto)</option>}
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
              <select
                value={form.finish}
                onChange={(e) => set("finish", e.target.value)}
                className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-zinc-500 ${errors.finish ? "bg-red-50 border-red-300" : isLegacyFinish && form.finish === product?.finish ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-gray-50 border-gray-200"}`}
              >
                <option value="">— Seleccionar —</option>
                {isLegacyFinish && <option value={product.finish}>{product.finish} (heredado)</option>}
                {metallicFinishIds.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              {errors.finish && <p className="text-red-500 text-xs mt-1">{errors.finish}</p>}
            </div>
          </div>

          {/* Color + Unidad */}
          <div className="grid grid-cols-2 gap-4">
          {/* Color removed */}

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
                  Ancho útil (m) <span className="text-gray-300">opt.</span>
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

          {/* DisplayName */}
          <div>
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">
              Nombre <span className="normal-case font-normal text-zinc-500">(editable)</span>
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              placeholder="Auto-generado"
              className="w-full p-3 bg-white border border-zinc-200 rounded-xl font-bold text-zinc-900 outline-none focus:border-zinc-500"
            />
            {errors.displayName && <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>}
          </div>

          {/* Metadata Reporte — COBERTURA/PLANCHA en create y edit */}
          {showMetaSection && (
            <div className="border border-zinc-200 rounded-xl overflow-hidden">
              <div className="bg-zinc-50 px-4 py-2.5 flex items-center justify-between">
                <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">
                  Metadata Reporte (Peso/ML)
                </p>
                {metaSource && (
                  <span
                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      metaSource === "manual"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {metaSource === "manual" ? (
                      <><Pencil size={9} /> Manual</>
                    ) : (
                      <><Cpu size={9} /> Auto</>
                    )}
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">
                      Ancho bobina (mm)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={form.widthMm}
                      onChange={(e) => set("widthMm", e.target.value)}
                      placeholder="1200"
                      className={`w-full p-3 border rounded-xl font-bold outline-none focus:border-zinc-500 ${
                        errors.widthMm ? "bg-red-50 border-red-300" : "bg-gray-50 border-gray-200"
                      }`}
                    />
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      Auto: round(ancho útil × 1000). Ajustar si difiere.
                    </p>
                    {errors.widthMm && <p className="text-red-500 text-xs mt-1">{errors.widthMm}</p>}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">
                      Densidad (del acabado)
                    </label>
                    {selectedFinishFactor !== null ? (
                      <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl font-black text-blue-800 text-sm">
                        {selectedFinishFactor}
                        <span className="text-[10px] font-bold text-blue-500 ml-1">
                          ({form.finish})
                        </span>
                      </div>
                    ) : (
                      <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                        <p className="text-[10px] font-bold text-amber-700">
                          Acabado &quot;{form.finish}&quot; sin densidad configurada — producción bloqueará.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400 font-medium">
                  La densidad se hereda del acabado (coil_finishes). Para cambiarla, edita el acabado en Ajustes → Acabados.
                </p>
              </div>
            </div>
          )}

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
                <Save size={20} /> {submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
