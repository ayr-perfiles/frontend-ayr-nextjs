import { expect, test, describe } from 'vitest';
import {
  computePricePerKg as computePriceClient,
  validateAndCalculateSplit as validateSplitClient,
} from '../../../src/core/coils/domain/coilPricing';
import {
  computePricePerKg as computePriceBackend,
  validateAndCalculateSplit as validateSplitBackend,
} from './coilPricing';

describe('Parity Test: coilPricing', () => {
  describe('computePricePerKg', () => {
    const priceCases = [
      {
        name: 'Válido PEN',
        inputs: { totalValue: 1000, weightKg: 500, currency: 'PEN' as const, exchangeRate: 1 },
        shouldThrow: false,
      },
      {
        name: 'Válido USD',
        inputs: { totalValue: 1000, weightKg: 500, currency: 'USD' as const, exchangeRate: 3.8 },
        shouldThrow: false,
      },
      {
        name: 'USD TC inválido',
        inputs: { totalValue: 1000, weightKg: 500, currency: 'USD' as const, exchangeRate: 0.5 },
        shouldThrow: true,
      },
      {
        name: 'Peso <= 0',
        inputs: { totalValue: 1000, weightKg: 0, currency: 'PEN' as const, exchangeRate: 1 },
        shouldThrow: true,
      },
      {
        name: 'Decimales (redondeo a 6)',
        inputs: { totalValue: 1000, weightKg: 333, currency: 'PEN' as const, exchangeRate: 1 },
        shouldThrow: false,
      },
    ];

    test.each(priceCases)('$name', ({ inputs, shouldThrow }) => {
      const runClient = () =>
        computePriceClient(inputs.totalValue, inputs.weightKg, inputs.currency, inputs.exchangeRate);
      const runBackend = () =>
        computePriceBackend(inputs.totalValue, inputs.weightKg, inputs.currency, inputs.exchangeRate);

      if (shouldThrow) {
        expect(runClient).toThrow();
        expect(runBackend).toThrow();

        let errCMessage = '';
        let errBMessage = '';
        try { runClient(); } catch (e: any) { errCMessage = e.message; }
        try { runBackend(); } catch (e: any) { errBMessage = e.message; }

        expect(errBMessage).toBe(errCMessage);
      } else {
        const resClient = runClient();
        const resBackend = runBackend();
        expect(resClient).toBe(resBackend);
      }
    });
  });

  describe('validateAndCalculateSplit', () => {
    const splitCases = [
      {
        name: 'Válido: split normal',
        inputs: { parent: { currentWeight: 1000, masterWidth: 1200, status: 'AVAILABLE' }, newChildWidthMm: 600 },
        shouldThrow: false,
      },
      {
        name: 'Válido: peso con redondeos',
        inputs: { parent: { currentWeight: 987.65, masterWidth: 1220, status: 'AVAILABLE' }, newChildWidthMm: 311 },
        shouldThrow: false,
      },
      {
        name: 'Inválido: ancho >= masterWidth',
        inputs: { parent: { currentWeight: 1000, masterWidth: 1200, status: 'AVAILABLE' }, newChildWidthMm: 1200 },
        shouldThrow: true,
      },
      {
        name: 'Inválido: ancho > masterWidth',
        inputs: { parent: { currentWeight: 1000, masterWidth: 1200, status: 'AVAILABLE' }, newChildWidthMm: 1250 },
        shouldThrow: true,
      },
      {
        name: 'Inválido: ancho <= 0',
        inputs: { parent: { currentWeight: 1000, masterWidth: 1200, status: 'AVAILABLE' }, newChildWidthMm: 0 },
        shouldThrow: true,
      },
      {
        name: 'Inválido: status no AVAILABLE',
        inputs: { parent: { currentWeight: 1000, masterWidth: 1200, status: 'IN_PROGRESS' }, newChildWidthMm: 600 },
        shouldThrow: true,
      },
    ];

    test.each(splitCases)('$name', ({ inputs, shouldThrow }) => {
      const runClient = () => validateSplitClient(inputs.parent, inputs.newChildWidthMm);
      const runBackend = () => validateSplitBackend(inputs.parent, inputs.newChildWidthMm);

      if (shouldThrow) {
        expect(runClient).toThrow();
        expect(runBackend).toThrow();

        let errCMessage = '';
        let errBMessage = '';
        try { runClient(); } catch (e: any) { errCMessage = e.message; }
        try { runBackend(); } catch (e: any) { errBMessage = e.message; }

        expect(errBMessage).toBe(errCMessage);
      } else {
        const resClient = runClient();
        const resBackend = runBackend();
        expect(resClient).toEqual(resBackend);
      }
    });

    // Caso de borde de proporcionalidad (comprobamos manualmente que no hay diferencias matemáticas)
    test('Proporcionalidad: childWeight = currentWeight * newChildWidth / masterWidth', () => {
      const parent = { currentWeight: 3333.33, masterWidth: 1000, status: 'AVAILABLE' };
      const newChildWidthMm = 333;
      
      const resClient = validateSplitClient(parent, newChildWidthMm);
      const resBackend = validateSplitBackend(parent, newChildWidthMm);
      
      expect(resClient).toEqual(resBackend);
      
      // Aseguramos que newParentWeight + childWeight == currentWeight (dependiendo del redondeo a 4 decimales)
      // Puede haber un minúsculo desface por el toFixed, pero ambas (Client/Backend) deben ser idénticas
      expect(resBackend.childWeight).toBe(Number((3333.33 * (333 / 1000)).toFixed(4)));
      expect(resBackend.newParentWeight).toBe(Number((3333.33 - resBackend.childWeight).toFixed(4)));
    });
  });
});
