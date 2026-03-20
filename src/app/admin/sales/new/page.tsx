"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/clientApp";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
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
import { getCatalog, ProductConfig } from "@/services/catalogService";
import { getSystemSettings, SystemSettings } from "@/services/settingsService";
import { StockSummary } from "@/types";
import { processSale, createQuotation } from "@/services/salesService";
import { useAuth } from "@/context/AuthContext";
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
  Scale,
  Percent,
} from "lucide-react";
import toast from "react-hot-toast";

interface CartItem {
  sku: string;
  quantity: number;
  unitPrice: number;
  baseCost: number;
  unitWeight: number;
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

  const { user } = useAuth();

  // --- ESTADOS GLOBALES ---
  const [catalog, setCatalog] = useState<ProductConfig[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  // --- ESTADOS DEL CLIENTE ---
  const [documentNumber, setDocumentNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");

  const [searchTerm, setSearchTerm] = useState("");
  const [suggestedCustomers, setSuggestedCustomers] = useState<any[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLDivElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [availableStock, setAvailableStock] = useState<StockSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedSku, setSelectedSku] = useState("");
  const [addQuantity, setAddQuantity] = useState<number | "">("");
  const [addPrice, setAddPrice] = useState<number | "">("");
  const [baseCost, setBaseCost] = useState<number>(0);

  // Carga inicial
  useEffect(() => {
    const fetchGlobals = async () => {
      const dataSettings = await getSystemSettings();
      setSettings(dataSettings);

      const dataCatalog = await getCatalog();
      const activeProducts = dataCatalog.filter((p) => p.isActive);
      setCatalog(activeProducts);

      if (activeProducts.length > 0 && !selectedSku) {
        setSelectedSku(activeProducts[0].sku);
      }
    };
    fetchGlobals();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    const loadDuplicateSale = async () => {
      if (!duplicateId || catalog.length === 0) return;
      try {
        const saleRef = doc(db, "sales", duplicateId);
        const saleSnap = await getDoc(saleRef);
        if (saleSnap.exists()) {
          const data = saleSnap.data();
          const docNum = data.documentNumber || "";
          setDocumentNumber(docNum);
          setCustomerName(data.customerName || "");
          setSearchTerm(docNum);
          if (docNum) await fetchClientData(docNum);

          const oldItems = data.items || [];
          const migratedItems = oldItems.map((item: any) => {
            const productInfo = catalog.find((p) => p.sku === item.sku);
            return {
              ...item,
              unitWeight: item.unitWeight || productInfo?.standardWeight || 0,
            };
          });
          setCart(migratedItems);
        }
      } catch (error) {
        console.error("Error al duplicar venta:", error);
      }
    };
    loadDuplicateSale();
  }, [duplicateId, catalog]);

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

  useEffect(() => {
    if (!selectedSku) return;
    const stockItem = availableStock.find((s) => s.sku === selectedSku);
    if (stockItem && stockItem.lastCostPerPiece) {
      const cost = Number(stockItem.lastCostPerPiece.toFixed(2));
      setBaseCost(cost);

      const targetMargin = (settings?.minMarginPercent || 20) / 100;
      const suggestedPrice = cost / (1 - targetMargin);
      setAddPrice(Number(suggestedPrice.toFixed(2)));
    } else {
      setBaseCost(0);
      setAddPrice("");
    }
  }, [selectedSku, availableStock, settings]);

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

  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSuggestedCustomers([]);
      setShowSuggestions(false);
      return;
    }
    const performPredictiveSearch = async () => {
      setIsSearchingClient(true);
      try {
        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.CUSTOMERS,
          searchParams: { query: searchTerm, hitsPerPage: 5 },
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

  const handleSelectSuggestedCustomer = async (hit: any) => {
    setSearchTerm(hit.documentNumber || hit.objectID);
    setShowSuggestions(false);
    await fetchClientData(hit.documentNumber || hit.objectID);
  };

  const handleDeepSearchClient = async () => {
    const targetDoc = searchTerm || documentNumber;
    if (targetDoc.length !== 8 && targetDoc.length !== 11) {
      return toast.success(
        "Ingresa un DNI (8) o RUC (11) válido para buscar en SUNAT.",
      );
    }
    setIsSearchingClient(true);
    setShowSuggestions(false);
    try {
      const existsLocally = await fetchClientData(targetDoc);
      if (!existsLocally) {
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
        toast.success("🌐 Datos importados exitosamente desde SUNAT/RENIEC.");
      }
    } catch (error: any) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setIsSearchingClient(false);
    }
  };

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
      toast.error(
        `⚠️ Stock insuficiente. Solo tienes ${stockItem?.totalQuantity || 0} unidades de ${selectedSku}.`,
      );
      return;
    }

    const productInfo = catalog.find((p) => p.sku === selectedSku);
    const unitWeight = productInfo?.standardWeight || 0;
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
          unitWeight,
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
  const totalWeight = cart.reduce(
    (sum, item) => sum + item.quantity * item.unitWeight,
    0,
  );

  const projectedProfit = totalAmount - totalCost;
  const marginPercent =
    totalAmount > 0 ? (projectedProfit / totalAmount) * 100 : 0;

  const MIN_MARGIN_ALERT = settings?.minMarginPercent ?? 20;
  const LOW_STOCK_ALERT = settings?.lowStockProduct ?? 100;

  const handleAction = async (actionType: "QUOTE" | "SALE") => {
    if (!customerName || !documentNumber)
      return toast.error("Faltan datos del cliente.");
    if (cart.length === 0) return toast.error("El carrito está vacío.");

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

      const sellerId = user?.email || user?.uid || "VENDEDOR_DESCONOCIDO";
      const selectedContact =
        contacts.find((c) => c.id === selectedContactId) || contacts[0];
      const contactNameFinal = selectedContact?.name || "";
      const contactPhoneFinal = selectedContact?.phone || "";

      if (actionType === "QUOTE") {
        await createQuotation(
          customerName,
          documentNumber,
          cart,
          sellerId,
          customerAddress,
          contactNameFinal,
          contactPhoneFinal,
        );
        toast.success("📄 Cotización generada con éxito.");
      } else {
        await processSale(
          customerName,
          documentNumber,
          cart,
          sellerId,
          customerAddress,
          contactNameFinal,
          contactPhoneFinal,
        );
        toast.success("✅ Venta procesada. El stock ha sido descontado.");
      }
      router.push("/admin/sales");
    } catch (error: any) {
      toast.error(error.message || "Error al procesar la operación.");
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
            Cotización o Venta Directa con alertas dinámicas.
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
              Facturación
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="md:col-span-1 relative" ref={searchInputRef}>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Buscar RUC, DNI o Nombre *
                </label>
                <div className="flex gap-2">
                  <div className="relative w-full">
                    <input
                      type="text"
                      placeholder="Ej: 20123..."
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={() =>
                        setShowSuggestions(suggestedCustomers.length > 0)
                      }
                    />
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
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
            </div>
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <div className="flex justify-between items-center mb-4">
                <label className="text-[10px] font-black text-blue-800 uppercase tracking-widest flex items-center gap-1">
                  <Users size={14} /> Contactos
                </label>
                <button
                  onClick={addContact}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Plus size={14} /> Añadir
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
                        checked={selectedContactId === contact.id}
                        onChange={() => {
                          if (contact.id) setSelectedContactId(contact.id);
                        }}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Nombre"
                      className="md:col-span-4 p-2 border rounded-lg text-sm bg-gray-50"
                      value={contact.name}
                      onChange={(e) =>
                        updateContact(idx, "name", e.target.value)
                      }
                    />
                    <input
                      type="tel"
                      placeholder="Celular"
                      className="md:col-span-3 p-2 border rounded-lg text-sm bg-gray-50"
                      value={contact.phone}
                      onChange={(e) =>
                        updateContact(idx, "phone", e.target.value)
                      }
                    />
                    <input
                      type="email"
                      placeholder="Correo"
                      className="md:col-span-4 p-2 border rounded-lg text-sm bg-gray-50"
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

          {/* MÓDULO DE PRODUCTOS */}
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
                  {catalog
                    .filter((p) => p.isActive)
                    .map((prod) => {
                      const stockItem = availableStock.find(
                        (s) => s.sku === prod.sku,
                      );
                      const stock = stockItem?.totalQuantity || 0;
                      const isLowStock = stock > 0 && stock <= LOW_STOCK_ALERT;
                      return (
                        <option
                          key={prod.sku}
                          value={prod.sku}
                          disabled={stock === 0}
                        >
                          {prod.sku} - {prod.name} | Disp: {stock}{" "}
                          {isLowStock ? "⚠️ (Bajo)" : ""}
                        </option>
                      );
                    })}
                </select>
                {(() => {
                  const s =
                    availableStock.find((s) => s.sku === selectedSku)
                      ?.totalQuantity || 0;
                  if (s > 0 && s <= LOW_STOCK_ALERT) {
                    return (
                      <p className="text-[10px] text-orange-500 font-bold mt-1 flex items-center gap-1">
                        <AlertTriangle size={12} /> Quedan pocas unidades ({s}).
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="w-full md:w-32">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
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
                  Costo Base: S/ {baseCost.toFixed(2)}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                    S/
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={`w-full p-4 pl-10 border-2 rounded-xl font-black outline-none transition ${Number(addPrice) < baseCost ? "border-red-400 text-red-600 bg-red-50" : "border-gray-200 text-green-700 bg-gray-50 focus:border-blue-500"}`}
                    value={addPrice}
                    onChange={(e) =>
                      setAddPrice(e.target.value ? Number(e.target.value) : "")
                    }
                  />
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

        {/* COLUMNA DERECHA: Resumen */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-blue-100/50 border border-blue-100 flex flex-col h-full sticky top-6">
            <h2 className="text-xl font-black text-gray-800 mb-4 border-b border-gray-100 pb-4 flex justify-between items-center">
              <span>Resumen</span>
              {totalWeight > 0 && (
                <span className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-full flex items-center gap-1">
                  <Scale size={14} /> {totalWeight.toLocaleString("es-PE")} kg
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
                  const itemProfit =
                    (item.unitPrice - item.baseCost) * item.quantity;
                  const itemMargin =
                    ((item.unitPrice - item.baseCost) / item.unitPrice) * 100;
                  const isLoss = item.unitPrice < item.baseCost;

                  // TOLERANCIA DEL 0.5% POR REDONDEO DECIMAL AL GENERAR PRECIO AUTO
                  const isLowMargin =
                    !isLoss && itemMargin < MIN_MARGIN_ALERT - 0.5;

                  return (
                    <div
                      key={index}
                      className={`flex justify-between items-center p-4 rounded-2xl border ${isLoss || isLowMargin ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}
                    >
                      <div>
                        <p className="font-black text-gray-800 text-lg leading-none">
                          {item.sku}
                        </p>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                          {item.quantity} pzas x S/ {item.unitPrice.toFixed(2)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <p
                            className={`text-[9px] font-black uppercase tracking-widest ${isLoss || isLowMargin ? "text-red-500" : "text-emerald-500"}`}
                          >
                            {isLoss
                              ? "⚠️ PÉRDIDA"
                              : isLowMargin
                                ? "⚠️ MARGEN BAJO"
                                : `Margen: +S/ ${itemProfit.toFixed(2)}`}
                          </p>
                        </div>
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

            {/* TABLERO INFERIOR */}
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
                  <div className="flex flex-col">
                    <span className="font-bold text-emerald-400 flex items-center gap-1 text-xs">
                      <Info size={14} /> Ganancia Neta:
                    </span>
                    <span
                      className={`text-[10px] font-black mt-1 flex items-center gap-0.5 uppercase tracking-widest ${marginPercent < MIN_MARGIN_ALERT - 0.5 ? "text-red-400" : "text-gray-400"}`}
                    >
                      <Percent size={10} /> Rentabilidad:{" "}
                      {marginPercent.toFixed(1)}%
                    </span>
                  </div>
                  <span
                    className={`font-mono font-bold text-lg ${projectedProfit < 0 ? "text-red-400" : "text-emerald-400"}`}
                  >
                    S/ {projectedProfit.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button
                  onClick={() => handleAction("QUOTE")}
                  disabled={isSubmitting || cart.length === 0}
                  className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-gray-700 text-white font-black hover:bg-gray-800 disabled:opacity-50 transition active:scale-95"
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
