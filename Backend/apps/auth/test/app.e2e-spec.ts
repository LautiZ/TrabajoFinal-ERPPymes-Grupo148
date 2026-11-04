import { INestMicroservice } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { firstValueFrom } from 'rxjs';
import { AUTH_PATTERNS } from '@app/contracts';
import { AuthModule } from './../src/auth.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { UsersRepository } from './../src/users/users.repository';

const TEST_PORT = 4001;
const tcpOptions = { host: '127.0.0.1', port: TEST_PORT };

describe('Auth microservice (e2e)', () => {
  let app: INestMicroservice;
  let client: ClientProxy;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    })
      // No database: PrismaService and the repository are replaced
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(UsersRepository)
      .useValue({ count: jest.fn().mockResolvedValue(7) })
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

  it('answers the users count pattern over TCP', async () => {
    await expect(
      firstValueFrom(client.send<number>(AUTH_PATTERNS.COUNT_USERS, {})),
    ).resolves.toBe(7);
  });
});
