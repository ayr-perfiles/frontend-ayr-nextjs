"use client";

import React from 'react';
import { FilterSpec } from '../types';
import { X } from 'lucide-react';

interface ReportFiltersProps {
  specs: FilterSpec[];
  values: any;
  onChange: (id: string, value: any) => void;
  onClear: () => void;
}

export function ReportFilters({ specs, values, onChange, onClear }: ReportFiltersProps) {
  if (specs.length === 0) return null;

  return (
    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-wrap items-end gap-5">
      {specs.map((spec) => (
        <div key={spec.id} className="space-y-1.5 flex-1 min-w-[180px]">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
            {spec.label}
          </label>
          
          {spec.type === 'PERIOD' && (
            <select
              value={values[spec.id]}
              onChange={(e) => onChange(spec.id, e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
            >
              <option value="HISTORICO">Histórico (Todo)</option>
              <option value="HOY">Hoy</option>
              <option value="SEMANA">Esta Semana</option>
              <option value="MES">Este Mes</option>
              <option value="MES_ANTERIOR">Mes Anterior</option>
              <option value="CUSTOM">Rango Personalizado</option>
            </select>
          )}

          {spec.type === 'LINE' && (
            <select
              value={values[spec.id]}
              onChange={(e) => onChange(spec.id, e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
            >
              <option value="all">Todas las líneas</option>
              <option value="drywall">Drywall</option>
              <option value="roofing">Roofing (UPVC)</option>
              <option value="metallic-roofing">Metallic Roofing</option>
              <option value="trading">Trading</option>
              <option value="services">Services</option>
            </select>
          )}

          {spec.type === 'BOOLEAN' && (
            <div className="flex items-center h-[42px] px-2">
              <input
                type="checkbox"
                checked={!!values[spec.id]}
                onChange={(e) => onChange(spec.id, e.target.checked)}
                className="w-5 h-5 rounded-lg border-slate-200 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-xs font-bold text-slate-600">SÍ</span>
            </div>
          )}

          {spec.type === 'TEXT' && (
            <input
              type="text"
              value={values[spec.id] || ''}
              onChange={(e) => onChange(spec.id, e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
              placeholder="..."
            />
          )}

          {/* Add more filter types as needed: LINE, STATUS, etc. */}
        </div>
      ))}

      {values.period === 'CUSTOM' && (
        <>
          <div className="space-y-1.5 flex-1 min-w-[150px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Inicio</label>
            <input
              type="date"
              value={values.startDate || ''}
              onChange={(e) => onChange('startDate', e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[150px]">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fin</label>
            <input
              type="date"
              value={values.endDate || ''}
              onChange={(e) => onChange('endDate', e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold outline-none focus:border-blue-500 shadow-sm"
            />
          </div>
        </>
      )}

      <button
        onClick={onClear}
        className="h-[42px] px-4 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center gap-2 font-bold text-xs"
      >
        <X size={16} /> LIMPIAR
      </button>
    </div>
  );
}
