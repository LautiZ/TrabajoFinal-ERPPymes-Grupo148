import type { Role } from './roles';

export interface AuthUser {
  userId: string;
  role: Role;
  jti: string;
}
