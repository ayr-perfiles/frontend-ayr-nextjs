"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, AlertTriangle, X, Play, Loader2, Database } from "lucide-react";
import toast from "react-hot-toast";
import { parseAndClassify, type ParsedCatalogRow, type BusinessLineTarget } from "@/core/import/catalogImport";
import { dispatchImportRow } from "@/core/import/importDispatcher";
import { MARZO_SEED_DATA } from "@/core/import/seedCatalogData";

interface Summary {
  drywall: number;
  "metallic-roofing": number;
  roofing: number;
  trading: number;
  services: number;
  coil: number;
  skip: number;
  unclassified: number;
}

export function BulkCatalogImport() {
  const [rows, setRows] = useState<ParsedCatalogRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imported, setImported] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImported(false);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const parsed = parseAndClassify(buffer);
        processParsedData(parsed);
      } catch (err) {
        toast.error("Error al procesar el archivo Excel/CSV.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ""; // reset
  }

  function handleLoadSeed() {
    setImported(false);
    processParsedData(MARZO_SEED_DATA as ParsedCatalogRow[]);
    toast.success("Datos de semilla (Marzo) cargados en vista previa.");
  }

  function processParsedData(data: ParsedCatalogRow[]) {
    const newSummary: Summary = {
      drywall: 0,
      "metallic-roofing": 0,
      roofing: 0,
      trading: 0,
      services: 0,
      coil: 0,
      skip: 0,
      unclassified: 0,
    };

    data.forEach(r => {
      if (newSummary[r.line] !== undefined) {
        newSummary[r.line]++;
      }
    });

    setSummary(newSummary);
    setRows(data);
  }

  async function handleConfirm() {
    if (!rows.length) return;
    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      if (['coil', 'skip', 'unclassified', 'drywall'].includes(row.line)) continue;
      try {
        await dispatchImportRow(row);
        successCount++;
      } catch (err) {
        console.error(`Error importando ${row.sku}:`, err);
        errorCount++;
      }
    }

    setIsProcessing(false);
    setImported(true);

    if (errorCount > 0) {
      toast.error(`Importación finalizada con ${errorCount} errores. Revisar consola.`);
    } else {
      toast.success(`Importados/Actualizados ${successCount} productos exitosamente.`);
    }
  }

  function renderGroup(line: BusinessLineTarget, title: string, colorClass: string) {
    const groupRows = rows.filter(r => r.line === line);
    if (!groupRows.length) return null;

    return (
      <div key={line} className="mb-6 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className={`p-4 font-black flex justify-between items-center ${colorClass}`}>
          <span>{title}</span>
          <span className="text-xs bg-white/30 px-2 py-1 rounded-full">{groupRows.length} SKUs</span>
        </div>
        
        {line === "drywall" && (
           <div className="bg-blue-50 p-3 text-sm text-blue-800 border-b border-blue-100 flex gap-2">
             <AlertTriangle size={16} className="shrink-0 mt-0.5" />
             <p><strong>Atención:</strong> Los perfiles creados por esta vía tendrán ancho y peso configurados en 0. Deberás editarlos manualmente para poder usarlos en producción.</p>
           </div>
        )}
        
        {line === "coil" && (
           <div className="bg-slate-50 p-3 text-sm text-slate-800 border-b border-slate-200 flex gap-2">
             <AlertTriangle size={16} className="shrink-0 mt-0.5" />
             <p>Estas bobinas <strong>NO</strong> se importarán aquí. Usa el flujo de compra de inventario para registrarlas.</p>
           </div>
        )}

        {line === "skip" && (
           <div className="bg-slate-50 p-3 text-sm text-slate-800 border-b border-slate-200 flex gap-2">
             <p>Estas filas (anticipos, etc) serán <strong>ignoradas</strong>.</p>
           </div>
        )}
        
        {line === "unclassified" && (
           <div className="bg-red-50 p-3 text-sm text-red-800 border-b border-red-200 flex gap-2">
             <AlertTriangle size={16} className="shrink-0 mt-0.5" />
             <p>Estas filas <strong>no pudieron ser clasificadas</strong> y serán omitidas. Ajusta el nombre/SKU si corresponde a un producto válido.</p>
           </div>
        )}

        <div className="max-h-60 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-wider">SKU</th>
                <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Nombre</th>
                <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Unidad Detectada</th>
                <th className="px-4 py-2 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groupRows.map((r, i) => (
                <tr key={`${r.sku}-${i}`} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2 font-mono font-bold text-slate-700">{r.sku}</td>
                  <td className="px-4 py-2 text-slate-600">{r.name}</td>
                  <td className="px-4 py-2 text-slate-600">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.normalizedUnit === "UNKNOWN" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                      {r.normalizedUnit}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider">
                    {["coil", "skip", "unclassified"].includes(r.line) ? (
                       <span className="text-slate-400 flex items-center gap-1"><X size={12} /> Ignorar</span>
                    ) : (
                       <span className="text-blue-600 flex items-center gap-1"><CheckCircle2 size={12} /> Upsert</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-black flex items-center gap-2 text-slate-800">
          <Database size={20} className="text-blue-600" /> Carga Masiva de Catálogo (Multi-línea)
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Sube un export de facturación (Excel/CSV) con columnas <code>CÓDIGO PRODUCTO</code>, <code>NOMBRE PRODUCTO</code> y <code>UNIDAD MEDIDA</code>. 
          El sistema detectará automáticamente a qué línea de negocio pertenece cada SKU y los preparará para importación.
        </p>
        
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <label className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold cursor-pointer transition flex items-center gap-2 shadow-sm active:scale-95">
            <UploadCloud size={18} /> Subir Excel / CSV
            <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFile} className="hidden" />
          </label>
          <button 
            onClick={handleLoadSeed}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold transition active:scale-95"
          >
            Cargar Catálogo Base (Seed)
          </button>
        </div>
      </div>

      {summary && rows.length > 0 && !imported && (
        <div className="animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-slate-900 text-white p-6 rounded-2xl mb-6 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <CheckCircle2 className="text-green-400" /> {rows.length} Filas Analizadas
              </h3>
              <p className="text-sm text-slate-400 mt-1 font-medium">Revisa la clasificación antes de escribir a la base de datos.</p>
            </div>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-black text-sm transition active:scale-95 shadow-md shadow-green-900/50 flex items-center gap-2"
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              Confirmar Importación
            </button>
          </div>

          {renderGroup("metallic-roofing", "Coberturas Aluzinc (Metallic Roofing)", "bg-zinc-100 text-zinc-800")}
          {renderGroup("drywall", "Perfiles Drywall", "bg-blue-100 text-blue-800")}
          {renderGroup("roofing", "Coberturas UPVC (Roofing)", "bg-emerald-100 text-emerald-800")}
          {renderGroup("trading", "Reventa de Terceros (Trading)", "bg-amber-100 text-amber-800")}
          {renderGroup("services", "Servicios de Mano de Obra", "bg-violet-100 text-violet-800")}
          {renderGroup("coil", "Bobinas de Acero (Inventario)", "bg-slate-100 text-slate-800")}
          {renderGroup("skip", "Filas a Ignorar (Anticipos, Fletes)", "bg-slate-100 text-slate-800")}
          {renderGroup("unclassified", "No Clasificados", "bg-red-100 text-red-800")}
        </div>
      )}

      {imported && (
        <div className="bg-green-50 border border-green-200 p-6 rounded-2xl flex items-center gap-4 animate-in fade-in">
          <CheckCircle2 size={32} className="text-green-500" />
          <div>
            <h3 className="text-lg font-black text-green-900">Importación finalizada</h3>
            <p className="text-sm text-green-700 font-medium">Los productos han sido registrados en sus respectivos catálogos.</p>
          </div>
        </div>
      )}
    </div>
  );
}
