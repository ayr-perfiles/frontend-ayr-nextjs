import React, { useState } from "react";
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
  Trash2,
  Loader2,
  ArrowRightLeft,
} from "lucide-react";
import { Sale } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { annulSale } from "@/services/salesService";
import toast from "react-hot-toast";
import { SunatPanel } from "./SunatPanel";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";

interface SaleDetailsModalProps {
  sale: Sale;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SaleDetailsModal({
  sale: initialSale,
  onClose,
  onSuccess,
}: SaleDetailsModalProps) {
  const { user, role } = useAuth();
  const [isAnnuling, setIsAnnuling] = useState(false);
  const [sale, setSale] = useState(initialSale);

  const refreshSale = async () => {
    if (!sale.id) return;
    try {
      const docRef = doc(db, "sales", sale.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSale({ id: docSnap.id, ...docSnap.data() } as Sale);
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error("Error refreshing sale:", error);
    }
  };

  // Configuración y cálculos financieros
  const IGV_RATE = 0.18;
  const items = sale.items || [];

  // 🚀 Lógica de Metadatos de Dólares (USD)
  const isConverted = (sale as any).metadata?.currency === "USD";
  const exchangeRate = (sale as any).metadata?.exchangeRate || 1;
  const originalCurrencyAmount =
    (sale as any).metadata?.originalCurrencyAmount || 0;

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

  // Lógica de Anulación
  const handleAnnul = async () => {
    const confirmMsg = `¿ESTÁS SEGURO?\n\nEsta acción anulará la factura ${sale.id}, devolverá el stock al inventario y creará un registro en auditoría.\n\nESTA ACCIÓN NO SE PUEDE DESHACER.`;
    if (!confirm(confirmMsg)) return;

    setIsAnnuling(true);
    toast.loading("Anulando operación...", { id: "annul" });
    try {
      await annulSale({
        saleId: sale.id!,
        userEmail: user?.email || "usuario@empresa.com",
      });
      toast.success("Venta anulada y stock restaurado.", { id: "annul" });
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message, { id: "annul" });
      setIsAnnuling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      {/* 🚀 CONTENEDOR PRINCIPAL: Alto máximo 95vh y estructura Flex Col para Scrolling Interno */}
      <div className="flex flex-col bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* CABECERA (Fija - shrink-0) */}
        <div className="p-6 bg-slate-800 text-white flex justify-between items-start shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black">
                {sale.id || sale.documentNumber}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-widest flex items-center gap-1 ${
                  sale.status === "COMPLETED"
                    ? "bg-green-500/20 text-green-300 border border-green-500/30"
                    : sale.status === "QUOTATION"
                      ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                      : sale.status === "VOIDED"
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
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
                ) : sale.status === "VOIDED" ? (
                  <>
                    <Trash2 size={12} /> ANULADA
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
                ? sale.timestamp.toDate().toLocaleString("es-PE", {
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

        {/* CUERPO DEL MODAL (Con Scroll Interno overflow-y-auto) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* 🔥 ALERTA DE CONVERSIÓN DE MONEDA (Solo si es USD) */}
          {isConverted && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
              <ArrowRightLeft
                className="text-blue-500 mt-0.5 shrink-0"
                size={18}
              />
              <div>
                <p className="text-sm font-bold text-blue-900">
                  Conversión Automática a Soles Aplicada
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Esta venta fue registrada originalmente en Dólares (USD). El
                  sistema la ha convertido a Soles (PEN) para la contabilidad
                  usando el tipo de cambio de <strong>S/ {exchangeRate}</strong>
                  .
                </p>
              </div>
            </div>
          )}

          {/* SECCIÓN 1: DATOS DEL CLIENTE */}
          <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
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
                      <th className="p-3 text-center">Línea</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3 text-center">Cant.</th>
                      <th className="p-3 text-right">Precio Unit.</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((item, idx) => {
                      const line = item.businessLine || "drywall";
                      const lineConfig: Record<string, { label: string; cls: string }> = {
                        drywall: { label: "DRY", cls: "bg-blue-50 text-blue-600 border-blue-100" },
                        roofing: { label: "PVC", cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
                        "metallic-roofing": { label: "ALU", cls: "bg-zinc-50 text-zinc-600 border-zinc-100" },
                        trading: { label: "TRD", cls: "bg-amber-50 text-amber-600 border-amber-100" },
                        services: { label: "SRV", cls: "bg-violet-50 text-violet-600 border-violet-100" },
                      };
                      const conf = lineConfig[line] || { label: "???", cls: "bg-gray-50 text-gray-400" };
                      
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 transition">
                          <td className="p-3 text-center">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${conf.cls}`}>
                              {conf.label}
                            </span>
                          </td>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalWeight > 0 && (
                <p className="text-xs font-bold text-gray-500 flex items-center gap-1 justify-end">
                  <Scale size={14} /> Peso Total Estimado:{" "}
                  <span className="text-gray-800">
                    {totalWeight.toLocaleString("es-PE", {
                      minimumFractionDigits: 3,
                      maximumFractionDigits: 3,
                    })}{" "}
                    kg{" "}
                  </span>
                </p>
              )}
            </div>

            {/* SECCIÓN 3: DATOS FINANCIEROS Y ACCIONES */}
            <div className="space-y-4 flex flex-col h-full">
              <div>
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 border-b pb-2">
                  <DollarSign size={16} className="text-emerald-500" /> Resumen
                  Financiero
                </h3>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 mt-4">
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
                      Total Contable
                    </span>
                    <span className="font-black text-2xl text-blue-600">
                      {formatMoney(totalAmount)}
                    </span>
                  </div>

                  {/* 🚀 AUDITORÍA DE VENTA ORIGINAL (EN DÓLARES) */}
                  {isConverted && originalCurrencyAmount > 0 && (
                    <div className="mt-4 pt-3 border-t border-dashed border-slate-300">
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-2">
                        Auditoría Original (USD)
                      </p>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">
                          Monto Facturado
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          ${" "}
                          {originalCurrencyAmount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs font-medium text-slate-500">
                          Tipo de Cambio
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {exchangeRate}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 🔥 PANEL SUNAT INTEGRADO */}
                {sale.status === "COMPLETED" && (
                  <div className="mt-6">
                    <SunatPanel 
                      saleId={sale.id!} 
                      sunatData={sale.sunat} 
                      onRefresh={refreshSale} 
                    />
                  </div>
                )}

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

              {/* BOTÓN DE ANULAR (Solo visible para ADMIN y ventas activas) */}
              <div className="mt-auto pt-6">
                {sale.status === "COMPLETED" && role === "ADMIN" && (
                  <button
                    onClick={handleAnnul}
                    disabled={isAnnuling}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-black text-xs transition border border-red-100 disabled:opacity-50"
                  >
                    {isAnnuling ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    {isAnnuling ? "PROCESANDO..." : "ANULAR ESTA VENTA"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
