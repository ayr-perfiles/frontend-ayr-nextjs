"use client";

import { useState } from "react";
import { resetDatabase } from "@/services/adminService";
import {
  Settings,
  Trash2,
  AlertTriangle,
  RefreshCcw,
  CheckCircle,
} from "lucide-react";

export default function SettingsPage() {
  const [isResetting, setIsResetting] = useState(false);
  const [step, setStep] = useState(0); // 0: Normal, 1: Confirmación, 2: Éxito

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetDatabase();
      setStep(2);
      // Regresar al estado inicial después de 3 segundos
      setTimeout(() => setStep(0), 3000);
    } catch (error) {
      alert("Error al limpiar la base de datos.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
          <Settings className="text-gray-400" /> Configuración del Sistema
        </h1>
        <p className="text-gray-500">
          Administración general y herramientas de mantenimiento.
        </p>
      </div>

      {/* ZONA DE PELIGRO */}
      <section className="bg-white rounded-2xl border-2 border-red-100 overflow-hidden shadow-sm">
        <div className="p-6 bg-red-50 border-b border-red-100 flex items-center gap-3 text-red-700">
          <AlertTriangle size={24} />
          <h2 className="font-black uppercase tracking-tight">
            Zona de Peligro
          </h2>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              Reiniciar Base de Datos
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Esta acción eliminará permanentemente todas las bobinas, el stock
              de ventas, los registros de producción y el historial comercial.
              **No se puede deshacer.**
            </p>
          </div>

          <div className="flex items-center gap-4">
            {step === 0 && (
              <button
                onClick={() => setStep(1)}
                className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition shadow-lg shadow-red-200"
              >
                <Trash2 size={20} /> Borrar Toda la Data
              </button>
            )}

            {step === 1 && (
              <div className="flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <button
                  disabled={isResetting}
                  onClick={handleReset}
                  className="bg-red-800 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-black transition"
                >
                  {isResetting ? (
                    <RefreshCcw className="animate-spin" size={20} />
                  ) : (
                    <AlertTriangle size={20} />
                  )}
                  ¡SÍ, ESTOY SEGURO, BORRAR TODO!
                </button>
                <button
                  onClick={() => setStep(0)}
                  className="text-gray-500 font-bold hover:text-gray-800 px-4"
                >
                  Cancelar
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="flex items-center gap-2 text-emerald-600 font-bold animate-bounce">
                <CheckCircle size={20} /> ¡Base de datos limpia con éxito!
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
        <p className="text-xs text-gray-400 font-medium">
          AYR STEEL ERP v2.0 - Entorno de Desarrollo Activo
        </p>
      </div>
    </div>
  );
}
