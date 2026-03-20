"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCustomerProfile, updatePaymentStatus } from "@/services/crmService";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  CreditCard,
  Clock,
  Receipt,
  Users,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const documentNumber = params.id as string;

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (documentNumber) {
        const data = await getCustomerProfile(documentNumber);
        setProfile(data);
      }
      setIsLoading(false);
    };
    loadProfile();
  }, [documentNumber]);

  const handleTogglePayment = async (saleId: string, currentStatus: string) => {
    // Si la venta está pendiente, la pasamos a pagada (PAID). Si no existe el campo, asumimos que es nueva/pendiente.
    const newStatus = currentStatus === "PAID" ? "PENDING" : "PAID";
    const confirmMessage =
      newStatus === "PAID"
        ? "¿Confirmas que esta factura ya ha sido CANCELADA (Pagada)?"
        : "¿Deseas devolver esta factura a estado PENDIENTE de pago (Crédito)?";

    if (!confirm(confirmMessage)) return;

    setProcessingId(saleId);
    try {
      await updatePaymentStatus(saleId, newStatus);

      // Actualizamos la UI sin recargar
      setProfile((prev: any) => ({
        ...prev,
        salesHistory: prev.salesHistory.map((sale: any) =>
          sale.id === saleId ? { ...sale, paymentStatus: newStatus } : sale,
        ),
      }));
    } catch (error) {
      toast.error("Error al actualizar el estado de pago.");
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-blue-600">
        <Loader2 size={48} className="animate-spin mb-4" />
        <p className="font-bold text-gray-500">
          Cargando perfil del cliente...
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center p-12 text-red-500 font-bold">
        Cliente no encontrado en la base de datos.
      </div>
    );
  }

  const { customerData, contacts, salesHistory } = profile;

  // Cálculos rápidos de CRM
  const totalSalesCount = salesHistory.filter(
    (s: any) => s.status === "COMPLETED",
  ).length;
  const pendingDebt = salesHistory
    .filter((s: any) => s.status === "COMPLETED" && s.paymentStatus !== "PAID")
    .reduce((sum: number, s: any) => sum + (s.totalAmount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* BOTÓN VOLVER */}
      <button
        onClick={() => router.push("/admin/customers")}
        className="text-gray-500 hover:text-blue-600 font-bold flex items-center gap-2 transition"
      >
        <ArrowLeft size={16} /> Volver a Cartera de Clientes
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUMNA IZQUIERDA: DATOS DE LA EMPRESA */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <Building2 size={32} />
            </div>
            <h2 className="text-xl font-black text-gray-900 leading-tight mb-1">
              {customerData.name}
            </h2>
            <p className="text-sm font-bold text-gray-500 font-mono mb-6">
              RUC/DNI: {customerData.id}
            </p>

            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Dirección Fiscal
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    {customerData.address || "No registrada"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* TARJETA DE DEUDA (CUENTAS POR COBRAR) */}
          {pendingDebt > 0 && (
            <div className="bg-red-50 p-6 rounded-3xl border border-red-200 shadow-sm animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={20} className="text-red-600" />
                <h3 className="text-sm font-black text-red-800 uppercase tracking-widest">
                  Deuda Pendiente
                </h3>
              </div>
              <p className="text-3xl font-black text-red-600">
                S/{" "}
                {pendingDebt.toLocaleString("es-PE", {
                  minimumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs font-bold text-red-500 mt-2">
                Facturas emitidas a crédito sin cancelar.
              </p>
            </div>
          )}

          {/* CONTACTOS */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-sm font-black text-gray-800 mb-4 uppercase tracking-widest flex items-center gap-2">
              <Users size={16} className="text-emerald-500" /> Contactos
              Autorizados
            </h3>
            {contacts.length === 0 ? (
              <p className="text-xs font-medium text-gray-400 italic">
                No hay contactos registrados.
              </p>
            ) : (
              <div className="space-y-4">
                {contacts.map((contact: any) => (
                  <div
                    key={contact.id}
                    className="bg-gray-50 p-3 rounded-xl border border-gray-100"
                  >
                    <p className="font-bold text-gray-900 text-sm mb-2">
                      {contact.name}
                    </p>
                    <p className="text-xs font-medium text-gray-600 flex items-center gap-2 mb-1">
                      <Phone size={12} className="text-gray-400" />{" "}
                      {contact.phone || "---"}
                    </p>
                    <p className="text-xs font-medium text-gray-600 flex items-center gap-2">
                      <Mail size={12} className="text-gray-400" />{" "}
                      {contact.email || "---"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: HISTORIAL DE VENTAS */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                  <Receipt className="text-blue-500" size={20} /> Historial
                  Operativo
                </h2>
                <p className="text-xs font-bold text-gray-500 mt-1">
                  Total Compras: {totalSalesCount} operaciones cerradas.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="p-4 pl-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Documento
                    </th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Estado Documento
                    </th>
                    <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                      Total
                    </th>
                    <th className="p-4 pr-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
                      Cobranza
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {salesHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-12 text-center text-gray-400 font-bold"
                      >
                        Sin historial de operaciones.
                      </td>
                    </tr>
                  ) : (
                    salesHistory.map((sale: any) => {
                      const isCompleted = sale.status === "COMPLETED";
                      const isPaid = sale.paymentStatus === "PAID";

                      return (
                        <tr
                          key={sale.id}
                          className="hover:bg-blue-50/30 transition"
                        >
                          <td className="p-4 pl-6">
                            <p className="text-sm font-black text-gray-900">
                              {sale.id}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400">
                              {sale.timestamp?.toDate
                                ? sale.timestamp
                                    .toDate()
                                    .toLocaleDateString("es-PE")
                                : "---"}
                            </p>
                          </td>
                          <td className="p-4">
                            {sale.status === "COMPLETED" && (
                              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-md text-[9px] font-black uppercase border border-green-200">
                                <CheckCircle2 size={10} /> Venta Cerrada
                              </span>
                            )}
                            {sale.status === "QUOTATION" && (
                              <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-md text-[9px] font-black uppercase border border-orange-200">
                                <FileText size={10} /> Cotización
                              </span>
                            )}
                            {sale.status === "CONVERTED" && (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-[9px] font-black uppercase border border-blue-200">
                                <CheckCircle2 size={10} /> Aprobada
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <p className="font-mono text-sm font-black text-gray-900">
                              S/{" "}
                              {(sale.totalAmount || 0).toLocaleString("es-PE", {
                                minimumFractionDigits: 2,
                              })}
                            </p>
                          </td>
                          <td className="p-4 pr-6 text-center">
                            {/* LÓGICA DE CUENTAS POR COBRAR: Solo aplica a VENTAS REALES */}
                            {isCompleted ? (
                              <button
                                onClick={() =>
                                  handleTogglePayment(
                                    sale.id,
                                    sale.paymentStatus,
                                  )
                                }
                                disabled={processingId === sale.id}
                                className={`w-full inline-flex justify-center items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition border ${
                                  isPaid
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                } disabled:opacity-50`}
                              >
                                {processingId === sale.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : isPaid ? (
                                  <>
                                    <CheckCircle2 size={14} /> Pagado
                                  </>
                                ) : (
                                  <>
                                    <Clock size={14} /> Crédito
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                No Aplica
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
