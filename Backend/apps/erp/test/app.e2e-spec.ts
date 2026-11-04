import { INestMicroservice } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { ERP_PATTERNS } from '@app/contracts';
import { ErpModule } from './../src/erp.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { ProductsRepository } from './../src/products/products.repository';

const TEST_PORT = 4002;
const tcpOptions = { host: '127.0.0.1', port: TEST_PORT };

describe('ERP microservice (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ErpModule],
    })
      // No database: PrismaService and the repository are replaced
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ProductsRepository)
      .useValue({ count: jest.fn().mockResolvedValue(12) })
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

  it('answers the products count pattern over TCP', async () => {
    await expect(
      firstValueFrom(client.send<number>(ERP_PATTERNS.COUNT_PRODUCTS, {})),
    ).resolves.toBe(12);
  });
});
