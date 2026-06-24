import React from "react";

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  bg: string;
  valueColor?: string;
}

export function KpiCard({
  label,
  value,
  icon,
  bg,
  valueColor = "text-gray-900",
}: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`${bg} p-3 rounded-xl shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <p className={`text-2xl font-black tabular-nums mt-0.5 ${valueColor}`}>{value}</p>
      </div>
    </div>
  );
}
