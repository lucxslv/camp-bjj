import { Module } from '@nestjs/common';
import { WeighInsController } from './weigh-ins.controller';
import { WeighInsService } from './weigh-ins.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { CompetitionsModule } from '../competitions/competitions.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, RegistrationsModule, CompetitionsModule, UsersModule],
  controllers: [WeighInsController],
  providers: [WeighInsService],
  exports: [WeighInsService],
})
export class WeighInsModule {}