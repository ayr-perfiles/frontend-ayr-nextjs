"use client";

import { useEffect, useState } from "react";
import { Settings, BookOpen, Users, Plug } from "lucide-react";
import {
  getSystemSettings,
  updateSystemSettings,
  SystemSettings,
} from "@/services/settingsService";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { CatalogSettings } from "@/components/settings/CatalogSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { UsersSettings } from "@/components/settings/UsersSettings";
import toast from "react-hot-toast"; // <-- IMPORTAMOS TOAST

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "general" | "catalog" | "integrations" | "users"
  >("general");

  const [settingsData, setSettingsData] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
      toast.success("Configuración guardada correctamente."); // <-- TOAST DE ÉXITO
    } catch (error) {
      toast.error("Ocurrió un error al guardar."); // <-- TOAST DE ERROR
    } finally {
      setIsSaving(false);
    }
  };

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
          <button
            onClick={() => setActiveTab("general")}
            className={`w-full text-left p-4 rounded-xl font-bold flex items-center gap-3 transition ${
              activeTab === "general"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Settings size={18} /> General y Operaciones
          </button>

          <button
            onClick={() => setActiveTab("catalog")}
            className={`w-full text-left p-4 rounded-xl font-bold flex items-center gap-3 transition ${
              activeTab === "catalog"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <BookOpen size={18} /> Catálogo de Perfiles
          </button>

          <button
            onClick={() => setActiveTab("integrations")}
            className={`w-full text-left p-4 rounded-xl font-bold flex items-center gap-3 transition ${
              activeTab === "integrations"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Plug size={18} /> Integraciones API
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={`w-full text-left p-4 rounded-xl font-bold flex items-center gap-3 transition ${
              activeTab === "users"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Users size={18} /> Usuarios y Roles
          </button>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
