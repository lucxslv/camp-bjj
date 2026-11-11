import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompetitionsModule } from './competitions/competitions.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { AuditModule } from './audit/audit.module';
import { WeighInsModule } from './weigh-ins/weigh-ins.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CompetitionsModule,
    RegistrationsModule,
    AuditModule,
    WeighInsModule,
  ],
})
export class AppModule {}