import { useState, useEffect } from "react";
import { SystemSettings } from "@/services/settingsService";
import {
  Building2,
  Save,
  Receipt,
  Hash,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface GeneralSettingsProps {
  initialSettings: SystemSettings | null;
  onSave: (settings: SystemSettings) => Promise<void>;
  isSaving: boolean;
}

export function GeneralSettings({
  initialSettings,
  onSave,
  isSaving,
}: GeneralSettingsProps) {
  // Se agregan los campos faltantes para que coincida con la interfaz SystemSettings
  const [formData, setFormData] = useState<SystemSettings>({
    companyName: "",
    companyRuc: "",
    companyAddress: "",
    companyEmail: "",
    companyPhone: "",
    igvRate: 0.18,
    nextSaleNumber: 1,
    nextQuotationNumber: 1,
    minMarginPercent: 10,
    lowStockProduct: 100,
    algoliaAppId: "", // <-- Agregado para corregir error TS
    algoliaSearchKey: "", // <-- Agregado para corregir error TS
    sunatApiToken: "", // <-- Agregado para corregir error TS
  });

  useEffect(() => {
    if (initialSettings) {
      setFormData({
        ...initialSettings,
        nextSaleNumber: initialSettings.nextSaleNumber || 1,
        nextQuotationNumber: initialSettings.nextQuotationNumber || 1,
        minMarginPercent: initialSettings.minMarginPercent || 10,
        lowStockProduct: initialSettings.lowStockProduct || 100,
      });
    }
  }, [initialSettings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* SECCIÓN 1: DATOS DE LA EMPRESA */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4">
          <Building2 size={20} className="text-blue-500" /> Identidad de la
          Empresa
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Razón Social
            </label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              RUC
            </label>
            <input
              type="text"
              name="companyRuc"
              value={formData.companyRuc}
              onChange={handleChange}
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Dirección Fiscal
            </label>
            <input
              type="text"
              name="companyAddress"
              value={formData.companyAddress}
              onChange={handleChange}
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Correo de Ventas
            </label>
            <input
              type="email"
              name="companyEmail"
              value={formData.companyEmail}
              onChange={handleChange}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Teléfono Principal
            </label>
            <input
              type="text"
              name="companyPhone"
              value={formData.companyPhone}
              onChange={handleChange}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4">
            <Receipt size={20} className="text-emerald-500" /> Facturación
          </h2>
          <div className="flex-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Tasa de IGV (Decimal)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                name="igvRate"
                value={formData.igvRate}
                onChange={handleChange}
                required
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-emerald-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                Ej: 0.18
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4">
            <Hash size={20} className="text-orange-500" /> Numeración
            Correlativa
          </h2>
          <div className="grid grid-cols-2 gap-4 flex-1">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Prox. Venta (V-)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                name="nextSaleNumber"
                value={formData.nextSaleNumber}
                onChange={handleChange}
                required
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black font-mono text-gray-800 outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Prox. Cotización (C-)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                name="nextQuotationNumber"
                value={formData.nextQuotationNumber}
                onChange={handleChange}
                required
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black font-mono text-gray-800 outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: PARÁMETROS LOGÍSTICOS */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4">
          <AlertTriangle size={20} className="text-red-500" /> Alertas de Margen
          y Stock
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Alerta de Margen Mínimo (%)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              name="minMarginPercent"
              value={formData.minMarginPercent}
              onChange={handleChange}
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-gray-800 outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Alerta de Stock Bajo (Unidades)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              name="lowStockProduct"
              value={formData.lowStockProduct}
              onChange={handleChange}
              required
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-black text-gray-800 outline-none focus:border-red-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="bg-gray-900 text-white px-8 py-3.5 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-black disabled:opacity-50 flex items-center gap-2 transition active:scale-95 shadow-lg shadow-gray-900/20"
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </form>
  );
}
