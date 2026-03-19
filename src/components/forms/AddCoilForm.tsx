"use client";

import { useState } from "react";
import { db } from "@/lib/firebase/clientApp";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

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
    setLoading(true);

    const newCoil = {
      id: coilId,
      initialWeight,
      currentWeight: initialWeight,
      masterWidth,
      thickness,
      pricePerKg,
      status: "AVAILABLE",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "coils", coilId), newCoil);
      onOpenChange(false);
    } catch (error) {
      console.error("Error adding coil:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase">
          Serie (ID)
        </label>
        <input
          required
          type="text"
          placeholder="Ej: PD03-08"
          className="mt-1 w-full border rounded-md p-2"
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
            className="mt-1 w-full border rounded-md p-2 border-green-300 focus:ring-green-500"
            value={pricePerKg}
            onChange={(e) => setPricePerKg(parseFloat(e.target.value))}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-md font-bold hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? "Guardando..." : "Registrar Bobina"}
      </button>
    </form>
  );
}
