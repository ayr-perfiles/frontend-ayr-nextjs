"use client";

import React, { useState, useRef } from "react";
import {
  FileCode2,
  Loader2,
  CheckCircle2,
  User,
  Receipt,
  PlusCircle,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase/clientApp";
import { doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

// Interfaces para manejar los datos extraídos
interface ParsedXML {
  invoiceNumber: string;
  issueDate: string;
  currency: string;
  provider: { ruc: string; name: string };
  items: any[];
}

interface CoilEntry {
  id: string; // La serie interna que tú le asignas
  description: string;
  initialWeight: number;
  masterWidth: number;
  thickness: number;
  pricePerKg: number;
}

export function PurchaseCoilFromXml() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedXML | null>(null);
  const [coilsToRegister, setCoilsToRegister] = useState<CoilEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setParsedData(null);
    setCoilsToRegister([]);

    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");

      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("El archivo no es un XML válido.");
      }

      const getTagText = (
        parent: Document | Element,
        tag: string,
        index = 0,
      ) => {
        const nodes = parent.getElementsByTagName(tag);
        return nodes.length > index ? nodes[index].textContent || "" : "";
      };

      // 1. Datos Generales de la Compra
      const invoiceNumber = getTagText(xmlDoc, "cbc:ID");
      const issueDate = getTagText(xmlDoc, "cbc:IssueDate");
      const currency = getTagText(xmlDoc, "cbc:DocumentCurrencyCode");

      // 2. Datos del Proveedor (AccountingSupplierParty)
      const supplierParty = xmlDoc.getElementsByTagName(
        "cac:AccountingSupplierParty",
      )[0];
      const providerRuc = supplierParty
        ? getTagText(supplierParty, "cbc:ID")
        : "Sin RUC";
      const providerName = supplierParty
        ? getTagText(supplierParty, "cbc:RegistrationName")
        : "Sin Nombre";

      // 3. Extraemos las Bobinas (Líneas de la factura)
      const lines = xmlDoc.getElementsByTagName("cac:InvoiceLine");
      const items: CoilEntry[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Generalmente en acero, la "cantidad" facturada son los Kilos
        const quantity =
          parseFloat(getTagText(line, "cbc:InvoicedQuantity")) || 0;
        const description = getTagText(line, "cbc:Description");
        const priceAmount =
          parseFloat(getTagText(line, "cbc:PriceAmount")) || 0;

        // Intentamos adivinar espesor y ancho desde la descripción del proveedor (Ej: "BOBINA 0.45x1200")
        let guessedThickness = 0.45;
        let guessedWidth = 1192;

        const descUpper = description.toUpperCase();
        if (descUpper.includes("0.40")) guessedThickness = 0.4;
        else if (descUpper.includes("0.50")) guessedThickness = 0.5;
        else if (descUpper.includes("0.60")) guessedThickness = 0.6;

        if (descUpper.includes("1200")) guessedWidth = 1200;
        else if (descUpper.includes("1220")) guessedWidth = 1220;
        else if (descUpper.includes("1000")) guessedWidth = 1000;

        items.push({
          id: "", // Lo dejas vacío para que el operario lo llene con su codificación (Ej: PD05-12)
          description,
          initialWeight: quantity,
          masterWidth: guessedWidth,
          thickness: guessedThickness,
          pricePerKg: priceAmount,
        });
      }

      setParsedData({
        invoiceNumber,
        issueDate,
        currency,
        provider: { ruc: providerRuc, name: providerName },
        items: [],
      });

      setCoilsToRegister(items);
      toast.success("Factura del proveedor leída correctamente.");
    } catch (error) {
      console.error(error);
      toast.error(
        "Error al leer el XML. Asegúrate de que sea una factura válida.",
      );
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Actualiza los datos que el usuario modifica en la tablita
  const handleUpdateCoil = (
    index: number,
    field: keyof CoilEntry,
    value: string | number,
  ) => {
    const updated = [...coilsToRegister];
    updated[index] = { ...updated[index], [field]: value };
    setCoilsToRegister(updated);
  };

  const handleRemoveCoil = (index: number) => {
    setCoilsToRegister(coilsToRegister.filter((_, i) => i !== index));
  };

  // Función final para subir las bobinas a Firebase
  const handleSaveToSystem = async () => {
    // Validar que todas tengan ID
    const missingIds = coilsToRegister.some((coil) => !coil.id.trim());
    if (missingIds) {
      toast.error(
        "Por favor, asigna una Serie (ID) a todas las bobinas antes de guardar.",
      );
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);

      coilsToRegister.forEach((coil) => {
        const docRef = doc(db, "coils", coil.id.toUpperCase());
        const newCoilData = {
          id: coil.id.toUpperCase(),
          initialWeight: coil.initialWeight,
          currentWeight: coil.initialWeight,
          masterWidth: coil.masterWidth,
          thickness: coil.thickness,
          pricePerKg: coil.pricePerKg,
          status: "AVAILABLE",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          registeredBy: user?.email || "Sistema",
          metadata: {
            provider: parsedData?.provider.name,
            providerRuc: parsedData?.provider.ruc,
            invoiceNumber: parsedData?.invoiceNumber,
            originalDescription: coil.description,
          },
        };
        batch.set(docRef, newCoilData);
      });

      await batch.commit();

      toast.success(
        `${coilsToRegister.length} bobinas ingresadas exitosamente al inventario.`,
      );
      setParsedData(null);
      setCoilsToRegister([]);
    } catch (error) {
      console.error("Error guardando bobinas:", error);
      toast.error("Hubo un error al guardar las bobinas en el sistema.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <FileCode2 className="text-blue-600" />
            Ingreso de Bobinas vía Factura XML
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Sube el XML de tu proveedor para autocompletar el ingreso de
            mercadería.
          </p>
        </div>

        <label className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700 transition px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm shadow-blue-200">
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <PlusCircle size={18} />
          )}
          Cargar XML de Compra
          <input
            type="file"
            accept=".xml"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={loading}
          />
        </label>
      </div>

      {parsedData && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
          {/* --- RESUMEN DE LA FACTURA --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
              <User className="text-blue-600 mt-0.5" size={20} />
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Proveedor
                </p>
                <p className="font-bold text-gray-900">
                  {parsedData.provider.name}
                </p>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  RUC: {parsedData.provider.ruc}
                </p>
              </div>
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
              <Receipt className="text-blue-600 mt-0.5" size={20} />
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Documento de Compra
                </p>
                <p className="font-bold text-gray-900">
                  {parsedData.invoiceNumber}
                </p>
                <p className="text-xs font-medium text-gray-500 mt-0.5">
                  Fecha: {parsedData.issueDate} | Moneda: {parsedData.currency}
                </p>
              </div>
            </div>
          </div>

          {/* --- TABLA AUTOCOMPLETADA DE BOBINAS --- */}
          <div className="border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase">
                    Serie (ID Interno) *
                  </th>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase">
                    Descripción Proveedor
                  </th>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase">
                    Peso (kg)
                  </th>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase">
                    Ancho (mm)
                  </th>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase">
                    Esp (mm)
                  </th>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase">
                    Costo x Kg
                  </th>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase text-center">
                    X
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coilsToRegister.map((coil, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition">
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Ej: PD01-05"
                        required
                        value={coil.id}
                        onChange={(e) =>
                          handleUpdateCoil(
                            index,
                            "id",
                            e.target.value.toUpperCase(),
                          )
                        }
                        className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </td>
                    <td
                      className="p-2 text-xs font-medium text-gray-500 max-w-[150px] truncate"
                      title={coil.description}
                    >
                      {coil.description}
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={coil.initialWeight}
                        onChange={(e) =>
                          handleUpdateCoil(
                            index,
                            "initialWeight",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-24 p-2 border border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={coil.masterWidth}
                        onChange={(e) =>
                          handleUpdateCoil(
                            index,
                            "masterWidth",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-20 p-2 border border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={coil.thickness}
                        onChange={(e) =>
                          handleUpdateCoil(
                            index,
                            "thickness",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-20 p-2 border border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={coil.pricePerKg}
                        onChange={(e) =>
                          handleUpdateCoil(
                            index,
                            "pricePerKg",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-20 p-2 border border-gray-300 rounded-lg text-sm font-medium focus:border-blue-500 outline-none"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleRemoveCoil(index)}
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSaveToSystem}
              disabled={loading || coilsToRegister.length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 transition active:scale-95 shadow-md shadow-green-200"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CheckCircle2 size={20} />
              )}
              Ingresar Bobinas al Inventario
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
