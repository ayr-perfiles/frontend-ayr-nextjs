"use client";

"use client";

import { useState } from "react";
import { useFinishes } from "@/core/coils/hooks/useFinishes";
import { createFinish, updateFinish, migrateFinishDensityFactors, CoilFinish, formatFinishChip } from "@/core/coils/services/finishService";
import { Plus, Edit2, Tag, Check, X, Loader2, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { BusinessLine } from "@/types";

const PRODUCTION_LINES: BusinessLine[] = ['drywall', 'metallic-roofing'];
export default function FinishesPage() {
  const { finishes, loading, error } = useFinishes(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CoilFinish>({
    id: "",
    label: "",
    active: true,
    lines: [],
    densityFactor: undefined,
    tipo: undefined,
    color: undefined,
  });

  const handleSave = async () => {
    if (!formData.id || !formData.label) {
      toast.error("ID y Etiqueta son obligatorios");
      return;
    }
    if (!formData.tipo || !formData.color) {
      toast.error("Tipo y Color son obligatorios");
      return;
    }
    if (formData.lines.length !== 1) {
      toast.error("Debes seleccionar exactamente una línea de producción");
      return;
    }
    try {
      if (editingId) {
        await updateFinish(editingId, formData);
        toast.success("Acabado actualizado");
      } else {
        await createFinish(formData);
        toast.success("Acabado creado");
      }
      setIsAdding(false);
      setEditingId(null);
      window.location.reload(); // Simple refresh for now
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMigrate = async () => {
    try {
      await migrateFinishDensityFactors();
      toast.success("Factor de densidad migrado en ALUZINC y NATURAL");
      window.location.reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error en migración");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Acabados de Bobina</h1>
          <p className="text-gray-500 font-medium">Gestiona los tipos de material y sus compatibilidades</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMigrate}
            className="bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-200 transition font-black text-sm"
            title="Inyectar densityFactor en ALUZINC y NATURAL (idempotente)"
          >
            <Zap size={16} /> Migrar Factores
          </button>
          <button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
              setFormData({ id: "", label: "", active: true, lines: [], densityFactor: undefined, tipo: undefined, color: undefined });
            }}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition font-black shadow-md shadow-blue-200"
          >
            <Plus size={20} /> Nuevo Acabado
          </button>
        </div>
      </div>

      {(isAdding || editingId) && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
            <Tag size={18} className="text-blue-600" />
            {editingId ? "Editar Acabado" : "Nuevo Acabado"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">ID (Único, ej: GALV_Z120)</label>
              <input
                disabled={!!editingId}
                type="text"
                className="w-full p-2.5 border rounded-lg font-bold outline-none focus:border-blue-500 disabled:bg-gray-50"
                value={formData.id}
                onChange={e => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Etiqueta (Display)</label>
              <input
                type="text"
                className="w-full p-2.5 border rounded-lg font-bold outline-none focus:border-blue-500"
                value={formData.label}
                onChange={e => setFormData({ ...formData, label: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Tipo de Acabado</label>
              <select
                className="w-full p-2.5 border rounded-lg font-bold outline-none focus:border-blue-500 bg-white"
                value={formData.tipo || ""}
                onChange={e => setFormData({ ...formData, tipo: e.target.value as any })}
              >
                <option value="" disabled>Seleccione...</option>
                <option value="Natural">Natural</option>
                <option value="Prepintado">Prepintado</option>
                <option value="Galvanizado">Galvanizado</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Color</label>
              <select
                className="w-full p-2.5 border rounded-lg font-bold outline-none focus:border-blue-500 bg-white"
                value={formData.color || ""}
                onChange={e => setFormData({ ...formData, color: e.target.value as any })}
              >
                <option value="" disabled>Seleccione...</option>
                <option value="-">- (Ninguno)</option>
                <option value="Rojo">Rojo</option>
                <option value="Azul">Azul</option>
                <option value="Blanco">Blanco</option>
                <option value="Gris">Gris</option>
                <option value="Verde">Verde</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Línea de producción</label>
            <div className="flex flex-wrap gap-2">
              {PRODUCTION_LINES.map(line => (
                <button
                  key={line}
                  type="button"
                  onClick={() => {
                    setFormData(prev => {
                      let newDensity = prev.densityFactor;
                      if (newDensity === undefined) {
                        newDensity = line === 'drywall' ? 0.00785 : 0.008;
                      }
                      return { ...prev, lines: [line], densityFactor: newDensity };
                    });
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${formData.lines.includes(line) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {line}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Factor de densidad conformado (kg/mm²·m)</label>
            <input
              type="number"
              step="0.00001"
              min="0.001"
              max="0.02"
              className="w-full p-2.5 border rounded-lg font-bold outline-none focus:border-blue-500"
              placeholder="0.00785 / 0.008"
              value={formData.densityFactor ?? ""}
              onChange={e => setFormData({
                ...formData,
                densityFactor: e.target.value !== "" ? Number(e.target.value) : undefined,
              })}
            />
            <p className="text-[10px] text-gray-400 mt-1">Típico: 0.008 (aluzinc — natural o prepintado) · 0.00785 (galvanizado/drywall). Requerido para registrar producción conformado.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={e => setFormData({ ...formData, active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="active" className="text-sm font-bold text-gray-700">Activo (Disponible para nuevas bobinas)</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition">Cancelar</button>
            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white text-sm font-black rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-100">Guardar Acabado</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {finishes.map(f => (
            <div key={f.id} className={`bg-white p-5 rounded-xl border transition hover:shadow-md ${f.active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-black text-blue-900">{f.label}</h4>
                  <p className="text-[10px] font-mono text-gray-400">{f.id}</p>
                </div>
                <button
                  onClick={() => {
                    setEditingId(f.id);
                    setFormData(f);
                    setIsAdding(false);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {f.lines.map(l => (
                  <span key={l} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold uppercase tracking-tighter">
                    {l}
                  </span>
                ))}
                {formatFinishChip(f.tipo, f.color) && (
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold uppercase tracking-tighter border border-indigo-100">
                    {formatFinishChip(f.tipo, f.color)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                {f.active ? (
                  <span className="flex items-center gap-1 text-[10px] font-black text-green-600 uppercase">
                    <Check size={12} /> Activo
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-black text-gray-400 uppercase">
                    <X size={12} /> Inactivo
                  </span>
                )}
                {f.densityFactor != null && (
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    δ = {f.densityFactor}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
