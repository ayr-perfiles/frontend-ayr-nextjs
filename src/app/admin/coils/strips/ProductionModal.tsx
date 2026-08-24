"use client";

import React from "react";
import { StripStock } from "@/types";
import { OutsourcedProductionForm } from "@/modules/drywall/components/forms/OutsourcedProductionForm";
import { X } from "lucide-react";

interface ProductionModalProps {
  strip: StripStock;
  onClose: (refresh?: boolean) => void;
}

export function ProductionModal({ strip, onClose }: ProductionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <OutsourcedProductionForm 
          strip={strip} 
          onClose={() => onClose(true)} 
        />
      </div>
    </div>
  );
}
