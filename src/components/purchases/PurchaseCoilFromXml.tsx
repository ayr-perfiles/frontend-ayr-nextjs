"use client";
import React, { useState, useRef } from "react";
import { Upload, FileCode2, Loader2, Database } from "lucide-react";
import { db } from "@/lib/firebase/clientApp";
import { writeBatch, doc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

export function PurchaseCoilFromXml() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [parsedCoils, setParsedCoils] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Función para buscar nodos en el XML ignorando prefijos (cac:, cbc:)
  const getNodeText = (node: Element | Document, tagName: string): string => {
    const elements = node.getElementsByTagNameNS("*", tagName);
    if (elements.length > 0) return elements[0].textContent || "";
    const fallback = node.getElementsByTagName(tagName);
    if (fallback.length > 0) return fallback[0].textContent || "";
    const cbcFallback = node.getElementsByTagName(`cbc:${tagName}`);
    if (cbcFallback.length > 0) return cbcFallback[0].textContent || "";
    return "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    let allCoils: any[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        // Datos Generales
        const invoiceNumber = getNodeText(xmlDoc, "ID");
        const issueDate = getNodeText(xmlDoc, "IssueDate");

        // Datos Proveedor
        const supplierParty =
          xmlDoc.getElementsByTagNameNS("*", "AccountingSupplierParty")[0] ||
          xmlDoc.getElementsByTagName("cac:AccountingSupplierParty")[0];
        let providerDoc = "";
        let providerName = "";

        if (supplierParty) {
          providerDoc = getNodeText(supplierParty, "ID");
          providerName =
            getNodeText(supplierParty, "RegistrationName") ||
            getNodeText(supplierParty, "Name");
        }

        // Líneas de Factura (Varios ítems)
        const invoiceLines = xmlDoc.getElementsByTagNameNS("*", "InvoiceLine");
        const linesArray =
          invoiceLines.length > 0
            ? invoiceLines
            : xmlDoc.getElementsByTagName("cac:InvoiceLine");

        Array.from(linesArray).forEach((line, index) => {
          const description = getNodeText(line, "Description").toUpperCase();

          if (
            !description.includes("BOB") &&
            !description.includes("ALUZINC") &&
            !description.includes("GALVANIZADO")
          )
            return;

          const rawQuantity =
            parseFloat(getNodeText(line, "InvoicedQuantity")) || 0;
          let weightInKg = rawQuantity < 100 ? rawQuantity * 1000 : rawQuantity;

          const totalValue =
            parseFloat(getNodeText(line, "LineExtensionAmount")) || 0;
          let costPerKg = weightInKg > 0 ? totalValue / weightInKg : 0;

          let thickness = 0.45;
          let width = 1200;
          const thicknessMatch = description.match(/0\.\d{2}/);
          if (thicknessMatch) thickness = parseFloat(thicknessMatch[0]);
          const widthMatch = description.match(/1[0-2]\d{2}/);
          if (widthMatch) width = parseFloat(widthMatch[0]);

          const generatedId = `${invoiceNumber}-${index + 1}`;

          allCoils.push({
            id: generatedId,
            initialWeight: Math.round(weightInKg),
            currentWeight: Math.round(weightInKg),
            masterWidth: width,
            thickness: thickness,
            pricePerKg: Number(costPerKg.toFixed(6)),
            status: "AVAILABLE",
            provider: providerName || "SISTEMA",
            providerDoc: providerDoc.replace(/\D/g, ""),
            invoiceNumber: invoiceNumber,
            invoiceDate: issueDate,
            originalDescription: description,
            totalValueLine: totalValue, // Para recalcular si editan el peso
          });
        });
      }

      setParsedCoils(allCoils);
      if (allCoils.length > 0)
        toast.success(`XML Procesado: ${allCoils.length} bobinas detectadas.`);
      else toast.error(`El XML se leyó, pero no se detectó ninguna bobina.`);
    } catch (error) {
      console.error(error);
      toast.error("Error al analizar el archivo XML de SUNAT.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Función para manejar la edición en vivo antes de subir a Firebase
  const handleUpdateCoil = (index: number, field: string, value: any) => {
    const updated = [...parsedCoils];
    updated[index][field] = value;

    // Si editan el peso inicial, recalculamos el costo por kilo automáticamente
    if (field === "initialWeight" && updated[index].totalValueLine) {
      const newWeight = Number(value);
      updated[index].currentWeight = newWeight;
      updated[index].pricePerKg =
        newWeight > 0
          ? Number((updated[index].totalValueLine / newWeight).toFixed(6))
          : 0;
    }

    setParsedCoils(updated);
  };

  const handleUploadToFirebase = async () => {
    if (parsedCoils.length === 0) return;
    setLoading(true);

    try {
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      for (const coil of parsedCoils) {
        if (opCount === 490) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }

        const docRef = doc(db, "coils", coil.id.toUpperCase());
        const docType =
          coil.providerDoc && coil.providerDoc.length === 11
            ? "LOCAL"
            : "TAX_ID";

        const coilData = {
          id: coil.id.toUpperCase(),
          initialWeight: Number(coil.initialWeight),
          currentWeight: Number(coil.currentWeight),
          masterWidth: Number(coil.masterWidth),
          thickness: Number(coil.thickness),
          pricePerKg: Number(coil.pricePerKg),
          status: coil.status,
          registeredBy: user?.email || "Admin (XML)",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          metadata: {
            providerDocType: docType,
            providerDoc: coil.providerDoc || null,
            provider: coil.provider,
            invoiceNumber: coil.invoiceNumber,
            originalDescription: coil.originalDescription,
            isHistoricalMigration: false,
          },
        };

        currentBatch.set(docRef, coilData);
        opCount++;
      }

      if (opCount > 0) batches.push(currentBatch);
      await Promise.all(batches.map((b) => b.commit()));

      toast.success(
        `¡${parsedCoils.length} bobinas ingresadas al inventario con éxito!`,
      );
      setParsedCoils([]);
    } catch (error) {
      console.error("Error en importación XML:", error);
      toast.error("Hubo un error guardando los datos en la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <FileCode2 className="text-blue-600" size={20} />
            Ingreso por Factura XML (SUNAT)
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Sube uno o varios XML. Revisa y ajusta los detalles antes de poblar
            el inventario.
          </p>
        </div>

        <label className="cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 transition px-4 py-2 rounded-xl font-bold flex items-center gap-2">
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Upload size={18} />
          )}
          Seleccionar XML
          <input
            type="file"
            accept=".xml"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={loading}
          />
        </label>
      </div>

      {parsedCoils.length > 0 && (
        <div className="bg-blue-50/30 rounded-xl border border-blue-100 animate-in fade-in overflow-hidden">
          <div className="flex justify-between items-center p-4 bg-blue-50/50 border-b border-blue-100">
            <div>
              <p className="font-bold text-gray-800 text-sm">
                Bobinas detectadas ({parsedCoils.length}):
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Verifica el Ancho y Espesor, ya que a veces la descripción de la
                factura no los incluye.
              </p>
            </div>
            <button
              onClick={handleUploadToFirebase}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 transition disabled:opacity-50 shadow-md shadow-blue-200"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Database size={18} />
              )}
              Confirmar e Ingresar
            </button>
          </div>

          {/* TABLA DE EDICIÓN EN VIVO */}
          <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white sticky top-0 shadow-sm text-xs text-gray-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3">Código / Serie *</th>
                  <th className="p-3">Peso (kg) *</th>
                  <th className="p-3">Ancho (mm) *</th>
                  <th className="p-3">Espesor (mm) *</th>
                  <th className="p-3 text-right">Costo x Kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {parsedCoils.map((c, i) => (
                  <tr key={i} className="hover:bg-blue-50/30 transition">
                    <td className="p-2">
                      <input
                        type="text"
                        value={c.id}
                        onChange={(e) =>
                          handleUpdateCoil(
                            i,
                            "id",
                            e.target.value.toUpperCase(),
                          )
                        }
                        className="w-full border border-gray-200 p-2 rounded-lg font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <p
                        className="text-[9px] text-gray-400 mt-1 truncate max-w-[150px]"
                        title={c.originalDescription}
                      >
                        Desc: {c.originalDescription}
                      </p>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={c.initialWeight}
                        onChange={(e) =>
                          handleUpdateCoil(i, "initialWeight", e.target.value)
                        }
                        className="w-24 border border-gray-200 p-2 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={c.masterWidth}
                        onChange={(e) =>
                          handleUpdateCoil(i, "masterWidth", e.target.value)
                        }
                        className="w-20 border border-gray-200 p-2 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={c.thickness}
                        onChange={(e) =>
                          handleUpdateCoil(i, "thickness", e.target.value)
                        }
                        className="w-20 border border-gray-200 p-2 rounded-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <div className="font-bold text-blue-700">
                        S/ {Number(c.pricePerKg).toFixed(4)}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Total: S/ {c.totalValueLine.toFixed(2)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
