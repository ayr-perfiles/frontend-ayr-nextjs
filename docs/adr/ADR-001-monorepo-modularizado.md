# ADR-001: Monorepo modularizado

**Estado:** Aceptada  
**Fecha:** 2026-05-26  
**Decisores:** Giancarlo Sinuiri  
**Consulta técnica:** —

---

## Contexto y problema

La empresa opera **5 líneas de negocio** sobre la misma materia prima (bobinas de acero): drywall, tubería, cobertura, decking y wholesale. Cada línea tiene su propio modelo de producción, sus propias fórmulas y su propia UX, pero **comparten infraestructura**: autenticación, CRM de clientes, kardex de inventario, auditoría y reportes.

La línea drywall fue la primera en implementarse. Al momento de escalar a las otras cuatro líneas surgió la pregunta: ¿cómo organizar el código para que las líneas sean independientes sin duplicar la infraestructura común?

- **Situación actual:** código de drywall acoplado en `src/services/` y `src/app/`, sin separación de dominio
- **Pain point principal:** cualquier cambio en la lógica de costos o kardex requería tocar archivos que otras líneas también usarían, con riesgo de regresiones cruzadas
- **Restricción temporal:** cada nueva línea debe poder desarrollarse e incorporarse en sprints independientes sin bloquear las ya productivas
- **Restricción técnica:** mismo stack Next.js + Firebase para todas las líneas; no existe presupuesto para infraestructuras separadas

---

## Opciones consideradas

### Opción 1: Monolito unificado

**Descripción:** Todo el código convive en `src/` sin separación por línea. Servicios y componentes con nombres prefijados (`drywallProductionService`, `tubingProductionService`).

**Pros:**
- ✅ Setup inmediato, sin migración
- ✅ Fácil compartir helpers entre líneas

**Contras:**
- ❌ Un bug en una línea puede romper a las demás si comparten código directamente
- ❌ Imposible establecer límites de propiedad de código por equipo
- ❌ A medida que crecen las líneas, los archivos comunes se vuelven inmanejables
- ❌ Dificulta onboarding: un desarrollador nuevo no sabe de qué línea es cada archivo

**Impacto en:**
- Complejidad de implementación: Baja (a corto plazo)
- Mantenibilidad: Baja (a largo plazo)
- Performance: Neutral
- Developer Experience: Mala (>3 líneas activas)

---

### Opción 2: Monorepo modularizado *(elegida)*

**Descripción:** Un solo repositorio Next.js con `src/modules/<linea>/` para cada línea de negocio y `src/core/` para la infraestructura compartida. Cada módulo contiene su propio `services/`, `components/`, `routes/`, `domain/` y `hooks/`.

**Pros:**
- ✅ Límites claros: un bug en `modules/drywall/` no puede afectar `modules/tubing/` sin un import explícito
- ✅ Auth, CRM, Kardex y Audit se definen una sola vez en `core/`
- ✅ Cada línea puede evolucionar a su propio ritmo
- ✅ Un solo deploy, un solo entorno de emuladores, una sola configuración de Firebase

**Contras:**
- ❌ Requiere migración del código de drywall existente (costo único, ~2 sprints)
- ❌ Convención de módulos debe documentarse y mantenerse; hay riesgo de que imports cruzados incorrectos rompan el aislamiento

**Impacto en:**
- Complejidad de implementación: Media (migración inicial)
- Mantenibilidad: Alta
- Performance: Neutral (Next.js tree-shakes por ruta)
- Developer Experience: Buena

---

### Opción 3: Multirepo (un repo por línea)

**Descripción:** Cinco repositorios independientes de Next.js, uno por línea. La infraestructura común se extrae a paquetes npm privados.

**Pros:**
- ✅ Máximo aislamiento: imposible el acoplamiento accidental
- ✅ Deploys y CI/CD totalmente independientes por línea

**Contras:**
- ❌ La infraestructura común (Auth, CRM, Kardex) debe vivir en paquetes versionados; cualquier cambio requiere release + actualización en 5 repos
- ❌ Cinco entornos de emuladores, cinco configuraciones de Firebase, cinco pipelines de CI
- ❌ Equipo pequeño: el overhead operativo es desproporcionado
- ❌ Sincronizar un fix de seguridad en las 5 apps requiere 5 PRs coordinados

**Impacto en:**
- Complejidad de implementación: Alta
- Mantenibilidad: Media
- Performance: Neutral
- Developer Experience: Mala (equipo pequeño, muchos repos)

---

## Decisión

**Opción elegida:** Opción 2 — Monorepo modularizado

**Justificación:**

1. El equipo es pequeño; el overhead de un multirepo es injustificado
2. Las líneas comparten demasiada infraestructura (40–50 % del código estimado) como para duplicarla en paquetes versionados
3. Los límites de módulo en Next.js son suficientemente fuertes si se mantiene la convención `modules/<linea>/` y se prohíben imports cruzados entre módulos de negocio
4. El monolito fue descartado porque su deuda técnica se acumula de forma no lineal: las primeras 2 líneas son manejables, las últimas 2 no

---

## Consecuencias

### Positivas ✅
- Cada nueva línea sigue un template probado (drywall como referencia)
- Un solo entorno de desarrollo y CI para todo el equipo
- Cambios en `core/` se propagan instantáneamente a todas las líneas
- Fácil auditar qué lógica pertenece a qué dominio

### Negativas ⚠️
- **Riesgo de acoplamiento accidental:** mitigado con la regla del CLAUDE.md: "Nunca pongas lógica de drywall en `core/`", y con lint rules (futuras) que prohíban imports entre módulos de dominio
- **Migración inicial:** el código de drywall debe moverse a `src/modules/drywall/`; esto ya está en ejecución (ver commit `5885d9d`)

### Neutrales 🔵
- El bundle size del frontend no cambia: Next.js tree-shakes por ruta independientemente de la estructura de carpetas

---

## Implementación

**Plan de migración:**

1. ✅ Mover servicios de drywall a `src/modules/drywall/services/`
2. ✅ Mover componentes a `src/modules/drywall/components/`
3. ✅ Mover rutas a `src/modules/drywall/routes/`
4. ✅ Extraer lógica pura a `src/modules/drywall/domain/`
5. ✅ Crear hooks en `src/modules/drywall/hooks/`
6. 🚧 Endurecer `src/core/` (auth guards, rules, funciones)
7. ⬜ Usar estructura de drywall como template para línea 2

**Tareas técnicas:**
- [x] Refactor drywall a estructura modular (Sprint 1)
- [ ] Documentar contrato de `BusinessLineModule` para líneas futuras
- [ ] Agregar lint rule que prohíba imports de `modules/X` dentro de `modules/Y`
- [ ] Crear scaffolding CLI o template de carpetas para nueva línea

**Criterio de éxito:**
- Línea 2 implementada usando el template de drywall en < 80 % del tiempo que tomó drywall
- Cero regresiones en drywall al desarrollar línea 2

---

## Validación y revisión

**Fecha de revisión:** 2026-11-26 (6 meses tras primera implementación multi-línea)

**Trigger para re-evaluar:**
- Si el monorepo supera 120 K líneas de código TypeScript
- Si los builds de CI superan los 8 minutos
- Si se necesita un stack tecnológico diferente para alguna línea (ej: Python para ML)

---

## Referencias

- [Monorepo vs Multirepo — Martin Fowler](https://martinfowler.com/bliki/MonoRepo.html)
- Estructura objetivo documentada en `CLAUDE.md` § 3
- Commit de migración inicial: `5885d9d refactor(drywall): migrate to modular structure`

---

## Notas adicionales

La carpeta `src/domain/steel/` aloja constantes físicas y fórmulas metalúrgicas compartidas por todas las líneas (densidad 7.85, tolerancias, factores de scrap). Es parte de `core/` conceptualmente aunque vive en `domain/` por nomenclatura.
