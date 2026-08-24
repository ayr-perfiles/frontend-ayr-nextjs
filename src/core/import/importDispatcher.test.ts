import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dispatchImportRow } from './importDispatcher';
import * as metallicService from '@/modules/metallic-roofing/services/catalogService';
import * as roofingService from '@/modules/roofing/services/catalogService';
import * as tradingService from '@/modules/trading/services/catalogService';
import * as servicesService from '@/modules/services/services/catalogService';

vi.mock('@/modules/metallic-roofing/services/catalogService');
vi.mock('@/modules/roofing/services/catalogService');
vi.mock('@/modules/trading/services/catalogService');
vi.mock('@/modules/services/services/catalogService');

describe('dispatchImportRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no hace nada para líneas omitidas (skip, coil, unclassified, drywall)', async () => {
    const skipRows: any[] = [
      { sku: 'ANTI01', name: 'ANTICIPO', normalizedUnit: 'PIEZA', line: 'skip' },
      { sku: 'BOB01', name: 'BOBINA', normalizedUnit: 'KILOGRAMO', line: 'coil' },
      { sku: 'DESCO', name: 'BASURA', normalizedUnit: 'PIEZA', line: 'unclassified' },
      { sku: 'P64G', name: 'PARANTE', normalizedUnit: 'PIEZA', line: 'drywall' },
    ];

    for (const row of skipRows) {
      await dispatchImportRow(row);
    }

    expect(metallicService.createProduct).not.toHaveBeenCalled();
    expect(roofingService.createProduct).not.toHaveBeenCalled();
    expect(tradingService.createProduct).not.toHaveBeenCalled();
    expect(servicesService.createProduct).not.toHaveBeenCalled();
  });

  it('llama a createProduct si no existe el producto en metallic-roofing', async () => {
    vi.mocked(metallicService.getProduct).mockResolvedValue(null);
    
    await dispatchImportRow({ 
      sku: 'COB030ROJO', 
      name: 'COBERTURA ROJO', 
      normalizedUnit: 'PIEZA', 
      line: 'metallic-roofing' 
    } as any);

    expect(metallicService.createProduct).toHaveBeenCalledWith(expect.objectContaining({
      sku: 'COB030ROJO',
      family: 'COBERTURA',

    }));
  });

  it('llama a updateProduct si el producto ya existe en trading', async () => {
    vi.mocked(tradingService.getProduct).mockResolvedValue({ sku: 'POLI01' } as any);
    
    await dispatchImportRow({ 
      sku: 'POLI01', 
      name: 'POLICARBONATO 6MM', 
      normalizedUnit: 'PIEZA', 
      line: 'trading' 
    } as any);

    expect(tradingService.updateProduct).toHaveBeenCalledWith('POLI01', expect.objectContaining({
      category: 'POLICARBONATO'
    }));
    expect(tradingService.createProduct).not.toHaveBeenCalled();
  });

  it('fuerza unidad TONELADA para servicios', async () => {
    vi.mocked(servicesService.getProduct).mockResolvedValue(null);
    
    await dispatchImportRow({ 
      sku: 'CONFORMADO', 
      name: 'SERVICIO', 
      normalizedUnit: 'PIEZA', 
      line: 'services' 
    } as any);

    expect(servicesService.createProduct).toHaveBeenCalledWith(expect.objectContaining({
      unit: 'TONELADA'
    }));
  });
});

/**
 * TODO Fase 2:
 * - Probar importDispatcher con un archivo Excel real usando parseAndClassify.
 * - Validar que la idempotencia se mantiene tras fallos parciales (re-intentos).
 */
