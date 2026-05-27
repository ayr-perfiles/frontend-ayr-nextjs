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
import { ArrowLeft, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { ContactModal, ContactFormData } from "@/components/crm/ContactModal";
import { CustomerInfoCard } from "@/components/crm/CustomerInfoCard";
import { SalesHistoryTable } from "@/components/crm/SalesHistoryTable";

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const documentNumber = params.id as string;

  const [profile, setProfile] = useState<{
    customerData: { name: string; id: string; address?: string };
    contacts: { id: string; name: string; phone?: string; email?: string; role?: string }[];
    salesHistory: { id: string; timestamp?: { toDate: () => Date }; status: string; totalAmount?: number; paymentStatus?: string }[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<(ContactFormData & { id?: string }) | null>(null);

  const loadProfile = async () => {
    if (documentNumber) {
      const data = await getCustomerProfile(documentNumber);
      setProfile(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, [documentNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenNewContact = () => {
    setEditingContact(null);
    setIsContactModalOpen(true);
  };

  const handleOpenEditContact = (contact: { id: string; name: string; phone?: string; email?: string; role?: string }) => {
    setEditingContact({
      id: contact.id,
      name: contact.name,
      phone: contact.phone || "",
      email: contact.email || "",
      role: contact.role || "",
    });
    setIsContactModalOpen(true);
  };

  const handleSaveContact = async (form: ContactFormData, editingId?: string) => {
    try {
      await saveContact(editingId || null, form, documentNumber);
      toast.success(editingId ? "Contacto actualizado" : "Contacto creado");
      await loadProfile();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al guardar contacto.");
    }
  };

  const handleLinkExisting = async (contactId: string) => {
    try {
      await linkExistingContact(contactId, documentNumber);
      toast.success("Contacto vinculado correctamente");
      await loadProfile();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al vincular contacto.");
    }
  };

  const handleUnlinkContact = async (contactId: string) => {
    try {
      await unlinkContact(contactId, documentNumber);
      await loadProfile();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al desvincular contacto.");
    }
  };

  const handleTogglePayment = async (saleId: string, currentStatus: string) => {
    try {
      await updatePaymentStatus(
        saleId,
        currentStatus === "PAID" ? "PENDING" : "PAID",
      );
      await loadProfile();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar estado de pago.");
    }
  };

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
        <CustomerInfoCard
          customerData={customerData}
          contacts={contacts}
          onAddContact={handleOpenNewContact}
          onEditContact={handleOpenEditContact}
          onUnlinkContact={handleUnlinkContact}
        />

        <div className="lg:col-span-2">
          <SalesHistoryTable
            salesHistory={salesHistory}
            documentNumber={documentNumber}
            onTogglePayment={handleTogglePayment}
          />
        </div>
      </div>

      <ContactModal
        isOpen={isContactModalOpen}
        editingContact={editingContact}
        onSave={handleSaveContact}
        onLinkExisting={handleLinkExisting}
        onClose={() => setIsContactModalOpen(false)}
      />
    </div>
  );
}
