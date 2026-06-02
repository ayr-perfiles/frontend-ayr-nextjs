import React, { useState } from "react";
import { Upload, FileSpreadsheet, Download, Loader2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { PurchaseStagingReview } from "./PurchaseStagingReview";

export function PurchaseExcelImporter() {
  const [loading, setLoading] = useState(false);
  const [stagedPurchases, setStagedPurchases] = useState<any[] | null>(null);

  const downloadTemplate = () => {
    const headers = [
      ["AYR STEEL ERP - PLANTILLA DE IMPORTACIÓN DE COMPRAS"],
      ["INSTRUCCIONES: Llenar una fila por cada ítem. Repetir datos de cabecera si la factura tiene varios ítems."],
      [""],
      [
        "RUC Proveedor",
        "Razón Social",
        "Tipo (01 Factura, 03 Boleta)",
        "Serie",
        "Número",
        "Fecha (DD/MM/YYYY)",
        "Moneda (PEN/USD)",
        "TC",
        "Descripción Producto / SKU",
        "Cantidad",
        "Unidad (NIU/KG)",
        "Precio Unitario (Sin IGV)",
        "Base Imponible Ítem",
        "IGV Ítem"
      ],
      [
        "20123456789",
        "PROVEEDOR ACERO S.A.",
        "01",
        "F001",
        "100",
        "01/06/2026",
        "PEN",
        "1",
        "TUBO CUADRADO 1X1",
        "10",
        "NIU",
        "45.50",
        "455.00",
        "81.90"
      ]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(wb, ws, "Compras");
    XLSX.writeFile(wb, "Plantilla_Compras_AYR.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // El header real empieza en la fila 4 (index 3)
        const rows = data.slice(4);
        const purchasesMap: Record<string, any> = {};

        rows.forEach((row) => {
          if (!row[0] || !row[3] || !row[4]) return; // Skip empty rows

          const ruc = row[0].toString();
          const serie = row[3].toString();
          const numero = row[4].toString();
          const key = `${ruc}_${serie}-${numero}`;

          if (!purchasesMap[key]) {
            const fechaStr = row[5]?.toString() || "";
            // Intentar parsear fecha DD/MM/YYYY o formato Excel
            let fechaISO = "";
            if (fechaStr.includes("/")) {
              const [d, m, y] = fechaStr.split("/");
              fechaISO = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            } else if (!isNaN(Date.parse(fechaStr))) {
              fechaISO = new Date(fechaStr).toISOString().split('T')[0];
            }

            purchasesMap[key] = {
              rucProveedor: ruc,
              razonSocialProveedor: row[1] || "",
              serie,
              numero,
              fechaEmision: fechaISO,
              moneda: row[6] === "USD" ? "USD" : "PEN",
              tipoCambio: parseFloat(row[7]) || 1,
              baseImponible: 0,
              igv: 0,
              total: 0,
              lines: []
            };
          }

          const base = parseFloat(row[12]) || 0;
          const igv = parseFloat(row[13]) || 0;
          const qty = parseFloat(row[9]) || 0;
          const price = parseFloat(row[11]) || (qty > 0 ? base / qty : 0);

          purchasesMap[key].lines.push({
            description: row[8]?.toString() || "Sin descripción",
            quantity: qty,
            unitCode: row[10] || "NIU",
            unitPrice: price,
            totalValue: base,
            sku: row[8]?.toString()?.startsWith("SKU-") ? row[8].toString() : undefined // Tip opcional
          });

          purchasesMap[key].baseImponible += base;
          purchasesMap[key].igv += igv;
          purchasesMap[key].total += (base + igv);
        });

        const result = Object.values(purchasesMap);
        if (result.length > 0) {
          setStagedPurchases(result);
          toast.success(`${result.length} facturas detectadas en el Excel.`);
        } else {
          toast.error("No se encontraron datos válidos en el Excel.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Error al procesar el archivo Excel.");
      } finally {
        setLoading(false);
        e.target.value = "";
      }
    };

    reader.readAsBinaryString(file);
  };

  if (stagedPurchases) {
    return <PurchaseStagingReview initialPurchases={stagedPurchases} onFinished={() => setStagedPurchases(null)} />;
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 flex flex-col items-center justify-center text-center space-y-6 hover:border-emerald-300 transition-colors group">
      <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
        {loading ? <Loader2 size={32} className="animate-spin" /> : <FileSpreadsheet size={32} />}
      </div>

      <div>
        <h3 className="text-lg font-black text-slate-800">Carga Masiva vía Excel</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          Ideal para proveedores no electrónicos o facturas físicas. Usa nuestra plantilla oficial.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={downloadTemplate}
          className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition flex items-center gap-2"
        >
          <Download size={14} /> DESCARGAR PLANTILLA
        </button>

        <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-black text-sm transition shadow-lg shadow-emerald-100 flex items-center gap-2">
          <Upload size={18} />
          SUBIR EXCEL COMPLETADO
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} disabled={loading} />
        </label>
      </div>

      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 max-w-md">
        <p className="text-[10px] font-bold text-blue-600 flex items-start gap-2 leading-relaxed text-left">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>
            Nota: Al igual que el XML, el Excel entrará en modo de revisión para mapear descripciones a SKUs de AYR.
          </span>
        </p>
      </div>
    </div>
  );
}
