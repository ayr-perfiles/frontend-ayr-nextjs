"use client";

import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import { Coil } from "@/types";
import { AddCoilForm } from "@/core/coils/components/AddCoilForm";
import {
  EditCoilModal,
  EditData,
} from "@/core/coils/components/EditCoilModal";
import { CoilDetailsModal } from "@/core/coils/components/CoilDetailsModal";
import { PurchaseCoilFromXml } from "@/core/coils/components/PurchaseCoilFromXml";
import { SplitCoilModal } from "@/core/coils/components/SplitCoilModal";
import { RegisterScrapModal } from "@/core/coils/components/RegisterScrapModal";

interface InventoryModalsProps {
  editingCoil: Coil | null;
  editData: EditData;
  setEditData: Dispatch<SetStateAction<EditData>>;
  onCloseEdit: () => void;
  onSaveEdit: () => void;

  isAddModalOpen: boolean;
  onAddModalChange: (isOpen: boolean) => void;

  viewingCoil: Coil | null;
  onCloseDetails: () => void;

  showXmlModal: boolean;
  onCloseXml: () => void;

  splittingCoil: Coil | null;
  onCloseSplit: () => void;
  onSplitSuccess: () => void;

  scrappingCoil: Coil | null;
  onCloseScrap: () => void;
  onScrapSuccess: () => void;
}

export function InventoryModals({
  editingCoil,
  editData,
  setEditData,
  onCloseEdit,
  onSaveEdit,
  isAddModalOpen,
  onAddModalChange,
  viewingCoil,
  onCloseDetails,
  showXmlModal,
  onCloseXml,
  splittingCoil,
  onCloseSplit,
  onSplitSuccess,
  scrappingCoil,
  onCloseScrap,
  onScrapSuccess,
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

      {splittingCoil && (
        <SplitCoilModal
          coil={splittingCoil}
          onClose={onCloseSplit}
          onSuccess={() => {
            onCloseSplit();
            onSplitSuccess();
          }}
        />
      )}

      {scrappingCoil && (
        <RegisterScrapModal
          coil={scrappingCoil}
          onClose={onCloseScrap}
          onSuccess={() => {
            onCloseScrap();
            onScrapSuccess();
          }}
        />
      )}
    </>
  );
}
