import { Reflector } from '@nestjs/core';
import type { Role } from '@app/contracts';
import { ROLES_KEY } from '../auth/roles.decorator';
import { PaymentsController } from './payments.controller';

// Same lookup RolesGuard does: handler metadata wins over class metadata
const rolesOf = (handler: keyof PaymentsController) =>
  new Reflector().getAllAndOverride<Role[]>(ROLES_KEY, [
    // eslint-disable-next-line @typescript-eslint/unbound-method -- only read as a metadata key, never called
    PaymentsController.prototype[handler],
    PaymentsController,
  ]);

describe('PaymentsController roles (RN-16.3)', () => {
  it('lets every role open the checkout of a sale', () => {
    expect(rolesOf('create')).toEqual(['Owner', 'Admin', 'Employee']);
  });

  it('keeps any other payments route for Owner and Admin by default', () => {
    expect(new Reflector().get<Role[]>(ROLES_KEY, PaymentsController)).toEqual([
      'Owner',
      'Admin',
    ]);
  });
});
