"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import { ProductionLog, StockSummary } from "@/types";
import {
  Factory,
  Package,
  History,
  Activity,
  DollarSign,
  TrendingUp,
  Trash2,
  AlertCircle,
  Download,
  ChevronDown,
  Calendar,
  Search,
  Filter,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { revertProductionLog } from "@/services/productionService";
import toast from "react-hot-toast";

export default function ProductionPage() {
  const { user, role } = useAuth();
  const [stock, setStock] = useState<StockSummary[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- PAGINACIÓN Y FILTROS ---
  const [limitCount, setLimitCount] = useState(30);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [filterSku, setFilterSku] = useState<string>("ALL");
  const [filterCoil, setFilterCoil] = useState<string>("");

  useEffect(() => {
    // 1. Escuchar el Stock de Producto Terminado
    const qStock = query(collection(db, "inventory_stock"));
    const unsubStock = onSnapshot(qStock, (snapshot) => {
      const stockData = snapshot.docs.map((doc) => ({
        sku: doc.id,
        ...doc.data(),
      })) as StockSummary[];
      setStock(stockData);
    });

    return () => unsubStock();
  }, []);

  useEffect(() => {
    // 2. Escuchar el Historial de Producción (Con filtro de FECHAS en Firebase)
    let baseQuery = collection(db, "production_logs");
    let queryConstraints: any[] = [];

    // Aplicar filtros de fecha si existen
    if (startDate) {
      const start = new Date(startDate + "T00:00:00");
      queryConstraints.push(where("timestamp", ">=", start));
    }
    if (endDate) {
      const end = new Date(endDate + "T23:59:59");
      queryConstraints.push(where("timestamp", "<=", end));
    }

    // Siempre ordenamos por fecha descendente
    queryConstraints.push(orderBy("timestamp", "desc"));
    queryConstraints.push(limit(limitCount));

    const qLogs = query(baseQuery, ...queryConstraints);

    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ProductionLog[];
      setLogs(logsData);
      setIsLoading(false);
    });

    return () => unsubLogs();
  }, [limitCount, startDate, endDate]);

  // --- FILTRO LOCAL (Búsqueda instantánea de SKU y Bobina) ---
  const displayLogs = logs.filter((log) => {
    const matchSku = filterSku === "ALL" || log.sku === filterSku;
    const matchCoil =
      filterCoil === "" ||
      log.parentCoilId.toLowerCase().includes(filterCoil.toLowerCase());
    return matchSku && matchCoil;
  });

  // --- FUNCIÓN DE ANULACIÓN ---
  const handleVoidLog = async (logId: string, pieces: number) => {
    if (
      confirm(
        `¿Estás seguro de ANULAR este corte de ${pieces} piezas? El inventario se restará y el fleje volverá a la bobina.`,
      )
    ) {
      try {
        await revertProductionLog(logId, user?.email || "Admin");
        toast.success("✅ Producción anulada y costos revertidos.");
      } catch (error: any) {
        toast.error(error.message);
      }
    }
  };

  // --- FUNCIÓN PARA EXPORTAR STOCK A EXCEL ---
  const exportStockToExcel = () => {
    const headers = [
      "Producto (SKU)",
      "Unidades en Almacen",
      "Costo Unitario (S/)",
      "Valor Total (S/)",
    ];
    const rows = stock.map((item) => {
      const costPerPiece = item.lastCostPerPiece || 0;
      const totalValue = item.totalQuantity * costPerPiece;
      return [
        item.sku,
        item.totalQuantity,
        costPerPiece.toFixed(4),
        totalValue.toFixed(2),
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Valorizacion_Stock_${new Date().toLocaleDateString()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
            <Factory className="text-blue-600" /> Producción y Costos
          </h1>
          <p className="text-gray-500">
            Control de inventario valorizado y trazabilidad de máquina.
          </p>
        </div>

        <button
          onClick={exportStockToExcel}
          className="bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-green-700 transition shadow-sm font-black uppercase tracking-widest text-xs"
        >
          <Download size={18} /> Exportar Stock Valorizado
        </button>
      </div>

      {/* SECCIÓN 1: STOCK VALORIZADO */}
      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
          <Package size={20} /> Stock Disponible para Venta
        </h2>

        {stock.length === 0 && !isLoading ? (
          <div className="p-6 bg-white rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
            Aún no hay productos procesados.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stock.map((item) => {
              const costPerPiece = item.lastCostPerPiece || 0;
              const totalValue = item.totalQuantity * costPerPiece;

              return (
                <div
                  key={item.sku}
                  className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-sm font-black text-gray-800 uppercase bg-gray-100 px-3 py-1 rounded-full">
                      {item.sku}
                    </span>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Package size={20} />
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-4xl font-black text-gray-800">
                      {item.totalQuantity}
                    </p>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mt-1">
                      unidades en almacén
                    </p>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-gray-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <DollarSign size={14} /> Costo Unitario
                      </span>
                      <span className="font-mono font-bold text-emerald-600">
                        S/ {costPerPiece.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 flex items-center gap-1">
                        <TrendingUp size={14} /> Valor Total
                      </span>
                      <span className="font-mono font-bold text-gray-700">
                        S/{" "}
                        {totalValue.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECCIÓN 2: HISTORIAL DE CORTES Y COSTOS */}
      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
          <History size={20} /> Historial de Operaciones (Conformadora)
        </h2>

        {/* --- BARRA DE FILTROS --- */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-col md:flex-row gap-4 items-end">
          {/* Rango de Fechas */}
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            <div className="flex-1 md:w-40">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Calendar size={12} /> Desde
              </label>
              <input
                type="date"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm font-medium"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setLimitCount(30); // Resetear paginación al filtrar
                }}
              />
            </div>
            <div className="flex-1 md:w-40">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Calendar size={12} /> Hasta
              </label>
              <input
                type="date"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm font-medium"
                value={endDate}
                min={startDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setLimitCount(30);
                }}
              />
            </div>
          </div>

          {/* Filtro por Producto */}
          <div className="w-full md:w-48">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Filter size={12} /> Producto (SKU)
            </label>
            <select
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm font-medium"
              value={filterSku}
              onChange={(e) => setFilterSku(e.target.value)}
            >
              <option value="ALL">Todos los Productos</option>
              {stock.map((item) => (
                <option key={item.sku} value={item.sku}>
                  {item.sku}
                </option>
              ))}
            </select>
          </div>

          {/* Buscador de Bobina Origen */}
          <div className="w-full flex-1 relative">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
              <Search size={12} /> Bobina de Origen
            </label>
            <input
              type="text"
              placeholder="Ej: PD03-11..."
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 text-sm font-medium uppercase"
              value={filterCoil}
              onChange={(e) => setFilterCoil(e.target.value)}
            />
          </div>

          {/* Botón Limpiar */}
          {(startDate || endDate || filterSku !== "ALL" || filterCoil) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setFilterSku("ALL");
                setFilterCoil("");
              }}
              className="p-2.5 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-bold transition flex-shrink-0"
              title="Limpiar Filtros"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-left min-w-225">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">
                  Bobina Origen
                </th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">
                  Producto
                </th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">
                  Producción
                </th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">
                  Costo Fleje
                </th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">
                  Costo x Pieza
                </th>
                <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-center">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayLogs.length === 0 && !isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-gray-500 font-medium"
                  >
                    No se encontraron registros con los filtros actuales.
                  </td>
                </tr>
              ) : (
                displayLogs.map((log) => {
                  const isVoided = log.status === "VOIDED";

                  return (
                    <tr
                      key={log.id}
                      className={`transition ${isVoided ? "bg-red-50/20" : "hover:bg-gray-50"}`}
                    >
                      <td className="p-4 text-sm text-gray-600">
                        {log.timestamp?.toDate
                          ? log.timestamp.toDate().toLocaleString("es-PE", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Reciente"}
                      </td>
                      <td className="p-4">
                        <span
                          className={`font-bold px-2 py-1 rounded-md text-xs border ${isVoided ? "text-red-400 border-red-200 line-through bg-red-50" : "text-blue-900 bg-blue-50 border-blue-100"}`}
                        >
                          {log.parentCoilId}
                        </span>
                        {isVoided && (
                          <span className="ml-2 text-[10px] font-black text-red-500 uppercase tracking-widest">
                            Anulado
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`font-bold ${isVoided ? "text-gray-400 line-through" : "text-gray-700"}`}
                        >
                          {log.sku}
                        </span>
                      </td>
                      <td className="p-4">
                        {isVoided ? (
                          <div className="flex items-center gap-1 text-red-400 text-xs font-bold uppercase">
                            <AlertCircle size={14} /> Sin Efecto
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Activity size={16} className="text-green-500" />
                            <span className="text-green-600 font-bold">
                              +{log.piecesProduced} pzas
                            </span>
                          </div>
                        )}
                      </td>
                      <td
                        className={`p-4 text-right font-mono text-sm ${isVoided ? "text-gray-400 line-through" : "text-gray-600"}`}
                      >
                        S/{" "}
                        {log.stripCost?.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        }) || "0.00"}
                      </td>
                      <td className="p-4 text-right">
                        <span
                          className={`font-mono font-bold px-2 py-1 rounded border ${isVoided ? "text-gray-400 bg-gray-50 border-gray-200 line-through" : "text-emerald-600 bg-emerald-50 border-emerald-100"}`}
                        >
                          S/ {log.costPerPiece?.toFixed(4) || "0.0000"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {role === "ADMIN" && !isVoided && log.id && (
                          <button
                            onClick={() =>
                              handleVoidLog(log.id!, log.piecesProduced)
                            }
                            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                            title="Anular Producción"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* BOTÓN CARGAR MÁS (PAGINACIÓN) */}
        {logs.length >= limitCount && (
          <div className="flex justify-center mt-6 p-4">
            <button
              onClick={() => setLimitCount((prev) => prev + 30)}
              className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:border-blue-500 hover:text-blue-600 transition shadow-sm active:scale-95"
            >
              Cargar más registros <ChevronDown size={20} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
