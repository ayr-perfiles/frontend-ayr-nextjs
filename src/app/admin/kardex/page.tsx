"use client";

import { useState, useEffect } from "react";
import { getKardexHistory, KardexMovement } from "@/services/kardexService";
import { getCatalog, ProductConfig } from "@/services/catalogService";
import {
  History,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  Calendar,
  User,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";

export default function KardexPage() {
  const [catalog, setCatalog] = useState<ProductConfig[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [movements, setMovements] = useState<KardexMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);

  // Cargar el catálogo de productos al iniciar
  useEffect(() => {
    const loadCatalog = async () => {
      const data = await getCatalog();
      // Ordenamos alfabéticamente
      setCatalog(data.sort((a, b) => a.sku.localeCompare(b.sku)));
      setIsCatalogLoading(false);
    };
    loadCatalog();
  }, []);

  // Cargar el historial cuando se selecciona un SKU
  useEffect(() => {
    const fetchKardex = async () => {
      if (!selectedSku) {
        setMovements([]);
        return;
      }
      setIsLoading(true);
      const data = await getKardexHistory(selectedSku);
      setMovements(data);
      setIsLoading(false);
    };
    fetchKardex();
  }, [selectedSku]);

  // Obtener el stock actual basado en el último movimiento (el de arriba)
  const currentStock = movements.length > 0 ? movements[0].balance : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* CABECERA Y BUSCADOR */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <History className="text-blue-600" /> Kardex de Inventario
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Audita las entradas y salidas históricas de cada producto.
          </p>
        </div>

        <div className="w-full md:w-96 relative">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
            Seleccionar Producto (SKU)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-gray-400" />
            </div>
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              disabled={isCatalogLoading}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:border-blue-500 transition appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="">-- Buscar SKU --</option>
              {catalog.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.sku} - {p.name}
                </option>
              ))}
            </select>
            {isCatalogLoading && (
              <Loader2
                size={16}
                className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
              />
            )}
          </div>
        </div>
      </div>

      {/* ESTADO VACÍO O CARGANDO */}
      {!selectedSku ? (
        <div className="bg-white p-16 rounded-3xl border border-gray-100 text-center flex flex-col items-center">
          <Package size={64} className="text-gray-200 mb-4" />
          <h3 className="text-xl font-black text-gray-400">
            Selecciona un producto
          </h3>
          <p className="text-sm font-medium text-gray-400 mt-2">
            Usa el buscador de arriba para ver el historial de movimientos.
          </p>
        </div>
      ) : isLoading ? (
        <div className="bg-white p-16 rounded-3xl border border-gray-100 text-center flex flex-col items-center text-blue-500">
          <Loader2 size={48} className="animate-spin mb-4" />
          <p className="font-bold text-gray-500">Reconstruyendo historial...</p>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          {/* TARJETA DE RESUMEN DEL SKU */}
          <div className="bg-gray-900 p-6 rounded-3xl text-white flex justify-between items-center shadow-lg shadow-gray-900/20">
            <div className="flex items-center gap-4">
              <div className="bg-gray-800 p-3 rounded-2xl">
                <Package size={24} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Stock Calculado
                </p>
                <h2 className="text-3xl font-black">
                  {currentStock}{" "}
                  <span className="text-lg text-gray-400 font-bold">
                    Unidades
                  </span>
                </h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-gray-300">
                Total de Movimientos
              </p>
              <p className="text-xl font-black text-blue-400">
                {movements.length} Registros
              </p>
            </div>
          </div>

          {/* TABLA DE KARDEX */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="p-4 pl-6 text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <Calendar size={12} /> Fecha
                    </th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Movimiento
                    </th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Documento / Detalle
                    </th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                      Cantidad
                    </th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                      Saldo
                    </th>
                    <th className="p-4 pr-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right flex items-center justify-end gap-1">
                      <User size={12} /> Usuario
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {movements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-12 text-center text-gray-400"
                      >
                        <AlertCircle
                          className="mx-auto mb-3 text-gray-300"
                          size={48}
                        />
                        <p className="font-bold">
                          Este producto aún no tiene movimientos registrados.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    movements.map((mov, idx) => (
                      <tr
                        key={mov.id + idx}
                        className="hover:bg-gray-50/50 transition"
                      >
                        <td className="p-4 pl-6">
                          <p className="text-sm font-bold text-gray-800">
                            {mov.date.toLocaleDateString("es-PE", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          <p className="text-[10px] font-bold text-gray-400">
                            {mov.date.toLocaleTimeString("es-PE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </td>
                        <td className="p-4">
                          {mov.type === "IN" ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                              <ArrowDownRight size={12} /> Entrada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-red-100">
                              <ArrowUpRight size={12} /> Salida
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-1 mb-0.5">
                            <FileText size={12} className="text-blue-500" />{" "}
                            {mov.reference}
                          </p>
                          <p className="text-xs font-bold text-gray-500">
                            {mov.description}
                          </p>
                        </td>
                        <td className="p-4 text-right">
                          <span
                            className={`font-mono text-base font-black ${mov.type === "IN" ? "text-emerald-600" : "text-red-600"}`}
                          >
                            {mov.type === "IN" ? "+" : "-"}
                            {mov.quantity}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className="font-mono text-base font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                            {mov.balance}
                          </span>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <p className="text-xs font-bold text-gray-500 truncate max-w-[100px] inline-block">
                            {mov.user}
                          </p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
