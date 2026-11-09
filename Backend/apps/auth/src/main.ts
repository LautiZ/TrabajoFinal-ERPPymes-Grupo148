import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AuthModule } from './auth.module';
import { envs } from './config/envs';
import { createRpcValidationPipe } from '@app/contracts';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AuthModule,
    {
      transport: Transport.TCP,
      options: { host: envs.HOST, port: envs.PORT },
    },
  );
  app.useGlobalPipes(createRpcValidationPipe());
  app.enableShutdownHooks();
  await app.listen();
}
void bootstrap();
