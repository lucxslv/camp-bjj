import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'v1');
  app.setGlobalPrefix(apiPrefix);

  // CORS
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3001');
  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      errorHttpStatusCode: 422,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global transform interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger/OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Camp BJJ API')
    .setDescription(`
      **BJJ Competition Management Platform API**

      ## Authentication
      All private endpoints require a Supabase JWT token in the \`Authorization: Bearer <token>\` header.
      The token is obtained via Supabase Auth on the frontend.

      ## Error Format
      All errors follow a consistent format:
      \`\`\`json
      {
        "statusCode": 409,
        "code": "STATE_CONFLICT",
        "message": "Registration was modified by another operation. Please retry.",
        "details": { "path": "/v1/registrations/abc/approve", "method": "POST" }
      }
      \`\`\`

      ## Common Error Codes
      | Code | HTTP | Description |
      |------|------|-------------|
      | VALIDATION_ERROR | 400 | Invalid DTO/schema |
      | UNAUTHENTICATED | 401 | Missing/invalid/expired token |
      | FORBIDDEN | 403 | Authenticated but insufficient permissions |
      | NOT_FOUND | 404 | Resource not found or not accessible |
      | STATE_CONFLICT | 409 | Concurrency conflict / duplicate |
      | BUSINESS_RULE_VIOLATION | 422 | Business rule failed (deadline, eligibility, consent) |
      | RATE_LIMITED | 429 | Too many requests |
      | INTERNAL_ERROR | 500 | Unexpected error (no stack trace) |

      ## Rate Limiting
      Auth endpoints: 10 req/min | Other endpoints: 100 req/min
    `)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Supabase JWT access token',
        in: 'header',
      },
      'access-token',
    )
    .addTag('health', 'Health check endpoints')
    .addTag('auth', 'Authentication & profile endpoints')
    .addTag('competitions', 'Competition management (public + organizer)')
    .addTag('registrations', 'Registration management (athlete + professor + organizer)')
    .addTag('weigh-ins', 'Weigh-in operations (professor)')
    .addTag('files', 'Private file upload/download via signed URLs')
    .addTag('consents', 'Guardian consent management')
    .addServer('http://localhost:3000', 'Local development')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    extraModels: [
      // DTOs for proper schema generation
    ],
    operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
  });
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
    },
    customSiteTitle: 'Camp BJJ API Docs',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1a1a2e }
      .swagger-ui .scheme-container { background: #f8f9fa; padding: 10px; border-radius: 4px }
    `,
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/docs`);
  console.log(`📄 OpenAPI JSON: http://localhost:${port}/docs-json`);
}

bootstrap();