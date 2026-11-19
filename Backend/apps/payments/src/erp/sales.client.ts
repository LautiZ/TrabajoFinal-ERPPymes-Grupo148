import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { ERP_PATTERNS, ERP_SERVICE } from '@app/contracts';
import type { SaleIdMessage, SaleView } from '@app/contracts';
import { rpcError } from '../common/rpc-error';

export const ERP_TIMEOUT_MS = 3000;

// An error answered by the ERP arrives as the plain { status, message } object
const isRpcPayload = (err: unknown): err is { status: number } =>
  typeof err === 'object' &&
  err !== null &&
  typeof (err as { status?: unknown }).status === 'number';

// Port to the ERP MS: Payments reads sales from it, never from its database
@Injectable()
export class SalesClient {
  constructor(@Inject(ERP_SERVICE) private readonly client: ClientProxy) {}

  getSale(id: string): Promise<SaleView> {
    return this.send(ERP_PATTERNS.GET_SALE, id);
  }

  // Ordered -> Paid. Safe to repeat: an already Paid sale is answered as is
  markPaid(id: string): Promise<SaleView> {
    return this.send(ERP_PATTERNS.MARK_SALE_PAID, id);
  }

  // Ordered -> Cancelled with stock returned. Safe to repeat; a sale in any
  // other state (e.g. paid by another attempt) comes back unchanged
  cancelSale(id: string): Promise<SaleView> {
    return this.send(ERP_PATTERNS.CANCEL_SALE, id);
  }

  private async send(pattern: string, id: string): Promise<SaleView> {
    try {
      return await firstValueFrom(
        this.client
          .send<SaleView, SaleIdMessage>(pattern, { id })
          .pipe(timeout(ERP_TIMEOUT_MS)),
      );
    } catch (err) {
      // Rethrown as RpcException so the gateway keeps the ERP status (e.g. 404)
      if (isRpcPayload(err)) throw new RpcException(err);
      // Timeout or connection refused: the ERP is down, not the request wrong
      throw rpcError(503, 'ERP service unavailable');
    }
  }
}
