import type { RolePermissionMap } from '@/core/contracts';

export const servicesPermissions: RolePermissionMap = {
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
