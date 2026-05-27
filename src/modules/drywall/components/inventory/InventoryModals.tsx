"use client";

import { X } from "lucide-react";
import { Coil } from "@/types";
import { AddCoilForm } from "@/modules/drywall/components/forms/AddCoilForm";
import { ProductionForm } from "@/modules/drywall/components/forms/ProductionForm";
import { ConsumeStripForm } from "@/modules/drywall/components/forms/ConsumeStripForm";
import {
  EditCoilModal,
  EditData,
} from "@/modules/drywall/components/inventory/EditCoilModal";
import { CoilDetailsModal } from "@/modules/drywall/components/inventory/CoilDetailsModal";
import { PurchaseCoilFromXml } from "@/modules/drywall/components/purchases/PurchaseCoilFromXml";
import { BulkUploadCoils } from "@/modules/drywall/components/purchases/BulkUploadCoils";

interface InventoryModalsProps {
  editingCoil: Coil | null;
  editData: EditData;
  setEditData: (data: EditData) => void;
  onCloseEdit: () => void;
  onSaveEdit: () => void;

  isAddModalOpen: boolean;
  onAddModalChange: (isOpen: boolean) => void;

  selectedCoil: Coil | null;
  onCloseProduction: () => void;

  viewingCoil: Coil | null;
  onCloseDetails: () => void;

  showXmlModal: boolean;
  onCloseXml: () => void;

  showExcelModal: boolean;
  onCloseExcel: () => void;
}

export function InventoryModals({
  editingCoil,
  editData,
  setEditData,
  onCloseEdit,
  onSaveEdit,
  isAddModalOpen,
  onAddModalChange,
  selectedCoil,
  onCloseProduction,
  viewingCoil,
  onCloseDetails,
  showXmlModal,
  onCloseXml,
  showExcelModal,
  onCloseExcel,
}: InventoryModalsProps) {
  return (
    <>
      {editingCoil && (
        <EditCoilModal
          editingCoil={editingCoil}
          editData={editData}
          setEditData={setEditData}
          onClose={onCloseEdit}
          onSave={onSaveEdit}
        />
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in-95">
            <AddCoilForm onOpenChange={onAddModalChange} />
          </div>
        </div>
      )}

      {selectedCoil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            {selectedCoil.status === "AVAILABLE" ? (
              <ProductionForm coil={selectedCoil} onClose={onCloseProduction} />
            ) : (
              <ConsumeStripForm coil={selectedCoil} onClose={onCloseProduction} />
            )}
          </div>
        </div>
      )}

      {viewingCoil && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl animate-in fade-in zoom-in-95 flex justify-center">
            <CoilDetailsModal coil={viewingCoil} onClose={onCloseDetails} />
          </div>
        </div>
      )}

      {showXmlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl relative my-8 animate-in fade-in zoom-in-95">
            <button
              onClick={onCloseXml}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 z-10 bg-white rounded-full p-1 shadow-sm border border-gray-100 transition"
            >
              <X size={20} />
            </button>
            <PurchaseCoilFromXml />
          </div>
        </div>
      )}

      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl relative my-8 animate-in fade-in zoom-in-95">
            <button
              onClick={onCloseExcel}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 z-10 bg-white rounded-full p-1 shadow-sm border border-gray-100 transition"
            >
              <X size={20} />
            </button>
            <BulkUploadCoils />
          </div>
        </div>
      )}
    </>
  );
}
