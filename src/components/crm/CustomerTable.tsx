import React from "react";
import { Building2, MapPin, Eye, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface CustomerTableProps {
  customers: any[];
  isLoading: boolean;
  currentPage: number;
  pageSize: number;
}

export function CustomerTable({
  customers,
  isLoading,
  currentPage,
  pageSize,
}: CustomerTableProps) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden overflow-x-auto min-h-[250px]">
      <table className="w-full text-left min-w-[800px] border-collapse">
        <thead className="bg-slate-50/80 border-b border-slate-100">
          <tr>
            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center w-12">
              #
            </th>
            <th className="p-4 pl-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Razón Social / Documento
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
              Dirección Fiscal
            </th>
            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
              Contactos
            </th>
            <th className="p-4 pr-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-28">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {customers.length === 0 && !isLoading ? (
            <tr>
              <td colSpan={5} className="p-12 text-center text-slate-400">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 mb-4 text-slate-400">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-slate-900 font-bold text-lg">
                  No hay clientes
                </h3>
                <p className="font-medium text-slate-500 mt-1">
                  No se encontraron clientes con esos parámetros.
                </p>
              </td>
            </tr>
          ) : (
            customers.map((customer, index) => {
              const rowNumber = (currentPage - 1) * pageSize + index + 1;

              return (
                <tr
                  key={customer.id}
                  onClick={() => router.push(`/admin/customers/${customer.id}`)}
                  className="hover:bg-blue-50/30 transition group cursor-pointer"
                >
                  <td className="p-4 text-center">
                    <span className="text-xs font-bold text-slate-400">
                      {rowNumber}
                    </span>
                  </td>
                  <td className="p-4 pl-2">
                    <p className="font-black text-slate-800 text-sm flex items-center gap-2">
                      <Building2 size={16} className="text-blue-500" />{" "}
                      {customer.name}
                    </p>
                    <p className="text-xs font-bold text-slate-400 mt-0.5 ml-6">
                      {customer.id}
                    </p>
                  </td>
                  <td className="p-4">
                    <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                      <MapPin size={14} className="text-slate-400" />{" "}
                      {customer.address || "No registrada"}
                    </p>
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center justify-center bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-lg text-xs border border-slate-200">
                      {customer.contactIds?.length || 0}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-center">
                    <button
                      className="p-2 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-100 rounded-lg transition"
                      title="Ver Perfil"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
