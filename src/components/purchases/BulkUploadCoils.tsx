"use client";
import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Loader2, Database } from "lucide-react";
import { db } from "@/lib/firebase/clientApp";
import {
  collection,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

export function BulkUploadCoils() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [parsedCoils, setParsedCoils] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });

      let allCoils: any[] = [];

      // Iteramos por todas las pestañas (Enero, Febrero, Marzo, etc.)
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        jsonData.forEach((row: any, index: number) => {
          const itemDescription = String(row["ITEM"] || "").toUpperCase();
          const serie = row["Serie del CDP"];
          const nroDoc = row["Nro CP o Doc."];

          // Si no hay factura o no dice BOBINA, lo saltamos
          if (!serie || !nroDoc || !itemDescription.includes("BOB")) return;

          // 1. Limpieza de Cantidad (Kilos)
          const rawCantidad = String(row["CANTIDAD"]).replace(/,/g, ".");
          let parsedCantidad = parseFloat(rawCantidad) || 0;

          // Lógica inteligente: Si dice < 100 asume que son Toneladas y convierte a Kg.
          // Si es > 100 asume que ya vino escrito en Kilos (Ej: 3824)
          let weightInKg =
            parsedCantidad < 100 ? parsedCantidad * 1000 : parsedCantidad;

          // 2. Extracción Regex de Espesor y Ancho de la descripción
          let thickness = 0.45;
          let width = 1200;

          const thicknessMatch = itemDescription.match(/0\.\d{2}/);
          if (thicknessMatch) thickness = parseFloat(thicknessMatch[0]);

          const widthMatch = itemDescription.match(/1[0-2]\d{2}/); // Busca números como 1000, 1200, 1220
          if (widthMatch) width = parseFloat(widthMatch[0]);

          // 3. Calculo del costo por Kg
          // La columna VALOR TOTAL EN SOLES o VALOR EN SOLES
          const rawTotalSoles = String(
            row["VALOR TOTAL EN SOLES"] || row["VALOR EN SOLES"],
          )
            .replace(/[^\d.,]/g, "")
            .replace(/,/g, ".");
          let totalCost = parseFloat(rawTotalSoles) || 0;
          let costPerKg = weightInKg > 0 ? totalCost / weightInKg : 0;

          // 4. Autogenerar un ID único para la bobina histórica
          const generatedId = `${serie}-${nroDoc}-${index + 1}`;

          allCoils.push({
            id: generatedId,
            initialWeight: Math.round(weightInKg),
            currentWeight: Math.round(weightInKg),
            masterWidth: width,
            thickness: thickness,
            pricePerKg: Number(costPerKg.toFixed(3)),
            status: "AVAILABLE",
            provider: row["PROVEEDOR"] || "SISTEMA",
            invoiceNumber: `${serie}-${nroDoc}`,
            invoiceDate: row["FECHA"],
            originalDescription: itemDescription,
          });
        });
      });

      setParsedCoils(allCoils);
      toast.success(
        `Archivo procesado: ${allCoils.length} bobinas extraídas de ${workbook.SheetNames.length} pestañas.`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Error al analizar el Excel. Verifica el formato.");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUploadToFirebase = async () => {
    if (parsedCoils.length === 0) return;
    setLoading(true);

    try {
      const batches = [];
      let currentBatch = writeBatch(db);
      let opCount = 0;

      for (const coil of parsedCoils) {
        if (opCount === 490) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          opCount = 0;
        }

        // Documento en la colección 'coils'
        const docRef = doc(db, "coils", coil.id);

        const coilData = {
          id: coil.id,
          initialWeight: coil.initialWeight,
          currentWeight: coil.currentWeight,
          masterWidth: coil.masterWidth,
          thickness: coil.thickness,
          pricePerKg: coil.pricePerKg,
          status: coil.status,
          registeredBy: user?.email || "Admin (Carga Masiva)",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          metadata: {
            provider: coil.provider,
            invoiceNumber: coil.invoiceNumber,
            originalDescription: coil.originalDescription,
            isHistoricalMigration: true,
          },
        };

        currentBatch.set(docRef, coilData);
        opCount++;
      }

      if (opCount > 0) batches.push(currentBatch);

      await Promise.all(batches.map((b) => b.commit()));

      toast.success(
        `¡${parsedCoils.length} bobinas históricas migradas al inventario con éxito!`,
      );
      setParsedCoils([]);
    } catch (error) {
      console.error("Error en migración:", error);
      toast.error("Hubo un error subiendo los datos a la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div>
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <Database className="text-purple-600" size={20} />
            Migración Histórica de Bobinas (Compras)
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            Sube tu Excel "Itemizado_Facturas". Extractor automático de Kilos,
            Espesor y Ancho.
          </p>
        </div>

        <label className="cursor-pointer bg-purple-50 text-purple-700 hover:bg-purple-100 transition px-4 py-2 rounded-xl font-bold flex items-center gap-2">
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={18} />
          )}
          Seleccionar Excel
          <input
            type="file"
            accept=".xlsx, .csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={loading}
          />
        </label>
      </div>

      {parsedCoils.length > 0 && (
        <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100 animate-in fade-in">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold text-gray-800 text-sm">
                Bobinas detectadas en todas las pestañas:
              </p>
              <p className="text-purple-600 font-black text-xl">
                {parsedCoils.length}{" "}
                <span className="text-sm font-medium">unidades físicas</span>
              </p>
            </div>
            <button
              onClick={handleUploadToFirebase}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Upload />}
              Poblar Inventario
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
