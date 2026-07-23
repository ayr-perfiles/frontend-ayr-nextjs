/**
 * Función pura que determina si una cotización necesita el paso de confirmación
 * manual "Mandar a producción" antes de poder producirse.
 *
 * La AUSENCIA del campo `productionStatus` (cotizaciones legacy, ej. las COT-*
 * importadas antes de este campo existir) se trata igual que 'PENDING' —
 * ver docs/modules/ventas.md.
 */
export function canConfirmForProduction(sale: any): boolean {
  const hasMetallicItem = (sale?.items || []).some(
    (item: any) => item.businessLine === "metallic-roofing",
  );
  const isConfirmed = sale?.productionStatus === "CONFIRMED";
  return Boolean(hasMetallicItem) && !isConfirmed;
}
