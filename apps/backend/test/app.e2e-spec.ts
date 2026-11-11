import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

// Set environment variables before importing modules
process.env['API_PREFIX'] = 'v1';
process.env['PORT'] = '3000';
process.env['CORS_ORIGIN'] = 'http://localhost:3001';
process.env['JWT_SECRET'] = 'test-secret';
process.env['SUPABASE_JWT_SECRET'] = 'test-supabase-secret';

const mockPrismaService = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  cleanDatabase: jest.fn().mockResolvedValue(undefined),
};

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as main.ts
    const apiPrefix = 'v1';
    app.setGlobalPrefix(apiPrefix);
    app.enableCors({
      origin: 'http://localhost:3001',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: true,
    });
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
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect((res: request.Response) => {
        // TransformInterceptor wraps response in { data, timestamp, path }
        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('status', 'ok');
        expect(res.body.data).toHaveProperty('timestamp');
        expect(res.body.data).toHaveProperty('uptime');
      });
  });
});