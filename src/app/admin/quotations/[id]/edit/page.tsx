"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/firebase/clientApp";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";
import { collection, doc, getDoc, getDocs, where, query } from "firebase/firestore";
import { getSystemSettings, SystemSettings } from "@/services/settingsService";
import { editQuotation, type CartItem } from "@/services/salesService";
import { isImportedQuotation } from "@/core/import/salesImportLogic";
import { computeCartTotals, addItemToCart } from "@/core/sales/cartLogic";
import { parseEditError } from "@/core/sales/parseEditError";
import { useForm } from "@/core/hooks/useForm";
import { saleCustomerSchema, type SaleCustomerForm } from "@/core/schemas/sale";
import ProductSelector from "@/core/sales/components/ProductSelector";
import { CustomerSection, SaleContact } from "@/components/sales/CustomerSection";
import { CartSummary } from "@/components/sales/CartSummary";
import { ProductionBlockedModal } from "@/components/sales/ProductionBlockedModal";
import { Loader2, Pencil, Save, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

const IGV_RATE = 0.18;

/** Motivo por el que la cotización no se puede editar (se resuelve al cargar). */
type NotEditableReason = "not-found" | "imported" | "wrong-status" | "load-error";

export default function EditQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const quotationId = typeof params?.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [notEditable, setNotEditable] = useState<{ reason: NotEditableReason; detail?: string } | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blockedModal, setBlockedModal] = useState<{ open: boolean; activeLogIds?: string[] }>({ open: false });

  // ── Estado del form (mismo shape que new/page.tsx) ──
  const {
    values: customerForm,
    setValues: setCustomerForm,
    errors: customerErrors,
    setErrors: setCustomerErrors,
    validate: validateCustomer,
  } = useForm<SaleCustomerForm>(saleCustomerSchema, { customerName: "", documentNumber: "" });

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

  const [customerAddress, setCustomerAddress] = useState("");
  const [contacts, setContacts] = useState<SaleContact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [globalContacts, setGlobalContacts] = useState<SaleContact[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestedCustomers, setSuggestedCustomers] = useState<Record<string, unknown>[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    getSystemSettings().then(setSettings).catch(() => setSettings(null));
    getDocs(collection(db, "contacts"))
      .then((s) => setGlobalContacts(s.docs.map((d) => ({ id: d.id, ...d.data() }) as SaleContact)))
      .catch(() => setGlobalContacts([]));
  }, []);

  // ── CARGA: TODO sale del DOC de la cotización, cero lectura del maestro `customers/`.
  // Si la cotización se guardó con una dirección de obra distinta a la fiscal, recargarla
  // del maestro la perdería. El buscador de cliente sigue disponible para cambiar de
  // cliente a propósito; el estado inicial es el del doc.
  useEffect(() => {
    if (!quotationId) {
      setNotEditable({ reason: "not-found" });
      setLoading(false);
      return;
    }
    let alive = true;

    (async () => {
      try {
        const snap = await getDoc(doc(db, "sales", quotationId));
        if (!alive) return;

        if (!snap.exists()) {
          setNotEditable({ reason: "not-found" });
          return;
        }
        const data = snap.data();

        // Mismos guards que el callable, para no ofrecer lo que el backend rechazaría.
        if (isImportedQuotation(data)) {
          setNotEditable({ reason: "imported" });
          return;
        }
        if (data.status !== "QUOTATION") {
          setNotEditable({ reason: "wrong-status", detail: data.status });
          return;
        }

        setCustomerName(data.customerName ?? "");
        setDocumentNumber(data.customerDocument ?? "");
        setSearchTerm(data.customerDocument ?? "");
        setCustomerAddress(data.customerAddress ?? "");
        setContacts(
          data.contactName
            ? [{ id: "doc-contact", name: data.contactName, phone: data.contactPhone ?? "", email: "" } as SaleContact]
            : [],
        );
        setSelectedContactId(data.contactName ? "doc-contact" : "");
        setCart(
          ((data.items ?? []) as CartItem[]).map((item) => ({
            ...item,
            businessLine: item.businessLine ?? "drywall",
            unitValue: item.unitValue || item.unitPrice / (1 + IGV_RATE),
          })),
        );
      } catch (e) {
        console.error("Error al cargar la cotización:", e);
        if (alive) setNotEditable({ reason: "load-error", detail: e instanceof Error ? e.message : undefined });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  // ── Búsqueda de cliente (mismo comportamiento que new/page.tsx) ──
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 3) {
      setSuggestedCustomers([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.CUSTOMERS,
          searchParams: { query: searchTerm, hitsPerPage: 5 },
        });
        setSuggestedCustomers(hits as Record<string, unknown>[]);
      } catch {
        setSuggestedCustomers([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchClientData = async (docNum: string) => {
    const snap = await getDoc(doc(db, "customers", docNum));
    if (!snap.exists()) return false;
    const data = snap.data();
    setDocumentNumber(docNum);
    setCustomerName(data.name || "");
    setCustomerAddress(data.address || "");
    const cSnap = await getDocs(
      query(collection(db, "contacts"), where("associatedCompanyIds", "array-contains", docNum)),
    );
    const fetched = cSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as SaleContact);
    setContacts(fetched);
    if (fetched.length > 0 && fetched[0].id) setSelectedContactId(fetched[0].id);
    return true;
  };

  const handleSelectSuggestedCustomer = async (hit: Record<string, unknown>) => {
    const docNum = (hit.documentNumber ?? hit.objectID) as string;
    setSearchTerm(docNum);
    setShowSuggestions(false);
    await fetchClientData(docNum);
  };

  const handleDeepSearchClient = async () => {
    if (!searchTerm) return;
    setIsSearchingClient(true);
    try {
      const found = await fetchClientData(searchTerm);
      if (!found) toast.error("Cliente no encontrado.");
    } finally {
      setIsSearchingClient(false);
    }
  };

  const addContact = () =>
    setContacts((prev) => [...prev, { id: `temp_${Date.now()}`, name: "", phone: "", email: "" } as SaleContact]);

  const handleContactNameChange = (index: number, newName: string) =>
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, name: newName } : c)));

  const updateContact = (index: number, field: keyof SaleContact, value: string) =>
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));

  const handleAddItem = (newItem: CartItem) => setCart((prev) => addItemToCart(prev, newItem));

  const { totalAmount, totalValue, totalIGV, totalWeight, projectedProfit, marginPercent, minMarginAlert } =
    computeCartTotals(cart, settings?.minMarginPercent ?? 20);

  // ── SUBMIT ──
  const handleSave = async () => {
    if (!validateCustomer()) return;
    if (cart.length === 0) {
      toast.error("La cotización debe tener al menos un ítem.");
      return;
    }
    setIsSubmitting(true);
    toast.loading("Guardando cambios...", { id: "edit" });

    const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? contacts[0];

    try {
      // UI-T1: se enumeran los campos. NUNCA se mandan totales — los calcula el builder
      // server-side, y `totalAmount` está protegido en firestore.rules por ser el
      // snapshot financiero.
      await editQuotation({
        quotationId,
        customerName,
        customerDocument: documentNumber,
        customerAddress,
        contactName: selectedContact?.name ?? "",
        contactPhone: selectedContact?.phone ?? "",
        items: cart.map((i) => ({
          sku: i.sku,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          unitValue: i.unitValue,
          baseCost: i.baseCost,
          businessLine: i.businessLine,
          unitWeight: i.unitWeight,
          isCoil: i.isCoil,
          weightSnapshot: i.weightSnapshot,
          piecesCount: i.piecesCount,
          pieceLengthM: i.pieceLengthM,
          // `calculatedWeight`/`unitOfMeasure`/`flags` NO estan en el tipo `SaleItem` del
          // cliente (los deriva el builder server-side), asi que no se mandan.
        })),
      });
      toast.success("Cotización actualizada.", { id: "edit" });
      router.push("/admin/quotations");
    } catch (error: unknown) {
      const parsed = parseEditError(error);
      // UI-T2: solo el bloqueo por producción abre modal; el resto va a toast.
      if (parsed.type === "production-block") {
        toast.dismiss("edit");
        setBlockedModal({ open: true, activeLogIds: parsed.activeLogIds });
      } else {
        toast.error(parsed.message, { id: "edit" });
      }
      setIsSubmitting(false);
    }
  };

  // ── RENDER ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-3">
        <Loader2 className="animate-spin" size={22} />
        <span className="font-bold text-sm">Cargando cotización…</span>
      </div>
    );
  }

  if (notEditable) {
    const COPY: Record<NotEditableReason, { title: string; body: string }> = {
      "not-found": {
        title: "Cotización no encontrada",
        body: `No existe ninguna cotización con el identificador ${quotationId}. Puede haber sido borrada.`,
      },
      imported: {
        title: "Esta cotización no se puede editar",
        body: "Es una cotización importada: el espejo de una factura ya emitida. Editarla desincronizaría la venta gemela.",
      },
      "wrong-status": {
        title: "Esta cotización no se puede editar",
        body: `Solo se edita una cotización vigente. Estado actual: ${notEditable.detail ?? "desconocido"}.`,
      },
      "load-error": {
        title: "No se pudo cargar la cotización",
        body: notEditable.detail ?? "Ocurrió un error al leer la cotización. Intentá de nuevo.",
      },
    };
    const { title, body } = COPY[notEditable.reason];

    return (
      <div className="max-w-2xl mx-auto py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="inline-flex bg-amber-100 text-amber-600 p-3 rounded-2xl mb-4">
            <AlertTriangle size={28} />
          </div>
          <h1 className="text-xl font-black text-slate-800 tracking-tight">{title}</h1>
          <p className="text-slate-500 font-medium mt-2 text-sm leading-relaxed">{body}</p>
          <button
            onClick={() => router.push("/admin/quotations")}
            className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition"
          >
            Volver a Cotizaciones
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-6 pb-20">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2 text-gray-800 tracking-tight">
              <Pencil className="text-blue-600" /> Editar Cotización
            </h1>
            <p className="text-gray-500 text-sm font-medium">
              <span className="font-bold text-gray-700">{quotationId}</span> — los cambios reemplazan el
              contenido actual de la cotización.
            </p>
          </div>
          <button
            onClick={() => router.push("/admin/quotations")}
            className="text-gray-500 hover:text-blue-600 font-bold transition"
          >
            Volver a Cotizaciones
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
            <ProductSelector cartItems={cart} settings={settings} onAdd={handleAddItem} />
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
              minMarginAlert={minMarginAlert}
              isSubmitting={isSubmitting}
              onRemove={(idx) => setCart(cart.filter((_, i) => i !== idx))}
              actions={
                <button
                  onClick={() => void handleSave()}
                  disabled={isSubmitting || cart.length === 0}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-500 disabled:opacity-50 transition shadow-lg shadow-blue-900/50 active:scale-95"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isSubmitting ? "GUARDANDO..." : "GUARDAR CAMBIOS"}
                </button>
              }
            />
          </div>
        </div>
      </div>

      <ProductionBlockedModal
        open={blockedModal.open}
        onClose={() => setBlockedModal({ open: false })}
        quotationId={quotationId}
        activeLogIds={blockedModal.activeLogIds}
        title="No se puede editar la cotización"
        body={
          <>
            La cotización <span className="font-bold text-slate-700">{quotationId}</span> tiene producción
            activa.
            <br />
            Debés anular la producción primero para poder editarla.
          </>
        }
        ctaLabel="Ir a la cola de producción"
      />
    </>
  );
}
