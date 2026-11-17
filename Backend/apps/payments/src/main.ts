import { NestFactory } from '@nestjs/core';
import { PaymentsModule } from './payments.module';
import { envs } from './config/envs';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { createRpcValidationPipe } from '@app/contracts';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    PaymentsModule,
    {
      transport: Transport.TCP,
      options: { host: envs.HOST, port: envs.PORT },
    },
  );
  // Without it, a bad payload reaches the service and ends as a 500
  app.useGlobalPipes(createRpcValidationPipe());
  app.enableShutdownHooks();
  await app.listen();
}
void bootstrap();
