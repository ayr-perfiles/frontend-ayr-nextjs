import { db } from "@/lib/firebase/clientApp";
import {
  doc,
  runTransaction,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import { Coil, BusinessLine, ProductionLog } from "@/types";
import { listFinishes } from "./finishService";
import { getStockStrategy } from "@/core/sales/strategies";

import { assertCoilFinishCompatible } from "../domain/finishCompat";

export interface ConsumptionParams {
  coilId: string;
  line: BusinessLine;
  sku: string; // SKU producido
  pieces: number;
  weightConsumed: number;
  operatorId: string;
  additionalLogData?: any;
  additionalCoilUpdates?: any;
  additionalStockParams?: any;
}

export const consumeCoil = async (params: ConsumptionParams) => {
  const { 
    coilId, 
    line, 
    sku, 
    pieces, 
    weightConsumed, 
    operatorId, 
    additionalLogData,
    additionalCoilUpdates,
    additionalStockParams
  } = params;

  const coilRef = doc(db, "coils", coilId);
  const logRef = doc(collection(db, "production_logs"));
  const strategy = getStockStrategy(line);
  const stockRef = strategy.getStockRef(sku);

  try {
    const finishes = await listFinishes(true);

    await runTransaction(db, async (transaction) => {
      // 1. LECTURAS PRIMERO
      const coilDoc = await transaction.get(coilRef);
      const stockDoc = await transaction.get(stockRef);
      
      if (!coilDoc.exists()) throw new Error("La bobina no existe.");
      const coil = coilDoc.data() as Coil;

      // 2. VALIDACIONES
      if (coil.status !== "AVAILABLE" && coil.status !== "IN_PROGRESS") {
        throw new Error(`La bobina no está en un estado válido para consumo (${coil.status}).`);
      }

      if (!coil.finish) {
        throw new Error("La bobina no tiene un acabado asignado. Edítala primero.");
      }

      const compatResult = assertCoilFinishCompatible(coil.finish, line, finishes);
      if (!compatResult.success) {
        throw new Error(compatResult.error.message);
      }

      const newCurrentWeight = (coil.currentWeight || coil.initialWeight) - weightConsumed;


      // 3. CÁLCULOS DE STOCK Y COSTO
      const currentQty = strategy.extractQuantity(stockDoc);
      const newBalance = currentQty + pieces;
      const newAverageCost = additionalStockParams?.newAverageCost || 0;

      // 4. ESCRITURAS
      
      // Actualizar peso de bobina
      transaction.update(coilRef, {
        currentWeight: Number(newCurrentWeight.toFixed(2)),
        status: newCurrentWeight <= 0 ? "PROCESSED" : "IN_PROGRESS",
        updatedAt: serverTimestamp(),
        ...additionalCoilUpdates,
      });

      // Registrar log de producción
      const logData: ProductionLog & { line: BusinessLine } = {
        parentCoilId: coilId,
        sku,
        piecesProduced: pieces,
        totalUsedWidth: 0, 
        scrapWidth: 0,
        stripCost: 0,
        costPerPiece: 0,
        reportedWeight: weightConsumed,
        operatorId,
        timestamp: serverTimestamp(),
        status: "ACTIVE",
        line,
        ...additionalLogData,
      };
      transaction.set(logRef, logData);

      // Incrementar stock vía Strategy
      strategy.writeProductionIncrement({
        sku,
        quantity: pieces,
        newBalance,
        newAverageCost,
        newWeight: weightConsumed,
        reference: coilId,
        operatorId,
        ...additionalStockParams
      }, stockDoc, transaction);
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error en consumeCoil:", error);
    throw new Error(error.message || "Error al consumir bobina");
  }
};

