import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Must run after configureApp so the 'api' global prefix is already in the paths
export const setupSwagger = (app: INestApplication): void => {
  const config = new DocumentBuilder()
    .setTitle('ERP Pymes API')
    .setVersion('1.0')
    .addBearerAuth()
    // Mirrors the global AuthGuard: every route needs a token unless it is @Public
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Served at /api/docs (UI) and /api/docs-json (OpenAPI spec for the front)
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    swaggerOptions: { persistAuthorization: true },
  });
};
