import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { TCP_TIMEOUT_MS } from './config/tcp';
import {
  AUTH_PATTERNS,
  AUTH_SERVICE,
  ERP_PATTERNS,
  ERP_SERVICE,
  PAYMENTS_PATTERNS,
  PAYMENTS_SERVICE,
} from '@app/contracts';

export type ServiceStatus = 'up' | 'down';

export interface ServicesHealth {
  auth: ServiceStatus;
  erp: ServiceStatus;
  payments: ServiceStatus;
}

@Injectable()
export class AppService {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authClient: ClientProxy,
    @Inject(ERP_SERVICE) private readonly erpClient: ClientProxy,
    @Inject(PAYMENTS_SERVICE) private readonly paymentsClient: ClientProxy,
  ) {}

  async checkServices(): Promise<ServicesHealth> {
    const [auth, erp, payments] = await Promise.all([
      this.ping(this.authClient, AUTH_PATTERNS.COUNT_USERS),
      this.ping(this.erpClient, ERP_PATTERNS.COUNT_PRODUCTS),
      this.ping(this.paymentsClient, PAYMENTS_PATTERNS.COUNT_PAYMENTS),
    ]);
    return { auth, erp, payments };
  }

  private async ping(
    client: ClientProxy,
    pattern: string,
  ): Promise<ServiceStatus> {
    try {
      await firstValueFrom(
        client.send<number>(pattern, {}).pipe(timeout(TCP_TIMEOUT_MS)),
      );
      return 'up';
    } catch {
      return 'down';
    }
  }
}
