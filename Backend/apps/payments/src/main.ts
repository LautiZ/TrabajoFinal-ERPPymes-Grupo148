import { NestFactory } from '@nestjs/core';
import { PaymentsModule } from './payments.module';
import { envs } from './config/envs';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    PaymentsModule,
    {
      transport: Transport.TCP,
      options: { host: envs.HOST, port: envs.PORT },
    },
  );
  app.enableShutdownHooks();
  await app.listen();
}
void bootstrap();
