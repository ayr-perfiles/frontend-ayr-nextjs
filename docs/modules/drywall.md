# MÓDULO: drywall — verdad de arquitectura
> ÚLTIMA VERIFICACIÓN CÓDIGO+PROD: 2026-07-20 (doc real de production_logs e inventory_stock en ayrsteel-2026).
> ⚠️ SE PUDRE. Antes de tocar lógica/costeo/writes de drywall: verificá (checklist §5). No confíes si la fecha está vieja.

## 1. Flujo VIVO hoy (NO lo aspiracional)
- Producción: saveCuttingPlan + processSingleStrip → consumeCoil. CLIENT-side (src/core/coils/services/coilConsumptionService.ts), montado en ProduceTab.tsx / ProductionForm.tsx. Escribe production_log con parentCoilId (COIL-DIRECTO), resta peso a coil.currentWeight.
- Reversa: revertProductionLog (callable, functions/src/callables/drywallProduction.ts). IMPLEMENTADA para coil-directo (WRITE 7b). Nota: el peso restaurado a la bobina es aproximado (approximateWeight) re-derivado del ancho hasta que se implemente el forward-fix.
- parentCoilId poblado en 100% de logs recientes de prod (F001-13039-8 en últimos 5).
- ASPIRACIONAL: produceFromStrip (callable, pool strips_stock) solo cableado a OutsourcedProductionForm.tsx. strips_stock casi vacío en prod. La reversa de pool (WRITE 7a, calcRevertProductionFromStrip) es correcta y validada en runtime pero sirve a este flujo casi-no-usado.

## 2. Campos congelados en production_log coil-directo (doc real de prod)
- stripCost = costo total S/ congelado. LEER ESTE para reversar costo. Trampa: objeto base graba stripCost:0, lo PISA ...additionalLogData con activeStrip.costPerStrip. El real llega a prod (ej. 2725.7).
- costPerPiece, averageCostAfter: costeo forward OK. WAC del PT NO corrupto.
- reportedWeight = peso del PT (pieces*standardWeight), NO de la bobina. El peso de bobina consumido NO se congela → se pierde del log.
- totalUsedWidth: ancho congelado (para re-derivar peso).

## 3. Trampas (cada una costó sangre en WRITE 7)
1. Peso no congelado → re-derivar totalUsedWidth*(initialWeight/masterWidth). MIENTE post-split (split.ts baja masterWidth, NO initialWeight → ratio inflado). updateCoil también muta masterWidth. Fix real: congelar coilWeightConsumedKg en forward (mirror metallic perCoilBreakdown).
2. masterWidth es opcional (masterWidth?:number) → initialWeight/undefined=NaN. NaN guard obligatorio.
3. Stock negativo REAL en prod: inventory_stock drywall con totalQuantity<0 (-18596 en P64GALV045; 8 SKUs). R39GALV045 tiene lastCostPerPiece:undefined. Al reversar con qty≤0: NO recalcular WAC, congelar lastCostPerPiece + negativeStockWarning. Política L349 "stock negativo permitido, warning no bloqueo".
4. +1 fleje: processSingleStrip consume 1 fleje (pendingCount-=1). NO hardcodear +1 en reversa, usar +stripsUsed.
5. inventory_stock drywall guarda solo totalQuantity+lastCostPerPiece (sin totalValue, a diferencia de metallic). Resta-de-lote infiere valor = totalQuantity*lastCostPerPiece.

## 4. Reversa correcta (molde = metallic voidProductionFromCoils)
- Costo PT: newLastCostPerPiece=(Q*cost - stripCost)/newQty si newQty>0; si ≤0 congelar WAC + warning.
- Peso bobina: log nuevo → coilWeightConsumedKg congelado; histórico → re-derivación + NaN guard + flag approximateWeight en audit.
- Estado: determineCoilStatusAfterReversal + Math.min(initialWeight, currentWeight+restored).
- Idempotencia: early-return éxito si ya VOIDED (patrón voidCoilScrap/reverseCoilSplit).
- Kardex FG: forward es cost-blind → reversa OUT cost-blind (mirror). No agregar costo a un solo lado.

## 5. VERIFICAR antes de cambio grande (NO confiar en este doc)
1. grep del escritor VIVO (consumeCoil vivo vs produceFromStrip aspiracional).
2. leer 1 doc REAL de prod del log/stock a tocar.
3. ¿flujo con consumidor vivo en UI o huérfano?
4. costo congelado: ¿de qué campo REAL sale? (ojo overrides por spread). Reversar a congelado, nunca lookback.

## Mentiras corregidas esta sesión
- "consumeCoil dead code" → VIVO, escritor principal.
- "modelo actual = coil→flejes→produceFromStrip" → aspiracional; el software real es coil-directo.
- "stripCost:0" → base 0, pisado por ...additionalLogData; el real llega a prod.
