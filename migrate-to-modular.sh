#!/bin/bash

# migrate-to-modular.sh
# Script para migrar el código actual a la estructura modular
# Uso: bash migrate-to-modular.sh

set -e  # Exit on error

echo "🚀 Iniciando migración a arquitectura modular..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que estamos en la raíz del proyecto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Ejecuta este script desde la raíz del proyecto (donde está package.json)${NC}"
    exit 1
fi

# Crear estructura base
echo -e "${YELLOW}📁 Creando estructura modular...${NC}"
mkdir -p src/core
mkdir -p src/domain/steel
mkdir -p src/modules/drywall/components
mkdir -p src/modules/drywall/services
mkdir -p src/modules/drywall/domain
mkdir -p src/modules/drywall/hooks
mkdir -p src/modules/drywall/routes

echo -e "${GREEN}✅ Estructura base creada${NC}"
echo ""

# Crear README en cada carpeta
echo -e "${YELLOW}📝 Creando README en cada carpeta...${NC}"

cat > src/core/README.md << 'EOF'
# Core — Módulos compartidos

Código que usan **todas** las líneas de negocio:
- Auth (AuthContext, guards, custom claims)
- CRM (clientes, contactos)
- Audit (audit_logs)
- Settings (configuración global)
- Users (gestión de usuarios)
- Kardex (motor genérico de movimientos)
- Reports (framework de reportes)
- Dashboard (vista ejecutiva)

⚠️ **Regla:** NO pongas lógica específica de drywall aquí.
EOF

cat > src/domain/README.md << 'EOF'
# Domain — Lógica pura

Código de dominio **sin dependencias de Firebase ni librerías externas**.
100% testeable con tests unitarios puros.

Ejemplos:
- `steel/constants.ts` — constantes físicas y de negocio
- `steel/density.ts` — fórmula de densidad siderúrgica
- `pricing/igv.ts` — cálculo de IGV
- `shared/Result.ts` — tipo Result<T, E> para manejo de errores

✅ Todo aquí debe tener su `.test.ts` correspondiente.
EOF

cat > src/modules/drywall/README.md << 'EOF'
# Módulo: Drywall (Perfilería)

Línea de negocio: Producción de perfiles para drywall (Parantes, Rieles, Omega).

**Proceso:**
1. Compra de bobina madre (steel coil)
2. Plan de corte (slitter) → define flejes
3. Conformado (roll forming) → flejes → perfiles
4. Inventario y venta

**Estructura:**
- `components/` — UI específica de drywall
- `services/` — acceso a Firebase (productionService, cuttingPlanService)
- `domain/` — lógica pura (slitter, costing, validation)
- `hooks/` — custom hooks (useCoils, useProductionLogs)
- `routes/` — páginas en /admin/drywall/*
- `types.ts` — tipos específicos de drywall

⚠️ Si algo es compartido con otras líneas → muévelo a `core/`
EOF

echo -e "${GREEN}✅ READMEs creados${NC}"
echo ""

# Copiar constants.ts si existe el archivo adjunto
if [ -f "domain-steel-constants.ts" ]; then
    echo -e "${YELLOW}📦 Copiando domain/steel/constants.ts...${NC}"
    cp domain-steel-constants.ts src/domain/steel/constants.ts
    echo -e "${GREEN}✅ constants.ts copiado${NC}"
else
    echo -e "${YELLOW}⚠️  domain-steel-constants.ts no encontrado, salta este paso${NC}"
fi

# Copiar test setup si existe
if [ -f "src-test-setup.ts" ]; then
    echo -e "${YELLOW}📦 Copiando src/test/setup.ts...${NC}"
    mkdir -p src/test
    cp src-test-setup.ts src/test/setup.ts
    echo -e "${GREEN}✅ Test setup copiado${NC}"
else
    echo -e "${YELLOW}⚠️  src-test-setup.ts no encontrado, salta este paso${NC}"
fi

# Copiar vitest config
if [ -f "vitest.config.ts" ]; then
    echo -e "${YELLOW}📦 Copiando vitest.config.ts...${NC}"
    cp vitest.config.ts ./vitest.config.ts
    echo -e "${GREEN}✅ vitest.config.ts copiado${NC}"
else
    echo -e "${YELLOW}⚠️  vitest.config.ts no encontrado, salta este paso${NC}"
fi

# Copiar CLAUDE.md
if [ -f "CLAUDE.md" ]; then
    echo -e "${YELLOW}📦 Copiando CLAUDE.md...${NC}"
    cp CLAUDE.md ./CLAUDE.md
    echo -e "${GREEN}✅ CLAUDE.md copiado a raíz${NC}"
else
    echo -e "${YELLOW}⚠️  CLAUDE.md no encontrado, salta este paso${NC}"
fi

# Copiar .cursorrules
if [ -f ".cursorrules" ]; then
    echo -e "${YELLOW}📦 Copiando .cursorrules...${NC}"
    cp .cursorrules ./.cursorrules
    echo -e "${GREEN}✅ .cursorrules copiado a raíz${NC}"
else
    echo -e "${YELLOW}⚠️  .cursorrules no encontrado, salta este paso${NC}"
fi

echo ""
echo -e "${GREEN}✨ Migración de archivos base completada${NC}"
echo ""
echo -e "${YELLOW}📋 PRÓXIMOS PASOS MANUALES:${NC}"
echo ""
echo "1. Instalar dependencias de testing:"
echo "   npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom"
echo ""
echo "2. Actualizar package.json con scripts de test:"
echo '   "test": "vitest",'
echo '   "test:ui": "vitest --ui",'
echo '   "test:coverage": "vitest run --coverage"'
echo ""
echo "3. Mover código de drywall a modules/drywall/ (usar Claude Code):"
echo "   claude-code task \"Mueve components/forms, components/production, components/inventory"
echo "   y services/productionService, cuttingPlanService a modules/drywall/ sin cambiar lógica\""
echo ""
echo "4. Reemplazar magic numbers con constantes:"
echo "   claude-code task \"Reemplaza 7.85, 1.05, 40, 0.85, 3.0, 0.18 en src/services/"
echo "   con constantes de domain/steel/constants.ts\""
echo ""
echo "5. Correr tests:"
echo "   npm run test"
echo ""
echo "6. Continuar con firestore.rules según ROADMAP-SPRINTS-0-1-2.md"
echo ""
echo -e "${GREEN}🎉 ¡Listo para empezar Sprint 0!${NC}"
