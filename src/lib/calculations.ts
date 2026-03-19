import { PRODUCT_CATALOG, ProductSKU } from "@/config/products";

/**
 * Calcula la producción teórica y la merma
 * Basado en las fórmulas de tu inventario real.
 */
export const calculateTransformation = (
  pesoInicialBobina: number,
  sku: ProductSKU,
  cantidadProducida: number,
) => {
  const producto = PRODUCT_CATALOG[sku];
  const pesoUtilTotal = cantidadProducida * producto.pesoStd;
  const merma = pesoInicialBobina - pesoUtilTotal;
  const eficiencia = (pesoUtilTotal / pesoInicialBobina) * 100;

  return {
    pesoUtilTotal: Number(pesoUtilTotal.toFixed(4)),
    merma: Number(merma.toFixed(4)),
    eficiencia: Number(eficiencia.toFixed(2)),
  };
};
