# Ficha de fórmula — [NOMBRE / ID]

> Estado: Vigente | Superseded | En desarrollo | Congelado
> Última verificación: YYYY-MM-DD · commit `<HEAD>`
> Fuente de verdad: el CÓDIGO. Este doc se valida contra él, no al revés.
> Relacionado: CLAUDE.md v… §… · ADR-…

---

## Propósito

[1-2 líneas, en términos de NEGOCIO: qué pregunta responde esta fórmula y quién depende de ella.]

## Notación matemática

```
resultado = expresión legible (no solo código)
```

## Implementación

**Archivo:** `ruta/al/archivo.ts:línea-línea`

```typescript
// snippet CRUDO, copiado verbatim del código
```

## Entradas

| Nombre | Tipo | Unidad | Rango / Validación | Fuente |
|---|---|---|---|---|
| `param1` | number | kg | > 0 (throw) | doc `coils/{id}.campo` |

## Salida

| Tipo | Unidad | Redondeo |
|---|---|---|
| number | PEN/kg | `toFixed(6)` |

## Precisión / Redondeo

[Qué `toFixed(n)` usa y por qué. Si hay inconsistencia con fórmulas hermanas (ej. 2 vs 4 decimales), decirlo acá.]

## Costo

**CONGELADO | WAC-ACTUAL | N/A** — [explicar: qué campo lee, en qué momento, y la línea que lo prueba.]

## Invariantes

- [Qué preserva (ej: masa total, valor contable) y qué ASUME (ej: pricePerKg de un coil nunca muta post-creación).]

## Casos borde

| Caso | Comportamiento |
|---|---|
| entrada ≤ 0 | throw / fallback / clamp / null |

## Consumidores

(Trazados por grep global — TODOS, no asumir uso único.)

- `archivo.ts:línea` — [contexto]

## Paridad cliente ↔ backend

- SYNC-MARKER: sí/no · Test de paridad: `archivo.test.ts` / **GAP**
- [Si hay copias sin relación declarada, listarlas como deuda.]

## Origen

- ADR-… / CLAUDE.md §… / regla de negocio: [cuál]

## Deudas conocidas

- [Duplicación, drift, constante mágica, guard solo-cliente, etc. Si no hay: "Ninguna conocida a la fecha de verificación."]
