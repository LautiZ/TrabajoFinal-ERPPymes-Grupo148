import { UserRole } from '../../../core/models/auth.model';

/**
 * Roles que pueden crear y editar productos. Según las reglas de negocio (RN-16.3), dentro del
 * ERP MS todos los roles autenticados operan el catálogo sin restricciones.
 */
export const INVENTORY_WRITE_ROLES: readonly UserRole[] = ['Owner', 'Admin', 'Employee'];
