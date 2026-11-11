import { INestApplication } from '@nestjs/common';

export let app: INestApplication;

beforeAll(() => {
  // Global test setup
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});