# ADR-XXX: [Título de la decisión]

**Estado:** [Propuesta | Aceptada | Rechazada | Deprecada | Supersedida por ADR-YYY]  
**Fecha:** YYYY-MM-DD  
**Decisores:** [Nombres de quienes participaron en la decisión]  
**Consulta técnica:** [Opcional: ¿Se consultó a alguien externo?]

---

## Contexto y problema

Describe **por qué** necesitamos tomar una decisión. ¿Qué problema estamos resolviendo? ¿Qué restricciones existen?

- Situación actual
- Pain points
- Requisitos funcionales/no-funcionales que impulsan la decisión
- Restricciones técnicas, de negocio o temporales

**Ejemplo real:**
> La empresa está incorporando 4 nuevas líneas de negocio (tubería, cobertura, decking, wholesale), cada una con su propio modelo de producción. El código actual de drywall está acoplado y no se puede extender sin duplicar lógica o crear un monolito inmantenible.

---

## Opciones consideradas

Lista todas las alternativas evaluadas, no solo la que se eligió.

### Opción 1: [Nombre de la opción]
**Descripción:** [Qué es y cómo funciona]

**Pros:**
- ✅ Pro 1
- ✅ Pro 2

**Contras:**
- ❌ Contra 1
- ❌ Contra 2

**Impacto en:**
- Complejidad de implementación: [Alta/Media/Baja]
- Mantenibilidad: [Alta/Media/Baja]
- Performance: [Positivo/Neutral/Negativo]
- Developer Experience: [Buena/Neutral/Mala]

---

### Opción 2: [Nombre]
[Misma estructura que Opción 1]

---

### Opción 3: [Nombre]
[Misma estructura]

---

## Decisión

**Opción elegida:** [Opción X — Nombre]

**Justificación:**
Explica **por qué** se eligió esta opción sobre las demás. Qué pros fueron decisivos, qué contras son aceptables o mitigables.

**Ejemplo:**
> Elegimos un monorepo modularizado (Opción 2) porque:
> 1. Permite compartir Auth, CRM, Kardex, Audit sin duplicar
> 2. Cada línea puede evolucionar independiente sin afectar a las demás
> 3. El overhead de setup es menor que un multirepo con 5 proyectos
> 4. Linear scaling hasta ~80K líneas de código (suficiente para 3-5 años)

---

## Consecuencias

### Positivas ✅
- Consecuencia buena 1
- Consecuencia buena 2

### Negativas ⚠️
- Consecuencia negativa 1 (y cómo la mitigamos)
- Consecuencia negativa 2

### Neutrales 🔵
- Consecuencia que no es ni buena ni mala

---

## Implementación

**Plan de migración:**
1. Paso 1
2. Paso 2
3. Paso 3

**Tareas técnicas:**
- [ ] Tarea 1 (Responsable: @nombre, Sprint: X)
- [ ] Tarea 2
- [ ] Tarea 3

**Criterio de éxito:**
- ¿Cómo sabemos que la implementación fue exitosa?
- Métricas: ¿qué mejoró?

---

## Validación y revisión

**Fecha de revisión:** [YYYY-MM-DD] (Ej: después de 3 meses de implementación)

**Trigger para re-evaluar:**
- Si pasa X (ej: el monorepo supera 80K líneas)
- Si surge Y (ej: necesitamos stack diferente para una línea)
- Si falla Z (ej: builds se vuelven lentos > 5 min)

---

## Referencias

- [Enlace a RFC, docs, papers relevantes]
- [Conversaciones en Linear/Slack]
- [ADRs relacionados]
- [Stack Overflow, blog posts que influyeron]

---

## Notas adicionales

Cualquier contexto extra que no encajó arriba pero es importante registrar.
