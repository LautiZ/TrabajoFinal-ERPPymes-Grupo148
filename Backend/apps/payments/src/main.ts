import { NestFactory } from '@nestjs/core';
import { PaymentsModule } from './payments.module';
import { envs } from './config/envs';

async function bootstrap() {
  const app = await NestFactory.create(PaymentsModule);
  await app.listen(envs.PORT);
}
void bootstrap();
