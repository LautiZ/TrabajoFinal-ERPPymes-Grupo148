import { Reflector } from '@nestjs/core';
import type { Role } from '@app/contracts';
import { ROLES_KEY } from '../auth/roles.decorator';
import { AnalyticsController } from './analytics.controller';

describe('AnalyticsController roles', () => {
  // Same lookup RolesGuard does: handler metadata wins over class metadata
  it.each([
    'summary',
    'salesOverTime',
    'topProducts',
    'inventoryValue',
  ] as const)('keeps %s for Owner and Admin only', (handler) => {
    expect(
      new Reflector().getAllAndOverride<Role[]>(ROLES_KEY, [
        // eslint-disable-next-line @typescript-eslint/unbound-method -- only read as a metadata key, never called
        AnalyticsController.prototype[handler],
        AnalyticsController,
      ]),
    ).toEqual(['Owner', 'Admin']);
  });
});
