import { ParsedCatalogRow } from './catalogImport';

import { createProduct as createMetallic, updateProduct as updateMetallic, getProduct as getMetallic } from '@/modules/metallic-roofing/services/catalogService';
import { createProduct as createRoofing, updateProduct as updateRoofing, getProduct as getRoofing } from '@/modules/roofing/services/catalogService';
import { createProduct as createTrading, updateProduct as updateTrading, getProduct as getTrading } from '@/modules/trading/services/catalogService';
import { createProduct as createServices, updateProduct as updateServices, getProduct as getServices } from '@/modules/services/services/catalogService';

import type { MetallicProductInput } from '@/modules/metallic-roofing/schemas/catalog';
import type { RoofingProductInput } from '@/modules/roofing/schemas/catalog';
import type { TradingProductInput } from '@/modules/trading/schemas/catalog';
import type { ServiceProductInput } from '@/modules/services/schemas/catalog';

export async function dispatchImportRow(row: ParsedCatalogRow): Promise<void> {
  const { sku, name, normalizedUnit, line } = row;

  if (['skip', 'coil', 'unclassified', 'drywall'].includes(line)) {
    return; // Do nothing
  }

  // Helper to fallback unit if UNKNOWN
  const safeUnit = (validUnits: string[], fallback: string) => {
    return validUnits.includes(normalizedUnit) ? normalizedUnit : fallback;
  };

  switch (line) {
    case 'metallic-roofing': {
      // Derive category
      let family: MetallicProductInput['family'] = 'COBERTURA';
      if (sku.startsWith('PL')) family = 'PLANCHA';
      if (sku.startsWith('ACCES')) family = 'ACCESORIO';

      // Parse finish/color from name (simple heuristic)
      const finish = name.includes('NATURAL') ? 'NATURAL' : name.includes('ALUZINC') ? 'ALUZINC' : 'GALV';
      const color = name.includes('ROJO') ? 'ROJO' : name.includes('AZUL') ? 'AZUL' : undefined;

      const unit = safeUnit(['PIEZA', 'METRO', 'KILOGRAMO', 'TONELADA'], 'PIEZA') as MetallicProductInput['unit'];

      const input: MetallicProductInput = {
        sku,
        displayName: name,
        family,
        finish,
        color,
        unit,
        thickness: 0.35, // default
        active: true,
      };

      const existing = await getMetallic(sku);
      if (existing) {
        await updateMetallic(sku, input);
      } else {
        await createMetallic(input);
      }
      break;
    }
    case 'roofing': {
      const unit = safeUnit(['PIEZA'], 'PIEZA') as RoofingProductInput['unit'];
      const input: RoofingProductInput = {
        sku,
        displayName: name,
        material: 'UPVC',
        thickness: 1.5,
        width: 1.075,
        length: 6,
        unit,
        active: true,
      };

      const existing = await getRoofing(sku);
      if (existing) {
        await updateRoofing(sku, input);
      } else {
        await createRoofing(input);
      }
      break;
    }
    case 'trading': {
      let category: TradingProductInput['category'] = 'OTRO';
      if (sku.startsWith('POLI') || sku.startsWith('COBPOLI') || name.includes('POLICARBONATO')) {
        category = 'POLICARBONATO';
      } else if (sku.startsWith('TUBO')) {
        category = 'TUBO';
      } else if (sku.startsWith('AUTOP')) {
        category = 'AUTOPERFORANTE';
      }

      const unit = safeUnit(['PIEZA', 'METRO', 'ROLLO'], 'PIEZA') as TradingProductInput['unit'];

      const input: TradingProductInput = {
        sku,
        displayName: name,
        category,
        unit,
        active: true,
        avgCost: 0,
      };

      const existing = await getTrading(sku);
      if (existing) {
        await updateTrading(sku, input);
      } else {
        await createTrading(input);
      }
      break;
    }
    case 'services': {
      const input: ServiceProductInput = {
        sku,
        displayName: name,
        unit: 'TONELADA',
        active: true,
      };

      const existing = await getServices(sku);
      if (existing) {
        await updateServices(sku, input);
      } else {
        await createServices(input);
      }
      break;
    }
  }
}
