"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getCatalog, type ProductConfig } from "@/services/catalogService";
import { listProducts } from "@/modules/roofing/services/catalogService";
import type { StockSummary, SaleItem, BusinessLine } from "@/types";
import type { RoofingProduct, RoofingStock } from "@/modules/roofing/types";
import type { SystemSettings } from "@/services/settingsService";
import { AlertTriangle, Factory, Home, Package, Plus } from "lucide-react";

export type CartItem = SaleItem;

type ActiveTab = "drywall" | "roofing" | "coils";

interface Props {
  cartItems: CartItem[];
  settings: SystemSettings | null;
  onAdd: (item: CartItem) => void;
}

const IGV_RATE = 0.18;

function suggestedPrice(cost: number, marginPercent: number): number {
  if (cost <= 0) return 0;
  const valueWithoutIGV = cost / (1 - marginPercent / 100);
  return Number((valueWithoutIGV * (1 + IGV_RATE)).toFixed(2));
}

export default function ProductSelector({ cartItems, settings, onAdd }: Props) {
  const [tab, setTab] = useState<ActiveTab>("drywall");

  // ── Drywall data ───────────────────────────────────────────────────────────
  const [drywallCatalog, setDrywallCatalog] = useState<ProductConfig[]>([]);
  const [drywallStock, setDrywallStock] = useState<StockSummary[]>([]);

  // ── Roofing data ───────────────────────────────────────────────────────────
  const [roofingCatalog, setRoofingCatalog] = useState<RoofingProduct[]>([]);
  const [roofingStock, setRoofingStock] = useState<RoofingStock[]>([]);

  // ── Coils data ─────────────────────────────────────────────────────────────
  const [availableCoils, setAvailableCoils] = useState<Record<string, unknown>[]>([]);

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    getCatalog().then((c) => setDrywallCatalog(c.filter((p) => p.isActive)));
    listProducts({ active: true }).then(setRoofingCatalog);
  }, []);

  // Real-time stock subscriptions
  useEffect(() => {
    const unsubDrywall = onSnapshot(collection(db, "inventory_stock"), (snap) => {
      setDrywallStock(snap.docs.map((d) => ({ sku: d.id, ...d.data() } as StockSummary)));
    });

    const unsubRoofing = onSnapshot(collection(db, "roofing_stock"), (snap) => {
      setRoofingStock(snap.docs.map((d) => ({ sku: d.id, ...d.data() } as RoofingStock)));
    });

    const unsubCoils = onSnapshot(
      query(collection(db, "coils"), where("status", "==", "AVAILABLE")),
      (snap) => setAvailableCoils(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );

    return () => { unsubDrywall(); unsubRoofing(); unsubCoils(); };
  }, []);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-100">
        {(
          [
            { id: "drywall", label: "Perfiles Drywall", icon: <Package size={14} />, color: "text-blue-600" },
            { id: "roofing", label: "Coberturas PVC", icon: <Home size={14} />, color: "text-emerald-600" },
            { id: "coils", label: "Bobinas M.P.", icon: <Factory size={14} />, color: "text-orange-600" },
          ] as const
        ).map(({ id, label, icon, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition ${
              tab === id
                ? `border-current ${color}`
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {tab === "drywall" && (
          <DrywallTab
            catalog={drywallCatalog}
            stock={drywallStock}
            cartItems={cartItems}
            settings={settings}
            onAdd={onAdd}
          />
        )}
        {tab === "roofing" && (
          <RoofingTab
            catalog={roofingCatalog}
            stock={roofingStock}
            cartItems={cartItems}
            settings={settings}
            onAdd={onAdd}
          />
        )}
        {tab === "coils" && (
          <CoilsTab
            coils={availableCoils}
            cartItems={cartItems}
            settings={settings}
            onAdd={onAdd}
          />
        )}
      </div>
    </div>
  );
}

// ─── Drywall tab ──────────────────────────────────────────────────────────────

function DrywallTab({
  catalog,
  stock,
  cartItems,
  settings,
  onAdd,
}: {
  catalog: ProductConfig[];
  stock: StockSummary[];
  cartItems: CartItem[];
  settings: SystemSettings | null;
  onAdd: (item: CartItem) => void;
}) {
  const [selectedSku, setSelectedSku] = useState(catalog[0]?.sku ?? "");
  const [qty, setQty] = useState<number | "">("");
  const [price, setPrice] = useState<number | "">("");

  useEffect(() => {
    if (catalog.length > 0 && !selectedSku) setSelectedSku(catalog[0].sku);
  }, [catalog, selectedSku]);

  const stockItem = stock.find((s) => s.sku === selectedSku);
  const baseCost = stockItem?.lastCostPerPiece ?? 0;
  const currentStock = stockItem?.totalQuantity ?? 0;
  const alreadyInCart = cartItems.filter((i) => i.sku === selectedSku && (i.businessLine ?? "drywall") === "drywall").reduce((s, i) => s + i.quantity, 0);
  const willBeNegative = currentStock - alreadyInCart - Number(qty || 0) < 0;

  useEffect(() => {
    if (!selectedSku) return;
    const item = stock.find((s) => s.sku === selectedSku);
    if (item?.lastCostPerPiece) {
      setPrice(suggestedPrice(item.lastCostPerPiece, settings?.minMarginPercent ?? 20));
    } else {
      setPrice("");
    }
    setQty("");
  }, [selectedSku, stock, settings]);

  function handleAdd() {
    if (!selectedSku || !qty || !price) return;
    const numQty = Number(qty);
    const numPrice = Number(price);
    const unitValue = numPrice / (1 + IGV_RATE);
    const product = catalog.find((p) => p.sku === selectedSku);

    if (unitValue < baseCost) {
      if (!confirm(`⚠️ ALERTA: El precio sin IGV (S/ ${unitValue.toFixed(2)}) es menor al costo (S/ ${baseCost.toFixed(2)}). ¿Vender a pérdida?`)) return;
    }

    onAdd({
      sku: selectedSku,
      businessLine: "drywall",
      productName: product?.name ?? selectedSku,
      quantity: numQty,
      unitPrice: numPrice,
      unitValue,
      baseCost,
      unitWeight: product?.standardWeight ?? 0,
      isCoil: false,
    });

    setQty("");
  }

  if (catalog.length === 0) {
    return <p className="text-sm text-gray-400 font-medium py-4 text-center">Cargando catálogo…</p>;
  }

  return (
    <div className="flex flex-col md:flex-row items-end gap-4">
      <div className="flex-1 w-full">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Perfil Drywall</label>
        <select
          value={selectedSku}
          onChange={(e) => setSelectedSku(e.target.value)}
          className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none h-[56px]"
        >
          {catalog.map((p) => {
            const s = stock.find((st) => st.sku === p.sku);
            const qty = s?.totalQuantity ?? 0;
            return (
              <option key={p.sku} value={p.sku}>
                {p.sku} — {p.name} | Disp: {qty}
              </option>
            );
          })}
        </select>
        {willBeNegative && Number(qty) > 0 && <StockWarning />}
      </div>
      <QtyInput value={qty} onChange={setQty} label="Cant. (pzas)" />
      <PriceInput value={price} onChange={setPrice} baseCost={baseCost} />
      <AddButton onClick={handleAdd} disabled={!qty || !price} />
    </div>
  );
}

// ─── Roofing tab ──────────────────────────────────────────────────────────────

function RoofingTab({
  catalog,
  stock,
  cartItems,
  settings,
  onAdd,
}: {
  catalog: RoofingProduct[];
  stock: RoofingStock[];
  cartItems: CartItem[];
  settings: SystemSettings | null;
  onAdd: (item: CartItem) => void;
}) {
  const [selectedSku, setSelectedSku] = useState(catalog[0]?.sku ?? "");
  const [qty, setQty] = useState<number | "">("");
  const [price, setPrice] = useState<number | "">("");

  useEffect(() => {
    if (catalog.length > 0 && !selectedSku) setSelectedSku(catalog[0].sku);
  }, [catalog, selectedSku]);

  const stockItem = stock.find((s) => s.sku === selectedSku);
  const product = catalog.find((p) => p.sku === selectedSku);
  const baseCost = stockItem?.avgCost ?? product?.avgCost ?? 0;
  const currentStock = stockItem?.quantity ?? 0;
  const alreadyInCart = cartItems.filter((i) => i.sku === selectedSku && i.businessLine === "roofing").reduce((s, i) => s + i.quantity, 0);
  const willBeNegative = currentStock - alreadyInCart - Number(qty || 0) < 0;

  useEffect(() => {
    if (!selectedSku) return;
    const p = catalog.find((c) => c.sku === selectedSku);
    const s = stock.find((st) => st.sku === selectedSku);
    const cost = s?.avgCost ?? p?.avgCost ?? 0;
    setPrice(cost > 0 ? suggestedPrice(cost, settings?.minMarginPercent ?? 20) : "");
    setQty("");
  }, [selectedSku, catalog, stock, settings]);

  function handleAdd() {
    if (!selectedSku || !qty || !price) return;
    const numQty = Number(qty);
    const numPrice = Number(price);
    const unitValue = numPrice / (1 + IGV_RATE);

    if (unitValue < baseCost) {
      if (!confirm(`⚠️ ALERTA: Precio sin IGV (S/ ${unitValue.toFixed(2)}) < costo (S/ ${baseCost.toFixed(2)}). ¿Continuar?`)) return;
    }

    onAdd({
      sku: selectedSku,
      businessLine: "roofing",
      productName: product?.displayName ?? selectedSku,
      quantity: numQty,
      unitPrice: numPrice,
      unitValue,
      baseCost,
      unitWeight: product?.weight ?? 0,
      isCoil: false,
    });

    setQty("");
  }

  if (catalog.length === 0) {
    return <p className="text-sm text-gray-400 font-medium py-4 text-center">Sin productos PVC activos en catálogo.</p>;
  }

  return (
    <div className="flex flex-col md:flex-row items-end gap-4">
      <div className="flex-1 w-full">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Cobertura PVC</label>
        <select
          value={selectedSku}
          onChange={(e) => setSelectedSku(e.target.value)}
          className="w-full p-4 bg-gray-50 border border-emerald-200 rounded-xl font-bold text-gray-800 outline-none h-[56px]"
        >
          {catalog.map((p) => {
            const s = stock.find((st) => st.sku === p.sku);
            const qty = s?.quantity ?? 0;
            return (
              <option key={p.sku} value={p.sku}>
                {p.sku} — {p.displayName} | Disp: {qty} pzs
              </option>
            );
          })}
        </select>
        {willBeNegative && Number(qty) > 0 && <StockWarning />}
      </div>
      <QtyInput value={qty} onChange={setQty} label="Cant. (pzas)" />
      <PriceInput value={price} onChange={setPrice} baseCost={baseCost} />
      <AddButton onClick={handleAdd} disabled={!qty || !price} color="emerald" />
    </div>
  );
}

// ─── Coils tab ────────────────────────────────────────────────────────────────

function CoilsTab({
  coils,
  cartItems,
  settings,
  onAdd,
}: {
  coils: Record<string, unknown>[];
  cartItems: CartItem[];
  settings: SystemSettings | null;
  onAdd: (item: CartItem) => void;
}) {
  const [selectedId, setSelectedId] = useState(String(coils[0]?.id ?? ""));
  const [price, setPrice] = useState<number | "">("");

  useEffect(() => {
    if (coils.length > 0) setSelectedId(String(coils[0].id ?? ""));
  }, [coils]);

  const coil = coils.find((c) => String(c.id) === selectedId);
  const baseCost = Number(coil?.pricePerKg ?? 0);
  const coilWeight = Number(coil?.currentWeight ?? coil?.initialWeight ?? 0);

  useEffect(() => {
    if (!coil) return;
    const cost = Number(coil.pricePerKg ?? 0);
    setPrice(cost > 0 ? suggestedPrice(cost, settings?.minMarginPercent ?? 20) : "");
  }, [selectedId, coil, settings]);

  const alreadyInCart = cartItems.some((i) => i.sku === selectedId && i.isCoil);

  function handleAdd() {
    if (!selectedId || !price || !coil) return;
    const numPrice = Number(price);
    const unitValue = numPrice / (1 + IGV_RATE);

    if (alreadyInCart) {
      alert("Esta bobina ya está en el carrito.");
      return;
    }

    if (unitValue < baseCost) {
      if (!confirm(`⚠️ ALERTA: Precio sin IGV (S/ ${unitValue.toFixed(2)}) < costo (S/ ${baseCost.toFixed(2)}). ¿Continuar?`)) return;
    }

    onAdd({
      sku: selectedId,
      businessLine: "drywall",
      productName: `Bobina ${selectedId}`,
      quantity: coilWeight,
      unitPrice: numPrice,
      unitValue,
      baseCost,
      unitWeight: 1,
      isCoil: true,
    });
  }

  if (coils.length === 0) {
    return (
      <p className="text-sm text-gray-400 font-medium py-4 text-center">
        No hay bobinas disponibles en planta.
      </p>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-end gap-4">
      <div className="flex-1 w-full">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Bobina disponible</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full p-4 bg-orange-50 border border-orange-200 rounded-xl font-bold text-gray-800 outline-none h-[56px]"
        >
          {coils.map((c) => (
            <option key={String(c.id)} value={String(c.id)}>
              {String(c.id)} | {Number(c.currentWeight).toFixed(1)} kg | S/ {Number(c.pricePerKg).toFixed(2)}/kg
            </option>
          ))}
        </select>
        {coilWeight > 0 && (
          <p className="text-[11px] text-gray-500 font-medium mt-1">
            Peso total: <span className="font-black">{coilWeight.toFixed(1)} kg</span> · Precio es por kg
          </p>
        )}
      </div>
      <PriceInput value={price} onChange={setPrice} baseCost={baseCost} label="Precio x kg (c/ IGV)" />
      <AddButton onClick={handleAdd} disabled={!price || alreadyInCart} color="orange" />
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StockWarning() {
  return (
    <div className="flex items-center gap-1.5 mt-1.5 text-amber-600 text-[11px] font-bold">
      <AlertTriangle size={12} />
      <span>Stock insuficiente — generará negativo (permitido por política)</span>
    </div>
  );
}

function QtyInput({ value, onChange, label = "Cantidad" }: { value: number | ""; onChange: (v: number | "") => void; label?: string }) {
  return (
    <div className="w-full md:w-32">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">{label}</label>
      <input
        type="number"
        min="1"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500 text-center h-[56px]"
      />
    </div>
  );
}

function PriceInput({
  value,
  onChange,
  baseCost,
  label = "Precio Venta (c/ IGV)",
}: {
  value: number | "";
  onChange: (v: number | "") => void;
  baseCost: number;
  label?: string;
}) {
  const numVal = Number(value);
  const isLoss = numVal > 0 && numVal / (1 + IGV_RATE) < baseCost;

  return (
    <div className="w-full md:w-48 relative group">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">{label}</label>
      {baseCost > 0 && (
        <div className="absolute -top-12 left-0 bg-gray-900 text-white text-[10px] font-bold p-2 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-10">
          Costo base: S/ {baseCost.toFixed(2)}
        </div>
      )}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">S/</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
          className={`w-full p-4 pl-10 border-2 rounded-xl font-black outline-none h-[56px] transition ${
            isLoss ? "border-red-400 text-red-600 bg-red-50" : "border-gray-200 text-green-700 bg-gray-50 focus:border-blue-500"
          }`}
        />
      </div>
      {value && (
        <p className="absolute -bottom-5 left-1 text-[10px] text-gray-500 font-bold whitespace-nowrap">
          S/IGV: S/ {(Number(value) / (1 + IGV_RATE)).toFixed(2)}
        </p>
      )}
    </div>
  );
}

function AddButton({
  onClick,
  disabled,
  color = "blue",
}: {
  onClick: () => void;
  disabled: boolean;
  color?: "blue" | "emerald" | "orange";
}) {
  const bg = color === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : color === "orange" ? "bg-orange-600 hover:bg-orange-700" : "bg-gray-900 hover:bg-black";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full md:w-auto text-white px-8 rounded-xl font-black transition active:scale-95 h-[56px] flex items-center justify-center gap-2 disabled:opacity-50 ${bg}`}
    >
      <Plus size={18} /> Añadir
    </button>
  );
}
