// src/domain/steel/constants.ts

/**
 * Constantes físicas y de negocio para la industria siderúrgica
 * 
 * ⚠️ ADVERTENCIA: No modificar sin validación del área técnica/producción
 * Estas constantes afectan cálculos de costeo, rendimiento y validaciones físicas.
 */

// ═══════════════════════════════════════════════════════════
// PROPIEDADES FÍSICAS DEL ACERO
// ═══════════════════════════════════════════════════════════

/**
 * Densidad volumétrica del acero al carbono (g/cm³)
 * Fuente: Norma ASTM A36, SAE 1020
 */
export const STEEL_DENSITY_G_CM3 = 7.85;

/**
 * Factor de conversión para fórmula de densidad
 * Uso: kg / (mm × mm × (ρ/1000))
 */
export const STEEL_DENSITY_FACTOR = STEEL_DENSITY_G_CM3 / 1000;

// ═══════════════════════════════════════════════════════════
// TOLERANCIAS Y VALIDACIONES DE PRODUCCIÓN
// ═══════════════════════════════════════════════════════════

/**
 * Tolerancia de sobre-producción permitida (5%)
 * Aplicación: maxAllowedPieces = expectedPieces × TOLERANCE_FACTOR
 * 
 * Razón: variación natural por:
 * - Inexactitud del peso reportado en la factura del proveedor
 * - Diferencias mínimas de espesor dentro del coil
 * - Ajustes del operador en el proceso
 */
export const PRODUCTION_TOLERANCE_FACTOR = 1.05;

/**
 * Umbral de sobrante (mm) para distribución de costo
 * Si leftover ≤ 40mm → costo se reparte solo sobre lo planificado
 * Si leftover > 40mm → costo se reparte sobre ancho total (incluye scrap)
 * 
 * Razón: sobrantes muy pequeños no tienen valor comercial de rescate
 */
export const LEFTOVER_THRESHOLD_MM = 40;

/**
 * Factor de conversión scrap (mm → kg)
 * ⚠️ TEMPORAL: Actualmente es una constante, pero debería derivarse
 * de la fórmula real: scrapWeight = scrapWidthMm × thicknessMm × weightPerMm
 * 
 * TODO: Eliminar esta constante y calcular dinámicamente en productionService
 */
export const SCRAP_WEIGHT_FACTOR_KG_MM = 0.85;

// ═══════════════════════════════════════════════════════════
// PARÁMETROS DE PRODUCTO ESTÁNDAR
// ═══════════════════════════════════════════════════════════

/**
 * Largo de pieza por defecto (metros)
 * Drywall estándar: 3.00m (perfil de 10 pies)
 * Otras líneas pueden tener largos distintos (2.44m, 6.00m, etc.)
 */
export const DEFAULT_PIECE_LENGTH_M = 3.0;

/**
 * Ancho maestro estándar de bobina importada (mm)
 * Común en el mercado peruano: 1192mm (47 pulgadas)
 */
export const DEFAULT_MASTER_WIDTH_MM = 1192;

// ═══════════════════════════════════════════════════════════
// PARÁMETROS FISCALES (PERÚ)
// ═══════════════════════════════════════════════════════════

/**
 * Tasa de IGV en Perú (18%)
 * PrecioVenta = PrecioBase × (1 + IGV_RATE)
 */
export const IGV_RATE_PERU = 0.18;

/**
 * Margen mínimo recomendado sobre costo (%)
 * Usado como alerta en el módulo de ventas
 */
export const MIN_MARGIN_PERCENT = 15;

// ═══════════════════════════════════════════════════════════
// UMBRALES DE STOCK (INVENTARIO)
// ═══════════════════════════════════════════════════════════

/**
 * Cantidad mínima de piezas para alertar stock bajo
 * TODO: Debería ser configurable por SKU en el catálogo
 */
export const LOW_STOCK_THRESHOLD_PIECES = 100;

/**
 * Peso mínimo de bobina para alertar stock bajo (kg)
 */
export const LOW_STOCK_THRESHOLD_COIL_KG = 500;

// ═══════════════════════════════════════════════════════════
// LÍMITES TÉCNICOS DE LA MAQUINARIA
// ═══════════════════════════════════════════════════════════

/**
 * Ancho mínimo de fleje que el slitter puede cortar (mm)
 * Limitación mecánica de las cuchillas
 */
export const MIN_STRIP_WIDTH_MM = 50;

/**
 * Ancho máximo de fleje (mm)
 * Limitación del ancho de la bobina madre
 */
export const MAX_STRIP_WIDTH_MM = DEFAULT_MASTER_WIDTH_MM;

/**
 * Espesor mínimo de chapa que la conformadora puede trabajar (mm)
 */
export const MIN_THICKNESS_MM = 0.3;

/**
 * Espesor máximo de chapa que la conformadora puede trabajar (mm)
 */
export const MAX_THICKNESS_MM = 1.5;
