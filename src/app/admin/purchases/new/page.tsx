"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Truck,
  ArrowLeft,
  Save,
  Trash2,
  Calculator,
  Info,
  Search,
  Loader2,
} from "lucide-react";
import { PurchaseItemSelector } from "@/components/purchases/PurchaseItemSelector";
import type { Purchase, PurchaseItem, Currency } from "@/core/purchases/types";
import { registerPurchase } from "@/core/purchases/service";
import { Timestamp } from "firebase/firestore";
import { functions } from "@/lib/firebase/clientApp";
import { httpsCallable } from "firebase/functions";
import toast from "react-hot-toast";

const IGV_RATE = 0.18;

export default function NewPurchasePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingSupplier, setIsSearchingSupplier] = useState(false);

  // Form State
  const [businessLine, setBusinessLine] = useState<"roofing" | "trading">(
    "trading",
  );
  const [supplier, setSupplier] = useState({ ruc: "", name: "" });

  const handleSearchSupplier = async () => {
    if (supplier.ruc.length !== 11) {
      return toast.error("Ingrese un RUC válido (11 dígitos).");
    }

    setIsSearchingSupplier(true);
    const consultFn = httpsCallable(functions, "consultarRuc");
    try {
      const result: any = await consultFn({ ruc: supplier.ruc });

      if (result.data.success) {
        const data = result.data.data;
        setSupplier((prev) => ({
          ...prev,
          name: data.razonSocial || data.razon_social || "",
        }));
        toast.success("Proveedor encontrado en SUNAT.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error al buscar proveedor.");
    } finally {
      setIsSearchingSupplier(false);
    }
  };
  const [invoice, setInvoice] = useState({
    number: "",
    date: new Date().toISOString().split("T")[0],
    currency: "PEN" as Currency,
    exchangeRate: 1,
    gravada: 0,
    igv: 0,
    total: 0,
  });
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // Fetch exchange rate on date change
  useEffect(() => {
    if (invoice.currency === "USD") {
      const fetchTC = async () => {
        try {
          const res = await fetch(`/api/tipo-cambio?fecha=${invoice.date}`);
          if (res.ok) {
            const data = await res.json();
            if (data.venta) {
              setInvoice((prev) => ({ ...prev, exchangeRate: data.venta }));
            }
          }
        } catch (e) {
          console.error("Error al obtener TC:", e);
        }
      };
      fetchTC();
    }
  }, [invoice.date, invoice.currency]);

  // Derived Values
  const totals = useMemo(() => {
    const totalPEN = items.reduce((sum, item) => {
      const unitCostPEN =
        invoice.currency === "USD"
          ? item.unitCostCurrency * invoice.exchangeRate
          : item.unitCostCurrency;
      return sum + item.quantity * unitCostPEN;
    }, 0);

    const igv = totalPEN * IGV_RATE;
    const totalWithIgv = totalPEN + igv;

    return {
      gravadaPEN: totalPEN,
      igvPEN: igv,
      totalPEN: totalWithIgv,
    };
  }, [items, invoice.currency, invoice.exchangeRate]);

  const handleAddItem = (item: PurchaseItem) => {
    setItems([...items, item]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0)
      return toast.error("Debe agregar al menos un ítem.");
    if (supplier.ruc.length !== 11)
      return toast.error("RUC debe tener 11 dígitos.");

    setIsSubmitting(true);
    try {
      const finalItems = items.map((item) => ({
        ...item,
        unitCostPEN:
          invoice.currency === "USD"
            ? Number((item.unitCostCurrency * invoice.exchangeRate).toFixed(4))
            : item.unitCostCurrency,
      }));

      const purchaseData: Omit<Purchase, "status" | "createdAt" | "createdBy"> =
        {
          supplier,
          businessLine,
          invoice: {
            ...invoice,
            date: Timestamp.fromDate(new Date(invoice.date)),
            gravada: Number(totals.gravadaPEN.toFixed(2)),
            igv: Number(totals.igvPEN.toFixed(2)),
            total: Number(totals.totalPEN.toFixed(2)),
          },
          items: finalItems,
          totalCostPEN: Number(totals.gravadaPEN.toFixed(2)), // El costo de inventario es la GRAVADA
        };

      await registerPurchase(purchaseData);
      toast.success("Compra registrada con éxito.");
      router.push("/admin/purchases");
    } catch (error: any) {
      toast.error(error.message || "Error al registrar la compra.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-50 rounded-full transition"
          >
            <ArrowLeft size={20} className="text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <Truck className="text-blue-600" /> Registrar Compra
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Complete los datos del comprobante del proveedor
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Left Column: Form Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Business Line & Supplier */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Info size={14} /> Información General
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                  Línea de Negocio
                </label>
                <select
                  value={businessLine}
                  onChange={(e) => setBusinessLine(e.target.value as any)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500"
                >
                  <option value="trading">Reventa / Trading</option>
                  <option value="roofing">Coberturas UPVC</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                  RUC Proveedor
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={11}
                    value={supplier.ruc}
                    onChange={(e) =>
                      setSupplier({ ...supplier, ruc: e.target.value })
                    }
                    placeholder="20123456789"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSearchSupplier}
                    disabled={isSearchingSupplier || supplier.ruc.length !== 11}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-30"
                    title="Buscar en SUNAT"
                  >
                    {isSearchingSupplier ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Search size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                Razón Social Proveedor
              </label>
              <input
                type="text"
                value={supplier.name}
                onChange={(e) =>
                  setSupplier({ ...supplier, name: e.target.value })
                }
                placeholder="PROVEEDOR S.A.C."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500"
                required
              />
            </div>
          </section>

          {/* Invoice Details */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Calculator size={14} /> Datos del Comprobante
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                  Nº Factura
                </label>
                <input
                  type="text"
                  value={invoice.number}
                  onChange={(e) =>
                    setInvoice({ ...invoice, number: e.target.value })
                  }
                  placeholder="F001-000123"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                  Fecha
                </label>
                <input
                  type="date"
                  value={invoice.date}
                  onChange={(e) =>
                    setInvoice({ ...invoice, date: e.target.value })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                  Moneda
                </label>
                <select
                  value={invoice.currency}
                  onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      currency: e.target.value as any,
                      exchangeRate:
                        e.target.value === "PEN" ? 1 : invoice.exchangeRate,
                    })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500"
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
            </div>

            {invoice.currency === "USD" && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-700">
                  <Info size={16} />
                  <span className="text-sm font-bold">Tipo de Cambio</span>
                </div>
                <input
                  type="number"
                  step="0.001"
                  value={invoice.exchangeRate}
                  onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      exchangeRate: Number(e.target.value),
                    })
                  }
                  className="w-24 p-2 bg-white border border-blue-200 rounded-lg text-center font-black text-blue-700"
                />
              </div>
            )}
          </section>

          {/* Item Selector & List */}
          <section className="space-y-4">
            <PurchaseItemSelector
              businessLine={businessLine}
              onAdd={handleAddItem}
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase">
                      Ítem
                    </th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center">
                      Cant.
                    </th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right">
                      Costo Unit ({invoice.currency})
                    </th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-right">
                      Costo PEN (s/IGV)
                    </th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-slate-400 font-medium"
                      >
                        No se han agregado productos
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const costPEN =
                        invoice.currency === "USD"
                          ? item.unitCostCurrency * invoice.exchangeRate
                          : item.unitCostCurrency;
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-4">
                            <p className="font-bold text-slate-700 text-sm">
                              {item.productName}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {item.sku}
                            </p>
                          </td>
                          <td className="p-4 text-center font-black text-slate-600">
                            {item.quantity}
                          </td>
                          <td className="p-4 text-right font-bold text-slate-600">
                            {invoice.currency === "USD" ? "$" : "S/"}{" "}
                            {item.unitCostCurrency.toFixed(2)}
                          </td>
                          <td className="p-4 text-right font-black text-slate-800">
                            S/ {costPEN.toFixed(2)}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-300 hover:text-red-500 transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column: Summary & Submit */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl space-y-6 sticky top-6">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Resumen de Compra
            </h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs font-bold uppercase">
                  Subtotal (Gravada)
                </span>
                <span className="font-mono">
                  S/{" "}
                  {totals.gravadaPEN.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs font-bold uppercase">IGV (18%)</span>
                <span className="font-mono">
                  S/{" "}
                  {totals.igvPEN.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="h-px bg-slate-800 my-2" />
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-black uppercase text-blue-400 tracking-tighter">
                  Total Factura
                </span>
                <span className="text-3xl font-black tabular-nums">
                  S/{" "}
                  {totals.totalPEN.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 space-y-2">
              <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
                <Info size={12} /> Nota de Costeo
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                El costo que ingresa al inventario (PPP) se basa en la{" "}
                <strong>Gravada</strong> (valor sin IGV). El IGV se considera
                crédito fiscal.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
              {isSubmitting ? (
                "Procesando..."
              ) : (
                <>
                  <Save size={20} /> Registrar Compra
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
