import { useState, useEffect } from "react";
import { SystemSettings } from "@/services/settingsService";
import {
  Save,
  Loader2,
  Search,
  Globe,
  Eye,
  EyeOff,
  ShieldAlert,
} from "lucide-react";

interface IntegrationsSettingsProps {
  initialSettings: SystemSettings | null;
  onSave: (settings: SystemSettings) => Promise<void>;
  isSaving: boolean;
}

export function IntegrationsSettings({
  initialSettings,
  onSave,
  isSaving,
}: IntegrationsSettingsProps) {
  const [formData, setFormData] = useState<Partial<SystemSettings>>({
    algoliaAppId: "",
    algoliaSearchKey: "",
    sunatApiToken: "",
  });

  const [showAlgoliaKey, setShowAlgoliaKey] = useState(false);
  const [showSunatToken, setShowSunatToken] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setFormData({
        algoliaAppId: initialSettings.algoliaAppId || "",
        algoliaSearchKey: initialSettings.algoliaSearchKey || "",
        sunatApiToken: initialSettings.sunatApiToken || "",
      });
    }
  }, [initialSettings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Combinamos con initialSettings para no borrar los datos generales
    onSave({ ...initialSettings, ...formData } as SystemSettings);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex items-start gap-3">
        <ShieldAlert
          className="text-orange-500 mt-0.5 flex-shrink-0"
          size={20}
        />
        <div>
          <h4 className="font-bold text-orange-900 text-sm">
            Zona de Seguridad
          </h4>
          <p className="text-xs text-orange-700 mt-1 font-medium">
            Los tokens guardados aquí sobrescribirán las variables de entorno
            locales (<code className="bg-orange-100 px-1 rounded">.env</code>).
            Asegúrate de copiar las credenciales exactas para evitar que el
            sistema deje de funcionar.
          </p>
        </div>
      </div>

      {/* SECCIÓN 1: ALGOLIA SEARCH */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4">
          <Search size={20} className="text-blue-500" /> Buscador Predictivo
          (Algolia)
        </h2>
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Application ID
            </label>
            <input
              type="text"
              name="algoliaAppId"
              value={formData.algoliaAppId}
              onChange={handleChange}
              placeholder="Ej: 8XYZ..."
              className="w-full md:w-1/2 p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold font-mono text-gray-800 outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Search-Only API Key
            </label>
            <div className="relative w-full md:w-2/3">
              <input
                type={showAlgoliaKey ? "text" : "password"}
                name="algoliaSearchKey"
                value={formData.algoliaSearchKey}
                onChange={handleChange}
                placeholder="Ingresa la clave de búsqueda..."
                className="w-full p-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl font-bold font-mono text-gray-800 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowAlgoliaKey(!showAlgoliaKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                {showAlgoliaKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 font-medium">
              Usa ÚNICAMENTE la clave de búsqueda pública (Search-Only), nunca
              la clave de administrador.
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: SUNAT / RENIEC */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4">
          <Globe size={20} className="text-emerald-500" /> API de SUNAT / RENIEC
        </h2>
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Bearer Token de Acceso
            </label>
            <div className="relative w-full md:w-2/3">
              <input
                type={showSunatToken ? "text" : "password"}
                name="sunatApiToken"
                value={formData.sunatApiToken}
                onChange={handleChange}
                placeholder="apis-token-xxxx.xxxx..."
                className="w-full p-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl font-bold font-mono text-gray-800 outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowSunatToken(!showSunatToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
              >
                {showSunatToken ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 font-medium">
              Token privado para consultar datos corporativos y personales en el
              CRM (Ej: apis.net.pe).
            </p>
          </div>
        </div>
      </div>

      {/* BOTÓN DE GUARDAR */}
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
          {isSaving ? "Guardando..." : "Guardar Integraciones"}
        </button>
      </div>
    </form>
  );
}
