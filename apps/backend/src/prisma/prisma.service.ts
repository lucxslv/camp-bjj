import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async cleanDatabase(): Promise<void> {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }
    const models = Reflect.ownKeys(this).filter(
      (key): key is string => typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'),
    );
    for (const model of models) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const modelDelegate = (this as any)[model];
      if (typeof modelDelegate?.deleteMany === 'function') {
        await modelDelegate.deleteMany();
      }
    }
  }
}