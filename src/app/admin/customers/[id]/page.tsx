"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCustomerProfile,
  updatePaymentStatus,
  saveContact,
  unlinkContact,
  linkExistingContact,
} from "@/services/crmService";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient"; // <-- VITAL
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  FileText,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Clock,
  Receipt,
  Users,
  AlertCircle,
  Briefcase,
  Plus,
  Edit2,
  Unplug,
  X,
  Search,
  Link as LinkIcon,
} from "lucide-react";
import toast from "react-hot-toast";

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const documentNumber = params.id as string;

  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // --- ESTADOS DE CONTACTOS ---
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactMode, setContactMode] = useState<"NEW" | "LINK">("NEW");
  const [editingContact, setEditingContact] = useState<any>(null);
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    email: "",
    role: "",
  });
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Búsqueda de existentes
  const [contactSearch, setContactSearch] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);

  const loadProfile = async () => {
    if (documentNumber) {
      const data = await getCustomerProfile(documentNumber);
      setProfile(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, [documentNumber]);

  // BUSCADOR DE CONTACTOS EXISTENTES (Algolia)
  useEffect(() => {
    const searchExisting = async () => {
      if (contactMode !== "LINK" || contactSearch.length < 2) {
        setSearchSuggestions([]);
        return;
      }
      try {
        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.CONTACTS || "contacts_index",
          searchParams: { query: contactSearch, hitsPerPage: 5 },
        });
        setSearchSuggestions(hits);
      } catch (e) {
        console.error(e);
      }
    };
    const timer = setTimeout(searchExisting, 300);
    return () => clearTimeout(timer);
  }, [contactSearch, contactMode]);

  const handleLinkExisting = async (contact: any) => {
    setIsSavingContact(true);
    try {
      await linkExistingContact(contact.objectID || contact.id, documentNumber);
      toast.success("Contacto vinculado correctamente");
      setIsContactModalOpen(false);
      loadProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingContact(true);
    try {
      await saveContact(
        editingContact?.id || null,
        contactForm,
        documentNumber,
      );
      toast.success(editingContact ? "Actualizado" : "Creado");
      setIsContactModalOpen(false);
      loadProfile();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSavingContact(false);
    }
  };

  // ... (handleTogglePayment y handleUnlink se mantienen igual)

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh]">
        <Loader2 size={48} className="animate-spin text-blue-600" />
      </div>
    );
  if (!profile)
    return (
      <div className="text-center p-12 text-red-500 font-bold">
        No encontrado
      </div>
    );

  const { customerData, contacts, salesHistory } = profile;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 relative">
      <button
        onClick={() => router.push("/admin/customers")}
        className="text-slate-500 hover:text-blue-600 font-bold flex items-center gap-2"
      >
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* TARJETA DE EMPRESA */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <Building2 size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-900">
              {customerData.name}
            </h2>
            <p className="text-sm font-bold text-slate-500 font-mono mb-6">
              {customerData.id}
            </p>
            <div className="pt-4 border-t border-slate-100 flex items-start gap-3">
              <MapPin size={16} className="text-slate-400 mt-0.5" />
              <p className="text-sm font-medium text-slate-700">
                {customerData.address || "No registrada"}
              </p>
            </div>
          </div>

          {/* CONTACTOS */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                <Users size={16} className="text-blue-500" /> Contactos
              </h3>
              <button
                onClick={() => {
                  setContactMode("NEW");
                  setIsContactModalOpen(true);
                }}
                className="bg-blue-50 text-blue-600 p-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition"
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {contacts.map((c: any) => (
                <div
                  key={c.id}
                  className="bg-slate-50 p-4 rounded-xl border border-slate-100 group relative"
                >
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                    <button
                      onClick={() => {
                        setContactMode("NEW");
                        setEditingContact(c);
                        setContactForm(c);
                        setIsContactModalOpen(true);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() =>
                        unlinkContact(c.id, documentNumber).then(() =>
                          loadProfile(),
                        )
                      }
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Unplug size={14} />
                    </button>
                  </div>
                  <p className="font-black text-slate-900 text-sm">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.phone || c.email}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* HISTORIAL DE VENTAS (RESOLUCIÓN DE VENTAS CERRADAS) */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Receipt className="text-blue-500" size={20} /> Historial
                Operativo
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
                      <td
                        colSpan={4}
                        className="p-12 text-center text-slate-400 font-bold"
                      >
                        Sin operaciones para el RUC {documentNumber}
                      </td>
                    </tr>
                  ) : (
                    salesHistory.map((sale: any) => (
                      <tr
                        key={sale.id}
                        className="hover:bg-blue-50/30 transition"
                      >
                        <td className="p-4 pl-6">
                          <p className="text-sm font-black text-slate-900">
                            {sale.id}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400">
                            {sale.timestamp?.toDate
                              ? sale.timestamp
                                  .toDate()
                                  .toLocaleDateString("es-PE")
                              : "---"}
                          </p>
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase border ${sale.status === "COMPLETED" ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}
                          >
                            {sale.status === "COMPLETED"
                              ? "Venta Cerrada"
                              : "Cotización"}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-black">
                          S/ {sale.totalAmount?.toFixed(2)}
                        </td>
                        <td className="p-4 pr-6 text-center">
                          {sale.status === "COMPLETED" && (
                            <button
                              onClick={() =>
                                updatePaymentStatus(
                                  sale.id,
                                  sale.paymentStatus === "PAID"
                                    ? "PENDING"
                                    : "PAID",
                                ).then(() => loadProfile())
                              }
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border transition ${sale.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}
                            >
                              {sale.paymentStatus === "PAID"
                                ? "Pagado"
                                : "Crédito"}
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
        </div>
      </div>

      {/* MODAL MULTI-MODO PARA CONTACTOS */}
      {isContactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="flex p-1 bg-slate-100 m-4 rounded-xl">
              <button
                onClick={() => setContactMode("NEW")}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition ${contactMode === "NEW" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                NUEVO CONTACTO
              </button>
              <button
                onClick={() => setContactMode("LINK")}
                className={`flex-1 py-2 text-xs font-black rounded-lg transition ${contactMode === "LINK" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                ENLAZAR EXISTENTE
              </button>
            </div>

            {contactMode === "NEW" ? (
              <form onSubmit={handleSaveContact} className="p-6 pt-2 space-y-4">
                <input
                  type="text"
                  placeholder="Nombre completo"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  value={contactForm.name}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, name: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Cargo (Opcional)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  value={contactForm.role}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, role: e.target.value })
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    placeholder="Teléfono"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    value={contactForm.phone}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, phone: e.target.value })
                    }
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingContact}
                  className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition"
                >
                  GUARDAR CONTACTO
                </button>
              </form>
            ) : (
              <div className="p-6 pt-2 space-y-4">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-3.5 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o empresa..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchSuggestions.map((s: any) => (
                    <button
                      key={s.objectID}
                      onClick={() => handleLinkExisting(s)}
                      className="w-full p-3 text-left hover:bg-blue-50 border border-slate-100 rounded-xl transition flex justify-between items-center group"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-800">
                          {s.name}
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase">
                          {s.role || "Sin cargo"}
                        </p>
                      </div>
                      <LinkIcon
                        size={16}
                        className="text-slate-300 group-hover:text-blue-500"
                      />
                    </button>
                  ))}
                  {contactSearch.length > 2 &&
                    searchSuggestions.length === 0 && (
                      <p className="text-center py-4 text-xs text-slate-400">
                        No se encontraron contactos
                      </p>
                    )}
                </div>
              </div>
            )}
            <button
              onClick={() => setIsContactModalOpen(false)}
              className="w-full py-4 text-xs font-black text-slate-400 hover:text-slate-600 border-t border-slate-50"
            >
              CANCELAR Y CERRAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
