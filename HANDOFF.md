# Handoff — AYR Steel ERP (Siguiente Sesión)

> **Subir SIEMPRE al inicio:** este `HANDOFF.md` + `CLAUDE.md` (v6.6).
> **Foco de la próxima sesión:** Correr migraciones/saneo pendientes + retomar deuda técnica (Sprint 7, ACCESORIO).
> **Ajuste de preferencias:** Generar **prompts para Claude Code** por defecto, NO crear archivos innecesarios. Preguntar antes de generar si hay dudas.

---

## 1. Estado del Proyecto (Sprint 6B Aluzinc Cerrado)

- **Línea Aluzinc (metallic-roofing):** ¡COMPLETA y en verde! El pipeline end-to-end es funcional y consistente:
  $$\text{Bobina} \longrightarrow \text{Slitting} \longrightarrow \text{Producción Conformado} \longrightarrow \text{Mermas/Despunte} \longrightarrow \text{Venta} \longrightarrow \text{Reporte (Venta/Costo/Ganancia)}$$
- **Build & Compilación:** 🟢 Compilación con `npm run build` y `tsc` limpia.
- **Última Feature Aplicada:** P-M9 (rendimiento teórico vs real, controlando contra el umbral global del 5%).
- **Fuente de verdad:** Ver detalles arquitectónicos actualizados directamente en [CLAUDE.md](file:///home/gsm/Documents/workspace/ayr/frontend-ayr-nextjs/CLAUDE.md) (v6.6).

---

## 2. Decisiones de Diseño Lockeadas (NO Revertir)

- **Densidad Centralizada:** La densidad se define como **un valor único por acabado** en `coil_finishes`, y el SKU terminado la hereda vía lookup.
  - $\delta$ Galvanizado / Drywall: `0.00785` (kg/mm²·m)
  - $\delta$ Aluzinc (natural/colores): `0.008` (kg/mm²·m)
  - *Regla de Oro:* El proceso de conformado no modifica la densidad física; se utiliza idéntico factor tanto para consumos como para cálculos de ventas. (Evitar reintroducir la lógica de "dos factores").
- **Atributos de Bobina (Color):** El color del SKU terminado es equivalente al acabado de la bobina consumida.
  - Los acabados/colores se gestionan de forma centralizada en la colección de acabados.
  - El selector de color de SKU lee dinámicamente de `coil_finishes`.
  - El formulario tolera campos legacy para no romper la edición de registros antiguos.
- **Modelo de Materiales:**
  - **Bobina:** Representa un documento individual único en la colección `coils`.
  - **Slitting (Corte de flejes):** Divide la bobina madre por **ancho** (masterWidth). El peso de los flejes resultantes se calcula de forma proporcional y heredan el `pricePerKg` de la bobina de origen.
  - **Catálogo:** Se eliminó la familia `BOBINA` del catálogo de productos. Si se vende material crudo, se utiliza la propiedad `isCoil: true` de la bobina.
- **Flexibilidad Operativa:** Se permite peso y stock negativo en consumo y venta (dispara advertencia/warning en UI sin bloquear).
- **Finanzas:** Todo costo se almacena en Soles (PEN). Las transacciones en dólares (USD) se convierten utilizando el tipo de cambio (TC) real al momento del registro.

---

## 3. Pendientes Operativos (Ejecutar en Orden, Dry-Run Primero)

1. **Correr Migraciones Pendientes:**
   - Habilitar e inyectar factores en `migrateFinishDensityFactors`.
   - Ejecutar script `migrate-cobertura-metadata` para alinear estructura.
   - Correr script `fix-density-factor-natural` para el acabado natural de aluzinc.
2. **Sembrado de Acabados de Color:**
   - Asegurar la presencia de al menos 5 acabados base en Firestore (AZUL, BLANCO, NATURAL, ROJO, VERDE) con sus líneas asignadas.
3. **Saneo de SKUs en Producción (`fix_skus_prod.ts`):**
   - *Nota:* La base de pruebas en el tenant `ayrsteel-test` ya está limpia, pero PRODUCCIÓN requiere saneo.
   - **Flujo:** Correr con `--dry-run` usando credenciales de prod $\rightarrow$ validar $\rightarrow$ aplicar con `--apply`.
   - **Acción sobre SKUs erróneos:**
     - SKUs erróneamente clasificados como familia `BOBINA` con ventas asociadas: **NO anular**, reclasificar al tipo correcto.
     - Corregir typo en `COB030ROJO` (ej. typo `RRR` $\rightarrow$ `ROJO`).
     - Marcar `COB035GALV` como `VOIDED`.
4. **Validación del Flujo Completo:**
   - Importar SKUs reales, registrar las primeras producciones de cobertura y corroborar que el reporte de ganancia se comporte según la progresión esperada.
5. **Backtest Histórico:**
   - Cargar y validar marzo (~44.7 TM consumidas, ~S/.148k valorizado, rango de precio/kg: `3.2` a `3.6`).

---

## 4. Deuda Técnica Prioritaria (Sprint 7 & Futuro)

- **Seguridad en DB (Crítico - Sprint 7):** Cerrar la colección Firestore en `firestore.rules` (actualmente abierta a escrituras públicas). Delegar escrituras críticas a Cloud Functions (`splitCoilAction`, `produceFromCoils`, `registerCoilScrap`, registro de ventas).
- **Línea ACCESORIO $\rightarrow$ Trading:** Migración transversal de documentos y stocks de accesorios desde la línea de aluzinc/roofing hacia el módulo `trading`.
- **Tipo de Cambio Manual:** Implementar la opción de fijar tipo de cambio manual en ventas en USD para los casos donde la API de SUNAT falle o retorne datos sin TC (ej: incidencias en comprobantes históricos como `FFA1-912/913/933`).
- **Control de Tolerancia P-M9:** Extender el umbral del 5% del rendimiento (teórico vs real) para que sea configurable por tipo de perfil (actualmente es un valor global).
- **Exportación de Reportes:** Habilitar la exportación a formato PDF (actualmente limitado a XLSX/CSV).

---

## 5. Convenciones del Proyecto

- **Strict TypeScript:** Cero (`0`) declaraciones `any` nuevas.
- **Idioma del Código:** Variables, nombres de funciones y base de datos en **inglés**; interfaz de usuario, mensajes de error y datos operacionales en **español**.
- **Diseño Modular:** Uso estricto del patrón **Strategy** para evitar branching `if/else` condicionado por líneas de negocio.
- **Acceso a Firestore:** Todas las operaciones de escritura en transacciones deben ir después de las lecturas (`runTransaction` lee antes de escribir).
- **Integridad de Datos:** Prohibido el borrado físico de registros de negocio. Utilizar estados como `VOIDED` / `ANULADA` y registrar log en `audit_logs`.
- **Valores Financieros:** Costo unitario en soles y control exacto de consumos en kilogramos.
- **Modo Operativo:** *Caveman mode* activo (paso a paso, cambios incrementales limpios y seguros).

---

## 6. Skills Recomendadas

- **`grill-me`:** Utilizar para realizar un *stress-test* del plan de migración de la línea ACCESORIO antes de iniciar la escritura de código.
- **`diagnose`:** Para diagnosticar inconsistencias durante el saneamiento de SKUs en producción.
- **`tdd`:** Diseñar las nuevas Cloud Functions del Sprint 7 utilizando testing de integración.
