import { describe, it, expect } from 'vitest';

// Simulación de la lógica real de sidebar.tsx
function filterProductionLines(businessLines: any[]) {
  return businessLines.filter((l) => l.productionEngine || l.id === "metallic-roofing");
}

function isRoleAllowed(role: string, allowedRoles?: string[]) {
  if (!allowedRoles) return true;
  return allowedRoles.includes(role);
}

describe('Sidebar Logic (Fase 1)', () => {
  const mockLines = [
    { id: 'drywall', displayName: 'Drywall', productionEngine: {} },
    { id: 'roofing', displayName: 'Roofing', productionEngine: undefined },
    { id: 'metallic-roofing', displayName: 'Metallic', productionEngine: undefined }, // Especial: siempre sale aunque no tenga engine aún
    { id: 'services', displayName: 'Services', productionEngine: undefined }
  ];

  it('filtra grupo Producción: incluye drywall y metallic-roofing, excluye roofing y services', () => {
    const filtered = filterProductionLines(mockLines);
    const ids = filtered.map(l => l.id);
    
    expect(ids).toContain('drywall');
    expect(ids).toContain('metallic-roofing');
    expect(ids).not.toContain('roofing');
    expect(ids).not.toContain('services');
  });

  it('valida roles correctamente', () => {
    expect(isRoleAllowed('ADMIN', ['ADMIN', 'SUPERVISOR'])).toBe(true);
    expect(isRoleAllowed('OPERATOR', ['ADMIN', 'SUPERVISOR'])).toBe(false);
    expect(isRoleAllowed('ANY_ROLE', undefined)).toBe(true);
  });

  it('deriva estado activo del pathname correctamente (simulado)', () => {
    const pathname: string = '/admin/lines/drywall/production';
    const lineId = 'drywall';
    const isActive = pathname === `/admin/lines/${lineId}/production`;
    expect(isActive).toBe(true);
    
    const otherPath: string = '/admin/lines/roofing/catalog';
    expect(otherPath === `/admin/lines/${lineId}/production`).toBe(false);
  });
});
