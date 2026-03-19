"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
  getDoc,
  doc,
} from "firebase/firestore";
import { ProductionLog } from "@/types";
import {
  BarChart3,
  Target,
  AlertCircle,
  Download,
  ChevronDown,
} from "lucide-react";

// Interfaz extendida para guardar el peso de la merma calculado
interface ExtendedLog extends ProductionLog {
  scrapWeightKg?: number;
}

export default function ReportsPage() {
  const [logs, setLogs] = useState<ExtendedLog[]>([]);
  const [limitCount, setLimitCount] = useState(30); // Paginación: Traemos 30 por defecto
  const [stats, setStats] = useState({
    totalUsedMm: 0,
    totalScrapMm: 0,
    totalScrapKg: 0, // NUEVO KPI: Merma en Kilos
    avgEfficiency: 0,
    totalOps: 0,
  });

  useEffect(() => {
    // 1. QUERY OPTIMIZADA: Solo pedimos los últimos X registros
    const q = query(
      collection(db, "production_logs"),
      orderBy("timestamp", "desc"),
      limit(limitCount),
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const logsData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as ExtendedLog,
      );

      let used = 0;
      let scrapMm = 0;
      let scrapKg = 0;
      let validOps = 0;

      // 2. ENRIQUECIMIENTO DE DATOS (Calcular KG de Merma)
      // Iteramos asíncronamente para buscar los datos de la bobina madre si es necesario
      const processedLogs = await Promise.all(
        logsData.map(async (log) => {
          if (log.status === "VOIDED") return log;

          used += log.totalUsedWidth || 0;
          scrapMm += log.scrapWidth || 0;
          validOps++;

          // Cálculo de Merma en KG:
          // Necesitamos saber cuánto pesa cada milímetro de esa bobina madre.
          // Si no tienes el peso original de la bobina en el log, lo ideal sería guardarlo cuando se crea.
          // Por ahora, como es un reporte de alto nivel, podemos estimarlo basado en la merma de la operación.
          // (En un sistema 100% preciso, la bobina debe guardar una propiedad "kgPerMm")

          // Simulación: Asumimos que la bobina estándar pesa 5000kg y mide 1200mm (aprox 4.16 kg/mm)
          // Para hacer esto 100% real, deberías buscar la bobina en Firestore o guardarlo en el log.
          // Aquí hacemos una estimación conservadora de 4 kg por milímetro de ancho consumido por toda la tira.

          // Cálculo temporal (Ajusta este factor según tu material real, ej. 0.04 kg/mm/metro)
          // Como no tenemos el largo, y solo tenemos piezas, usaremos una relación de ancho.
          const estimatedScrapWeight = (log.scrapWidth || 0) * 0.85; // Factor arbitrario de ejemplo

          scrapKg += estimatedScrapWeight;

          return { ...log, scrapWeightKg: estimatedScrapWeight };
        }),
      );

      setLogs(processedLogs);

      const total = used + scrapMm;
      const efficiency = total > 0 ? (used / total) * 100 : 0;

      setStats({
        totalUsedMm: used,
        totalScrapMm: Number(scrapMm.toFixed(2)),
        totalScrapKg: Number(scrapKg.toFixed(2)),
        avgEfficiency: efficiency,
        totalOps: validOps,
      });
    });
    return () => unsub();
  }, [limitCount]); // Se vuelve a ejecutar si el usuario le da a "Cargar más"

  // --- FUNCIÓN DE EXPORTACIÓN A EXCEL (CSV) ---
  const exportToExcel = () => {
    const headers = [
      "Bobina Madre",
      "Producto",
      "Ancho Usado (mm)",
      "Merma Generada (mm)",
      "Merma Estimada (kg)",
      "Fecha",
      "Estado",
    ];
    const rows = logs.map((log) => {
      const dateStr = log.timestamp?.toDate
        ? log.timestamp.toDate().toLocaleString()
        : "Sin fecha";
      return [
        log.parentCoilId,
        log.sku,
        log.totalUsedWidth || 0,
        log.scrapWidth || 0,
        (log.scrapWeightKg || 0).toFixed(2),
        dateStr,
        log.status === "VOIDED" ? "ANULADO" : "VÁLIDO",
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
      `Reporte_Produccion_${new Date().toLocaleDateString()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800 tracking-tight">
            <BarChart3 className="text-blue-600" /> Rendimiento de Planta
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Análisis de aprovechamiento y control de mermas.
          </p>
        </div>

        {/* BOTÓN EXPORTAR EXCEL */}
        <button
          onClick={exportToExcel}
          className="bg-green-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-green-700 transition shadow-sm font-black uppercase tracking-widest text-xs"
        >
          <Download size={18} /> Exportar Datos
        </button>
      </div>

      {/* KPIs SUPERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 bg-green-50 w-24 h-24 rounded-full opacity-50"></div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 relative z-10">
            Eficiencia Global
          </p>
          <h3 className="text-4xl font-black text-gray-800 tracking-tighter relative z-10">
            {stats.avgEfficiency.toFixed(1)}%
          </h3>
          <div className="w-full bg-gray-100 h-2 rounded-full mt-4 relative z-10">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${stats.avgEfficiency}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 bg-orange-50 w-24 h-24 rounded-full opacity-50"></div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 relative z-10">
            Merma (Ancho)
          </p>
          <h3 className="text-4xl font-black text-gray-800 tracking-tighter relative z-10">
            {stats.totalScrapMm}{" "}
            <span className="text-lg font-bold text-gray-400">mm</span>
          </h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden bg-linear-to-br from-gray-900 to-gray-800 text-white">
          <div className="absolute -right-4 -top-4 bg-white/5 w-24 h-24 rounded-full"></div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 relative z-10">
            Merma (Peso Estimado)
          </p>
          <h3 className="text-4xl font-black tracking-tighter relative z-10">
            {stats.totalScrapKg}{" "}
            <span className="text-lg font-bold text-gray-400">kg</span>
          </h3>
          <p className="text-[10px] text-gray-400 mt-2">Chatarra valorizable</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 bg-blue-50 w-24 h-24 rounded-full opacity-50"></div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 relative z-10">
            Operaciones
          </p>
          <h3 className="text-4xl font-black text-gray-800 tracking-tighter relative z-10">
            {stats.totalOps}
          </h3>
          <p className="text-xs text-gray-400 mt-2 font-medium">
            Ciclos válidos.
          </p>
        </div>
      </div>

      {/* TABLA DE DETALLE */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-gray-700">
            <Target size={20} className="text-blue-500" /> Detalle de
            Aprovechamiento
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white">
              <tr>
                <th className="p-4 pl-6 border-b border-gray-50">
                  Bobina Madre
                </th>
                <th className="p-4 border-b border-gray-50">Producto</th>
                <th className="p-4 border-b border-gray-50">Usado (mm)</th>
                <th className="p-4 border-b border-gray-50">Merma (mm)</th>
                <th className="p-4 border-b border-gray-50 text-orange-600">
                  Merma Est. (kg)
                </th>
                <th className="p-4 pr-6 text-center border-b border-gray-50">
                  Rendimiento
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-gray-400 font-medium"
                  >
                    No hay registros todavía.
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => {
                  const isVoided = log.status === "VOIDED";
                  const u = log.totalUsedWidth || 0;
                  const s = log.scrapWidth || 0;
                  const kg = log.scrapWeightKg || 0;
                  const yieldPct = u + s > 0 ? (u / (u + s)) * 100 : 0;

                  return (
                    <tr
                      key={idx}
                      className={`transition group ${isVoided ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-blue-50/30"}`}
                    >
                      <td className="p-4 pl-6">
                        <span
                          className={`text-sm font-black ${isVoided ? "text-red-400 line-through" : "text-blue-900"}`}
                        >
                          {log.parentCoilId}
                        </span>
                        {isVoided && (
                          <span className="ml-2 text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded uppercase tracking-widest">
                            Anulado
                          </span>
                        )}
                      </td>
                      <td
                        className={`p-4 font-black text-sm ${isVoided ? "text-gray-400 line-through" : "text-gray-700"}`}
                      >
                        {log.sku}
                      </td>
                      <td
                        className={`p-4 text-xs font-bold ${isVoided ? "text-gray-400" : "text-gray-600"}`}
                      >
                        {u > 0 ? `${u} ` : "---"}
                      </td>
                      <td
                        className={`p-4 text-xs font-black ${isVoided ? "text-gray-400" : s > 50 ? "text-orange-500" : "text-gray-400"}`}
                      >
                        {s > 0 ? `${s} ` : "---"}
                      </td>

                      {/* NUEVA COLUMNA KG */}
                      <td
                        className={`p-4 text-xs font-black ${isVoided ? "text-gray-400 line-through" : "text-orange-600"}`}
                      >
                        {kg > 0 ? `${kg.toFixed(2)} kg` : "---"}
                      </td>

                      <td className="p-4 pr-6">
                        {isVoided ? (
                          <div className="flex items-center justify-center gap-1 text-red-400 text-xs font-bold uppercase">
                            <AlertCircle size={14} /> Sin efecto
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-3">
                            <div className="w-24 bg-gray-100 h-2 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${yieldPct > 95 ? "bg-green-500" : "bg-orange-400"}`}
                                style={{ width: `${yieldPct}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-black w-10 text-right">
                              {yieldPct > 0 ? yieldPct.toFixed(1) : "0.0"}%
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* BOTÓN DE PAGINACIÓN */}
      <div className="flex justify-center mt-6">
        <button
          onClick={() => setLimitCount((prev) => prev + 30)}
          className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:border-blue-500 hover:text-blue-600 transition"
        >
          Cargar registros anteriores <ChevronDown size={20} />
        </button>
      </div>
    </div>
  );
}
