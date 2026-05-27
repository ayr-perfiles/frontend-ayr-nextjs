"use client";

import { useState, useEffect } from "react";
import { Search, Link as LinkIcon } from "lucide-react";
import { algoliaClient, ALGOLIA_INDICES } from "@/lib/algoliaClient";

export interface ContactFormData {
  name: string;
  phone: string;
  email: string;
  role: string;
}

interface ContactSuggestion {
  objectID: string;
  id?: string;
  name: string;
  role?: string;
}

interface ContactModalProps {
  isOpen: boolean;
  editingContact: (ContactFormData & { id?: string }) | null;
  onSave: (form: ContactFormData, editingId?: string) => Promise<void>;
  onLinkExisting: (contactId: string) => Promise<void>;
  onClose: () => void;
}

export function ContactModal({
  isOpen,
  editingContact,
  onSave,
  onLinkExisting,
  onClose,
}: ContactModalProps) {
  const [mode, setMode] = useState<"NEW" | "LINK">("NEW");
  const [form, setForm] = useState<ContactFormData>({ name: "", phone: "", email: "", role: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [suggestions, setSuggestions] = useState<ContactSuggestion[]>([]);

  useEffect(() => {
    if (isOpen) {
      setMode("NEW");
      setContactSearch("");
      setSuggestions([]);
      setForm(
        editingContact
          ? { name: editingContact.name, phone: editingContact.phone, email: editingContact.email, role: editingContact.role }
          : { name: "", phone: "", email: "", role: "" },
      );
    }
  }, [isOpen, editingContact]);

  useEffect(() => {
    const searchExisting = async () => {
      if (mode !== "LINK" || contactSearch.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const { hits } = await algoliaClient.searchSingleIndex({
          indexName: ALGOLIA_INDICES.CONTACTS || "contacts_index",
          searchParams: { query: contactSearch, hitsPerPage: 5 },
        });
        setSuggestions(hits as ContactSuggestion[]);
      } catch (e) {
        console.error(e);
      }
    };
    const timer = setTimeout(searchExisting, 300);
    return () => clearTimeout(timer);
  }, [contactSearch, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form, editingContact?.id);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleLink = async (suggestion: ContactSuggestion) => {
    setIsSaving(true);
    try {
      await onLinkExisting(suggestion.objectID || suggestion.id || "");
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="flex p-1 bg-slate-100 m-4 rounded-xl">
          <button
            onClick={() => setMode("NEW")}
            className={`flex-1 py-2 text-xs font-black rounded-lg transition ${mode === "NEW" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            NUEVO CONTACTO
          </button>
          <button
            onClick={() => setMode("LINK")}
            className={`flex-1 py-2 text-xs font-black rounded-lg transition ${mode === "LINK" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            ENLAZAR EXISTENTE
          </button>
        </div>

        {mode === "NEW" ? (
          <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-4">
            <input
              type="text"
              placeholder="Nombre completo"
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Cargo (Opcional)"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="tel"
                placeholder="Teléfono"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              GUARDAR CONTACTO
            </button>
          </form>
        ) : (
          <div className="p-6 pt-2 space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o empresa..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {suggestions.map((s) => (
                <button
                  key={s.objectID}
                  onClick={() => void handleLink(s)}
                  disabled={isSaving}
                  className="w-full p-3 text-left hover:bg-blue-50 border border-slate-100 rounded-xl transition flex justify-between items-center group disabled:opacity-50"
                >
                  <div>
                    <p className="text-sm font-black text-slate-800">{s.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase">{s.role || "Sin cargo"}</p>
                  </div>
                  <LinkIcon size={16} className="text-slate-300 group-hover:text-blue-500" />
                </button>
              ))}
              {contactSearch.length > 2 && suggestions.length === 0 && (
                <p className="text-center py-4 text-xs text-slate-400">
                  No se encontraron contactos
                </p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-4 text-xs font-black text-slate-400 hover:text-slate-600 border-t border-slate-50"
        >
          CANCELAR Y CERRAR
        </button>
      </div>
    </div>
  );
}
