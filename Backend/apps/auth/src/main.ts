import { NestFactory } from '@nestjs/core';
import { AuthModule } from './auth.module';
import { envs } from './config/envs';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  await app.listen(envs.PORT);
}
bootstrap();
