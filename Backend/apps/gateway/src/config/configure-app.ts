import { INestApplication, ValidationPipe } from '@nestjs/common';
import { envs } from './envs';

// Shared by main.ts and the e2e tests so both run the same HTTP pipeline
export const configureApp = (app: INestApplication): void => {
  // health stays at the root so the Docker healthcheck keeps working
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableCors({ origin: envs.CORS_ORIGINS });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
};
