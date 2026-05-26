"use client";

import { useState, useEffect } from "react";
import { X, Save, Lock, AlertTriangle } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import toast from "react-hot-toast";
import {
  generateDisplayName,
  updateProduct,
} from "@/modules/roofing/services/catalogService";
import { RoofingProductSchema } from "@/modules/roofing/schemas/catalog";
import type { RoofingProductInput } from "@/modules/roofing/schemas/catalog";
import type { RoofingProduct } from "@/modules/roofing/types";

const MATERIAL_OPTIONS = ["UPVC", "ACERO_GALV", "POLICARBONATO"] as const;
const COLOR_SUGGESTIONS = ["ROJO", "AZUL", "VERDE", "BLANCO", "GRIS", "AMARILLO"];

type FormState = {
  material: string;
  color: string;
  thickness: string;
  width: string;
  length: string;
  weight: string;
  displayName: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

interface EditProductModalProps {
  product: RoofingProduct;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditProductModal({
  product,
  onClose,
  onSuccess,
}: EditProductModalProps) {
  const [form, setForm] = useState<FormState>({
    material: product.material,
    color: product.color ?? "",
    thickness: product.thickness.toString(),
    width: product.width.toString(),
    length: product.length.toString(),
    weight: product.weight?.toString() ?? "",
    displayName: product.displayName,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [stockQty, setStockQty] = useState<number>(0);
  const [stockLoading, setStockLoading] = useState(true);

  // Fetch stock to show warning if needed
  useEffect(() => {
    getDoc(doc(db, "roofing_stock", product.sku))
      .then((snap) => {
        if (snap.exists()) {
          setStockQty((snap.data().quantity as number) ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setStockLoading(false));
  }, [product.sku]);

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  // Auto-refresh displayName when spec fields change
  useEffect(() => {
    const thickness = parseFloat(form.thickness);
    const width = parseFloat(form.width);
    const length = parseFloat(form.length);
    if (isNaN(thickness) || isNaN(width) || isNaN(length)) return;

    const newName = generateDisplayName({
      family: product.family ?? "TC5",
      material: form.material as RoofingProduct["material"],
      color: form.color,
      thickness,
      width,
      length,
    });
    setForm((prev) => ({ ...prev, displayName: newName }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.material, form.color, form.thickness, form.width, form.length]);

  async function handleSubmit() {
    const updates: Partial<RoofingProductInput> = {
      material: form.material as RoofingProductInput["material"],
      color: form.color || undefined,
      thickness: parseFloat(form.thickness),
      width: parseFloat(form.width),
      length: parseFloat(form.length),
      displayName: form.displayName || undefined,
      ...(form.weight ? { weight: parseFloat(form.weight) } : {}),
    };

    // Validate via schema (include required fields for the parser)
    const result = RoofingProductSchema.safeParse({ ...updates, unit: "PIEZA" as const });
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Editar Producto PVC</h2>
            <p className="text-emerald-200 text-xs font-bold uppercase tracking-widest">
              SKU: {product.sku}
            </p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* SKU locked */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Lock size={10} /> SKU{" "}
              <span className="normal-case font-normal">— no modificable</span>
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
                <p className="text-sm font-bold text-amber-800">
                  Producto con stock activo
                </p>
                <p className="text-xs text-amber-700 font-medium mt-1">
                  Hay{" "}
                  <span className="font-black">
                    {stockQty} {stockQty === 1 ? "unidad" : "unidades"}
                  </span>{" "}
                  en inventario. Los cambios de dimensiones afectarán reportes futuros.
                </p>
              </div>
            </div>
          )}

          {/* Material + Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Material
              </label>
              <select
                value={form.material}
                onChange={(e) => set("material", e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-emerald-500"
              >
                {MATERIAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Color
              </label>
              <input
                list="edit-color-suggestions"
                value={form.color}
                onChange={(e) => set("color", e.target.value.toUpperCase())}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-emerald-500"
              />
              <datalist id="edit-color-suggestions">
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
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-emerald-500"
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
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-emerald-500"
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
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-emerald-500"
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
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-emerald-500"
            />
          </div>

          {/* DisplayName editable */}
          <div>
            <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1 block">
              Nombre del producto{" "}
              <span className="normal-case font-normal text-emerald-500">(editable)</span>
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl font-bold text-emerald-900 outline-none focus:border-emerald-500"
            />
            {errors.displayName && (
              <p className="text-red-500 text-xs mt-1">{errors.displayName}</p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-emerald-600 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-emerald-700 transition active:scale-95 shadow-md shadow-emerald-200 disabled:opacity-60 disabled:cursor-not-allowed"
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
