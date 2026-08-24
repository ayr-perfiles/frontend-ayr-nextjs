import { describe, it, expect } from 'vitest';
import { RoofingProductSchema, addProductFormSchema } from './catalog';
import { generateSKU, combinationKey } from '../domain/skuGenerator';

// ─── fixtures ────────────────────────────────────────────────────────────────

const validBase = {
  sku: 'UPVC6MT',
  displayName: 'Plancha UPVC 6m Rojo',
  family: 'TC5',
  material: 'UPVC' as const,
  color: 'ROJO',
  thickness: 2,
  width: 1,
  length: 6.0,
  unit: 'PIEZA' as const,
  active: true,
};

// ─── RoofingProductSchema ─────────────────────────────────────────────────────

describe('RoofingProductSchema', () => {
  describe('SKU: formato', () => {
    it('acepta SKU válido en mayúsculas', () => {
      expect(RoofingProductSchema.safeParse(validBase).success).toBe(true);
    });

    it('acepta SKU con números', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, sku: 'UPVC36MTAZUL' });
      expect(r.success).toBe(true);
    });

    it('rechaza SKU con menos de 3 caracteres', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, sku: 'AB' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].path).toContain('sku');
    });

    it('rechaza SKU con más de 30 caracteres', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, sku: 'A'.repeat(31) });
      expect(r.success).toBe(false);
    });

    it('rechaza SKU con minúsculas', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, sku: 'upvc6mt' });
      expect(r.success).toBe(false);
    });

    it('rechaza SKU con guión', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, sku: 'UPVC-6MT' });
      expect(r.success).toBe(false);
    });

    it('rechaza SKU con espacios', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, sku: 'UPVC 6MT' });
      expect(r.success).toBe(false);
    });
  });

  describe('displayName', () => {
    it('rechaza nombre con menos de 5 caracteres', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, displayName: 'PVC' });
      expect(r.success).toBe(false);
    });

    it('acepta nombre exactamente de 5 caracteres', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, displayName: 'UPVC1' });
      expect(r.success).toBe(true);
    });
  });

  describe('color: normalización a mayúsculas', () => {
    it('transforma color en minúsculas a mayúsculas', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, color: 'azul' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.color).toBe('AZUL');
    });

    it('transforma color mixto a mayúsculas', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, color: 'Verde' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.color).toBe('VERDE');
    });

    it('mantiene color ya en mayúsculas', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, color: 'BLANCO' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.color).toBe('BLANCO');
    });

    it('rechaza color de 1 caracter', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, color: 'R' });
      expect(r.success).toBe(false);
    });
  });

  describe('material UPVC requiere color', () => {
    it('acepta UPVC con color definido', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, material: 'UPVC', color: 'ROJO' });
      expect(r.success).toBe(true);
    });

    it('rechaza UPVC sin color', () => {
      const { color: _omitted, ...withoutColor } = validBase;
      const r = RoofingProductSchema.safeParse({ ...withoutColor, material: 'UPVC' });
      expect(r.success).toBe(false);
      if (!r.success) {
        const colorIssue = r.error.issues.find(i => i.path.includes('color'));
        expect(colorIssue).toBeDefined();
      }
    });

    it('acepta ACERO_GALV sin color', () => {
      const { color: _omitted, ...withoutColor } = validBase;
      const r = RoofingProductSchema.safeParse({ ...withoutColor, material: 'ACERO_GALV' });
      expect(r.success).toBe(true);
    });

    it('acepta POLICARBONATO sin color', () => {
      const { color: _omitted, ...withoutColor } = validBase;
      const r = RoofingProductSchema.safeParse({ ...withoutColor, material: 'POLICARBONATO' });
      expect(r.success).toBe(true);
    });

    it('rechaza material no definido en enum', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, material: 'MADERA' });
      expect(r.success).toBe(false);
    });
  });

  describe('family: default', () => {
    it('aplica default TC5 cuando se omite family', () => {
      const { family: _omitted, ...withoutFamily } = validBase;
      const r = RoofingProductSchema.safeParse(withoutFamily);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.family).toBe('TC5');
    });

    it('respeta el valor si se provee', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, family: 'TC7' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.family).toBe('TC7');
    });
  });

  describe('active: default', () => {
    it('aplica default true cuando se omite active', () => {
      const { active: _omitted, ...withoutActive } = validBase;
      const r = RoofingProductSchema.safeParse(withoutActive);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.active).toBe(true);
    });
  });

  describe('campos numéricos', () => {
    it.each([
      ['thickness', -1],
      ['thickness', 0],
      ['thickness', 11],
      ['width', -1],
      ['width', 0],
      ['length', -1],
      ['length', 0],
      ['length', 25],
    ])('rechaza %s = %d', (field, value) => {
      const r = RoofingProductSchema.safeParse({ ...validBase, [field]: value });
      expect(r.success).toBe(false);
    });

    it('acepta weight opcional ausente', () => {
      const { weight: _omitted, ...withoutWeight } = { ...validBase, weight: undefined };
      const r = RoofingProductSchema.safeParse(withoutWeight);
      expect(r.success).toBe(true);
    });

    it('acepta weight cuando es positivo', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, weight: 5.2 });
      expect(r.success).toBe(true);
    });

    it('rechaza weight = 0', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, weight: 0 });
      expect(r.success).toBe(false);
    });
  });

  describe('unit', () => {
    it('rechaza unit distinto de PIEZA', () => {
      const r = RoofingProductSchema.safeParse({ ...validBase, unit: 'KG' });
      expect(r.success).toBe(false);
    });
  });
});

// ─── generateSKU ─────────────────────────────────────────────────────────────

describe('generateSKU', () => {
  it.each([
    [{ material: 'UPVC', length: 6.0, color: 'ROJO' }, 'UPVC6MT'],
    [{ material: 'UPVC', length: 3.6, color: 'ROJO' }, 'UPVC36MT'],
    [{ material: 'UPVC', length: 4.8, color: 'ROJO' }, 'UPVC48MT'],
    [{ material: 'UPVC', length: 3.0, color: 'ROJO' }, 'UPVC3MT'],
    [{ material: 'UPVC', length: 6.0, color: 'AZUL' }, 'UPVC6MTAZUL'],
    [{ material: 'UPVC', length: 6.0, color: 'VERDE' }, 'UPVC6MTVERDE'],
    [{ material: 'UPVC', length: 3.6, color: 'AZUL' }, 'UPVC36MTAZUL'],
  ])('genera SKU correcto para %o → %s', (input, expected) => {
    expect(generateSKU(input)).toBe(expected);
  });

  it('normaliza color en minúsculas al generar SKU', () => {
    expect(generateSKU({ material: 'UPVC', length: 6.0, color: 'azul' })).toBe('UPVC6MTAZUL');
  });

  it('normaliza material en minúsculas al generar SKU', () => {
    expect(generateSKU({ material: 'upvc', length: 6.0, color: 'ROJO' })).toBe('UPVC6MT');
  });

  it('omite el color cuando es ROJO (default)', () => {
    const sku = generateSKU({ material: 'UPVC', length: 6.0, color: 'ROJO' });
    expect(sku).not.toContain('ROJO');
  });

  it('incluye el color cuando no es ROJO', () => {
    const sku = generateSKU({ material: 'UPVC', length: 6.0, color: 'GRIS' });
    expect(sku).toContain('GRIS');
  });

  it('lanza error para material no soportado', () => {
    expect(() => generateSKU({ material: 'MADERA', length: 6.0, color: 'ROJO' })).toThrow();
  });

  it('lanza error con mensaje descriptivo para material desconocido', () => {
    expect(() => generateSKU({ material: 'MADERA', length: 6.0, color: 'ROJO' }))
      .toThrow(/no soportado/);
  });
});

// ─── combinationKey ───────────────────────────────────────────────────────────

describe('combinationKey', () => {
  const base = { material: 'UPVC', color: 'ROJO', thickness: 2, width: 1, length: 6.0 };

  it('genera clave determinista', () => {
    expect(combinationKey(base)).toBe(combinationKey(base));
  });

  it('claves distintas para colores distintos', () => {
    expect(combinationKey({ ...base, color: 'AZUL' })).not.toBe(combinationKey(base));
  });

  it('claves distintas para largos distintos', () => {
    expect(combinationKey({ ...base, length: 3.6 })).not.toBe(combinationKey(base));
  });

  it('claves distintas para materiales distintos', () => {
    expect(combinationKey({ ...base, material: 'ACERO_GALV' })).not.toBe(combinationKey(base));
  });

  it('normaliza color a mayúsculas en la clave', () => {
    expect(combinationKey({ ...base, color: 'rojo' })).toBe(combinationKey({ ...base, color: 'ROJO' }));
  });

  it('normaliza material a mayúsculas en la clave', () => {
    expect(combinationKey({ ...base, material: 'upvc' })).toBe(combinationKey({ ...base, material: 'UPVC' }));
  });
});

// ─── addProductFormSchema ─────────────────────────────────────────────────────

describe('addProductFormSchema', () => {
  const validForm = {
    material: 'UPVC' as const,
    color: 'ROJO',
    thickness: '1.5',
    width: '1.075',
    length: '6',
    weight: '',
    sku: '',
    displayName: '',
  };

  it('acepta datos válidos', () => {
    expect(addProductFormSchema.safeParse(validForm).success).toBe(true);
  });

  it('rechaza espesor no numérico', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, thickness: 'abc' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain('thickness');
  });

  it('rechaza espesor = 0', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, thickness: '0' });
    expect(r.success).toBe(false);
  });

  it('rechaza espesor > 10', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, thickness: '11' });
    expect(r.success).toBe(false);
  });

  it('rechaza ancho no numérico', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, width: 'abc' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toContain('width');
  });

  it('rechaza ancho = 0', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, width: '0' });
    expect(r.success).toBe(false);
  });

  it('rechaza largo = 0', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, length: '0' });
    expect(r.success).toBe(false);
  });

  it('rechaza largo > 20', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, length: '21' });
    expect(r.success).toBe(false);
  });

  it('acepta peso vacío (opcional)', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, weight: '' });
    expect(r.success).toBe(true);
  });

  it('acepta peso positivo como string', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, weight: '5.5' });
    expect(r.success).toBe(true);
  });

  it('rechaza peso = 0', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, weight: '0' });
    expect(r.success).toBe(false);
  });

  it('rechaza UPVC sin color', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, material: 'UPVC', color: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const colorIssue = r.error.issues.find((i) => i.path.includes('color'));
      expect(colorIssue).toBeDefined();
    }
  });

  it('acepta ACERO_GALV sin color', () => {
    const r = addProductFormSchema.safeParse({ ...validForm, material: 'ACERO_GALV', color: '' });
    expect(r.success).toBe(true);
  });
});
