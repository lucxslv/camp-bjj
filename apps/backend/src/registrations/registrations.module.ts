import { Module } from '@nestjs/common';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';
import { StateMachineService } from './state-machine.service';
import { RegistrationSnapshotService } from './snapshot.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CompetitionsModule } from '../competitions/competitions.module';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, CompetitionsModule, AuditModule, UsersModule],
  controllers: [RegistrationsController],
  providers: [RegistrationsService, StateMachineService, RegistrationSnapshotService],
  exports: [RegistrationsService, StateMachineService, RegistrationSnapshotService],
})
export class RegistrationsModule {}