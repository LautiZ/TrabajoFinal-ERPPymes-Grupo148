import { SetMetadata } from '@nestjs/common';
import type { Role } from '@app/contracts';

export const ROLES_KEY = 'roles';

// Restricts a route to the given roles. Without it, any authenticated user passes.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
