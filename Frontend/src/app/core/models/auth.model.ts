/** Roles del sistema (RN-16). Cada usuario tiene exactamente uno. */
export type UserRole = 'Owner' | 'Admin' | 'Employee';

export const USER_ROLES: readonly UserRole[] = ['Owner', 'Admin', 'Employee'];

export const ROLE_LABELS: Record<UserRole, string> = {
  Owner: 'Propietario',
  Admin: 'Administrador',
  Employee: 'Empleado',
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** El registro público es solo de arranque: crea al `Owner` mientras no exista uno (RN-16.4). */
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  surname?: string;
}

/** Claims del JWT que usa el cliente. Solo sirven para la UX: el Gateway valida la firma. */
export interface JwtPayload {
  /** Id del usuario. */
  sub: string;
  role: UserRole;
  /** Vencimiento, en segundos desde epoch. */
  exp: number;
  iat?: number;
  /** Id de la sesión en el servidor (permite revocarla). */
  jti?: string;
  email?: string;
  name?: string;
}

/** Por qué terminó la sesión: cierre voluntario, vencimiento del token o rechazo del servidor (401). */
export type SessionEndReason = 'logout' | 'expired' | 'unauthorized';
