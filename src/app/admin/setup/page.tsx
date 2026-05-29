"use client";

import { useEffect, useState } from "react";
import { Home, CheckCircle2, Loader2, AlertTriangle, PackagePlus } from "lucide-react";
import toast from "react-hot-toast";
import { listProducts, seedInitialCatalog } from "@/modules/roofing/services/catalogService";

type CatalogStatus = "loading" | "empty" | "populated" | "seeded";

export default function SetupPage() {
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [catalogCount, setCatalogCount] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    listProducts()
      .then((products) => {
        setCatalogCount(products.length);
        setCatalogStatus(products.length > 0 ? "populated" : "empty");
      })
      .catch(() => {
        toast.error("Error al verificar el catálogo PVC");
        setCatalogStatus("empty");
      });
  }, []);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedInitialCatalog();
      const products = await listProducts();
      setCatalogCount(products.length);
      setCatalogStatus("seeded");
      toast.success(`Catálogo inicializado con ${products.length} productos`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error al inicializar el catálogo";
      toast.error(msg);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Configuración Inicial
        </h1>
        <p className="text-slate-500 font-medium mt-1">
          Herramientas de inicialización y seed de datos base del sistema.
        </p>
      </div>

      {/* ── Tarjeta: Catálogo PVC ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 p-6 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Home size={20} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-900">Catálogo PVC — Coberturas Roofing</h2>
            <p className="text-sm text-slate-500 font-medium">
              Productos base UPVC en colores Rojo y Azul, largos 3.6m y 6.0m.
            </p>
          </div>
        </div>

        <div className="p-6">
          {catalogStatus === "loading" && (
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm font-medium">Verificando catálogo...</span>
            </div>
          )}

          {catalogStatus === "empty" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800">Catálogo vacío</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    No hay productos registrados en <code className="font-mono">roofing_catalog</code>.
                    Inicializa con los 4 productos base para comenzar a operar.
                  </p>
                </div>
              </div>

              <button
                onClick={handleSeed}
                disabled={isSeeding}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-md shadow-emerald-200"
              >
                {isSeeding ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <PackagePlus size={16} />
                )}
                {isSeeding ? "Inicializando..." : "Inicializar Catálogo PVC"}
              </button>
            </div>
          )}

          {(catalogStatus === "populated" || catalogStatus === "seeded") && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-emerald-800">
                    {catalogStatus === "seeded" ? "Catálogo inicializado" : "Catálogo activo"}
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {catalogCount} {catalogCount === 1 ? "producto registrado" : "productos registrados"} en{" "}
                    <code className="font-mono">roofing_catalog</code>.
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-400 font-medium">
                Para agregar más productos, usa el{" "}
                <a href="/admin/roofing/catalog" className="text-blue-600 hover:underline font-bold">
                  Catálogo PVC
                </a>
                .
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tarjeta: Importación Masiva Multi-Línea ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 p-6 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <PackagePlus size={20} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-black text-slate-900">Catálogos — Importación Masiva</h2>
            <p className="text-sm text-slate-500 font-medium">
              Sube el archivo Excel de facturación para poblar automáticamente los catálogos de todas las líneas.
            </p>
          </div>
        </div>
        <div className="p-6 bg-slate-50">
          <a
            href="/admin/setup/catalog-import"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition active:scale-95 shadow-md shadow-blue-200"
          >
            Ir a Herramienta de Importación
          </a>
        </div>
      </div>
    </div>
  );
}
