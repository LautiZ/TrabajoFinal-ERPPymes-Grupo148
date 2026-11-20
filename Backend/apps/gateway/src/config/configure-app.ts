import { INestApplication, ValidationPipe } from '@nestjs/common';
import { envs } from './envs';

// Shared by main.ts and the e2e tests so both run the same HTTP pipeline
export const configureApp = (app: INestApplication): void => {
  // Behind nginx every request comes from the proxy's IP: without this, the
  // login rate limit (keyed by req.ip) would put every client in one bucket
  if (envs.TRUST_PROXY_HOPS > 0) {
    const express = app.getHttpAdapter().getInstance() as {
      set(setting: string, value: unknown): void;
    };
    express.set('trust proxy', envs.TRUST_PROXY_HOPS);
  }
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
