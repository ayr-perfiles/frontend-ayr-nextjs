"use client";

import React, { useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Search, Loader2, Save, X, Building2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

interface AddCoilFormProps {
  onOpenChange: (isOpen: boolean) => void;
}

export function AddCoilForm({ onOpenChange }: AddCoilFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Estados de búsqueda
  const [searchingDoc, setSearchingDoc] = useState(false);
  const [docType, setDocType] = useState<"LOCAL" | "TAX_ID">("LOCAL");

  // Estados del formulario general
  const [coilId, setCoilId] = useState("");
  const [initialWeight, setInitialWeight] = useState<number | "">("");
  const [masterWidth, setMasterWidth] = useState<number | "">(1200);
  const [thickness, setThickness] = useState<number | "">(0.45);
  // CAMBIO CONTABLE: Ahora pedimos el Valor Total en lugar del Costo x Kg
  const [totalValue, setTotalValue] = useState<number | "">("");

  // Estados para el Proveedor
  const [providerDoc, setProviderDoc] = useState("");
  const [providerName, setProviderName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  // Consulta a tu API Interna
  const handleSearchDoc = async () => {
    if (
      docType === "LOCAL" &&
      providerDoc.length !== 8 &&
      providerDoc.length !== 11
    ) {
      toast.error("El documento debe tener 8 (DNI) u 11 (RUC) dígitos.");
      return;
    }

    setSearchingDoc(true);
    setProviderName("");

    try {
      const response = await fetch(`/api/consulta-doc?numero=${providerDoc}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Documento no encontrado");
      }

      const isRUC = providerDoc.length === 11;
      const nombreEncontrado = isRUC
        ? data.razon_social || data.razonSocial
        : `${data.nombres || data.first_name} ${data.apellidoPaterno || data.first_last_name} ${data.apellidoMaterno || data.second_last_name}`;

      if (nombreEncontrado) {
        setProviderName(nombreEncontrado.toUpperCase());
        toast.success("Proveedor encontrado");
      } else {
        throw new Error("Formato de respuesta desconocido");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(
        error.message || "No se pudo encontrar. Ingresa el nombre manualmente.",
      );
    } finally {
      setSearchingDoc(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !coilId.trim() ||
      !initialWeight ||
      !masterWidth ||
      !thickness ||
      !totalValue
    ) {
      toast.error("Por favor completa todos los campos obligatorios (*)");
      return;
    }

    setLoading(true);

    try {
      // CÁLCULO CONTABLE EXACTO
      const weight = Number(initialWeight);
      const value = Number(totalValue);
      const exactCostPerKg = weight > 0 ? value / weight : 0;

      const docRef = doc(db, "coils", coilId.toUpperCase());

      await setDoc(docRef, {
        id: coilId.toUpperCase(),
        initialWeight: weight,
        currentWeight: weight,
        masterWidth: Number(masterWidth),
        thickness: Number(thickness),
        pricePerKg: Number(exactCostPerKg.toFixed(6)), // Guardamos con precisión alta
        status: "AVAILABLE",
        registeredBy: user?.email || "Usuario Desconocido",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        metadata: {
          providerDocType: docType,
          providerDoc: providerDoc || null,
          provider: providerName || "SIN PROVEEDOR",
          invoiceNumber: invoiceNumber || null,
          isManualEntry: true,
        },
      });

      toast.success("Bobina ingresada con éxito");
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar la bobina");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      <div className="flex justify-between items-center p-6 bg-blue-600 text-white">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Plus size={20} /> Ingreso Manual
          </h2>
          <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mt-1">
            Nueva Bobina
          </p>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="p-2 hover:bg-white/20 rounded-full transition"
        >
          <X size={20} />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-6 space-y-6 overflow-y-auto max-h-[75vh]"
      >
        {/* SECCIÓN 1: DATOS DEL PROVEEDOR */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Building2 size={14} /> Datos de Compra (Opcional)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TIPO DE DOCUMENTO */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-2">
                Origen del Proveedor
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="docType"
                    checked={docType === "LOCAL"}
                    onChange={() => {
                      setDocType("LOCAL");
                      setProviderDoc("");
                      setProviderName("");
                    }}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  Nacional (RUC)
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="docType"
                    checked={docType === "TAX_ID"}
                    onChange={() => {
                      setDocType("TAX_ID");
                      setProviderDoc("");
                      setProviderName("");
                    }}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  Extranjero
                </label>
              </div>
            </div>

            {/* NÚMERO DE DOCUMENTO */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                {docType === "LOCAL" ? "Número (RUC)" : "Tax ID (Extranjero)"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={docType === "LOCAL" ? 11 : 50}
                  placeholder={
                    docType === "LOCAL" ? "Ej: 20519161151" : "Ej: CN-998877"
                  }
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  value={providerDoc}
                  onChange={(e) => {
                    const val =
                      docType === "LOCAL"
                        ? e.target.value.replace(/\D/g, "")
                        : e.target.value.toUpperCase();
                    setProviderDoc(val);
                  }}
                />

                {docType === "LOCAL" && (
                  <button
                    type="button"
                    onClick={handleSearchDoc}
                    disabled={
                      searchingDoc ||
                      (providerDoc.length !== 8 && providerDoc.length !== 11)
                    }
                    className="bg-blue-100 text-blue-700 px-4 rounded-lg font-bold hover:bg-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[48px]"
                  >
                    {searchingDoc ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Search size={18} />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* RAZÓN SOCIAL */}
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                Razón Social
              </label>
              <input
                type="text"
                placeholder="Nombre de la empresa"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-bold text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value.toUpperCase())}
              />
            </div>

            {/* FACTURA */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 mb-1">
                Factura N° (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: F001-35087"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: DATOS FÍSICOS DE LA BOBINA */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">
            Características de la Bobina
          </h3>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Serie / Código (ID) *
            </label>
            <input
              required
              type="text"
              placeholder="Ej: PD05-12"
              className="w-full border border-gray-300 rounded-lg p-3 font-black uppercase focus:ring-2 focus:ring-blue-500 outline-none"
              value={coilId}
              onChange={(e) => setCoilId(e.target.value.toUpperCase())}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                Peso Inicial (kg) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={initialWeight}
                onChange={(e) => setInitialWeight(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-600 mb-1">
                Valor Total (S/ sin IGV) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                placeholder="Ej: 12500.50"
                className="w-full border-2 border-blue-100 bg-blue-50 rounded-lg p-2.5 font-bold focus:border-blue-500 outline-none"
                value={totalValue}
                onChange={(e) => setTotalValue(Number(e.target.value))}
              />
              {totalValue && initialWeight ? (
                <p className="text-[10px] text-gray-500 mt-1 font-medium">
                  Costo: S/{" "}
                  {(Number(totalValue) / Number(initialWeight)).toFixed(4)} x Kg
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                Ancho (mm) *
              </label>
              <input
                required
                type="number"
                step="1"
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={masterWidth}
                onChange={(e) => setMasterWidth(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">
                Espesor (mm) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={thickness}
                onChange={(e) => setThickness(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition active:scale-95 shadow-md shadow-blue-200 mt-4"
        >
          {loading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
          {loading ? "GUARDANDO..." : "GUARDAR BOBINA"}
        </button>
      </form>
    </div>
  );
}
