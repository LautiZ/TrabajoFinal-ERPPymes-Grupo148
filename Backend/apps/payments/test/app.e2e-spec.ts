import { INestMicroservice } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { PAYMENTS_PATTERNS } from '@app/contracts';
import { SalesClient } from './../src/erp/sales.client';
import { MercadoPagoClient } from './../src/mercadopago/mercadopago.client';
import { PaymentsModule } from './../src/payments.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { PaymentsRepository } from './../src/payments/payments.repository';

const TEST_PORT = 4003;
const mercadoPago = {
  isAuthenticNotification: jest.fn(),
  getOrder: jest.fn(),
  createCheckout: jest.fn(),
};
const sales = {
  getSale: jest.fn(),
  markPaid: jest.fn(),
  cancelSale: jest.fn(),
};
const repository = {
  count: jest.fn().mockResolvedValue(3),
  findCurrentBySale: jest.fn(),
  findByOrderId: jest.fn(),
};

const tcpOptions = { host: '127.0.0.1', port: TEST_PORT };

describe('Payments microservice (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PaymentsModule],
    })
      // No database: PrismaService and the repository are replaced
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(PaymentsRepository)
      .useValue(repository)
      // Neither the ERP nor Mercado Pago is ever reached
      .overrideProvider(SalesClient)
      .useValue(sales)
      .overrideProvider(MercadoPagoClient)
      .useValue(mercadoPago)
      .compile();

    app = moduleRef.createNestMicroservice({
      transport: Transport.TCP,
      options: tcpOptions,
    });
    await app.listen();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: tcpOptions,
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  it('answers the payments count pattern over TCP', async () => {
    await expect(
      firstValueFrom(client.send<number>(PAYMENTS_PATTERNS.COUNT_PAYMENTS, {})),
    ).resolves.toBe(3);
  });

  it('answers 404 through TCP when the sale has no payment', async () => {
    repository.findCurrentBySale.mockResolvedValue(null);

    await expect(
      firstValueFrom(
        client.send(PAYMENTS_PATTERNS.GET_SALE_PAYMENT, { saleId: 'sale-1' }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('rejects a notification with an invalid signature over TCP', async () => {
    mercadoPago.isAuthenticNotification.mockReturnValue(false);

    await expect(
      firstValueFrom(
        client.send(PAYMENTS_PATTERNS.HANDLE_NOTIFICATION, {
          type: 'order',
          dataId: 'ORD01',
          xSignature: 'ts=1,v1=bad',
          xRequestId: 'req-1',
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
    expect(mercadoPago.getOrder).not.toHaveBeenCalled();
  });
});
