import type { RolePermissionMap } from '@/core/contracts';

/**
 * Permisos por rol para el módulo roofing.
 * Debe mantenerse alineado con ROUTE_PERMISSIONS en src/app/admin/layout.tsx
 * y con firestore.rules para las colecciones: roofing_catalog, roofing_stock, roofing_stock_movements.
 */
export const roofingPermissions: RolePermissionMap = {
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
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canVoid: false,
  },
};
