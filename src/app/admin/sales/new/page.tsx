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
import {
  processSale,
  createQuotation,
  type CartItem,
} from "@/services/salesService";
import { useAuth } from "@/context/AuthContext";
import { useForm } from "@/core/hooks/useForm";
import { saleCustomerSchema, type SaleCustomerForm } from "@/core/schemas/sale";
import ProductSelector from "@/core/sales/components/ProductSelector";
import { ShoppingCart } from "lucide-react";
import { functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";

import {
  CustomerSection,
  SaleContact,
} from "@/components/sales/CustomerSection";
import { CartSummary } from "@/components/sales/CartSummary";

const IGV_RATE = 0.18;

export default function NewSalePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams.get("duplicateId");
  const { user } = useAuth();

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [customerAddress, setCustomerAddress] = useState("");

  const {
    values: customerForm,
    setValues: setCustomerForm,
    errors: customerErrors,
    setErrors: setCustomerErrors,
    validate: validateCustomer,
  } = useForm<SaleCustomerForm>(saleCustomerSchema, {
    customerName: "",
    documentNumber: "",
  });

  const customerName = customerForm.customerName;
  const documentNumber = customerForm.documentNumber;
  const setCustomerName = (v: string) => {
    setCustomerForm((prev) => ({ ...prev, customerName: v }));
    setCustomerErrors((prev) => ({ ...prev, customerName: undefined }));
  };
  const setDocumentNumber = (v: string) => {
    setCustomerForm((prev) => ({ ...prev, documentNumber: v }));
    setCustomerErrors((prev) => ({ ...prev, documentNumber: undefined }));
  };
  const [contacts, setContacts] = useState<SaleContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [globalContacts, setGlobalContacts] = useState<SaleContact[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [suggestedCustomers, setSuggestedCustomers] = useState<
    Record<string, unknown>[]
  >([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLDivElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [dataSettings, contactsSnap] = await Promise.all([
        getSystemSettings(),
        getDocs(collection(db, "contacts")),
      ]);
      setSettings(dataSettings);
      setGlobalContacts(
        contactsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as SaleContact,
        ),
      );
    };
    load();
  }, []);

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

  useEffect(() => {
    const loadDuplicate = async () => {
      if (!duplicateId) return;
      try {
        const snap = await getDoc(doc(db, "sales", duplicateId));
        if (snap.exists()) {
          const data = snap.data();
          const custDoc = data.customerDocument || "";
          setDocumentNumber(custDoc);
          setCustomerName(data.customerName || "");
          setSearchTerm(custDoc);
          if (custDoc) await fetchClientData(custDoc);
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
  }, [duplicateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchClientData = async (docNum: string) => {
    const snap = await getDoc(doc(db, "customers", docNum));
    if (snap.exists()) {
      const data = snap.data();
      setDocumentNumber(docNum);
      setCustomerName(data.name || "");
      setCustomerAddress(data.address || "");
      const cSnap = await getDocs(
        query(
          collection(db, "contacts"),
          where("associatedCompanyIds", "array-contains", docNum),
        ),
      );
      const fetched = cSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as SaleContact,
      );
      setContacts(fetched);
      if (fetched.length > 0 && fetched[0].id)
        setSelectedContactId(fetched[0].id);
      return true;
    }
    return false;
  };

  const handleSelectSuggestedCustomer = async (
    hit: Record<string, unknown>,
  ) => {
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
        const isRUC = targetDoc.length === 11;
        const consultFn = httpsCallable(
          functions,
          isRUC ? "consultarRuc" : "consultarDni",
        );
        const result: any = await consultFn(
          isRUC ? { ruc: targetDoc } : { dni: targetDoc },
        );

        if (result.data.success) {
          const data = result.data.data;
          const nombre = isRUC
            ? data.razonSocial || data.razon_social
            : `${data.nombres || data.first_name || ""} ${data.apellidoPaterno || data.first_last_name || ""} ${data.apellidoMaterno || data.second_last_name || ""}`.trim();

          setDocumentNumber(targetDoc);
          setCustomerName(nombre);
          setCustomerAddress(
            data.direccion || data.address || "Dirección no registrada",
          );
          setContacts([]);
          setSelectedContactId("");
          toast.success("Datos importados desde SUNAT/RENIEC.");
        }
      }
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al buscar cliente.",
      );
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
    const existing = globalContacts.find(
      (c) => c.name.toLowerCase() === newName.toLowerCase(),
    );
    if (existing) {
      updated[index] = {
        ...updated[index],
        id: existing.id,
        phone: existing.phone || "",
        email: existing.email || "",
      };
      toast.success(`Contacto "${existing.name}" autocompletado.`);
    } else if (updated[index].id && !updated[index].id?.startsWith("temp_")) {
      updated[index].id = `temp_${Date.now()}`;
    }
    setContacts(updated);
  };

  const updateContact = (
    index: number,
    field: keyof SaleContact,
    value: string,
  ) => {
    const updated = [...contacts];
    updated[index][field] = value;
    setContacts(updated);
  };

  const handleAddItem = (newItem: CartItem) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (i) =>
          i.sku === newItem.sku &&
          (i.businessLine ?? "drywall") === (newItem.businessLine ?? "drywall"),
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
  };

  const totalAmount = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalValue = cart.reduce((s, i) => s + i.quantity * i.unitValue, 0);
  const totalCost = cart.reduce((s, i) => s + i.quantity * i.baseCost, 0);
  const totalIGV = totalAmount - totalValue;
  const totalWeight = cart.reduce(
    (s, i) => s + i.quantity * (i.unitWeight ?? 0),
    0,
  );
  const projectedProfit = totalValue - totalCost;
  const marginPercent =
    totalValue > 0 ? (projectedProfit / totalValue) * 100 : 0;
  const MIN_MARGIN_ALERT = settings?.minMarginPercent ?? 20;

  const handleAction = async (actionType: "QUOTE" | "SALE") => {
    if (!validateCustomer()) return;
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
          await setDoc(ref, {
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
      const docType =
        documentNumber.length === 11
          ? "RUC"
          : documentNumber.length === 8
            ? "DNI"
            : "TAX_ID";
      await setDoc(
        doc(db, "customers", documentNumber),
        {
          name: customerName,
          documentNumber,
          documentType: docType,
          address: customerAddress,
          contactIds: finalContactIds,
          lastUpdate: serverTimestamp(),
        },
        { merge: true },
      );
      const sellerId = user?.email ?? user?.uid ?? "VENDEDOR_DESCONOCIDO";
      const selectedContact =
        contacts.find((c) => c.id === selectedContactId) ?? contacts[0];
      if (actionType === "QUOTE") {
        await createQuotation(
          customerName,
          documentNumber,
          "", // documentNumber for quote is empty or generated
          cart,
          sellerId,
          customerAddress,
          selectedContact?.name ?? "",
          selectedContact?.phone ?? "",
        );
        toast.success("Cotización generada con éxito.");
      } else {
        await processSale(
          customerName,
          documentNumber,
          "", // documentNumber is empty for standard sales
          cart,
          sellerId,
          customerAddress,
          selectedContact?.name ?? "",
          selectedContact?.phone ?? "",
        );
        toast.success("Venta procesada. El stock fue descontado.");
      }
      router.push("/admin/sales");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Error al procesar la operación.",
      );
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
            Cotización o Venta Directa — Drywall · Coberturas UPVC · Bobinas M.P.
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
          <CustomerSection
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            searchInputRef={searchInputRef}
            suggestedCustomers={suggestedCustomers}
            isSearchingClient={isSearchingClient}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
            onSelectSuggested={handleSelectSuggestedCustomer}
            onDeepSearch={handleDeepSearchClient}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerAddress={customerAddress}
            setCustomerAddress={setCustomerAddress}
            contacts={contacts}
            selectedContactId={selectedContactId}
            setSelectedContactId={setSelectedContactId}
            onAddContact={addContact}
            onContactNameChange={handleContactNameChange}
            onUpdateContact={updateContact}
            globalContacts={globalContacts}
            fieldErrors={customerErrors}
          />
          <ProductSelector
            cartItems={cart}
            settings={settings}
            onAdd={handleAddItem}
          />
        </div>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <CartSummary
            cart={cart}
            totalWeight={totalWeight}
            totalValue={totalValue}
            totalIGV={totalIGV}
            totalAmount={totalAmount}
            projectedProfit={projectedProfit}
            marginPercent={marginPercent}
            minMarginAlert={MIN_MARGIN_ALERT}
            isSubmitting={isSubmitting}
            onRemove={(idx) => setCart(cart.filter((_, i) => i !== idx))}
            onQuote={() => void handleAction("QUOTE")}
            onSell={() => void handleAction("SALE")}
          />
        </div>
      </div>
    </div>
  );
}
