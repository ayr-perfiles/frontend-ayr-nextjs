"use client";

import { useState, useEffect } from "react";
import { X, Save, Lock, AlertTriangle } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import toast from "react-hot-toast";
import {
  generateDisplayName,
  updateProduct,
} from "@/modules/metallic-roofing/services/catalogService";
import { MetallicProductSchema } from "@/modules/metallic-roofing/schemas/catalog";
import type { MetallicProductInput } from "@/modules/metallic-roofing/schemas/catalog";
import type { MetallicProduct, MetallicFamily } from "@/modules/metallic-roofing/types";

const FAMILY_OPTIONS: MetallicFamily[] = ["COBERTURA", "PLANCHA", "BOBINA", "ACCESORIO"];
const FINISH_SUGGESTIONS = ["GALV", "ALUZINC", "NATURAL", "PREPINTADO"];
const COLOR_SUGGESTIONS = ["ROJO", "AZUL", "VERDE", "BLANCO", "GRIS", "AMARILLO"];
const UNIT_OPTIONS = ["PIEZA", "METRO", "KILOGRAMO", "TONELADA"] as const;

type FormState = {
  family: string;
  finish: string;
  color: string;
  thickness: string;
  width: string;
  length: string;
  unit: string;
  displayName: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

interface EditProductModalProps {
  product: MetallicProduct;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditProductModal({ product, onClose, onSuccess }: EditProductModalProps) {
  const [form, setForm] = useState<FormState>({
    family: product.family,
    finish: product.finish,
    color: product.color ?? "",
    thickness: product.thickness.toString(),
    width: product.width?.toString() ?? "",
    length: product.length?.toString() ?? "",
    unit: product.unit,
    displayName: product.displayName,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [stockQty, setStockQty] = useState<number>(0);
  const [stockLoading, setStockLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "metallic_roofing_stock", product.sku))
      .then((snap) => {
        if (snap.exists()) setStockQty((snap.data().quantity as number) ?? 0);
      })
      .catch(() => {})
      .finally(() => setStockLoading(false));
  }, [product.sku]);

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  useEffect(() => {
    const thickness = parseFloat(form.thickness);
    if (isNaN(thickness)) return;

    const newName = generateDisplayName({
      family: form.family as MetallicFamily,
      finish: form.finish,
      color: form.color || undefined,
      thickness,
      width: form.width ? parseFloat(form.width) : undefined,
      length: form.length ? parseFloat(form.length) : undefined,
    });
    setForm((prev) => ({ ...prev, displayName: newName }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.family, form.finish, form.color, form.thickness, form.width, form.length]);

  async function handleSubmit() {
    const updates: Partial<MetallicProductInput> = {
      family: form.family as MetallicFamily,
      finish: form.finish,
      color: form.color || undefined,
      thickness: parseFloat(form.thickness),
      unit: form.unit as MetallicProductInput["unit"],
      displayName: form.displayName || undefined,
      ...(form.width ? { width: parseFloat(form.width) } : {}),
      ...(form.length ? { length: parseFloat(form.length) } : {}),
    };

    const result = MetallicProductSchema.safeParse({ ...updates });
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormState;
        if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      await updateProduct(product.sku, updates);
      toast.success("Producto actualizado");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar producto");
    } finally {
      setSaving(false);
    }
  }

  const isPlancha = form.family === "PLANCHA";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 bg-zinc-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Editar Producto Aluzinc</h2>
            <p className="text-zinc-300 text-xs font-bold uppercase tracking-widest">
              SKU: {product.sku}
            </p>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* SKU locked */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Lock size={10} /> SKU <span className="normal-case font-normal">— no modificable</span>
            </label>
            <div className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl font-black font-mono text-gray-400 select-all">
              {product.sku}
            </div>
          </div>

          {/* Stock warning */}
          {!stockLoading && stockQty > 0 && (
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

          {/* Familia + Acabado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Familia</label>
              <select
                value={form.family}
                onChange={(e) => set("family", e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-zinc-500"
              >
                {FAMILY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Acabado</label>
              <input
                list="edit-finish-suggestions"
                value={form.finish}
                onChange={(e) => set("finish", e.target.value.toUpperCase())}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-zinc-500"
              />
              <datalist id="edit-finish-suggestions">
                {FINISH_SUGGESTIONS.map((f) => <option key={f} value={f} />)}
              </datalist>
              {errors.finish && <p className="text-red-500 text-xs mt-1">{errors.finish}</p>}
            </div>
          </div>

          {/* Color + Unidad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Color <span className="normal-case font-normal">— opcional</span></label>
              <input
                list="edit-color-suggestions"
                value={form.color}
                onChange={(e) => set("color", e.target.value.toUpperCase())}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-zinc-500"
                placeholder="—"
              />
              <datalist id="edit-color-suggestions">
                {COLOR_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Unidad</label>
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
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Dimensiones</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">Espesor (mm)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.thickness}
                  onChange={(e) => set("thickness", e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-zinc-500"
                />
                {errors.thickness && <p className="text-red-500 text-xs mt-1">{errors.thickness}</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">Ancho (m) <span className="text-gray-300">opt.</span></label>
                <input
                  type="number" step="0.001" min="0"
                  value={form.width}
                  onChange={(e) => set("width", e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-zinc-500"
                  placeholder="—"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">
                  Largo (m){isPlancha && <span className="text-red-500"> *</span>}
                </label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.length}
                  onChange={(e) => set("length", e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-zinc-500"
                  placeholder={isPlancha ? "req." : "—"}
                />
                {errors.length && <p className="text-red-500 text-xs mt-1">{errors.length}</p>}
              </div>
            </div>
          </div>

          {/* DisplayName editable */}
          <div>
            <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 block">
              Nombre del producto <span className="normal-case font-normal text-zinc-500">(editable)</span>
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              className="w-full p-3 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-zinc-900 outline-none focus:border-zinc-500"
            />
            {errors.displayName && <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>}
          </div>

          <button
            onClick={() => void handleSubmit()}
            disabled={saving}
            className="w-full bg-zinc-700 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-zinc-800 transition active:scale-95 shadow-md shadow-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Save size={20} /> Guardar Cambios
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
