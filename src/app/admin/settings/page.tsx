"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  BookOpen,
  Users,
  Plug,
  AlertTriangle,
  DatabaseZap,
  Loader2,
} from "lucide-react";
import {
  getSystemSettings,
  updateSystemSettings,
  resetDatabaseDevOnly, // <-- Certifique-se de exportar esta função do seu settingsService
  SystemSettings,
} from "@/services/settingsService";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { CatalogSettings } from "@/components/settings/CatalogSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { UsersSettings } from "@/components/settings/UsersSettings";
import { useAuth } from "@/context/AuthContext"; // <-- Necessário para o log de auditoria
import toast from "react-hot-toast";

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "general" | "catalog" | "integrations" | "users" | "danger"
  >("general");

  const [settingsData, setSettingsData] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const data = await getSystemSettings();
      if (data) setSettingsData(data);
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  const handleSaveSettings = async (newSettings: SystemSettings) => {
    setIsSaving(true);
    try {
      await updateSystemSettings(newSettings);
      setSettingsData(newSettings);
      toast.success("Configuración guardada correctamente.");
    } catch (error) {
      toast.error("Ocurrió un error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSystemReset = async () => {
    const confirm1 = window.confirm(
      "⚠️ ADVERTENCIA EXTREMA\n\nEstás a punto de ELIMINAR TODAS las Bobinas, Stocks, Producciones y Ventas.\n\n¿Estás completamente seguro?",
    );
    if (!confirm1) return;

    const confirm2 = window.prompt(
      "Para confirmar la eliminación, escribe la palabra: ELIMINAR",
    );
    if (confirm2 !== "ELIMINAR") {
      toast.error("Operación cancelada. La palabra no coincide.");
      return;
    }

    setIsResetting(true);
    try {
      await resetDatabaseDevOnly(user?.email || "Admin");
      toast.success("💥 Base de datos limpiada con éxito.");
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsResetting(false);
    }
  };

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800 tracking-tight">
          <Settings className="text-blue-600" /> Configuración del Sistema
        </h1>
        <p className="text-gray-500 text-sm font-medium mt-1">
          Administra la identidad corporativa, impuestos, integraciones y
          catálogos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-3 space-y-2">
          {/* Botões de navegação existentes */}
          <button
            onClick={() => setActiveTab("general")}
            className={`w-full text-left p-4 rounded-xl font-bold flex items-center gap-3 transition ${activeTab === "general" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            <Settings size={18} /> General y Operaciones
          </button>

          <button
            onClick={() => setActiveTab("catalog")}
            className={`w-full text-left p-4 rounded-xl font-bold flex items-center gap-3 transition ${activeTab === "catalog" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            <BookOpen size={18} /> Catálogo de Perfiles
          </button>

          <button
            onClick={() => setActiveTab("integrations")}
            className={`w-full text-left p-4 rounded-xl font-bold flex items-center gap-3 transition ${activeTab === "integrations" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            <Plug size={18} /> Integraciones API
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`w-full text-left p-4 rounded-xl font-bold flex items-center gap-3 transition ${activeTab === "users" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            <Users size={18} /> Usuarios y Roles
          </button>

          {/* NOVO: Aba de Manutenção (Apenas em Dev) */}
          {isDev && (
            <button
              onClick={() => setActiveTab("danger")}
              className={`w-full text-left p-4 rounded-xl font-bold flex items-center gap-3 transition ${activeTab === "danger" ? "bg-red-600 text-white shadow-lg shadow-red-200" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
            >
              <AlertTriangle size={18} /> Zona de Peligro
            </button>
          )}
        </div>

        <div className="md:col-span-9">
          {isLoading ? (
            <div className="bg-white p-12 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-gray-400">
              <span className="animate-spin text-blue-500 mb-4">
                <Settings size={32} />
              </span>
              <p className="font-bold">Cargando configuración...</p>
            </div>
          ) : (
            <>
              {activeTab === "general" && (
                <GeneralSettings
                  initialSettings={settingsData}
                  onSave={handleSaveSettings}
                  isSaving={isSaving}
                />
              )}

              {activeTab === "catalog" && <CatalogSettings />}

              {activeTab === "integrations" && (
                <IntegrationsSettings
                  initialSettings={settingsData}
                  onSave={handleSaveSettings}
                  isSaving={isSaving}
                />
              )}

              {activeTab === "users" && <UsersSettings />}

              {/* Conteúdo da Zona de Peligro */}
              {activeTab === "danger" && isDev && (
                <div className="bg-white p-8 rounded-2xl border-2 border-red-100 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-red-100 p-3 rounded-xl">
                      <AlertTriangle className="text-red-600" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">
                        Herramientas de Desarrollador
                      </h2>
                      <p className="text-sm text-gray-500 font-medium">
                        Limpieza profunda de base de datos para pruebas.
                      </p>
                    </div>
                  </div>

                  <div className="p-6 bg-red-50 rounded-2xl border border-red-100 mb-8">
                    <p className="text-red-800 text-sm leading-relaxed">
                      Esta acción eliminará permanentemente todas las
                      colecciones de:
                      <code className="mx-1 bg-red-100 px-1 rounded font-bold">
                        coils
                      </code>
                      ,
                      <code className="mx-1 bg-red-100 px-1 rounded font-bold">
                        inventory_stock
                      </code>
                      ,
                      <code className="mx-1 bg-red-100 px-1 rounded font-bold">
                        production_logs
                      </code>
                      ,
                      <code className="mx-1 bg-red-100 px-1 rounded font-bold">
                        sales
                      </code>{" "}
                      y
                      <code className="mx-1 bg-red-100 px-1 rounded font-bold">
                        audit_logs
                      </code>
                      .
                    </p>
                    <p className="mt-4 text-xs font-black text-red-600 uppercase tracking-widest">
                      LOS USUARIOS, PRODUCTOS Y CONFIGURACIÓN SE MANTENDRÁN.
                    </p>
                  </div>

                  <button
                    onClick={handleSystemReset}
                    disabled={isResetting}
                    className="w-full md:w-auto bg-red-600 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-100"
                  >
                    {isResetting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />{" "}
                        DESTRUYENDO DATOS...
                      </>
                    ) : (
                      <>
                        <DatabaseZap size={20} /> Formatear Base de Datos
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
