"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/clientApp";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  where,
  arrayUnion,
  serverTimestamp,
  query,
} from "firebase/firestore";
import { getSystemSettings, SystemSettings } from "@/services/settingsService";
import { processSale, createQuotation, type CartItem } from "@/services/salesService";
import { useAuth } from "@/context/AuthContext";
import ProductSelector from "@/core/sales/components/ProductSelector";
import {
  ShoppingCart,
  Trash2,
  FileText,
  CheckCircle2,
  Building2,
  Search,
  MapPin,
  Users,
  Info,
  Loader2,
  Scale,
  Percent,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";

const IGV_RATE = 0.18;

interface Contact {
  id?: string;
  name: string;
  phone: string;
  email: string;
}

const LINE_BADGES: Record<string, { label: string; cls: string }> = {
  drywall: { label: "DRY", cls: "bg-blue-100 text-blue-700" },
  roofing: { label: "PVC", cls: "bg-emerald-100 text-emerald-700" },
};

export default function NewSalePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicateId");

  const { user } = useAuth();

  const [settings, setSettings] = useState<SystemSettings | null>(null);

  const [documentNumber, setDocumentNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [globalContacts, setGlobalContacts] = useState<Contact[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [suggestedCustomers, setSuggestedCustomers] = useState<Record<string, unknown>[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLDivElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. CARGA INICIAL
  useEffect(() => {
    const load = async () => {
      const [dataSettings, contactsSnap] = await Promise.all([
        getSystemSettings(),
        getDocs(collection(db, "contacts")),
      ]);
      setSettings(dataSettings);
      setGlobalContacts(
        contactsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Contact),
      );
    };
    load();
  }, []);

  // 2. CLIC FUERA DEL BUSCADOR DE CLIENTES
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 3. BÚSQUEDA PREDICTIVA DE CLIENTES
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestedCustomers([]);
      setShowSuggestions(false);
      return;
    }
    const t = setTimeout(async () => {
      setIsSearchingClient(true);
      try {
        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.CUSTOMERS,
          searchParams: { query: searchTerm, hitsPerPage: 5 },
        });
        setSuggestedCustomers(hits as Record<string, unknown>[]);
        setShowSuggestions(hits.length > 0);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearchingClient(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // 4. CARGAR VENTA DUPLICADA
  useEffect(() => {
    const loadDuplicate = async () => {
      if (!duplicateId) return;
      try {
        const snap = await getDoc(doc(db, "sales", duplicateId));
        if (snap.exists()) {
          const data = snap.data();
          const docNum = data.documentNumber || "";
          setDocumentNumber(docNum);
          setCustomerName(data.customerName || "");
          setSearchTerm(docNum);
          if (docNum) await fetchClientData(docNum);
          setCart(
            (data.items || []).map((item: CartItem) => ({
              ...item,
              businessLine: item.businessLine ?? "drywall",
              unitValue: item.unitValue || item.unitPrice / (1 + IGV_RATE),
            })),
          );
        }
      } catch (e) {
        console.error("Error al duplicar venta:", e);
      }
    };
    loadDuplicate();
  }, [duplicateId]);  

  // ── Lógica de clientes ───────────────────────────────────────────────────
  const fetchClientData = async (docNum: string) => {
    const snap = await getDoc(doc(db, "customers", docNum));
    if (snap.exists()) {
      const data = snap.data();
      setDocumentNumber(docNum);
      setCustomerName(data.name || "");
      setCustomerAddress(data.address || "");

      const cSnap = await getDocs(query(collection(db, "contacts"), where("associatedCompanyIds", "array-contains", docNum)));
      const fetched = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Contact);
      setContacts(fetched);
      if (fetched.length > 0 && fetched[0].id) setSelectedContactId(fetched[0].id);
      return true;
    }
    return false;
  };

  const handleSelectSuggestedCustomer = async (hit: Record<string, unknown>) => {
    setSearchTerm((hit.documentNumber ?? hit.objectID) as string);
    setShowSuggestions(false);
    await fetchClientData((hit.documentNumber ?? hit.objectID) as string);
  };

  const handleDeepSearchClient = async () => {
    const targetDoc = searchTerm || documentNumber;
    if (targetDoc.length !== 8 && targetDoc.length !== 11) {
      return toast.error("Ingresa un DNI (8) o RUC (11) válido para buscar.");
    }
    setIsSearchingClient(true);
    setShowSuggestions(false);
    try {
      const existsLocally = await fetchClientData(targetDoc);
      if (!existsLocally) {
        const res = await fetch(`/api/consulta-doc?numero=${targetDoc}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo obtener la información.");
        const isRUC = targetDoc.length === 11;
        const nombre = isRUC
          ? data.razon_social ?? data.razonSocial
          : `${data.nombres ?? data.first_name} ${data.apellidoPaterno ?? data.first_last_name} ${data.apellidoMaterno ?? data.second_last_name}`;
        setDocumentNumber(targetDoc);
        setCustomerName(nombre);
        setCustomerAddress(data.direccion || "Dirección no registrada");
        setContacts([]);
        setSelectedContactId("");
        toast.success("Datos importados desde SUNAT/RENIEC.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al buscar cliente.");
    } finally {
      setIsSearchingClient(false);
    }
  };

  const addContact = () => {
    const tempId = `temp_${Date.now()}`;
    setContacts([...contacts, { id: tempId, name: "", phone: "", email: "" }]);
    if (!selectedContactId) setSelectedContactId(tempId);
  };

  const handleContactNameChange = (index: number, newName: string) => {
    const updated = [...contacts];
    updated[index].name = newName;
    const existing = globalContacts.find((c) => c.name.toLowerCase() === newName.toLowerCase());
    if (existing) {
      updated[index] = { ...updated[index], id: existing.id, phone: existing.phone || "", email: existing.email || "" };
      toast.success(`Contacto "${existing.name}" autocompletado.`);
    } else if (updated[index].id && !updated[index].id?.startsWith("temp_")) {
      updated[index].id = `temp_${Date.now()}`;
    }
    setContacts(updated);
  };

  const updateContact = (index: number, field: keyof Contact, value: string) => {
    const updated = [...contacts];
    updated[index][field] = value;
    setContacts(updated);
  };

  // ── Gestión del carrito ──────────────────────────────────────────────────

  function handleAddItem(newItem: CartItem) {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.sku === newItem.sku && (i.businessLine ?? "drywall") === (newItem.businessLine ?? "drywall"),
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + newItem.quantity,
          unitPrice: newItem.unitPrice,
          unitValue: newItem.unitValue,
        };
        return updated;
      }
      return [...prev, newItem];
    });
  }

  const removeFromCart = (index: number) => setCart(cart.filter((_, i) => i !== index));

  // ── Cálculos de resumen ──────────────────────────────────────────────────
  const totalAmount = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalValue = cart.reduce((s, i) => s + i.quantity * i.unitValue, 0);
  const totalCost = cart.reduce((s, i) => s + i.quantity * i.baseCost, 0);
  const totalIGV = totalAmount - totalValue;
  const totalWeight = cart.reduce((s, i) => s + i.quantity * (i.unitWeight ?? 0), 0);
  const projectedProfit = totalValue - totalCost;
  const marginPercent = totalValue > 0 ? (projectedProfit / totalValue) * 100 : 0;
  const MIN_MARGIN_ALERT = settings?.minMarginPercent ?? 20;

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleAction = async (actionType: "QUOTE" | "SALE") => {
    if (!customerName || !documentNumber) return toast.error("Faltan datos del cliente.");
    if (cart.length === 0) return toast.error("El carrito está vacío.");

    setIsSubmitting(true);
    try {
      const finalContactIds: string[] = [];
      for (const contact of contacts) {
        if (!contact.name) continue;
        let contactId = contact.id;
        const isNew = !contactId || contactId.startsWith("temp_");
        if (isNew) {
          const ref = doc(collection(db, "contacts"));
          contactId = ref.id;
          await setDoc(ref, { name: contact.name, phone: contact.phone, email: contact.email, associatedCompanyIds: [documentNumber], createdAt: serverTimestamp() });
        } else {
          await setDoc(doc(db, "contacts", contactId!), { name: contact.name, phone: contact.phone, email: contact.email, associatedCompanyIds: arrayUnion(documentNumber), updatedAt: serverTimestamp() }, { merge: true });
        }
        finalContactIds.push(contactId as string);
      }

      const docType = documentNumber.length === 11 ? "RUC" : documentNumber.length === 8 ? "DNI" : "TAX_ID";
      await setDoc(doc(db, "customers", documentNumber), { name: customerName, documentNumber, documentType: docType, address: customerAddress, contactIds: finalContactIds, lastUpdate: serverTimestamp() }, { merge: true });

      const sellerId = user?.email ?? user?.uid ?? "VENDEDOR_DESCONOCIDO";
      const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? contacts[0];

      if (actionType === "QUOTE") {
        await createQuotation(customerName, documentNumber, cart, sellerId, customerAddress, selectedContact?.name ?? "", selectedContact?.phone ?? "");
        toast.success("Cotización generada con éxito.");
      } else {
        await processSale(customerName, documentNumber, cart, sellerId, customerAddress, selectedContact?.name ?? "", selectedContact?.phone ?? "");
        toast.success("Venta procesada. El stock fue descontado.");
      }
      router.push("/admin/sales");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al procesar la operación.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <datalist id="global-contacts-list">
        {globalContacts.map((c) => <option key={c.id} value={c.name} />)}
      </datalist>

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800 tracking-tight">
            <ShoppingCart className="text-blue-600" /> Nuevo Documento
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Cotización o Venta Directa — Drywall · Coberturas PVC · Bobinas M.P.
          </p>
        </div>
        <button onClick={() => router.push("/admin/sales")} className="text-gray-500 hover:text-blue-600 font-bold transition">
          Volver a Historial
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 space-y-6">
          {/* Customer */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4">
              <Building2 size={20} className="text-blue-500" /> Información de Facturación
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="md:col-span-1 relative" ref={searchInputRef}>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Buscar RUC, DNI o Nombre *</label>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <input
                      type="text"
                      placeholder="Ej: 20123..."
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 h-[48px]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={() => setShowSuggestions(suggestedCustomers.length > 0)}
                    />
                    {showSuggestions && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                        {suggestedCustomers.map((hit) => (
                          <div key={String(hit.objectID)} onClick={() => void handleSelectSuggestedCustomer(hit)} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0">
                            <p className="font-bold text-gray-800 text-sm truncate">{String(hit.name ?? "")}</p>
                            <p className="text-xs text-gray-500 font-medium">{String(hit.documentNumber ?? hit.objectID)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => void handleDeepSearchClient()}
                    disabled={isSearchingClient}
                    className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center shrink-0 h-[48px]"
                  >
                    {isSearchingClient ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Razón Social / Nombre Confirmado *</label>
                <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 h-[48px]" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
            </div>
            <div className="mb-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin size={12} /> Dirección Fiscal</label>
              <input type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-500" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
            </div>
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <div className="flex justify-between items-center mb-4">
                <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-1"><Users size={14} /> Contactos</label>
                <button onClick={addContact} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"><Plus size={14} /> Añadir</button>
              </div>
              {contacts.length === 0 && <p className="text-xs text-blue-400 font-medium italic mb-2">Sin contactos. Escribe un nombre y el sistema buscará en el Directorio Global.</p>}
              <div className="space-y-3">
                {contacts.map((contact, idx) => (
                  <div key={contact.id || idx} className={`grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3 rounded-xl shadow-sm border transition ${selectedContactId === contact.id && contact.id ? "border-blue-400 ring-1 ring-blue-400" : "border-gray-200"}`}>
                    <div className="md:col-span-1 flex items-center justify-center border-r border-gray-100">
                      <input type="radio" checked={selectedContactId === contact.id} onChange={() => { if (contact.id) setSelectedContactId(contact.id); }} className="w-4 h-4 text-blue-600 cursor-pointer" />
                    </div>
                    <input type="text" list="global-contacts-list" placeholder="Nombre..." className="md:col-span-4 p-2 border border-gray-200 rounded-lg text-sm bg-white font-bold focus:ring-2 focus:ring-blue-400 outline-none" value={contact.name} onChange={(e) => handleContactNameChange(idx, e.target.value)} />
                    <input type="tel" placeholder="Celular" className="md:col-span-3 p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-400 outline-none" value={contact.phone} onChange={(e) => updateContact(idx, "phone", e.target.value)} />
                    <input type="email" placeholder="Correo" className="md:col-span-4 p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-400 outline-none" value={contact.email} onChange={(e) => updateContact(idx, "email", e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Multi-line product selector */}
          <ProductSelector cartItems={cart} settings={settings} onAdd={handleAddItem} />
        </div>

        {/* RIGHT COLUMN — Cart summary */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-100/50 border border-blue-100 flex flex-col h-full sticky top-6">
            <h2 className="text-xl font-black text-gray-800 mb-4 border-b border-gray-100 pb-4 flex justify-between items-center">
              <span>Resumen</span>
              {totalWeight > 0 && (
                <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full flex items-center gap-1">
                  <Scale size={14} /> {totalWeight.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
                </span>
              )}
            </h2>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px] mb-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                  <ShoppingCart size={48} className="mb-2" />
                  <p className="text-sm font-bold">Carrito vacío</p>
                </div>
              ) : (
                cart.map((item, index) => {
                  const itemProfit = (item.unitValue - item.baseCost) * item.quantity;
                  const itemMargin = item.unitValue > 0 ? ((item.unitValue - item.baseCost) / item.unitValue) * 100 : 0;
                  const isLoss = item.unitValue < item.baseCost;
                  const isLowMargin = !isLoss && itemMargin < MIN_MARGIN_ALERT - 0.5;
                  const lineBadge = LINE_BADGES[item.businessLine ?? "drywall"];

                  return (
                    <div key={index} className={`flex justify-between items-center p-4 rounded-2xl border ${isLoss || isLowMargin ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
                      <div>
                        <p className="font-black text-gray-800 text-lg leading-none flex items-center gap-2">
                          {item.sku}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md uppercase font-black ${lineBadge?.cls ?? "bg-gray-100 text-gray-500"}`}>
                            {lineBadge?.label ?? item.businessLine}
                          </span>
                          {item.isCoil && <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md uppercase">M. Prima</span>}
                        </p>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                          {item.quantity} {item.isCoil ? "kg" : "pzas"} × S/ {item.unitPrice.toFixed(2)}
                        </p>
                        <p className={`text-[9px] font-black uppercase tracking-widest mt-1.5 ${isLoss || isLowMargin ? "text-red-500" : "text-emerald-500"}`}>
                          {isLoss ? "⚠️ PÉRDIDA" : isLowMargin ? "⚠️ MARGEN BAJO" : `+S/ ${itemProfit.toFixed(2)}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="font-mono font-black text-gray-900 text-lg">S/ {(item.quantity * item.unitPrice).toFixed(2)}</span>
                        <button onClick={() => removeFromCart(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl text-white space-y-4">
              <div className="flex justify-between items-center text-gray-400 text-sm font-medium">
                <span>Subtotal (Valor Venta)</span>
                <span>S/ {totalValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-400 text-sm font-medium">
                <span>IGV (18%)</span>
                <span>S/ {totalIGV.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                <span className="font-bold text-gray-200 uppercase tracking-widest text-sm">TOTAL:</span>
                <span className="font-black text-3xl">S/ {totalAmount.toFixed(2)}</span>
              </div>
              {cart.length > 0 && (
                <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                  <div className="flex flex-col">
                    <span className="font-bold text-emerald-400 flex items-center gap-1 text-xs"><Info size={14} /> Ganancia Neta Real:</span>
                    <span className={`text-[10px] font-black mt-1 flex items-center gap-0.5 uppercase tracking-widest ${marginPercent < MIN_MARGIN_ALERT - 0.5 ? "text-red-400" : "text-gray-400"}`}>
                      <Percent size={10} /> Rentabilidad: {marginPercent.toFixed(1)}%
                    </span>
                  </div>
                  <span className={`font-mono font-bold text-lg ${projectedProfit < 0 ? "text-red-400" : "text-emerald-400"}`}>
                    S/ {projectedProfit.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button onClick={() => void handleAction("QUOTE")} disabled={isSubmitting || cart.length === 0} className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-gray-700 text-white font-black hover:bg-gray-800 disabled:opacity-50 transition active:scale-95">
                  <FileText size={18} /> COTIZAR
                </button>
                <button onClick={() => void handleAction("SALE")} disabled={isSubmitting || cart.length === 0} className="flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-500 disabled:opacity-50 transition shadow-lg shadow-blue-900/50 active:scale-95">
                  <CheckCircle2 size={18} /> VENDER
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
