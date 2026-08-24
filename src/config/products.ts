export const PRODUCT_CATALOG = {
  P38: { name: "Parante 38", stripWidth: 124, standardWeight: 1.3141 },
  P64: { name: "Parante 64", stripWidth: 149, standardWeight: 1.5896 },
  P89: { name: "Parante 89", stripWidth: 175, standardWeight: 1.8652 },
  R39: { name: "Riel 39", stripWidth: 87, standardWeight: 0.9326 },
  R65: { name: "Riel 65", stripWidth: 113, standardWeight: 1.2081 },
  R90: { name: "Riel 90", stripWidth: 138, standardWeight: 1.4837 },
  OMG: { name: "Omega", stripWidth: 115, standardWeight: 1.2293 },
} as const;

export type ProductSKU = keyof typeof PRODUCT_CATALOG;
