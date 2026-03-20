"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/clientApp";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient"; // <-- Importamos nuestra config centralizada
import {
  collection,
  onSnapshot,
  query,
  doc,
  getDoc,
  getDocs,
  setDoc,
  where,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { PRODUCT_CATALOG } from "@/config/products";
import { StockSummary } from "@/types";
import { processSale, createQuotation } from "@/services/salesService";
import {
  ShoppingCart,
  Plus,
  Trash2,
  FileText,
  CheckCircle2,
  Building2,
  Search,
  MapPin,
  Users,
  Info,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface CartItem {
  sku: string;
  quantity: number;
  unitPrice: number;
  baseCost: number;
}

interface Contact {
  id?: string;
  name: string;
  phone: string;
  email: string;
}

export default function NewSalePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicateId");

  // --- ESTADOS DEL CLIENTE (CRM RELACIONAL) ---
  const [documentNumber, setDocumentNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  // Estados para la Búsqueda Predictiva (Algolia)
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestedCustomers, setSuggestedCustomers] = useState<any[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLDivElement>(null);

  // Estados del Carrito y Stock
  const [cart, setCart] = useState<CartItem[]>([]);
  const [availableStock, setAvailableStock] = useState<StockSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSku, setSelectedSku] = useState("P64");
  const [addQuantity, setAddQuantity] = useState<number | "">("");
  const [addPrice, setAddPrice] = useState<number | "">("");
  const [baseCost, setBaseCost] = useState<number>(0);

  // 1. Cargar stock disponible
  useEffect(() => {
    const q = query(collection(db, "inventory_stock"));
    const unsub = onSnapshot(q, (snapshot) => {
      const stockData = snapshot.docs.map((doc) => ({
        sku: doc.id,
        ...doc.data(),
      })) as StockSummary[];
      setAvailableStock(stockData);
    });
    return () => unsub();
  }, []);

  // 2. Auto-rellenar costo
  useEffect(() => {
    const stockItem = availableStock.find((s) => s.sku === selectedSku);
    if (stockItem && stockItem.lastCostPerPiece) {
      const cost = Number(stockItem.lastCostPerPiece.toFixed(2));
      setBaseCost(cost);
      setAddPrice(cost);
    } else {
      setBaseCost(0);
      setAddPrice("");
    }
  }, [selectedSku, availableStock]);

  // Cerrar sugerencias si se hace clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- 3. BÚSQUEDA PREDICTIVA (ALGOLIA) ---
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestedCustomers([]);
      setShowSuggestions(false);
      return;
    }

    const performPredictiveSearch = async () => {
      setIsSearchingClient(true);
      try {
        // Método optimizado para búsqueda simple en un solo índice (v5)
        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.CUSTOMERS,
          searchParams: {
            query: searchTerm,
            hitsPerPage: 5,
          },
        });

        setSuggestedCustomers(hits);
        setShowSuggestions(hits.length > 0);
      } catch (error) {
        console.error("Error en Algolia:", error);
      } finally {
        setIsSearchingClient(false);
      }
    };
    const timeoutId = setTimeout(() => performPredictiveSearch(), 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Función al seleccionar un cliente sugerido por Algolia
  const handleSelectSuggestedCustomer = async (hit: any) => {
    setSearchTerm(hit.documentNumber || hit.objectID);
    setShowSuggestions(false);

    // Al seleccionar, cargamos toda su info desde Firebase (incluyendo contactos)
    await fetchClientData(hit.documentNumber || hit.objectID);
  };

  // --- BÚSQUEDA PROFUNDA (FIREBASE / SUNAT) ---
  const fetchClientData = async (docNum: string) => {
    const clientRef = doc(db, "customers", docNum);
    const clientSnap = await getDoc(clientRef);

    if (clientSnap.exists()) {
      const data = clientSnap.data();
      setDocumentNumber(docNum);
      setCustomerName(data.name || "");
      setCustomerAddress(data.address || "");

      const contactsQuery = query(
        collection(db, "contacts"),
        where("associatedCompanyIds", "array-contains", docNum),
      );
      const contactsSnap = await getDocs(contactsQuery);

      const fetchedContacts = contactsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Contact[];

      setContacts(fetchedContacts);
      if (fetchedContacts.length > 0 && fetchedContacts[0].id) {
        setSelectedContactId(fetchedContacts[0].id);
      }
      return true;
    }
    return false;
  };

  const handleDeepSearchClient = async () => {
    const targetDoc = searchTerm || documentNumber;
    if (targetDoc.length !== 8 && targetDoc.length !== 11) {
      return alert(
        "Ingresa un DNI (8) o RUC (11) válido para buscar en SUNAT.",
      );
    }

    setIsSearchingClient(true);
    setShowSuggestions(false);
    try {
      const existsLocally = await fetchClientData(targetDoc);

      if (!existsLocally) {
        // Fallback a la API de SUNAT si Algolia/Firebase no lo tienen
        const res = await fetch(`/api/consulta-doc?numero=${targetDoc}`);
        const data = await res.json();

        if (!res.ok)
          throw new Error(data.error || "No se pudo obtener la información.");

        const isRUC = targetDoc.length === 11;
        const nombreCompleto = isRUC
          ? data.razon_social || data.razonSocial
          : `${data.nombres || data.first_name} ${data.apellidoPaterno || data.first_last_name} ${data.apellidoMaterno || data.second_last_name}`;

        setDocumentNumber(targetDoc);
        setCustomerName(nombreCompleto);
        setCustomerAddress(data.direccion || "Dirección no registrada");
        setContacts([]);
        setSelectedContactId("");

        alert("🌐 Datos importados exitosamente desde SUNAT/RENIEC.");
      }
    } catch (error: any) {
      alert(`❌ ${error.message}`);
    } finally {
      setIsSearchingClient(false);
    }
  };

  // ... (addContact, updateContact, handleAddToCart, removeFromCart, y handleAction se mantienen iguales a tu versión original)
  const addContact = () => {
    const tempId = `temp_${Date.now()}`;
    setContacts([...contacts, { id: tempId, name: "", phone: "", email: "" }]);
    if (!selectedContactId) setSelectedContactId(tempId);
  };

  const updateContact = (
    index: number,
    field: keyof Contact,
    value: string,
  ) => {
    const newContacts = [...contacts];
    newContacts[index][field] = value;
    setContacts(newContacts);
  };

  const handleAddToCart = () => {
    if (!selectedSku || !addQuantity || !addPrice) return;
    if (Number(addPrice) < baseCost) {
      if (
        !confirm(
          `⚠️ ALERTA: Estás vendiendo por debajo del costo de producción (S/ ${baseCost}). ¿Deseas continuar y generar pérdida?`,
        )
      )
        return;
    }
    const stockItem = availableStock.find((s) => s.sku === selectedSku);
    const currentQtyInCart =
      cart.find((c) => c.sku === selectedSku)?.quantity || 0;
    const requestedTotal = currentQtyInCart + Number(addQuantity);

    if (!stockItem || stockItem.totalQuantity < requestedTotal) {
      alert(
        `⚠️ Stock insuficiente. Solo tienes ${stockItem?.totalQuantity || 0} unidades de ${selectedSku}.`,
      );
      return;
    }

    const existingItemIndex = cart.findIndex(
      (item) => item.sku === selectedSku,
    );
    if (existingItemIndex >= 0) {
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += Number(addQuantity);
      newCart[existingItemIndex].unitPrice = Number(addPrice);
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          sku: selectedSku,
          quantity: Number(addQuantity),
          unitPrice: Number(addPrice),
          baseCost,
        },
      ]);
    }
    setAddQuantity("");
  };

  const removeFromCart = (index: number) =>
    setCart(cart.filter((_, i) => i !== index));

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const totalCost = cart.reduce(
    (sum, item) => sum + item.quantity * item.baseCost,
    0,
  );
  const projectedProfit = totalAmount - totalCost;

  const handleAction = async (actionType: "QUOTE" | "SALE") => {
    if (!customerName || !documentNumber)
      return alert("Faltan datos del cliente.");
    if (cart.length === 0) return alert("El carrito está vacío.");

    setIsSubmitting(true);
    try {
      const finalContactIds: string[] = [];
      for (const contact of contacts) {
        if (!contact.name) continue;

        let contactId = contact.id;
        const isNew = !contactId || contactId.startsWith("temp_");

        if (isNew) {
          const newContactRef = doc(collection(db, "contacts"));
          contactId = newContactRef.id;
          await setDoc(newContactRef, {
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            associatedCompanyIds: [documentNumber],
            createdAt: serverTimestamp(),
          });
        } else {
          await setDoc(
            doc(db, "contacts", contactId!),
            {
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
              associatedCompanyIds: arrayUnion(documentNumber),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
        finalContactIds.push(contactId as string);
      }

      await setDoc(
        doc(db, "customers", documentNumber),
        {
          name: customerName,
          documentNumber: documentNumber,
          address: customerAddress,
          contactIds: finalContactIds,
          lastUpdate: serverTimestamp(),
        },
        { merge: true },
      );

      if (actionType === "QUOTE") {
        await createQuotation(
          customerName,
          documentNumber,
          cart,
          "VENDEDOR_ACTUAL",
        );
        alert("📄 Cotización generada con éxito.");
      } else {
        await processSale(
          customerName,
          documentNumber,
          cart,
          "VENDEDOR_ACTUAL",
        );
        alert("✅ Venta procesada. El stock ha sido descontado.");
      }
      router.push("/admin/sales");
    } catch (error: any) {
      alert(error.message || "Error al procesar la operación.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800 tracking-tight">
            <ShoppingCart className="text-blue-600" /> Nuevo Documento
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Cotización o Venta Directa con control de margen y CRM Relacional.
          </p>
        </div>
        <button
          onClick={() => router.push("/admin/sales")}
          className="text-gray-500 hover:text-blue-600 font-bold transition"
        >
          Volver a Historial
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4">
              <Building2 size={20} className="text-blue-500" /> Información de
              Facturación (Empresa)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* CAMPO DE BÚSQUEDA PREDICTIVA */}
              <div className="md:col-span-1 relative" ref={searchInputRef}>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Buscar RUC, DNI o Nombre *
                </label>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <input
                      type="text"
                      placeholder="Ej: 20123... o 'Construc...'"
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={() =>
                        setShowSuggestions(suggestedCustomers.length > 0)
                      }
                    />

                    {/* DROPDOWN DE SUGERENCIAS ALGOLIA */}
                    {showSuggestions && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                        {suggestedCustomers.map((hit) => (
                          <div
                            key={hit.objectID}
                            onClick={() => handleSelectSuggestedCustomer(hit)}
                            className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                          >
                            <p className="font-bold text-gray-800 text-sm truncate">
                              {hit.name}
                            </p>
                            <p className="text-xs text-gray-500 font-medium">
                              {hit.documentNumber || hit.objectID}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleDeepSearchClient}
                    disabled={isSearchingClient}
                    className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex-shrink-0"
                    title="Buscar profundo en SUNAT/RENIEC"
                  >
                    {isSearchingClient ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Search size={20} />
                    )}
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Razón Social / Nombre Confirmado *
                </label>
                <input
                  type="text"
                  placeholder="Se autocompletará al seleccionar"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <MapPin size={12} /> Dirección Fiscal
              </label>
              <input
                type="text"
                placeholder="Av. Los Industriales Mz B Lote 3, Lima"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </div>

            {/* SECCIÓN CONTACTOS */}
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <div className="flex justify-between items-center mb-4">
                <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-1">
                  <Users size={14} /> Contactos de Empresa
                </label>
                <button
                  onClick={addContact}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus size={14} /> Añadir Contacto
                </button>
              </div>

              {contacts.length === 0 && (
                <p className="text-xs text-blue-400 font-medium italic">
                  Sin contactos registrados.
                </p>
              )}

              <div className="space-y-3">
                {contacts.map((contact, idx) => (
                  <div
                    key={contact.id || idx}
                    className={`grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3 rounded-xl shadow-sm border transition ${selectedContactId === contact.id && contact.id ? "border-blue-400 ring-1 ring-blue-400" : "border-gray-200"}`}
                  >
                    <div className="md:col-span-1 flex items-center justify-center border-r border-gray-100">
                      <input
                        type="radio"
                        name="attentionContact"
                        checked={selectedContactId === contact.id}
                        onChange={() => {
                          if (contact.id) setSelectedContactId(contact.id);
                        }}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                        title="Atención a este contacto"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Nombre (Ej: Ing. Juan)"
                      className="md:col-span-4 p-2 border rounded-lg text-sm outline-none bg-gray-50"
                      value={contact.name}
                      onChange={(e) =>
                        updateContact(idx, "name", e.target.value)
                      }
                    />
                    <input
                      type="tel"
                      placeholder="Celular"
                      className="md:col-span-3 p-2 border rounded-lg text-sm outline-none bg-gray-50"
                      value={contact.phone}
                      onChange={(e) =>
                        updateContact(idx, "phone", e.target.value)
                      }
                    />
                    <input
                      type="email"
                      placeholder="Correo electrónico"
                      className="md:col-span-4 p-2 border rounded-lg text-sm outline-none bg-gray-50"
                      value={contact.email}
                      onChange={(e) =>
                        updateContact(idx, "email", e.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* MÓDULO DE PRODUCTOS CON PROTECCIÓN DE MARGEN */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4">
              <Plus size={20} className="text-blue-500" /> Agregar Productos
            </h2>

            <div className="flex flex-col md:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Seleccionar Producto
                </label>
                <select
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                >
                  {Object.entries(PRODUCT_CATALOG).map(([sku, prod]) => {
                    const stockItem = availableStock.find((s) => s.sku === sku);
                    const stock = stockItem?.totalQuantity || 0;
                    const cost = stockItem?.lastCostPerPiece
                      ? `(Costo: S/${stockItem.lastCostPerPiece.toFixed(2)})`
                      : "";
                    return (
                      <option key={sku} value={sku} disabled={stock === 0}>
                        {sku} - {prod.name} | Disp: {stock} u. {cost}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="w-full md:w-32">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ej: 100"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 text-center"
                  value={addQuantity}
                  onChange={(e) =>
                    setAddQuantity(e.target.value ? Number(e.target.value) : "")
                  }
                />
              </div>

              <div className="w-full md:w-40 relative group">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Precio Venta (S/)
                </label>
                <div className="absolute -top-10 left-0 bg-gray-900 text-white text-[10px] font-bold p-2 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-10">
                  Costo de Planta: S/ {baseCost.toFixed(2)}
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                    S/
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`w-full p-4 pl-10 border-2 rounded-xl font-black outline-none transition
                      ${Number(addPrice) < baseCost ? "border-red-400 text-red-600 bg-red-50" : "border-gray-200 text-green-700 bg-gray-50 focus:border-blue-500"}
                    `}
                    value={addPrice}
                    onChange={(e) =>
                      setAddPrice(e.target.value ? Number(e.target.value) : "")
                    }
                  />
                  {Number(addPrice) < baseCost && addPrice !== "" && (
                    <AlertTriangle
                      size={16}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500"
                    />
                  )}
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!addQuantity || !addPrice}
                className="w-full md:w-auto bg-gray-900 text-white px-8 py-4 rounded-xl font-black hover:bg-black disabled:opacity-50 transition active:scale-95"
              >
                Añadir
              </button>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Resumen y Acciones (Ocupa 4 columnas) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-100/50 border border-blue-100 flex flex-col h-full sticky top-6">
            <h2 className="text-xl font-black text-gray-800 mb-4 border-b border-gray-100 pb-4">
              Ticket / Cotización
            </h2>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-62.5 mb-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                  <ShoppingCart size={48} className="mb-2" />
                  <p className="text-sm font-bold">Carrito vacío</p>
                </div>
              ) : (
                cart.map((item, index) => {
                  const itemProfit =
                    (item.unitPrice - item.baseCost) * item.quantity;
                  const isLoss = item.unitPrice < item.baseCost;

                  return (
                    <div
                      key={index}
                      className={`flex justify-between items-center p-4 rounded-2xl border ${isLoss ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}
                    >
                      <div>
                        <p className="font-black text-gray-800 text-lg leading-none">
                          {item.sku}
                        </p>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                          {item.quantity} pzas x S/ {item.unitPrice.toFixed(2)}
                        </p>
                        <p
                          className={`text-[9px] font-black uppercase tracking-widest mt-2 ${isLoss ? "text-red-500" : "text-emerald-500"}`}
                        >
                          {isLoss
                            ? "⚠️ PÉRDIDA"
                            : `Margen: +S/ ${itemProfit.toFixed(2)}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="font-mono font-black text-gray-900 text-lg">
                          S/ {(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-gray-900 p-6 rounded-2xl text-white space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-400 uppercase tracking-widest text-xs">
                  Total Venta:
                </span>
                <span className="font-black text-3xl">
                  S/ {totalAmount.toFixed(2)}
                </span>
              </div>

              {cart.length > 0 && (
                <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                  <span className="font-bold text-emerald-400 flex items-center gap-1 text-xs">
                    <Info size={14} /> Ganancia Neta Proyectada:
                  </span>
                  <span
                    className={`font-mono font-bold text-sm ${projectedProfit < 0 ? "text-red-400" : "text-emerald-400"}`}
                  >
                    S/ {projectedProfit.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-4">
                <button
                  onClick={() => handleAction("QUOTE")}
                  disabled={isSubmitting || cart.length === 0}
                  className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-gray-700 text-white font-black hover:bg-gray-800 hover:border-gray-600 disabled:opacity-50 transition active:scale-95"
                >
                  <FileText size={18} /> COTIZAR
                </button>
                <button
                  onClick={() => handleAction("SALE")}
                  disabled={isSubmitting || cart.length === 0}
                  className="flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-500 disabled:opacity-50 transition shadow-lg shadow-blue-900/50 active:scale-95"
                >
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
