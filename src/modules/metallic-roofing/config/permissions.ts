import type { RolePermissionMap } from '@/core/contracts';

/** Espejo de la política de roofing. Mantener alineado con middleware y firestore.rules. */
export const metallicRoofingPermissions: RolePermissionMap = {
  ADMIN:      { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  canVoid: true  },
  SUPERVISOR: { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canVoid: true  },
  OPERATOR:   { canView: true,  canCreate: false, canEdit: false, canDelete: false, canVoid: false },
};
