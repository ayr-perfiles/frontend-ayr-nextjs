import { z } from 'zod';

/**
 * Contrato que debe implementar cada línea de negocio.
 *
 * Propósito: Estandarizar la estructura de módulos para facilitar:
 * - Selector de línea de negocio
 * - Inyección de rutas dinámicas
 * - Catálogos personalizados por línea
 * - Permisos específicos por línea
 */
export interface BusinessLineModule {
  /** ID único de la línea (ej: 'drywall', 'tubing', 'roofing') */
  id: string;

  /** Nombre para mostrar en UI (ej: 'Drywall (Perfilería)') */
  displayName: string;

  /** Ícono lucide-react (ej: 'Factory', 'Package', 'Zap') */
  icon: string;

  /** Motor de producción específico de esta línea */
  productionEngine: ProductionEngine;

  /** Motor de inventario (cómo se ve el stock) */
  inventoryEngine: InventoryEngine;

  /** Schema de Zod para validar productos de esta línea */
  catalogSchema: z.ZodSchema;

  /** Rutas de Next.js que esta línea registra */
  routes: RouteConfig[];

  /** Ítems a inyectar en el sidebar */
  sidebarItems: MenuItem[];

  /** Permisos por rol para esta línea */
  permissions: RolePermissionMap;
}

/**
 * Motor de producción: lógica específica de cómo esta línea produce.
 * Cada línea implementa este contrato con su propia maquinaria
 * (ej: drywall usa plan de corte de slitter, tubing usa schedule de conformado).
 */
export interface ProductionEngine {
  /**
   * Planificar operación de producción.
   * Ej: drywall = cutting plan, tubing = bending schedule
   */
  planOperation(input: PlanInput): Promise<Result<Plan, DomainError>>;

  /**
   * Ejecutar operación de producción confirmada.
   */
  executeOperation(
    planId: string,
    executionData: ExecutionData
  ): Promise<Result<Output, DomainError>>;

  /**
   * Cancelar/anular operación en curso o planificada.
   */
  cancelOperation(
    operationId: string,
    reason: string
  ): Promise<Result<void, DomainError>>;

  /**
   * Obtener estado actual de una operación.
   */
  getStatus(operationId: string): Promise<OperationStatus>;
}

/**
 * Motor de inventario: cómo se visualiza y gestiona el stock para esta línea.
 * Permite que cada módulo tenga su propia vista del kardex
 * sin acoplar la UI a una implementación concreta.
 */
export interface InventoryEngine {
  /**
   * Obtener vista de inventario filtrada para esta línea.
   */
  getInventoryView(filters: InventoryFilters): Promise<InventoryView>;

  /**
   * Calcular métricas de stock (yield, scrap, rotación, etc.)
   */
  calculateMetrics(sku: string): Promise<StockMetrics>;
}

/**
 * Configuración de ruta de Next.js registrada por el módulo.
 */
export interface RouteConfig {
  /** Ruta absoluta (ej: '/admin/drywall/inventory') */
  path: string;
  /** Path relativo al módulo donde vive el componente */
  component: string;
  /** Si true, requiere sesión activa */
  protected: boolean;
  /** Roles permitidos cuando protected=true */
  roles?: string[];
}

/**
 * Ítem del sidebar inyectado por el módulo.
 */
export interface MenuItem {
  label: string;
  href: string;
  /** Nombre del ícono en lucide-react */
  icon: string;
  /** Roles que pueden ver este ítem; undefined = todos los autenticados */
  roles?: string[];
}

/**
 * Permisos por rol para operaciones CRUD dentro de la línea.
 * Complementa ROUTE_PERMISSIONS y firestore.rules — ambos deben estar alineados.
 */
export type RolePermissionMap = {
  [role: string]: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    /** Permite anular documentos ya confirmados (ventas, órdenes) */
    canVoid: boolean;
  };
};

// ════════════════════════════════════════════════════════════
// TIPOS AUXILIARES
// ════════════════════════════════════════════════════════════

/**
 * Entrada para planificar una operación de producción.
 * Cada línea extiende este tipo con sus campos específicos.
 * Pendiente: migrar [key: string]: unknown cuando cada módulo defina su PlanInput concreto.
 */
export interface PlanInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Plan {
  id: string;
  status: 'DRAFT' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ExecutionData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface Output {
  producedItems: ProducedItem[];
  scrap?: ScrapData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ProducedItem {
  sku: string;
  quantity: number;
  /** Costo unitario en soles (PEN) */
  cost: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ScrapData {
  /** Peso en kg del scrap generado */
  weight?: number;
  description: string;
}

export interface OperationStatus {
  id: string;
  status: string;
  /** Porcentaje de avance 0–100 */
  progress: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface InventoryFilters {
  status?: string;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
}

export interface InventoryView {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  totalCount: number;
  metrics?: StockMetrics;
}

export interface StockMetrics {
  totalQuantity: number;
  /** Valor total en soles (PEN) */
  totalValue: number;
  /** Rendimiento de ancho útil expresado como porcentaje (0–100) */
  yield?: number;
  /** Tasa de scrap expresada como porcentaje (0–100) */
  scrapRate?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface DomainError {
  /** Código de error legible por máquina (ej: 'INSUFFICIENT_STOCK') */
  code: string;
  /** Mensaje en español para mostrar al usuario */
  message: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
}

/**
 * Tipo resultado inspirado en el patrón Railway Oriented Programming.
 * Evita lanzar excepciones para errores de dominio esperados.
 *
 * @example
 * const result = await engine.planOperation(input);
 * if (!result.success) toast.error(result.error.message);
 */
export type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E };
