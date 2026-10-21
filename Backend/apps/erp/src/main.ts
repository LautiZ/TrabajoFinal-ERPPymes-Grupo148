import { NestFactory } from '@nestjs/core';
import { ErpModule } from './erp.module';
import { envs } from './config/envs';

async function bootstrap() {
  const app = await NestFactory.create(ErpModule);
  await app.listen(envs.PORT);
}
void bootstrap();
