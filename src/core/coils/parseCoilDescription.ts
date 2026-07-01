export type CoilFinishToken = 'GALV' | 'NATURAL' | 'AZUL' | 'BLANCO' | 'ROJO' | 'VERDE';

export interface ParsedCoilSpec {
  finishToken: CoilFinishToken | null;
  thickness: number | null;
  width: number | null;
  flags: string[];
}

export function parseCoilDescription(desc: string): ParsedCoilSpec {
  const norm = desc.toUpperCase().replace(/\s+/g, ' ').trim();
  
  let thickness: number | null = null;
  let width: number | null = null;
  let finishToken: CoilFinishToken | null = null;
  const flags: string[] = [];

  const thickMatch = norm.match(/0\.\d{1,2}/);
  if (thickMatch) {
    thickness = parseFloat(thickMatch[0]);
  }

  const widthMatch = norm.match(/X\s*(1[0-3]\d{2})/);
  if (widthMatch) {
    width = parseInt(widthMatch[1], 10);
  }

  if (/\bGALV\b|\bGALVANIZAD/.test(norm)) {
    finishToken = 'GALV';
  } else if (/\bNATURAL\b/.test(norm)) {
    finishToken = 'NATURAL';
  } else if (/\bAZUL\b|\bBLUE\b/.test(norm)) {
    finishToken = 'AZUL';
  } else if (/\bROJO\b|\bRED\b/.test(norm)) {
    finishToken = 'ROJO';
  } else if (/\bBLANCO\b|\bWHITE\b/.test(norm)) {
    finishToken = 'BLANCO';
  } else if (/\bVERDE\b|\bGREEN\b/.test(norm)) {
    finishToken = 'VERDE';
  }

  if (finishToken === null) {
    flags.push('FINISH_AMBIGUOUS');
  }
  if (thickness === null) {
    flags.push('THICKNESS_NOT_FOUND');
  }
  if (width === null) {
    flags.push('WIDTH_NOT_FOUND');
  }

  return {
    finishToken,
    thickness,
    width,
    flags
  };
}
