import { UserRole } from '../models/auth.model';

/**
 * Quién puede dar de alta a quién (RN-16, RF-04.1/RF-04.2). Espeja la matriz del Auth MS
 * (`CAN_CREATE`): el `Owner` crea `Admin` y `Employee`; el `Admin` solo `Employee` (nunca un par
 * ni un `Owner`); el `Employee` no crea a nadie. Es UX: el servidor vuelve a validarlo siempre.
 */
const CREATABLE_ROLES: Record<UserRole, readonly UserRole[]> = {
  Owner: ['Admin', 'Employee'],
  Admin: ['Employee'],
  Employee: [],
};

/** Roles que el usuario con `role` puede asignar al crear una cuenta. */
export function creatableRoles(role: UserRole | null | undefined): readonly UserRole[] {
  return role ? CREATABLE_ROLES[role] : [];
}

/** `true` si el rol puede dar de alta usuarios (y por lo tanto ve el botón "Crear usuario"). */
export function canCreateUsers(role: UserRole | null | undefined): boolean {
  return creatableRoles(role).length > 0;
}
