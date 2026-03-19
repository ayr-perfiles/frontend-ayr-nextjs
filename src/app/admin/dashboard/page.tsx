"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";
import { Sale, StockSummary, Coil } from "@/types";
import {
  DollarSign,
  TrendingUp,
  Package,
  Factory,
  Activity,
  ShoppingBag,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [kpis, setKpis] = useState({
    totalSales: 0,
    totalProfit: 0,
    inventoryValue: 0,
    activeCoils: 0,
  });

  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [activeCoilsList, setActiveCoilsList] = useState<Coil[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Calcular Valor Total del Inventario (Stock Terminado)
    const qStock = query(collection(db, "inventory_stock"));
    const unsubStock = onSnapshot(qStock, (snapshot) => {
      let invValue = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as StockSummary;
        invValue += data.totalQuantity * (data.lastCostPerPiece || 0);
      });
      setKpis((prev) => ({ ...prev, inventoryValue: invValue }));
    });

    // 2. Calcular Ventas y Ganancias (Solo ventas completadas)
    const qSales = query(
      collection(db, "sales"),
      where("status", "==", "COMPLETED"),
    );
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      let salesSum = 0;
      let profitSum = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data() as Sale;
        salesSum += data.totalAmount;
        profitSum += data.totalProfit;
      });
      setKpis((prev) => ({
        ...prev,
        totalSales: salesSum,
        totalProfit: profitSum,
      }));
    });

    // 3. Obtener Bobinas Activas en Planta (En proceso o disponibles)
    const qCoils = query(
      collection(db, "coils"),
      where("status", "in", ["AVAILABLE", "IN_PROGRESS"]),
    );
    const unsubCoils = onSnapshot(qCoils, (snapshot) => {
      setKpis((prev) => ({ ...prev, activeCoils: snapshot.size }));

      // Guardar algunas para la tabla de abajo
      const coilsData = snapshot.docs.map((doc) => doc.data() as Coil);
      setActiveCoilsList(coilsData.slice(0, 5));
    });

    // 4. Obtener Últimas 5 Ventas para la tabla rápida
    const qRecentSales = query(
      collection(db, "sales"),
      orderBy("timestamp", "desc"),
      limit(5),
    );
    const unsubRecentSales = onSnapshot(qRecentSales, (snapshot) => {
      const salesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as Sale,
      );
      setRecentSales(salesData);
      setIsLoading(false);
    });

    return () => {
      unsubStock();
      unsubSales();
      unsubCoils();
      unsubRecentSales();
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl font-black text-gray-800 tracking-tight">
          Dashboard Gerencial
        </h1>
        <p className="text-gray-500 mt-1">
          Resumen financiero y operativo de la planta AYR Steel.
        </p>
      </div>

      {/* SECCIÓN 1: TARJETAS DE KPIs (Indicadores Clave) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* KPI 1: Ventas Totales */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Ingresos (Ventas)
              </p>
              <h3 className="text-3xl font-black text-gray-800 mt-1">
                S/{" "}
                {kpis.totalSales.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        {/* KPI 2: Ganancia Neta */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5">
            <TrendingUp size={100} />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Ganancia Neta (Profit)
              </p>
              <h3 className="text-3xl font-black text-emerald-600 mt-1">
                S/{" "}
                {kpis.totalProfit.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        {/* KPI 3: Capital en Almacén */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Capital en Almacén
              </p>
              <h3 className="text-3xl font-black text-gray-800 mt-1">
                S/{" "}
                {kpis.inventoryValue.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}
              </h3>
            </div>
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <Package size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 font-medium">
            Costo de fabricación del stock actual
          </p>
        </div>

        {/* KPI 4: Bobinas Activas */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                Bobinas Activas
              </p>
              <h3 className="text-3xl font-black text-gray-800 mt-1">
                {kpis.activeCoils}
              </h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Factory size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 font-medium">
            Materia prima lista o en máquina
          </p>
        </div>
      </div>

      {/* SECCIÓN 2: TABLAS RESUMEN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tabla: Últimas Transacciones */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <ShoppingBag size={20} className="text-gray-400" /> Actividad
              Reciente (Ventas)
            </h2>
            <Link
              href="/admin/sales"
              className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1"
            >
              Ver todas <ArrowRight size={16} />
            </Link>
          </div>
          <div className="p-0">
            {recentSales.length === 0 ? (
              <p className="text-gray-500 text-center p-8 text-sm">
                No hay ventas recientes.
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 hover:bg-gray-50 flex justify-between items-center transition"
                  >
                    <div>
                      <p className="font-bold text-gray-800">
                        {sale.customerName}
                      </p>
                      <p className="text-xs font-bold text-gray-400 mt-1">
                        {sale.status === "COMPLETED"
                          ? "✅ VENTA"
                          : "📄 COTIZACIÓN"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-gray-800">
                        S/{" "}
                        {sale.totalAmount.toLocaleString("es-PE", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                      {sale.status === "COMPLETED" && (
                        <p className="text-xs font-bold text-emerald-600 mt-1">
                          + S/{" "}
                          {sale.totalProfit.toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                          })}{" "}
                          ganancia
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabla: Estado de Planta (Bobinas) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Activity size={20} className="text-gray-400" /> Estado de Planta
              (Máquinas)
            </h2>
            <Link
              href="/admin/inventory"
              className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1"
            >
              Ir a Inventario <ArrowRight size={16} />
            </Link>
          </div>
          <div className="p-0">
            {activeCoilsList.length === 0 ? (
              <p className="text-gray-500 text-center p-8 text-sm">
                No hay bobinas en proceso.
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {activeCoilsList.map((coil) => (
                  <div
                    key={coil.id}
                    className="p-4 hover:bg-gray-50 flex justify-between items-center transition"
                  >
                    <div>
                      <p className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded text-sm inline-block mb-1">
                        {coil.id}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">
                        Restante: {coil.currentWeight.toLocaleString("es-PE")}{" "}
                        kg
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          coil.status === "IN_PROGRESS"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {coil.status === "IN_PROGRESS"
                          ? "EN MÁQUINA"
                          : "DISPONIBLE"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
