import { hasStockPosition } from './stockDisplayLogic';

describe('hasStockPosition', () => {
  it('returns true when quantity > 0', () => {
    expect(hasStockPosition(10)).toBe(true);
  });

  it('returns false when quantity === 0', () => {
    expect(hasStockPosition(0)).toBe(false);
  });

  it('returns true when quantity < 0', () => {
    expect(hasStockPosition(-5)).toBe(true);
  });
});
