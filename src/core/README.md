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
