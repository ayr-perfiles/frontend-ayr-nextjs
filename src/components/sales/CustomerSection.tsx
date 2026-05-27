"use client";

import React from "react";
import {
  Building2,
  MapPin,
  Search,
  Users,
  Loader2,
  Plus,
} from "lucide-react";

export interface SaleContact {
  id?: string;
  name: string;
  phone: string;
  email: string;
}

interface CustomerSectionProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  searchInputRef: React.RefObject<HTMLDivElement | null>;
  suggestedCustomers: Record<string, unknown>[];
  isSearchingClient: boolean;
  showSuggestions: boolean;
  setShowSuggestions: (v: boolean) => void;
  onSelectSuggested: (hit: Record<string, unknown>) => void;
  onDeepSearch: () => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerAddress: string;
  setCustomerAddress: (v: string) => void;
  contacts: SaleContact[];
  selectedContactId: string;
  setSelectedContactId: (id: string) => void;
  onAddContact: () => void;
  onContactNameChange: (idx: number, name: string) => void;
  onUpdateContact: (idx: number, field: keyof SaleContact, value: string) => void;
  globalContacts: SaleContact[];
  fieldErrors?: { customerName?: string; documentNumber?: string };
}

export function CustomerSection({
  searchTerm,
  setSearchTerm,
  searchInputRef,
  suggestedCustomers,
  isSearchingClient,
  showSuggestions,
  setShowSuggestions,
  onSelectSuggested,
  onDeepSearch,
  customerName,
  setCustomerName,
  customerAddress,
  setCustomerAddress,
  contacts,
  selectedContactId,
  setSelectedContactId,
  onAddContact,
  onContactNameChange,
  onUpdateContact,
  globalContacts,
  fieldErrors,
}: CustomerSectionProps) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2 border-b border-gray-50 pb-4">
        <Building2 size={20} className="text-blue-500" /> Información de Facturación
      </h2>

      <datalist id="global-contacts-list">
        {globalContacts.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>

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
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 h-[48px]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setShowSuggestions(suggestedCustomers.length > 0)}
              />
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                  {suggestedCustomers.map((hit) => (
                    <div
                      key={String(hit.objectID)}
                      onClick={() => void onSelectSuggested(hit)}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <p className="font-bold text-gray-800 text-sm truncate">
                        {String(hit.name ?? "")}
                      </p>
                      <p className="text-xs text-gray-500 font-medium">
                        {String(hit.documentNumber ?? hit.objectID)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => void onDeepSearch()}
              disabled={isSearchingClient}
              className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center shrink-0 h-[48px]"
            >
              {isSearchingClient ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Search size={20} />
              )}
            </button>
          </div>
          {fieldErrors?.documentNumber && (
            <p className="text-red-500 text-xs mt-1">{fieldErrors.documentNumber}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
            Razón Social / Nombre Confirmado *
          </label>
          <input
            type="text"
            className={`w-full p-3 border rounded-xl font-bold text-gray-800 outline-none focus:ring-2 h-12 ${fieldErrors?.customerName ? "bg-red-50 border-red-300 focus:ring-red-400" : "bg-gray-50 border-gray-200 focus:ring-blue-500"}`}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          {fieldErrors?.customerName && (
            <p className="text-red-500 text-xs mt-1">{fieldErrors.customerName}</p>
          )}
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
            onClick={onAddContact}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Plus size={14} /> Añadir
          </button>
        </div>
        {contacts.length === 0 && (
          <p className="text-xs text-blue-400 font-medium italic mb-2">
            Sin contactos. Escribe un nombre y el sistema buscará en el Directorio Global.
          </p>
        )}
        <div className="space-y-3">
          {contacts.map((contact, idx) => (
            <div
              key={contact.id || idx}
              className={`grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-3 rounded-xl shadow-sm border transition ${
                selectedContactId === contact.id && contact.id
                  ? "border-blue-400 ring-1 ring-blue-400"
                  : "border-gray-200"
              }`}
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
                list="global-contacts-list"
                placeholder="Nombre..."
                className="md:col-span-4 p-2 border border-gray-200 rounded-lg text-sm bg-white font-bold focus:ring-2 focus:ring-blue-400 outline-none"
                value={contact.name}
                onChange={(e) => onContactNameChange(idx, e.target.value)}
              />
              <input
                type="tel"
                placeholder="Celular"
                className="md:col-span-3 p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-400 outline-none"
                value={contact.phone}
                onChange={(e) => onUpdateContact(idx, "phone", e.target.value)}
              />
              <input
                type="email"
                placeholder="Correo"
                className="md:col-span-4 p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-blue-400 outline-none"
                value={contact.email}
                onChange={(e) => onUpdateContact(idx, "email", e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
