"use client";

import React, { useState, useEffect } from 'react';
import { CutOrder } from "@/types";
import { X, Scissors, Save, Loader2, Receipt, Upload, FileText, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { receiveStrips } from "../services/cutOrderService";
import { getCatalog } from "@/modules/drywall/services/catalogService";
import { getSystemSettings } from "@/services/settingsService";
import toast from 'react-hot-toast';

interface ReceiveStripsModalProps {
  order: CutOrder;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReceiveStripsModal({ order, userEmail, onClose, onSuccess }: ReceiveStripsModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [ownRuc, setOwnRuc] = useState<string>('');
  
  const [isParsingXml, setIsParsingXml] = useState(false);
  const [showXmlLines, setShowXmlLines] = useState(false);
  const [tcMissing, setTcMissing] = useState(false);
  const [xmlSource, setXmlSource] = useState(false);

  useEffect(() => {
    const init = async () => {
      const [catalogData, settings] = await Promise.all([
        getCatalog(),
        getSystemSettings()
      ]);
      setCatalog(catalogData.filter(p => p.isActive));
      if (settings?.companyRuc) setOwnRuc(settings.companyRuc);
    };
    init();
  }, []);
  
  const [invoice, setInvoice] = useState({
    number: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'PEN' as 'USD' | 'PEN',
    exchangeRate: 1,
    gravada: 0,
    igv: 0,
    total: 0,
    supplier: null as { ruc: string; razonSocial: string } | null,
    detraction: null as { amount: number; code: string } | null,
    xmlLines: [] as { description: string; quantity: number; unitCode: string; amount: number }[],
  });

  // Pre-poblar strips recibidos basados en el plan enviado
  const [receivedStrips, setReceivedStrips] = useState<{ coilId: string; widthMm: number; count: number; weight: number }[]>(
    order.coils.flatMap(c => c.cutPlan.map(p => ({
      coilId: c.coilId,
      widthMm: p.widthMm,
      count: p.count,
      weight: 0 // El peso se ingresa al recibir
    })))
  );

  const fetchExchangeRate = async (date: string) => {
    try {
      setTcMissing(false);
      const res = await fetch(`/api/tipo-cambio?fecha=${date}`);
      const data = await res.json();
      if (data?.venta) {
        return parseFloat(data.venta);
      }
      setTcMissing(true);
      return 0;
    } catch (error) {
      console.error("Error fetching TC:", error);
      setTcMissing(true);
      return 0;
    }
  };

  const handleUpdateStrip = (index: number, field: 'count' | 'weight', value: number) => {
    setReceivedStrips(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const handleUpdateInvoice = async (field: string, value: any) => {
    if (field === 'date' && invoice.currency === 'USD') {
      const tc = await fetchExchangeRate(value);
      setInvoice(prev => ({ ...prev, date: value, exchangeRate: tc }));
      return;
    }

    setInvoice(prev => {
      const newInvoice = { ...prev, [field]: value };
      if (field === 'currency') {
        if (value === 'PEN') {
          newInvoice.exchangeRate = 1;
          setTcMissing(false);
        } else {
          fetchExchangeRate(prev.date).then(tc => {
            setInvoice(curr => ({ ...curr, currency: 'USD', exchangeRate: tc }));
          });
        }
      }
      if (!xmlSource && (field === 'gravada' || field === 'igv')) {
        newInvoice.total = Number(newInvoice.gravada) + Number(newInvoice.igv);
      }
      return newInvoice;
    });
  };

  const handleXmlImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingXml(true);
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "text/xml");

      const getVal = (selector: string) => xmlDoc.querySelector(selector)?.textContent || '';
      
      const number = getVal("ID");
      const date = getVal("IssueDate");
      const currency = getVal("DocumentCurrencyCode") as 'USD' | 'PEN';
      const gravada = parseFloat(xmlDoc.querySelector("LegalMonetaryTotal > LineExtensionAmount")?.textContent || '0');
      const igv = parseFloat(xmlDoc.querySelector("TaxTotal > TaxAmount")?.textContent || '0');
      const total = parseFloat(xmlDoc.querySelector("LegalMonetaryTotal > PayableAmount")?.textContent || '0');

      if (!number || !date || isNaN(gravada) || !total) {
        throw new Error("XML inválido o incompleto. Faltan campos críticos.");
      }

      // Proveedor
      const supplierRuc = xmlDoc.querySelector("AccountingSupplierParty PartyIdentification ID")?.textContent || '';
      const supplierName = xmlDoc.querySelector("AccountingSupplierParty PartyLegalEntity RegistrationName")?.textContent || 
                           xmlDoc.querySelector("AccountingSupplierParty PartyName Name")?.textContent || '';
      
      // Cliente ( Receptor )
      const customerRuc = xmlDoc.querySelector("AccountingCustomerParty PartyIdentification ID")?.textContent || '';

      // Detracción
      let detraction = null;
      const paymentTerms = xmlDoc.querySelectorAll("PaymentTerms");
      paymentTerms.forEach(pt => {
        if (pt.querySelector("ID")?.textContent === 'Detraccion') {
          detraction = {
            amount: parseFloat(pt.querySelector("Amount")?.textContent || '0'),
            code: pt.querySelector("PaymentMeansID")?.textContent || ''
          };
        }
      });

      // Líneas
      const lines: any[] = [];
      const xmlLines = xmlDoc.querySelectorAll("InvoiceLine");
      xmlLines.forEach(l => {
        lines.push({
          description: l.querySelector("Item Description")?.textContent || '',
          quantity: parseFloat(l.querySelector("InvoicedQuantity")?.textContent || '0'),
          unitCode: l.querySelector("InvoicedQuantity")?.getAttribute("unitCode") || '',
          amount: parseFloat(l.querySelector("LineExtensionAmount")?.textContent || '0')
        });
      });

      // Validaciones no bloqueantes
      if (ownRuc && customerRuc !== ownRuc) {
        toast((t) => (
          <span className="flex items-center gap-2 text-amber-600 font-bold">
            <AlertTriangle size={20} /> Factura emitida a otro RUC ({customerRuc})
          </span>
        ), { duration: 5000 });
      }

      if (order.tercero.ruc && supplierRuc !== order.tercero.ruc) {
        toast.error(`El proveedor del XML (${supplierRuc}) no coincide con el de la orden (${order.tercero.ruc})`, { icon: '⚠️' });
      }

      let exchangeRate = 1;
      if (currency === 'USD') {
        exchangeRate = await fetchExchangeRate(date);
      }

      setInvoice({
        number,
        date,
        currency,
        exchangeRate,
        gravada,
        igv,
        total,
        supplier: { ruc: supplierRuc, razonSocial: supplierName },
        detraction,
        xmlLines: lines
      });
      setXmlSource(true);
      toast.success("Factura importada correctamente.");

    } catch (error: any) {
      console.error("Error parsing XML:", error);
      toast.error(error.message || "Error al procesar el XML.");
    } finally {
      setIsParsingXml(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleClearXml = () => {
    setInvoice(prev => ({
      ...prev,
      supplier: null,
      detraction: null,
      xmlLines: [],
      exchangeRate: prev.currency === 'PEN' ? 1 : 3.80
    }));
    setXmlSource(false);
    setTcMissing(false);
    toast.success("Datos de XML descartados.");
  };

  const handleSubmit = async () => {
    if (!invoice.number) {
      toast.error("El número de factura es obligatorio.");
      return;
    }

    const receivedWeightTotal = receivedStrips.reduce((sum, s) => sum + s.weight, 0);
    if (receivedWeightTotal === 0) {
      toast.error("Debes ingresar el peso recibido.");
      return;
    }

    setIsSubmitting(true);
    try {
      await receiveStrips({
        cutOrderId: order.id!,
        invoice: {
          ...invoice,
          gravada: Number(invoice.gravada),
          igv: Number(invoice.igv),
          total: Number(invoice.total),
          exchangeRate: Number(invoice.exchangeRate),
          source: xmlSource ? 'XML' : 'MANUAL'
        },
        receivedStrips,
        receivedWeightTotal,
        userEmail
      });
      toast.success("Flejes recibidos y stock actualizado.");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Error al recibir flejes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <header className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-200">
              <Save size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Registrar Recepción de Flejes</h2>
              <p className="text-sm text-slate-500 font-bold italic">Orden #{order.id?.slice(-6)} - {order.tercero.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition text-slate-400">
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
               <div className="flex justify-between items-center">
                 <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                   <Receipt size={16} /> 1. Datos de Facturación
                 </h3>
                 {!xmlSource ? (
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black cursor-pointer hover:bg-blue-100 transition border border-blue-100 uppercase">
                       {isParsingXml ? <Loader2 className="animate-spin" size={12} /> : <Upload size={12} />}
                       IMPORTAR XML
                       <input type="file" accept=".xml" className="hidden" onChange={handleXmlImport} disabled={isParsingXml} />
                    </label>
                 ) : (
                    <button 
                      onClick={handleClearXml}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-[10px] font-black hover:bg-red-100 transition border border-red-100 uppercase"
                    >
                      <X size={12} /> LIMPIAR XML
                    </button>
                 )}
               </div>
               
               <div className="bg-slate-50 p-6 rounded-3xl space-y-4 border border-slate-100">
                  {xmlSource && invoice.supplier && (
                    <div className="p-4 bg-white rounded-2xl border border-blue-100 shadow-sm space-y-1">
                       <p className="text-[9px] font-black text-blue-500 uppercase tracking-tighter flex items-center gap-1">
                          <CheckCircle2 size={10} /> Emisor Factura (XML)
                       </p>
                       <p className="text-[11px] font-black text-slate-800 line-clamp-1">{invoice.supplier.razonSocial}</p>
                       <p className="text-[10px] font-bold text-slate-400">RUC: {invoice.supplier.ruc}</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">N° Factura</label>
                      {xmlSource && <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black uppercase">XML</span>}
                    </div>
                    <input 
                      type="text" 
                      value={invoice.number}
                      onChange={e => handleUpdateInvoice('number', e.target.value)}
                      placeholder="F001-..."
                      className={`w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all ${xmlSource ? 'ring-1 ring-blue-100' : ''}`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Fecha</label>
                      <input 
                        type="date" 
                        value={invoice.date}
                        onChange={e => handleUpdateInvoice('date', e.target.value)}
                        className="w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Moneda</label>
                      <select 
                        value={invoice.currency}
                        onChange={e => handleUpdateInvoice('currency', e.target.value)}
                        className="w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="USD">USD</option>
                        <option value="PEN">PEN</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Tipo de Cambio</label>
                      {tcMissing && <span className="text-[8px] text-amber-600 font-bold uppercase animate-pulse">TC Manual Requerido</span>}
                    </div>
                    <input 
                      type="number" 
                      step="0.001"
                      value={invoice.exchangeRate}
                      onChange={e => handleUpdateInvoice('exchangeRate', e.target.value)}
                      className={`w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all ${tcMissing ? 'ring-2 ring-amber-200' : ''}`}
                    />
                    {tcMissing && (
                      <p className="text-[9px] text-amber-600 font-bold ml-2 mt-1 italic">TC no obtenido para la fecha - ingrésalo manualmente</p>
                    )}
                  </div>

                  <div className="h-px bg-slate-200 my-2" />

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Gravada ({invoice.currency})</label>
                    <input 
                      type="number" 
                      value={invoice.gravada}
                      onChange={e => handleUpdateInvoice('gravada', e.target.value)}
                      className="w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">IGV ({invoice.currency})</label>
                    <input 
                      type="number" 
                      value={invoice.igv}
                      onChange={e => handleUpdateInvoice('igv', e.target.value)}
                      className="w-full bg-white border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>

                  <div className="pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Total {invoice.currency}</p>
                    <p className="text-2xl font-black text-slate-900 ml-2">{invoice.total.toFixed(2)}</p>
                    {invoice.exchangeRate > 0 && invoice.currency === 'USD' && (
                      <p className="text-[10px] font-bold text-blue-600 uppercase italic ml-2 mt-1">
                        Costo Servicio: S/ {(invoice.gravada * invoice.exchangeRate).toFixed(2)} PEN (sin IGV)
                      </p>
                    )}
                  </div>

                  {invoice.detraction && (
                    <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-3">
                       <AlertTriangle className="text-amber-500" size={18} />
                       <div>
                          <p className="text-[10px] font-black text-amber-700 uppercase">Afecto a Detracción</p>
                          <p className="text-xs font-bold text-amber-600">{invoice.currency} {invoice.detraction.amount.toFixed(2)} (Cod. {invoice.detraction.code})</p>
                       </div>
                    </div>
                  )}

                  {xmlSource && invoice.xmlLines.length > 0 && (
                    <div className="mt-4">
                       <button 
                        onClick={() => setShowXmlLines(!showXmlLines)}
                        className="w-full flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200 text-[10px] font-black text-slate-500 hover:bg-slate-50 transition uppercase"
                       >
                         <span className="flex items-center gap-2"><FileText size={14} /> Detalle factura (referencia)</span>
                         {showXmlLines ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                       </button>
                       {showXmlLines && (
                         <div className="mt-2 space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                            {invoice.xmlLines.map((line, i) => (
                              <div key={i} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm text-[10px]">
                                 <p className="font-bold text-slate-700 leading-tight mb-1">{line.description}</p>
                                 <div className="flex justify-between text-slate-400 font-black">
                                    <span>{line.quantity} {line.unitCode}</span>
                                    <span className="text-slate-600">{invoice.currency} {line.amount.toFixed(2)}</span>
                                 </div>
                              </div>
                            ))}
                         </div>
                       )}
                    </div>
                  )}
               </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
               <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                 <Scissors size={16} /> 2. Flejes Recibidos (Detalle por Bobina)
               </h3>

               <div className="space-y-4">
                  {order.coils.map(coilInfo => (
                    <div key={coilInfo.coilId} className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                       <header className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200/50">
                          <div className="flex items-center gap-3">
                             <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-[10px] font-black text-slate-400 uppercase">
                               {coilInfo.coilId.slice(-6)}
                             </div>
                             <p className="text-sm font-black text-slate-700">Enviado: {coilInfo.sentWeight} kg</p>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Recibido</p>
                             <p className="text-sm font-black text-green-600">
                               {receivedStrips.filter(s => s.coilId === coilInfo.coilId).reduce((sum, s) => sum + s.weight, 0).toFixed(2)} kg
                             </p>
                          </div>
                       </header>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {receivedStrips.filter(s => s.coilId === coilInfo.coilId).map((strip, idx) => {
                             const originalIndex = receivedStrips.findIndex(s => s === strip);
                             const mappedProduct = catalog.find(p => p.stripWidth === strip.widthMm);
                             return (
                               <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 font-black text-xs">
                                      {strip.widthMm}
                                    </div>
                                    <div className="flex-1">
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mapeo SKU</p>
                                       <p className="text-xs font-bold text-slate-700">
                                         {mappedProduct ? `${mappedProduct.sku} - ${mappedProduct.name}` : 'SIN ASIGNAR'}
                                       </p>
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                     <div className="space-y-1">
                                        <label className="text-[8px] font-black text-slate-300 uppercase block">Cant.</label>
                                        <input 
                                          type="number" 
                                          value={strip.count}
                                          onChange={e => handleUpdateStrip(originalIndex, 'count', Number(e.target.value))}
                                          className="w-full border-none p-0 text-sm font-black text-slate-700 focus:ring-0"
                                        />
                                     </div>
                                     <div className="space-y-1">
                                        <label className="text-[8px] font-black text-slate-300 uppercase block">Peso (kg)</label>
                                        <input 
                                          type="number" 
                                          value={strip.weight}
                                          onChange={e => handleUpdateStrip(originalIndex, 'weight', Number(e.target.value))}
                                          className="w-full border-none p-0 text-sm font-black text-slate-700 focus:ring-0"
                                        />
                                     </div>
                                  </div>
                               </div>
                             );
                          })}
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>

        <footer className="p-8 border-t border-slate-50 bg-slate-50/50 flex justify-between items-center">
          <div className="flex gap-8">
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Total Enviado</p>
                <p className="text-lg font-black text-slate-600">{order.sentWeightTotal.toFixed(2)} kg</p>
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Peso Total Recibido</p>
                <p className="text-lg font-black text-green-600">{receivedStrips.reduce((sum, s) => sum + s.weight, 0).toFixed(2)} kg</p>
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Merma Refilado</p>
                <p className="text-lg font-black text-red-500">{(order.sentWeightTotal - receivedStrips.reduce((sum, s) => sum + s.weight, 0)).toFixed(2)} kg</p>
             </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-8 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-10 py-4 bg-green-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition shadow-xl shadow-green-200 flex items-center gap-3 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Registrar Recepción
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
