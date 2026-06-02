"use client";

import { Building2, MapPin, Users, Edit2, Unplug, Plus } from "lucide-react";

interface CustomerContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface CustomerData {
  name: string;
  id: string;
  address?: string;
}

interface CustomerInfoCardProps {
  customerData: CustomerData;
  contacts: CustomerContact[];
  onAddContact: () => void;
  onEditContact: (contact: CustomerContact) => void;
  onUnlinkContact: (contactId: string) => void;
}

export function CustomerInfoCard({
  customerData,
  contacts,
  onAddContact,
  onEditContact,
  onUnlinkContact,
}: CustomerInfoCardProps) {
  return (
    <div className="lg:col-span-1 space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
          <Building2 size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900">{customerData.name}</h2>
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

      <div className="bg-white p-6 rounded-3xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
            <Users size={16} className="text-blue-500" /> Contactos
          </h3>
          <button
            onClick={onAddContact}
            className="bg-blue-50 text-blue-600 p-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-3">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="bg-slate-50 p-4 rounded-xl border border-slate-100 group relative"
            >
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                <button
                  onClick={() => onEditContact(c)}
                  className="p-1 text-slate-400 hover:text-blue-600"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => onUnlinkContact(c.id)}
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
  );
}
