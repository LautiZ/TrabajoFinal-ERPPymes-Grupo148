import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { envs } from './config/envs';
import { configureApp } from './config/configure-app';
import { setupSwagger } from './config/setup-swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  if (envs.SWAGGER_ENABLED) setupSwagger(app);
  await app.listen(envs.PORT);
}
void bootstrap();
