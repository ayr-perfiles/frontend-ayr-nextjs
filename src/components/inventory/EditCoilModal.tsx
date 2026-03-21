import { X, Save } from "lucide-react";
import { Coil } from "@/types";

interface EditData {
  initialWeight: number;
  currentWeight: number;
  masterWidth: number;
  thickness: number;
}

interface EditCoilModalProps {
  editingCoil: Coil;
  editData: EditData;
  setEditData: (data: EditData) => void;
  onClose: () => void;
  onSave: () => void;
}

export function EditCoilModal({
  editingCoil,
  editData,
  setEditData,
  onClose,
  onSave,
}: EditCoilModalProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black">Editar Bobina</h2>
            <p className="text-blue-200 text-xs font-bold uppercase tracking-widest">
              {editingCoil.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Ancho (mm)
              </label>
              <input
                type="number"
                value={editData.masterWidth}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    masterWidth: Number(e.target.value),
                  })
                }
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
                Espesor (mm)
              </label>
              <input
                type="number"
                step="0.01"
                value={editData.thickness}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    thickness: Number(e.target.value),
                  })
                }
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">
              Peso Inicial (kg)
            </label>
            <input
              type="number"
              value={editData.initialWeight}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  initialWeight: Number(e.target.value),
                  currentWeight: Number(e.target.value), // Igualamos el actual al inicial
                })
              }
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
            />
          </div>
          <p className="text-[10px] text-orange-500 bg-orange-50 p-3 rounded-lg font-bold border border-orange-100">
            ⚠️ El peso actual se igualará al peso inicial. Edita esto solo si la
            máquina no ha cortado la bobina aún.
          </p>

          <button
            onClick={onSave}
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 hover:bg-blue-700 transition active:scale-95"
          >
            <Save size={20} /> Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}
