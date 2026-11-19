import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SalesService } from './sales.service';

export const SALE_EXPIRATION_OPTIONS = Symbol('SALE_EXPIRATION_OPTIONS');

export interface SaleExpirationOptions {
  // Same SALE_PAYMENT_WINDOW_MINUTES as Payments (shared in docker-compose)
  paymentWindowMinutes: number;
  intervalMs: number;
}

// Room for a payment notification that arrives late (Mercado Pago retries
// with backoff, or the gateway was briefly down). A webhook later than this
// finds the sale cancelled and is logged as a refund to make.
export const EXPIRATION_MARGIN_MINUTES = 30;

/**
 * Cancels Ordered sales nobody can pay anymore and returns their stock
 * (TES-75). A payment can be opened up to 1 window after the sale, and its
 * Mercado Pago order expires 1 window later, so after 2 windows (plus a
 * margin) no open checkout can still be paid. The age is measured with the
 * database clock, the same one that stamped created_at.
 */
@Injectable()
export class SaleExpirationJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SaleExpirationJob.name);
  private timer?: NodeJS.Timeout;
  private current?: Promise<number>;

  constructor(
    private readonly salesService: SalesService,
    @Inject(SALE_EXPIRATION_OPTIONS)
    private readonly options: SaleExpirationOptions,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.run(), this.options.intervalMs);
    // Never keeps the process (or jest) alive on its own
    this.timer.unref();
  }

  // Lets a run in progress finish before Prisma disconnects
  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.current;
  }

  run(): Promise<number> {
    // A slow run must not overlap with the next tick
    if (this.current) return Promise.resolve(0);
    this.current = this.cancelExpired().finally(() => {
      this.current = undefined;
    });
    return this.current;
  }

  private async cancelExpired(): Promise<number> {
    try {
      const cancelled = await this.salesService.cancelExpired(
        2 * this.options.paymentWindowMinutes + EXPIRATION_MARGIN_MINUTES,
      );
      if (cancelled > 0) {
        this.logger.log(
          `Cancelled ${cancelled} unpaid sale(s) past their payment window`,
        );
      }
      return cancelled;
    } catch (err) {
      this.logger.error(`Expiration run failed: ${String(err)}`);
      return 0;
    }
  }
}
