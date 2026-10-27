import { NestFactory } from '@nestjs/core';
import { ErpModule } from './erp.module';
import { envs } from './config/envs';

async function bootstrap() {
  const app = await NestFactory.create(ErpModule);
  app.enableShutdownHooks();
  await app.listen(envs.PORT);
}
void bootstrap();
