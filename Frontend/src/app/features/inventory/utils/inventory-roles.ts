/**
 * Roles que pueden crear y editar productos. Según las reglas de negocio, dentro del ERP MS
 * todos los roles autenticados (Owner, Admin y Employee) operan el catálogo; `VENDEDOR` es el
 * nombre con el que el guard de rutas actual identifica al empleado.
 */
export const INVENTORY_WRITE_ROLES: readonly string[] = ['OWNER', 'ADMIN', 'EMPLOYEE', 'VENDEDOR'];
