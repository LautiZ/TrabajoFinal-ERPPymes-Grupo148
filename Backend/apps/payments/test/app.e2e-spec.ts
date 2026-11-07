import { INestMicroservice } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { PAYMENTS_PATTERNS } from '@app/contracts';
import { PaymentsModule } from './../src/payments.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { PaymentsRepository } from './../src/payments/payments.repository';

const TEST_PORT = 4003;
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
      .useValue({ count: jest.fn().mockResolvedValue(3) })
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
});
