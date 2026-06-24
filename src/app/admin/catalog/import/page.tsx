"use client";

import React, { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { UploadCloud, CheckCircle2, AlertTriangle, Play, Loader2, Database, XCircle, RefreshCw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { parseAndClassify, type ParsedCatalogRow } from "@/core/import/catalogImport";
import { listFinishes, CoilFinish } from "@/core/coils/services/finishService";
import { getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/clientApp";

import { createProduct as createMetallic } from "@/modules/metallic-roofing/services/catalogService";

type ImportStatus = 'VALID' | 'DUPLICATE' | 'WARNING' | 'ERROR';

interface PreviewRow extends ParsedCatalogRow {
  status: ImportStatus;
  message: string;
  derivedDensityFactor: number | null;
  family: 'COBERTURA' | 'PLANCHA';
  isLengthConfirmed: boolean;
}

export default function CatalogImportPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [imported, setImported] = useState(false);
  
  const [stats, setStats] = useState({ totalRead: 0, included: 0, excluded: 0 });
  const [finishes, setFinishes] = useState<CoilFinish[]>([]);
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchReferences();
  }, []);

  const fetchReferences = async () => {
    try {
      const finishList = await listFinishes(true);
      setFinishes(finishList.filter(f => f.lines.includes('metallic-roofing')));

      const metallicProd = await getDocs(collection(db, "metallic_roofing_catalog"));
      const skus = new Set<string>();
      metallicProd.forEach(d => skus.add(d.id));

      setExistingSkus(skus);
    } catch (error) {
      console.error("Error cargando referencias:", error);
      toast.error("Error cargando catálogos de referencia.");
    }
  };

  const calculateStatus = (row: PreviewRow | (ParsedCatalogRow & { family: string, isLengthConfirmed?: boolean }), aluzincFinishes: CoilFinish[], allSkus: Set<string>): { status: ImportStatus; message: string; derivedDensityFactor: number | null } => {
    let derivedDensityFactor: number | null = null;
    
    if (!row.sku || !row.name) {
       return { status: 'ERROR', message: 'SKU y Nombre son obligatorios.', derivedDensityFactor };
    }

    if (allSkus.has(row.sku)) {
      return { status: 'DUPLICATE', message: 'El SKU ya existe en la base de datos (SKIP).', derivedDensityFactor };
    }

    if (!row.colorOrFinish) {
      return { status: 'ERROR', message: 'El acabado es obligatorio.', derivedDensityFactor };
    }

    const finishObj = aluzincFinishes.find(f => f.id === row.colorOrFinish.toUpperCase());
    if (!finishObj) {
      return { status: 'ERROR', message: `Debes seleccionar un acabado válido.`, derivedDensityFactor };
    }
    
    derivedDensityFactor = finishObj.densityFactor ?? null;

    if (row.material && row.material.toUpperCase().includes('COMPRA VENTA')) {
      return { status: 'WARNING', message: 'Material es "COMPRA VENTA", revisar.', derivedDensityFactor };
    }

    if (row.family === 'PLANCHA') {
      if (!row.length) {
        return { status: 'WARNING', message: 'Falta largo, recomendado para planchas.', derivedDensityFactor };
      }
      if (!row.isLengthConfirmed) {
        return { status: 'WARNING', message: `Largo sugerido del código: ${row.length}m — verifica`, derivedDensityFactor };
      }
    }

    return { status: 'VALID', message: 'OK', derivedDensityFactor };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setImported(false);
    try {
      const data = await file.arrayBuffer();
      
      const wb = XLSX.read(data, { type: 'array', raw: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawLen = XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' }).length;

      const parsed = parseAndClassify(data);
      
      const previewRows: PreviewRow[] = parsed.map(r => {
        const family = r.sku.startsWith('PL') ? 'PLANCHA' : 'COBERTURA';
        const normalizedUnit = r.sku.startsWith('PL') ? 'PIEZA' : 'METRO';
        // Si no tiene length derivado, ya está "confirmado" que el usuario lo ingresará manual. Si tiene, requiere confirmación.
        const isLengthConfirmed = r.length === undefined; 
        const enhancedRow = { ...r, family, normalizedUnit, isLengthConfirmed } as PreviewRow;

        const { status, message, derivedDensityFactor } = calculateStatus(enhancedRow, finishes, existingSkus);
        return { ...enhancedRow, status, message, derivedDensityFactor };
      });

      setRows(previewRows);
      setStats({
        totalRead: rawLen,
        included: previewRows.length,
        excluded: rawLen - previewRows.length
      });
      
      toast.success(`${previewRows.length} productos Aluzinc (COB/PL) listos para revisión.`);
    } catch (error) {
      console.error(error);
      toast.error("Error al analizar el Excel.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCellChange = (index: number, field: keyof PreviewRow, value: any) => {
    const newRows = [...rows];
    (newRows[index] as any)[field] = value;
    
    if (field === 'length') {
      newRows[index].isLengthConfirmed = true;
    }

    // Auto-unit when family changes
    if (field === 'family') {
      newRows[index].normalizedUnit = value === 'PLANCHA' ? 'PIEZA' : 'METRO';
      if (value === 'COBERTURA') newRows[index].length = undefined;
    }

    const { status, message, derivedDensityFactor } = calculateStatus(newRows[index], finishes, existingSkus);
    newRows[index].status = status;
    newRows[index].message = message;
    newRows[index].derivedDensityFactor = derivedDensityFactor;
    
    setRows(newRows);
  };

  const handleRemoveRow = (index: number) => {
    const newRows = [...rows];
    newRows.splice(index, 1);
    setRows(newRows);
    setStats(prev => ({
      ...prev,
      included: newRows.length,
      excluded: prev.excluded + 1
    }));
  };

  const handleConfirm = async () => {
    const rowsToImport = rows.filter(r => r.status === 'VALID' || r.status === 'WARNING');
    if (rowsToImport.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of rowsToImport) {
      try {
        await createMetallic({
          sku: row.sku,
          displayName: row.name,
          family: row.family,
          finish: row.colorOrFinish.toUpperCase(),
          thickness: row.thickness,
          width: row.width,
          widthMm: row.width * 1000,
          length: row.family === 'PLANCHA' ? (row.length || undefined) : undefined,
          unit: row.normalizedUnit as any,
          densityFactor: row.derivedDensityFactor || undefined,
          active: row.active,
        });
        
        successCount++;
        setExistingSkus(prev => new Set(prev).add(row.sku));
      } catch (err) {
        console.error(`Error importando ${row.sku}:`, err);
        errorCount++;
      }
    }

    setIsProcessing(false);
    setImported(true);
    await fetchReferences();

    if (errorCount > 0) {
      toast.error(`Importación finalizada: ${successCount} OK, ${errorCount} errores.`);
    } else {
      toast.success(`Se importaron ${successCount} productos exitosamente.`);
    }
  };

  const formatKind = (family: string, unit: string) => {
    if (family === 'COBERTURA' && unit === 'METRO') return 'COBERTURA_ML';
    if (family === 'PLANCHA' && (unit === 'PIEZA' || unit === 'UNIDAD')) return 'PLANCHA_UND';
    return `${family}_${unit}`;
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10 space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Database size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Importación Masiva de Conformado (Aluzinc)</h1>
            <p className="text-sm text-slate-500 font-medium">Sube el CSV para importar productos COB* y PL* exclusivamente.</p>
          </div>
        </div>
        
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <label className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold cursor-pointer transition flex items-center gap-2 shadow-sm active:scale-95">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            {loading ? "Analizando..." : "Subir Excel / CSV"}
            <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" ref={fileInputRef} disabled={loading} />
          </label>
          <button onClick={fetchReferences} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition">
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {stats.totalRead > 0 && !imported && (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-black flex items-center gap-2">
                <CheckCircle2 className="text-green-400" /> {stats.included} Productos (COB / PL) listos
              </h3>
              <p className="text-sm text-slate-400 mt-1 font-medium">
                Leídas: {stats.totalRead} | Incluidas: {stats.included} | Excluidas: {stats.excluded}
                <br/>
                <span className="opacity-75">
                  ({rows.filter(r => r.status === 'VALID' || r.status === 'WARNING').length} importables, {' '}
                  {rows.filter(r => r.status === 'DUPLICATE').length} duplicados, {' '}
                  {rows.filter(r => r.status === 'ERROR').length} con error)
                </span>
              </p>
            </div>
            <button
              onClick={handleConfirm}
              disabled={isProcessing || rows.filter(r => r.status === 'VALID' || r.status === 'WARNING').length === 0}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-black text-sm transition active:scale-95 shadow-md shadow-green-900/50 flex items-center gap-2"
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
              Importar Válidos y Revisar
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 z-10 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Acción</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Estado</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">SKU</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider min-w-[200px]">Descripción</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Tipo (Familia)</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Acabado</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Espesor</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Ancho(m)</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Largo(m)</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Unidad</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Activo</th>
                    <th className="px-3 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Densidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, i) => (
                    <tr key={`${row.sku}-${i}`} className={`hover:bg-slate-50/50 ${row.status === 'ERROR' ? 'bg-red-50/30' : ''} ${row.status === 'WARNING' ? 'bg-orange-50/50' : ''}`}>
                      <td className="px-3 py-2">
                        <button onClick={() => handleRemoveRow(i)} className="text-slate-400 hover:text-red-600 transition" title="Quitar ítem del lote">
                          <Trash2 size={16} />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {row.status === 'VALID' && <span className="flex w-max items-center gap-1 text-green-600 text-xs font-bold bg-green-100 px-2 py-1 rounded"><CheckCircle2 size={14}/> OK</span>}
                        {row.status === 'DUPLICATE' && <span className="flex w-max items-center gap-1 text-slate-500 text-xs font-bold bg-slate-100 px-2 py-1 rounded" title={row.message}><RefreshCw size={14}/> DUPLICADO</span>}
                        {row.status === 'WARNING' && <span className="flex w-max items-center gap-1 text-orange-600 text-xs font-bold bg-orange-100 px-2 py-1 rounded" title={row.message}><AlertTriangle size={14}/> REVISAR</span>}
                        {row.status === 'ERROR' && <span className="flex w-max items-center gap-1 text-red-600 text-xs font-bold bg-red-100 px-2 py-1 rounded" title={row.message}><XCircle size={14}/> ERROR</span>}
                      </td>
                      <td className="px-3 py-2">
                        <input 
                          type="text" 
                          value={row.sku} 
                          onChange={(e) => handleCellChange(i, 'sku', e.target.value.toUpperCase())}
                          className="w-28 bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none text-slate-700 font-mono font-bold px-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input 
                          type="text" 
                          value={row.name} 
                          onChange={(e) => handleCellChange(i, 'name', e.target.value.toUpperCase())}
                          className="w-full min-w-[200px] bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none text-slate-700 font-medium px-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col">
                          <select
                            value={row.family}
                            onChange={(e) => handleCellChange(i, 'family', e.target.value)}
                            className="bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none text-slate-700 font-medium px-1"
                          >
                            <option value="COBERTURA">COBERTURA</option>
                            <option value="PLANCHA">PLANCHA</option>
                          </select>
                          <span className="text-[10px] text-slate-400 font-mono mt-1">{formatKind(row.family, row.normalizedUnit)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.colorOrFinish.toUpperCase()}
                          onChange={(e) => handleCellChange(i, 'colorOrFinish', e.target.value)}
                          className={`w-28 bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none text-slate-700 font-medium px-1 ${!finishes.some(f => f.id === row.colorOrFinish.toUpperCase()) ? 'text-red-500' : ''}`}
                        >
                          <option value="">Selecciona...</option>
                          {finishes.map(f => (
                            <option key={f.id} value={f.id}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input 
                          type="number" 
                          step="0.01"
                          value={row.thickness} 
                          onChange={(e) => handleCellChange(i, 'thickness', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none text-slate-700 font-medium px-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input 
                          type="number" 
                          step="0.01"
                          value={row.width} 
                          onChange={(e) => handleCellChange(i, 'width', parseFloat(e.target.value) || 0)}
                          className="w-16 bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none text-slate-700 font-medium px-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {row.family === 'PLANCHA' ? (
                          <input 
                            type="number" 
                            step="0.01"
                            value={row.length || ''} 
                            onChange={(e) => handleCellChange(i, 'length', parseFloat(e.target.value) || undefined)}
                            className="w-16 bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none text-slate-700 font-medium px-1 placeholder-slate-300"
                            placeholder="Largo"
                          />
                        ) : (
                          <span className="text-slate-300 text-xs px-1">N/A</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.normalizedUnit}
                          onChange={(e) => handleCellChange(i, 'normalizedUnit', e.target.value)}
                          className="w-20 bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 outline-none text-slate-700 font-medium px-1"
                        >
                          <option value="METRO">METRO</option>
                          <option value="PIEZA">PIEZA</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.active}
                          onChange={(e) => handleCellChange(i, 'active', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs font-mono font-bold text-slate-500">
                        {row.derivedDensityFactor !== null ? row.derivedDensityFactor : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {imported && (
        <div className="bg-green-50 border border-green-200 p-6 rounded-2xl flex items-center gap-4 animate-in fade-in">
          <CheckCircle2 size={32} className="text-green-500" />
          <div>
            <h3 className="text-lg font-black text-green-900">Importación finalizada</h3>
            <p className="text-sm text-green-700 font-medium">Revisa el catálogo de Conformado para verificar los productos agregados.</p>
          </div>
        </div>
      )}
    </div>
  );
}
