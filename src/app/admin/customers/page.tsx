"use client";

import { useEffect, useState } from "react";
import { getAllCustomers } from "@/services/crmService";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Building2,
  MapPin,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

export default function CustomersListPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCustomers = async () => {
      const data = await getAllCustomers();
      setCustomers(data);
      setIsLoading(false);
    };
    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter(
    (c) =>
      (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.id || "").includes(searchTerm),
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* CABECERA */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" /> Cartera de Clientes (CRM)
          </h1>
          <p className="text-gray-500 text-sm font-medium mt-1">
            Gestiona tus empresas, contactos e historial de compras.
          </p>
        </div>

        <div className="w-full md:w-96 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, RUC o DNI..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-800 outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* LISTA DE CLIENTES */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-16 flex justify-center text-blue-500">
            <Loader2 size={48} className="animate-spin" />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-16 text-center text-gray-400 flex flex-col items-center">
            <AlertCircle size={48} className="mb-4 opacity-50" />
            <h3 className="text-xl font-black text-gray-500">
              No se encontraron clientes
            </h3>
            <p className="font-medium mt-2">
              Intenta buscar con otro término o registra una nueva venta.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="p-4 pl-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Razón Social / RUC
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Dirección Fiscal
                  </th>
                  <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                    Contactos
                  </th>
                  <th className="p-4 pr-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-24">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-blue-50/30 transition group cursor-pointer"
                    onClick={() =>
                      router.push(`/admin/customers/${customer.id}`)
                    }
                  >
                    <td className="p-4 pl-6">
                      <p className="font-black text-gray-800 text-sm flex items-center gap-2">
                        <Building2 size={14} className="text-blue-500" />{" "}
                        {customer.name}
                      </p>
                      <p className="text-xs font-bold text-gray-500 mt-0.5 ml-5">
                        {customer.id}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
                        <MapPin size={12} className="text-gray-400" />{" "}
                        {customer.address || "No registrada"}
                      </p>
                    </td>
                    <td className="p-4 text-right">
                      <span className="inline-flex items-center justify-center bg-gray-100 text-gray-600 font-bold px-3 py-1 rounded-lg text-xs">
                        {customer.contactIds?.length || 0}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-center">
                      <button className="p-2 text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-100 rounded-lg transition">
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
