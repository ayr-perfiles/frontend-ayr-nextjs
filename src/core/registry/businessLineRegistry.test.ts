import { describe, it, expect } from 'vitest';
import { businessLines } from './businessLineRegistry';

describe('businessLineRegistry', () => {
  it('contiene exactamente 5 líneas de negocio registradas', () => {
    expect(businessLines).toHaveLength(5);
  });

  it('cada módulo tiene un ID único y válido', () => {
    const ids = businessLines.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
    
    const expectedIds = ['drywall', 'roofing', 'metallic-roofing', 'trading', 'services'];
    expectedIds.forEach(id => {
      expect(ids).toContain(id);
    });
  });

  it('todos los módulos cumplen con la interfaz BusinessLineModule básica', () => {
    businessLines.forEach(mod => {
      expect(mod.id).toBeDefined();
      expect(mod.displayName).toBeDefined();
      expect(mod.icon).toBeDefined();
      expect(mod.catalogSchema).toBeDefined();
      expect(mod.routes).toBeInstanceOf(Array);
      expect(mod.sidebarItems).toBeInstanceOf(Array);
      expect(mod.permissions).toBeDefined();
    });
  });

  it('el módulo "services" no tiene motores de producción ni inventario', () => {
    const services = businessLines.find(m => m.id === 'services');
    expect(services?.productionEngine).toBeUndefined();
    expect(services?.inventoryEngine).toBeUndefined();
  });

  it('el módulo "trading" tiene motor de inventario pero no de producción', () => {
    const trading = businessLines.find(m => m.id === 'trading');
    expect(trading?.inventoryEngine).toBeDefined();
    expect(trading?.productionEngine).toBeUndefined();
  });

  it('el módulo "drywall" tiene ambos motores registrados', () => {
    const drywall = businessLines.find(m => m.id === 'drywall');
    expect(drywall).toBeDefined();
    // En v6.0 drywall DEBE tener motores. Si falla, revisar circular dependencies.
    expect(drywall?.productionEngine).toBeDefined();
    expect(drywall?.inventoryEngine).toBeDefined();
  });

  it('el módulo "metallic-roofing" tiene motor de inventario (v1)', () => {
    const metallic = businessLines.find(m => m.id === 'metallic-roofing');
    expect(metallic?.inventoryEngine).toBeDefined();
    // productionEngine se omite en v1 (conformado en sprint posterior)
    expect(metallic?.productionEngine).toBeUndefined();
  });
});
