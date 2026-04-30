"use client";

import React, { useState, useRef } from "react";
import {
  FileCode2,
  Loader2,
  CheckCircle2,
  ShoppingCart,
  User,
  Calendar,
  Receipt,
  Upload,
} from "lucide-react";
import toast from "react-hot-toast";

interface ParsedXML {
  invoiceNumber: string;
  issueDate: string;
  currency: string;
  customer: {
    ruc: string;
    name: string;
  };
  items: Array<{
    quantity: number;
    description: string;
    unitPrice: number;
    subtotal: number;
  }>;
  grandTotal: number;
}

export function XmlInvoiceReader() {
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedXML | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setParsedData(null);

    try {
      const text = await file.text();

      // Usamos el DOMParser nativo del navegador (¡Súper rápido y no pesa nada!)
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");

      // Verificamos si es un XML válido (a veces el parser devuelve un documento con un tag de error)
      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error("El archivo no es un XML válido.");
      }

      // Función auxiliar para extraer el texto de las etiquetas específicas de SUNAT (UBL 2.1)
      const getTagText = (
        parent: Document | Element,
        tag: string,
        index = 0,
      ) => {
        const nodes = parent.getElementsByTagName(tag);
        return nodes.length > index ? nodes[index].textContent || "" : "";
      };

      // 1. Extraemos Datos Generales
      const invoiceNumber = getTagText(xmlDoc, "cbc:ID"); // Ej: F001-0000123
      const issueDate = getTagText(xmlDoc, "cbc:IssueDate"); // Ej: 2026-04-30
      const currency = getTagText(xmlDoc, "cbc:DocumentCurrencyCode"); // Ej: PEN o USD

      // 2. Extraemos Datos del Cliente (AccountingCustomerParty)
      const customerParty = xmlDoc.getElementsByTagName(
        "cac:AccountingCustomerParty",
      )[0];
      const customerRuc = customerParty
        ? getTagText(customerParty, "cbc:ID")
        : "Sin RUC";
      const customerName = customerParty
        ? getTagText(customerParty, "cbc:RegistrationName")
        : "Sin Nombre";

      // 3. Extraemos los Ítems (InvoiceLine)
      const lines = xmlDoc.getElementsByTagName("cac:InvoiceLine");
      const items = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const quantity =
          parseFloat(getTagText(line, "cbc:InvoicedQuantity")) || 0;
        const description = getTagText(line, "cbc:Description");
        const priceAmount =
          parseFloat(getTagText(line, "cbc:PriceAmount")) || 0;
        const lineTotal =
          parseFloat(getTagText(line, "cbc:LineExtensionAmount")) || 0;

        items.push({
          quantity,
          description,
          unitPrice: priceAmount,
          subtotal: lineTotal,
        });
      }

      // 4. Extraemos el Total a Pagar (LegalMonetaryTotal)
      const legalTotal = xmlDoc.getElementsByTagName(
        "cac:LegalMonetaryTotal",
      )[0];
      const grandTotal = legalTotal
        ? parseFloat(getTagText(legalTotal, "cbc:TaxInclusiveAmount"))
        : 0;

      // Guardamos en el estado para mostrarlo en pantalla
      setParsedData({
        invoiceNumber,
        issueDate,
        currency,
        customer: { ruc: customerRuc, name: customerName },
        items,
        grandTotal,
      });

      toast.success("Factura leída con éxito");
    } catch (error) {
      console.error(error);
      toast.error(
        "Hubo un error al leer el XML. Asegúrate de que sea una factura electrónica válida.",
      );
    } finally {
      setLoading(false);
      // Limpiamos el input para poder subir el mismo archivo si hay un error
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveToSystem = () => {
    // Aquí iría la lógica para inyectar esta venta o compra a Firebase.
    toast.success(
      `Simulando guardado de la factura ${parsedData?.invoiceNumber}...`,
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <FileCode2 className="text-blue-600" />
            Lector Automático de Facturas
          </h2>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Sube el archivo XML (UBL 2.1) extraído de SUNAT.
          </p>
        </div>

        <label className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700 transition px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-sm shadow-blue-200">
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Upload size={18} />
          )}
          Cargar Archivo XML
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

      {/* --- VISTA PREVIA DE LOS DATOS EXTRAÍDOS --- */}
      {parsedData && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-start gap-3">
              <Receipt className="text-blue-500 mt-0.5" size={20} />
              <div>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  Documento
                </p>
                <p className="font-bold text-gray-900">
                  {parsedData.invoiceNumber}
                </p>
                <p className="text-xs font-medium text-gray-500 mt-1 flex items-center gap-1">
                  <Calendar size={12} /> {parsedData.issueDate}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-start gap-3 md:col-span-2">
              <User className="text-blue-500 mt-0.5" size={20} />
              <div className="w-full">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                  Cliente / Receptor
                </p>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900 truncate pr-2">
                      {parsedData.customer.name}
                    </p>
                    <p className="text-xs font-medium text-gray-500 mt-1">
                      RUC: {parsedData.customer.ruc}
                    </p>
                  </div>
                  <span className="bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded-lg text-xs">
                    {parsedData.currency}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider">
                    Cant
                  </th>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider">
                    Descripción
                  </th>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider text-right">
                    P. Unit
                  </th>
                  <th className="p-3 text-xs font-black text-gray-500 uppercase tracking-wider text-right">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedData.items.map((item, index) => (
                  <tr key={index} className="hover:bg-blue-50/30 transition">
                    <td className="p-3 text-sm font-bold text-gray-700">
                      {item.quantity}
                    </td>
                    <td
                      className="p-3 text-sm text-gray-600 font-medium max-w-50 truncate"
                      title={item.description}
                    >
                      {item.description}
                    </td>
                    <td className="p-3 text-sm text-gray-600 text-right">
                      {item.unitPrice.toFixed(2)}
                    </td>
                    <td className="p-3 text-sm font-bold text-gray-900 text-right">
                      {item.subtotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td
                    colSpan={3}
                    className="p-4 text-right text-xs font-black text-gray-500 uppercase tracking-widest"
                  >
                    Total a Pagar ({parsedData.currency})
                  </td>
                  <td className="p-4 text-right font-black text-lg text-blue-600">
                    {parsedData.grandTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSaveToSystem}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 transition active:scale-95 shadow-md shadow-green-200"
            >
              <CheckCircle2 size={20} />
              Guardar en el Sistema
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
