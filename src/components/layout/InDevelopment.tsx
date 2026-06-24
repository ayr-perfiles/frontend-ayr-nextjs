"use client";

import { Wrench, ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface InDevelopmentProps {
  title: string;
  description?: string;
  module?: string;
}

export default function InDevelopment({ 
  title, 
  description = "Esta sección está siendo construida para mejorar tu experiencia operativa.", 
  module 
}: InDevelopmentProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center">
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 animate-pulse">
          <Wrench size={48} />
        </div>
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white p-2 rounded-xl shadow-lg animate-bounce">
          <Construction size={20} />
        </div>
      </div>

      <div className="max-w-md space-y-4">
        {module && (
          <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">
            Módulo: {module}
          </span>
        )}
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          {title}
        </h1>
        <p className="text-slate-500 font-medium leading-relaxed">
          {description}
        </p>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 font-black text-sm rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
        >
          <ArrowLeft size={18} /> REGRESAR
        </button>
        <Link
          href="/admin"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white font-black text-sm rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        >
          IR AL DASHBOARD
        </Link>
      </div>

      <div className="mt-20 pt-8 border-t border-slate-100 w-full max-w-lg opacity-30 italic">
        <p className="text-[11px] font-bold text-slate-400">
          AYR Steel ERP · Roadmap Sprint 7 · v1.1
        </p>
      </div>
    </div>
  );
}
