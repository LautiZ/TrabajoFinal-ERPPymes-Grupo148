import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { PAYMENTS_PATTERNS } from '@app/contracts';
import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { ROLES_KEY } from '../auth/roles.decorator';
import { PaymentsWebhookController } from './payments-webhook.controller';

describe('PaymentsWebhookController', () => {
  const send = jest.fn();
  const controller = new PaymentsWebhookController({
    send,
  } as unknown as ClientProxy);

  beforeEach(() => {
    send.mockReset();
    send.mockReturnValue(of(undefined));
  });

  // Mercado Pago calls it without a session: AuthGuard and RolesGuard must let it in
  it('is public and requires no role', () => {
    const reflector = new Reflector();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- only read as a metadata key, never called
    const handler = PaymentsWebhookController.prototype.handle;
    expect(reflector.get<boolean>(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(
      reflector.getAllAndOverride(ROLES_KEY, [
        handler,
        PaymentsWebhookController,
      ]),
    ).toBeUndefined();
  });

  it('forwards the query params and the signature headers', async () => {
    await controller.handle('order', 'ORD01', 'ts=1,v1=abc', 'req-1', {});

    expect(send).toHaveBeenCalledWith(PAYMENTS_PATTERNS.HANDLE_NOTIFICATION, {
      type: 'order',
      dataId: 'ORD01',
      signedDataId: 'ORD01',
      xSignature: 'ts=1,v1=abc',
      xRequestId: 'req-1',
    });
  });

  it('falls back to the body when the query params are missing', async () => {
    await controller.handle(undefined, undefined, undefined, undefined, {
      type: 'order',
      data: { id: 'ORD02' },
    });

    expect(send).toHaveBeenCalledWith(PAYMENTS_PATTERNS.HANDLE_NOTIFICATION, {
      type: 'order',
      dataId: 'ORD02',
      // The body id is used to find the order, never to check the signature
      signedDataId: undefined,
      xSignature: undefined,
      xRequestId: undefined,
    });
  });

  it('drops values that are not strings', async () => {
    await controller.handle(['order', 'x'], { id: 1 }, undefined, undefined, {
      data: { id: 42 },
    });

    expect(send.mock.calls[0][1]).toMatchObject({
      type: undefined,
      dataId: undefined,
    });
  });
});
