import type { BusinessLineModule } from '@/core/contracts';
import { drywallModule } from '@/modules/drywall';
import { roofingModule } from '@/modules/roofing';
import { metallicRoofingModule } from '@/modules/metallic-roofing';
import { tradingModule } from '@/modules/trading';
import { servicesModule } from '@/modules/services';

/**
 * Fuente única de verdad para los módulos de línea de negocio activos.
 * Para agregar una nueva línea: importar el módulo y añadirlo al array.
 */
export const businessLines: BusinessLineModule[] = [
  drywallModule,
  roofingModule,
  metallicRoofingModule,
  tradingModule,
  servicesModule,
];
