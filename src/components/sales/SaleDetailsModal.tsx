import React from "react";
import {
  X,
  Building2,
  ShoppingCart,
  DollarSign,
  Clock,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  FileText,
  Scale,
} from "lucide-react";
import { Sale } from "@/types";

interface SaleDetailsModalProps {
  sale: Sale;
  onClose: () => void;
}

export function SaleDetailsModal({ sale, onClose }: SaleDetailsModalProps) {
  // Configuración y cálculos financieros
  const IGV_RATE = 0.18;
  const items = sale.items || [];

  // Total con IGV (El precio de cara al cliente)
  const totalAmount =
    sale.totalAmount ||
    items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  // Total sin IGV (El valor real para la empresa)
  const totalValue = items.reduce((sum, item) => {
    const value = item.unitValue || item.unitPrice / (1 + IGV_RATE);
    return sum + item.quantity * value;
  }, 0);

  const totalIGV = totalAmount - totalValue;
  const totalWeight = items.reduce(
    (sum, item) => sum + item.quantity * (item.unitWeight || 0),
    0,
  );

  // Formateador de moneda
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden animate-in fade-in zoom-in-95">
        {/* CABECERA */}
        <div className="p-6 bg-slate-800 text-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black">{sale.id}</h2>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest flex items-center gap-1 ${
                  sale.status === "COMPLETED"
                    ? "bg-green-500/20 text-green-300 border border-green-500/30"
                    : sale.status === "QUOTATION"
                      ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                }`}
              >
                {sale.status === "COMPLETED" ? (
                  <>
                    <CheckCircle2 size={12} /> VENTA
                  </>
                ) : sale.status === "QUOTATION" ? (
                  <>
                    <FileText size={12} /> COTIZACIÓN
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={12} /> APROBADA
                  </>
                )}
              </span>
            </div>
            <p className="text-slate-400 text-xs font-medium flex items-center gap-1">
              <Clock size={12} /> Emitido el:{" "}
              {sale.timestamp?.toDate
                ? sale.timestamp
                    .toDate()
                    .toLocaleString("es-PE", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })
                : "N/A"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-700 p-2 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* SECCIÓN 1: DATOS DEL CLIENTE */}
          <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
            <h3 className="text-xs font-black text-blue-800 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-blue-100 pb-2">
              <Building2 size={16} /> Información del Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Razón Social / Nombre
                </p>
                <p className="font-bold text-gray-800">{sale.customerName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Documento (RUC/DNI)
                </p>
                <p className="font-bold text-gray-800">{sale.documentNumber}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MapPin size={12} /> Dirección de Despacho
                </p>
                <p className="font-medium text-gray-700">
                  {sale.customerAddress || "No registrada"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <User size={12} /> Contacto
                </p>
                <p className="font-medium text-gray-700">
                  {sale.contactName || "---"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Phone size={12} /> Teléfono
                </p>
                <p className="font-medium text-gray-700">
                  {sale.contactPhone || "---"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SECCIÓN 2: LISTA DE PRODUCTOS */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
                <ShoppingCart size={16} className="text-blue-500" /> Productos
                Solicitados
              </h3>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-500 uppercase">
                    <tr>
                      <th className="p-3">SKU</th>
                      <th className="p-3 text-center">Cant.</th>
                      <th className="p-3 text-right">Precio Unit.</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition">
                        <td className="p-3 font-bold text-gray-800">
                          {item.sku}
                        </td>
                        <td className="p-3 text-center font-medium text-gray-600">
                          {item.quantity}
                        </td>
                        <td className="p-3 text-right text-gray-600">
                          {formatMoney(item.unitPrice)}
                        </td>
                        <td className="p-3 text-right font-bold text-gray-800">
                          {formatMoney(item.quantity * item.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalWeight > 0 && (
                <p className="text-xs font-bold text-gray-500 flex items-center gap-1 justify-end">
                  <Scale size={14} /> Peso Total Estimado:{" "}
                  <span className="text-gray-800">
                    {totalWeight.toLocaleString("es-PE")} kg
                  </span>
                </p>
              )}
            </div>

            {/* SECCIÓN 3: DATOS FINANCIEROS */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
                <DollarSign size={16} className="text-emerald-500" /> Resumen
                Financiero
              </h3>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-gray-500">
                    Op. Gravada (Valor)
                  </span>
                  <span className="font-bold text-gray-800">
                    {formatMoney(totalValue)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200">
                  <span className="font-bold text-gray-500">IGV (18%)</span>
                  <span className="font-bold text-gray-800">
                    {formatMoney(totalIGV)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-3 border-t-2 border-slate-300">
                  <span className="text-sm font-black text-slate-800 uppercase tracking-widest">
                    Total
                  </span>
                  <span className="font-black text-2xl text-blue-600">
                    {formatMoney(totalAmount)}
                  </span>
                </div>
              </div>

              {/* RASTRO DE VENDEDOR Y GANANCIA */}
              <div className="pt-4 space-y-3">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-500 uppercase tracking-wider">
                    Vendedor
                  </span>
                  <span className="font-bold text-gray-800">
                    {sale.sellerId || "SISTEMA"}
                  </span>
                </div>

                {sale.status === "COMPLETED" &&
                  sale.totalProfit !== undefined && (
                    <div
                      className={`p-3 rounded-lg border text-xs flex justify-between items-center ${sale.totalProfit >= 0 ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}
                    >
                      <span
                        className={`font-bold uppercase tracking-wider ${sale.totalProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}
                      >
                        Ganancia Neta
                      </span>
                      <span
                        className={`font-black text-sm ${sale.totalProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}
                      >
                        {formatMoney(sale.totalProfit)}
                      </span>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
