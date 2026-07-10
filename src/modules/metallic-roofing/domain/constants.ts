/**
 * Tolerancia (mm) al filtrar bobinas elegibles para producción por espesor.
 * El espesor real de bobina rara vez calza exacto con el nominal del SKU
 * (medición de planta); esta banda evita false-negatives sin abrir el filtro
 * a espesores realmente distintos. Single-source: no hardcodear en otro lado.
 */
export const THICKNESS_MATCH_TOLERANCE_MM = 0.02;
