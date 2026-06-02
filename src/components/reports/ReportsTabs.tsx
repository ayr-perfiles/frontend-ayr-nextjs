"use client";

import {
  BarChart3,
  TrendingUp,
  Boxes,
  Users,
  Hourglass,
  FileSpreadsheet,
} from "lucide-react";

export type ReportTab =
  | "PRODUCTION"
  | "SALES"
  | "VALUATION"
  | "CUSTOMERS"
  | "STAGNANT"
  | "KARDEX";

interface ReportsTabsProps {
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
}

const TABS: {
  id: ReportTab;
  label: string;
  icon: React.ReactNode;
  activeColor: string;
}[] = [
  {
    id: "PRODUCTION",
    label: "Producción",
    icon: <BarChart3 size={18} />,
    activeColor: "text-blue-600",
  },
  {
    id: "SALES",
    label: "Top Ventas",
    icon: <TrendingUp size={18} />,
    activeColor: "text-emerald-600",
  },
  {
    id: "CUSTOMERS",
    label: "Clientes VIP",
    icon: <Users size={18} />,
    activeColor: "text-amber-600",
  },
  {
    id: "VALUATION",
    label: "Valorización",
    icon: <Boxes size={18} />,
    activeColor: "text-purple-600",
  },
  {
    id: "STAGNANT",
    label: "Estancados",
    icon: <Hourglass size={18} />,
    activeColor: "text-red-600",
  },
  {
    id: "KARDEX",
    label: "Kardex SUNAT",
    icon: <FileSpreadsheet size={18} />,
    activeColor: "text-indigo-600",
  },
];

export function ReportsTabs({ activeTab, onTabChange }: ReportsTabsProps) {
  return (
    <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 overflow-x-auto">
      <div className="flex w-full md:w-auto p-1 bg-slate-50 rounded-xl border border-slate-200 min-w-max">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm transition-all ${
              activeTab === tab.id
                ? `bg-white ${tab.activeColor} shadow-sm`
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
