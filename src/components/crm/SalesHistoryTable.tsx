"use client";

import { Receipt } from "lucide-react";

interface SaleRecord {
  id: string;
  timestamp?: { toDate: () => Date };
  status: string;
  totalAmount?: number;
  paymentStatus?: string;
}

interface SalesHistoryTableProps {
  salesHistory: SaleRecord[];
  documentNumber: string;
  onTogglePayment: (saleId: string, currentStatus: string) => void;
}

export function SalesHistoryTable({
  salesHistory,
  documentNumber,
  onTogglePayment,
}: SalesHistoryTableProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
          <Receipt className="text-blue-500" size={20} /> Historial Operativo
        </h2>
      </div>
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-white border-b border-slate-100">
            <tr>
              <th className="p-4 pl-6 text-[10px] font-black text-slate-400 uppercase">
                Documento
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase">
                Estado
              </th>
              <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right">
                Total
              </th>
              <th className="p-4 pr-6 text-[10px] font-black text-slate-400 uppercase text-center">
                Cobranza
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {salesHistory.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-12 text-center text-slate-400 font-bold">
                  Sin operaciones para el RUC {documentNumber}
                </td>
              </tr>
            ) : (
              salesHistory.map((sale) => (
                <tr key={sale.id} className="hover:bg-blue-50/30 transition">
                  <td className="p-4 pl-6">
                    <p className="text-sm font-black text-slate-900">{sale.id}</p>
                    <p className="text-[10px] font-bold text-slate-400">
                      {sale.timestamp?.toDate
                        ? sale.timestamp.toDate().toLocaleDateString("es-PE")
                        : "---"}
                    </p>
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase border ${
                        sale.status === "COMPLETED"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-orange-50 text-orange-700 border-orange-200"
                      }`}
                    >
                      {sale.status === "COMPLETED" ? "Venta Cerrada" : "Cotización"}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-black">
                    S/ {sale.totalAmount?.toFixed(2)}
                  </td>
                  <td className="p-4 pr-6 text-center">
                    {sale.status === "COMPLETED" && (
                      <button
                        onClick={() => onTogglePayment(sale.id, sale.paymentStatus ?? "PENDING")}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition ${
                          sale.paymentStatus === "PAID"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                            : "bg-red-50 text-red-600 border-red-200"
                        }`}
                      >
                        {sale.paymentStatus === "PAID" ? "Pagado" : "Crédito"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
