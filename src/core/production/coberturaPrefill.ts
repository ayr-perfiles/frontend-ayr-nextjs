export function computeCoberturaPrefill(pending: number, pieceLengthM: number, piecesCount?: number): { cantidad: string; longitud: string } | null {
  if (pieceLengthM <= 0 || !piecesCount) {
    return null;
  }
  return {
    longitud: String(pieceLengthM),
    cantidad: String(pending / pieceLengthM)
  };
}
