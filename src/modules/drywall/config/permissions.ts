import type { RolePermissionMap } from '@/core/contracts';

/**
 * Permisos por rol para el módulo drywall.
 * Debe mantenerse alineado con ROUTE_PERMISSIONS en src/app/admin/layout.tsx
 * y con firestore.rules para las colecciones: coils, production_logs, inventory_stock.
 */
export const drywallPermissions: RolePermissionMap = {
  ADMIN: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canVoid: true,
  },
  SUPERVISOR: {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canVoid: true,
  },
  OPERATOR: {
    canView: true,
    canCreate: true,   // procesar flejes en terminal móvil
    canEdit: false,
    canDelete: false,
    canVoid: false,
  },
};
