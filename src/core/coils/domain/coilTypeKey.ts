/**
 * Clave de tipo de bobina: agrupa por acabado + espesor. Formato:
 * `BOB-{FINISH}-{ESPESOR}` (ej. `BOB-GALV-045`).
 *
 * El ANCHO (masterWidth) queda deliberadamente FUERA de la clave — no es
 * un dato de "tipo", es un dato de LOTE: `registerCoilSplit` asigna a la
 * hija el ancho que pidió quien hizo el corte (`newChildWidthMm`, input
 * directo, no derivado ni heredado del padre — ver
 * `functions/src/callables/split.ts:113`), así que una sola madre
 * (mismo finish+thickness) puede tener N hijas con N anchos distintos.
 * Meter el ancho en la clave fragmentaría el agrupamiento por lote en vez
 * de por tipo de material. (Medido en [COIL-TYPE-KEY] PASO 0, 2026-08-28.)
 *
 * FINISH: se usa tal cual viene (sin traducir tipo/color — eso vive en
 * `coil_finishes`, no acá), solo se fuerza a mayúsculas y se le quita
 * cualquier caracter no alfanumérico (espacios, guiones). Regla elegida
 * a propósito: la clave es un identificador técnico, no un label — un
 * `finish` con separadores internos ("ALZ-AZUL") no debe partir la clave
 * en pedazos ambiguos.
 *
 * ESPESOR: `thickness` en mm × 100, redondeado al entero más cercano
 * (absorbe ruido de punto flotante tipo 0.45000000000001) y rellenado a
 * 3 dígitos con ceros a la izquierda. 0.45 -> "045", 1.2 -> "120".
 *
 * Lanza si `finish` o `thickness` no son utilizables — nunca devuelve una
 * clave parcial ni un placeholder: una clave mal formada contaminaría el
 * agrupamiento en silencio, que es exactamente el problema que este
 * helper existe para evitar.
 */
export function buildCoilTypeKey({
  finish,
  thickness,
}: {
  finish: string;
  thickness: number;
}): string {
  if (typeof finish !== 'string' || finish.trim() === '') {
    throw new Error('buildCoilTypeKey: "finish" es obligatorio y no puede estar vacío.');
  }
  if (typeof thickness !== 'number' || !Number.isFinite(thickness) || thickness <= 0) {
    throw new Error(
      'buildCoilTypeKey: "thickness" debe ser un número finito mayor a 0.',
    );
  }

  const finishKey = finish.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (finishKey === '') {
    throw new Error(
      `buildCoilTypeKey: "finish" (${JSON.stringify(finish)}) no tiene caracteres alfanuméricos válidos.`,
    );
  }

  const thicknessKey = String(Math.round(thickness * 100)).padStart(3, '0');

  return `BOB-${finishKey}-${thicknessKey}`;
}
