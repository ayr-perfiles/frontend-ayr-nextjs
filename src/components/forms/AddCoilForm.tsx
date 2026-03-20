"use client";

import { useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { X } from "lucide-react"; // <-- Importamos el ícono X
import toast from "react-hot-toast";

export function AddCoilForm({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const [coilId, setCoilId] = useState("");
  const [initialWeight, setInitialWeight] = useState<number>(5000);
  const [masterWidth, setMasterWidth] = useState<number>(1192); // Ancho en mm
  const [thickness, setThickness] = useState<number>(0.45); // Espesor en mm
  const [pricePerKg, setPricePerKg] = useState<number>(3.02); // Precio en Soles
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const newCoil = {
      id: coilId.toUpperCase(), // Forzamos mayúsculas por seguridad
      initialWeight,
      currentWeight: initialWeight,
      masterWidth,
      thickness,
      pricePerKg,
      status: "AVAILABLE",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const savePromise = setDoc(doc(db, "coils", newCoil.id), newCoil);

    toast
      .promise(savePromise, {
        loading: "Registrando bobina...",
        success: `Bobina ${newCoil.id} ingresada correctamente.`,
        error: "Error al registrar la bobina.",
      })
      .then(() => {
        onOpenChange(false); // Cierra el modal automáticamente al tener éxito
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* --- CABECERA CON BOTÓN DE CIERRE --- */}
      <div className="flex justify-between items-center p-6 border-b bg-gray-50/50">
        <h2 className="text-xl font-black text-gray-800">
          Registrar Ingreso de Bobina
        </h2>
        <button
          onClick={() => onOpenChange(false)}
          type="button"
          className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500"
        >
          <X size={20} />
        </button>
      </div>

      {/* --- FORMULARIO INTACTO --- */}
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase">
            Serie (ID)
          </label>
          <input
            required
            type="text"
            placeholder="Ej: PD03-08"
            className="mt-1 w-full border rounded-md p-2 font-bold uppercase"
            value={coilId}
            onChange={(e) => setCoilId(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase">
              Peso (kg)
            </label>
            <input
              required
              type="number"
              step="0.01"
              className="mt-1 w-full border rounded-md p-2"
              value={initialWeight}
              onChange={(e) => setInitialWeight(parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase">
              Ancho (mm)
            </label>
            <input
              required
              type="number"
              step="1"
              className="mt-1 w-full border rounded-md p-2"
              value={masterWidth}
              onChange={(e) => setMasterWidth(parseFloat(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase">
              Espesor (mm)
            </label>
            <input
              required
              type="number"
              step="0.01"
              className="mt-1 w-full border rounded-md p-2"
              value={thickness}
              onChange={(e) => setThickness(parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase">
              Precio x Kg (S/)
            </label>
            <input
              required
              type="number"
              step="0.01"
              className="mt-1 w-full border rounded-md p-2 border-green-300 focus:ring-green-500 font-bold"
              value={pricePerKg}
              onChange={(e) => setPricePerKg(parseFloat(e.target.value))}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !coilId}
          className="w-full bg-blue-600 text-white py-4 mt-2 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-gray-400 transition active:scale-95 shadow-lg shadow-blue-100"
        >
          {loading ? "GUARDANDO..." : "REGISTRAR BOBINA"}
        </button>
      </form>
    </div>
  );
}
